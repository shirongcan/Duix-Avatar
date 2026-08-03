import { ipcMain } from 'electron'
import crypto from 'crypto'
import path from 'path'
import fs from 'fs'
import { isEmpty } from 'lodash'
import { assetPath } from '../config/config.js'
import { selectPage,selectByStatus, updateStatus, remove as deleteVideo, findFirstByStatus } from '../dao/video.js'
import { selectByID as selectF2FModelByID } from '../dao/f2f-model.js'
import { selectByID as selectVoiceByID } from '../dao/voice.js'
import {
  insert as insertVideo,
  count,
  update,
  selectByID as selectVideoByID
} from '../dao/video.js'
import { makeAudio4Video, copyAudio4Video } from './voice.js'
import { makeVideo as makeVideoApi,getVideoStatus } from '../api/f2f.js'
import { transcribePcmWithTimestamps } from '../api/asr.js'
import log from '../logger.js'
import {
  applyBeautyFilter,
  applyVideoCover,
  burnAssSubtitles,
  convertAudioToAsrPcm,
  detectSpeechIntervals,
  getVideoDuration,
  prependAudioSilence
} from '../util/ffmpeg.js'
import { createAss, createSrt } from '../util/subtitle.js'

const MODEL_NAME = 'video'
const VIDEO_LEAD_IN_SECONDS = 1.5
const LEAD_IN_AUDIO_SUFFIX = '.leadin.wav'
const COVER_DIRECTORY = path.join(assetPath.model, 'covers')

function getVideoLeadInSeconds(audioPath) {
  return String(audioPath || '').endsWith(LEAD_IN_AUDIO_SUFFIX) ? VIDEO_LEAD_IN_SECONDS : 0
}

async function ensureAudioLeadIn(audioPath) {
  if (!audioPath) return audioPath

  const inputPath = path.join(assetPath.ttsProduct, audioPath)
  if (!fs.existsSync(inputPath)) {
    throw new Error(`找不到待处理音频：${audioPath}`)
  }
  if (getVideoLeadInSeconds(audioPath) > 0) return audioPath

  const parsedPath = path.parse(audioPath)
  const outputName = `${parsedPath.name}${LEAD_IN_AUDIO_SUFFIX}`
  const outputPath = path.join(assetPath.ttsProduct, outputName)
  if (!fs.existsSync(outputPath)) {
    try {
      await prependAudioSilence(inputPath, outputPath, VIDEO_LEAD_IN_SECONDS)
    } catch (error) {
      try {
        fs.rmSync(outputPath, { force: true })
      } catch (cleanupError) {
        log.warn('Unable to remove failed lead-in audio:', cleanupError.message)
      }
      throw error
    }
  }
  return outputName
}

async function getSubtitleSpeechIntervals(audioPath) {
  const absoluteAudioPath = path.join(assetPath.ttsProduct, audioPath || '')
  if (!audioPath || !fs.existsSync(absoluteAudioPath)) return []
  try {
    return await detectSpeechIntervals(absoluteAudioPath)
  } catch (error) {
    log.warn('Unable to detect speech intervals, using estimated subtitle timing:', error.message)
    return []
  }
}

function parseSubtitleTiming(value) {
  if (!value) return null
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch (error) {
    log.warn('Unable to parse cached subtitle timing:', error.message)
    return null
  }
}

async function getSubtitleTiming(video) {
  const cachedTiming = parseSubtitleTiming(video?.subtitle_timing)
  if (cachedTiming?.stamp_sents?.length) return cachedTiming

  const audioPath = video?.audio_path
  const absoluteAudioPath = path.join(assetPath.ttsProduct, audioPath || '')
  if (!audioPath || !fs.existsSync(absoluteAudioPath)) return null

  const parsedAudioPath = path.parse(absoluteAudioPath)
  const pcmPath = path.join(parsedAudioPath.dir, `${parsedAudioPath.name}.subtitle-asr.pcm`)
  try {
    await convertAudioToAsrPcm(absoluteAudioPath, pcmPath)
    const timing = await transcribePcmWithTimestamps(pcmPath)
    update({ id: video.id, subtitle_timing: timing })
    video.subtitle_timing = timing
    return timing
  } catch (error) {
    log.warn('Unable to recognize subtitle timing, using silence-based fallback:', error.message)
    return null
  } finally {
    try {
      fs.rmSync(pcmPath, { force: true })
    } catch (cleanupError) {
      log.warn('Unable to remove temporary ASR audio:', cleanupError.message)
    }
  }
}

/**
 * 分页查询合成结果
 * @param {number} page
 * @param {number} pageSize
 * @returns
 */
function page({ page, pageSize, name = '' }) {
  // 查询的有waiting状态的视频
  const waitingVideos = selectByStatus('waiting').map((v) => v.id)
  const total = count(name)
  const list = selectPage({ page, pageSize, name }).map((video) => {
    video = resolveVideoPaths(video)

    if(video.status === 'waiting'){
      video.progress = `${waitingVideos.indexOf(video.id) + 1} / ${waitingVideos.length}`
    }
    return video
  })

  return {
    total,
    list
  }
}

function findVideo(videoId) {
  return resolveVideoPaths(selectVideoByID(videoId))
}

function countVideo(name = '') {
  return count(name)
}

function saveVideo({ id, model_id, name, text_content, voice_id, audio_path, beauty, subtitle_style, cover_style }) {
  const video = selectVideoByID(id)
  if(audio_path){
    audio_path = copyAudio4Video(audio_path)
  }

  const persistedCoverStyle = persistCoverStyle(cover_style, video?.cover_style)

  if (video) {
    return update({
      id,
      model_id,
      name,
      text_content,
      voice_id,
      audio_path,
      beauty,
      subtitle_style,
      cover_style: persistedCoverStyle,
      subtitle_timing: null
    })
  }
  return insertVideo({
    model_id,
    name,
    status: 'draft',
    text_content,
    voice_id,
    audio_path,
    beauty,
    subtitle_style,
    cover_style: persistedCoverStyle
  })
}

function parseJSON(value) {
  if (!value) return null
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch (_error) {
    return null
  }
}

export function parseCoverStyle(value) {
  const style = parseJSON(value)
  if (!style?.enabled || !style?.imagePath) return null
  return {
    enabled: true,
    imagePath: String(style.imagePath),
    duration: VIDEO_LEAD_IN_SECONDS
  }
}

function absoluteCoverPath(imagePath) {
  return path.isAbsolute(imagePath) ? imagePath : path.join(assetPath.model, imagePath)
}

function isPathInside(parentPath, targetPath) {
  const relativePath = path.relative(parentPath, targetPath)
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
}

function removeManagedCover(styleValue) {
  const style = parseCoverStyle(styleValue)
  if (!style) return
  const coverPath = absoluteCoverPath(style.imagePath)
  if (isPathInside(COVER_DIRECTORY, coverPath)) {
    try {
      fs.rmSync(coverPath, { force: true })
    } catch (error) {
      log.warn('Unable to remove managed cover:', error.message)
    }
  }
}

function persistCoverStyle(styleValue, previousStyleValue) {
  const style = parseCoverStyle(styleValue)
  if (!style) {
    removeManagedCover(previousStyleValue)
    return { enabled: false, imagePath: '', duration: VIDEO_LEAD_IN_SECONDS }
  }

  const sourcePath = absoluteCoverPath(style.imagePath)
  if (!fs.existsSync(sourcePath)) {
    throw new Error('找不到选择的视频封面图片')
  }
  const extension = path.extname(sourcePath).toLowerCase()
  if (!['.jpg', '.jpeg', '.png'].includes(extension)) {
    throw new Error('视频封面仅支持 JPG、PNG 图片')
  }

  fs.mkdirSync(COVER_DIRECTORY, { recursive: true })
  let managedPath = sourcePath
  if (!isPathInside(COVER_DIRECTORY, sourcePath)) {
    managedPath = path.join(COVER_DIRECTORY, `${crypto.randomUUID()}${extension}`)
    fs.copyFileSync(sourcePath, managedPath)
  }

  const previousStyle = parseCoverStyle(previousStyleValue)
  if (previousStyle) {
    const previousPath = absoluteCoverPath(previousStyle.imagePath)
    if (path.resolve(previousPath) !== path.resolve(managedPath)) {
      removeManagedCover(previousStyle)
    }
  }

  return {
    enabled: true,
    imagePath: path.relative(assetPath.model, managedPath),
    duration: VIDEO_LEAD_IN_SECONDS
  }
}

function resolveVideoPaths(video) {
  if (!video) return video
  const coverStyle = parseCoverStyle(video.cover_style)
  return {
    ...video,
    file_path: video.file_path ? path.join(assetPath.model, video.file_path) : video.file_path,
    cover_style: coverStyle
      ? { ...coverStyle, imagePath: absoluteCoverPath(coverStyle.imagePath) }
      : { enabled: false, imagePath: '', duration: VIDEO_LEAD_IN_SECONDS }
  }
}

function parseSubtitleStyle(value) {
  if (!value) return null
  try {
    const style = typeof value === 'string' ? JSON.parse(value) : value
    return style?.enabled ? style : null
  } catch (error) {
    log.warn('invalid subtitle style:', error.message)
    return null
  }
}

export function hasEnabledSubtitles(video) {
  return Boolean(parseSubtitleStyle(video?.subtitle_style) && video?.text_content?.trim())
}

export async function renderVideoSubtitles(video, inputPath, outputPath, options = {}) {
  const subtitleStyle = parseSubtitleStyle(video?.subtitle_style)
  if (!subtitleStyle || !video?.text_content?.trim()) return false

  const duration = options.duration || await getVideoDuration(inputPath)
  const assPath = options.assPath || path.join(
    path.dirname(outputPath),
    `${path.parse(outputPath).name}.${crypto.randomUUID()}.ass`
  )

  try {
    const leadInSeconds = getVideoLeadInSeconds(video.audio_path)
    const subtitleTiming = await getSubtitleTiming(video)
    const speechIntervals = await getSubtitleSpeechIntervals(video.audio_path)
    fs.writeFileSync(
      assPath,
      `\ufeff${createAss(
        video.text_content,
        duration,
        subtitleStyle,
        leadInSeconds,
        speechIntervals,
        subtitleTiming
      )}`,
      'utf8'
    )
    await burnAssSubtitles(inputPath, outputPath, assPath)
    return true
  } finally {
    try {
      fs.rmSync(assPath, { force: true })
    } catch (cleanupError) {
      log.warn('Unable to remove temporary subtitle file:', cleanupError.message)
    }
  }
}

export function hasEnabledCover(video) {
  return Boolean(parseCoverStyle(video?.cover_style))
}

export async function renderVideoCover(video, inputPath, outputPath) {
  const style = parseCoverStyle(video?.cover_style)
  if (!style) return false
  const coverPath = absoluteCoverPath(style.imagePath)
  if (!fs.existsSync(coverPath)) throw new Error('找不到视频封面图片')
  await applyVideoCover(inputPath, outputPath, coverPath, VIDEO_LEAD_IN_SECONDS)
  return true
}

function parseBeauty(value) {
  if (!value) return null
  try {
    const beauty = typeof value === 'string' ? JSON.parse(value) : value
    return beauty?.enabled ? beauty : null
  } catch (error) {
    log.warn('invalid beauty settings:', error.message)
    return null
  }
}

/**
 * 合成视频
 * 更新视频状态为waiting
 * @param {number} videoId
 * @returns
 */
function makeVideo(videoId) {
  update({ id: videoId, status: 'waiting' })
  return videoId
}

export async function synthesisVideo(videoId) {
  try{
    update({
      id: videoId,
      file_path: null,
      source_file_path: null,
      status: 'pending',
      message: '正在提交任务',
      subtitle_timing: null
    })

    // 查询Video
    const video = selectVideoByID(videoId)
    log.debug('~ makeVideo ~ video:', video)

    // 根据modelId获取model信息
    const model = selectF2FModelByID(video.model_id)
    log.debug('~ makeVideo ~ model:', model)

    let audioPath
    if(video.audio_path){
      // 将audio_path复制到ttsProduct目录下
      audioPath = video.audio_path
    }else{
      // 根据model信息中的voiceId获取voice信息
      const voice = selectVoiceByID(video.voice_id || model.voice_id)
      log.debug('~ makeVideo ~ voice:', voice)

      // 调用tts接口生成音频
      audioPath = await makeAudio4Video({
        voiceId: voice.id,
        text: video.text_content,
        onProgress: ({ phase, index, total, attempt }) => {
          if (phase === 'generating') {
            const retry = attempt > 1 ? `，第 ${attempt} 次尝试` : ''
            updateStatus(videoId, 'pending', `正在生成语音 ${index}/${total}${retry}`)
          } else if (phase === 'verifying') {
            updateStatus(videoId, 'pending', `正在检查语音完整性 ${index}/${total}`)
          } else if (phase === 'merging') {
            updateStatus(videoId, 'pending', '正在合并语音片段')
          }
        }
      })
      log.debug('~ makeVideo ~ audioPath:', audioPath)
    }

    updateStatus(videoId, 'pending', `正在添加 ${VIDEO_LEAD_IN_SECONDS} 秒开场静默`)
    audioPath = await ensureAudioLeadIn(audioPath)

    // 调用视频生成接口生成视频
    let result, param
    if (process.env.NODE_ENV === 'development') {
      ({ result, param } = await makeVideoByF2F(audioPath, 'test.mp4'))
    } else {
      ({ result, param } = await makeVideoByF2F(audioPath, model.video_path))
    }

    log.debug('~ makeVideo ~ result, param:', result, param)

    // 插入视频表
    if(10000 === result.code){ // 成功
      update({
        id: videoId,
        file_path: null,
        source_file_path: null,
        status: 'pending',
        message: result,
        audio_path: audioPath,
        param,
        code: param.code
      })
    }else{ // 失败
      update({
        id: videoId,
        file_path: null,
        source_file_path: null,
        status: 'failed',
        message: result.msg,
        audio_path: audioPath,
        param,
        code: param.code
      })
    }
  } catch (error) {
    log.error('~ synthesisVideo ~ error:', error.message)
    updateStatus(videoId, 'failed', error.message)
  }

  // 6. 返回视频id
  return videoId
}

export async function loopPending() {
  const video = findFirstByStatus('pending')
  if (!video) {
    synthesisNext()

    setTimeout(() => {
      loopPending()
    }, 2000)
    return
  }

  const statusRes = await getVideoStatus(video.code)

  if ([9999, 10002, 10003].includes(statusRes.code)) {
    updateStatus(video.id, 'failed', statusRes.msg)
  } else if (statusRes.code === 10000) {
    if (statusRes.data.status === 1) {
      updateStatus(
        video.id,
        'pending',
        statusRes.data.msg,
        statusRes.data.progress,
      )
    }else if (statusRes.data.status === 2) { // 合成成功
      // ffmpeg 获取视频时长
      let duration
      let sourceResultPath = null
      if(process.env.NODE_ENV === 'development'){
        duration = 88
        if (statusRes.data.result) {
          sourceResultPath = path.join(assetPath.model, statusRes.data.result)
        }
      }else{
        const sourcePath = path.join(assetPath.model, statusRes.data.result)
        let resultPath = sourcePath
        const beauty = parseBeauty(video.beauty)
        if (beauty) {
          const parsedPath = path.parse(sourcePath)
          resultPath = path.join(parsedPath.dir, `${parsedPath.name}.beauty.mp4`)
          if (!fs.existsSync(resultPath)) {
            updateStatus(video.id, 'pending', '正在进行美颜处理', 99)
            try {
              await applyBeautyFilter(sourcePath, resultPath, beauty)
            } catch (error) {
              updateStatus(video.id, 'failed', `美颜处理失败：${error.message}`)
              setTimeout(() => loopPending(), 2000)
              return video
            }
          }
        }
        duration = await getVideoDuration(resultPath)
        sourceResultPath = resultPath
        if (hasEnabledSubtitles(video)) {
          const parsedPath = path.parse(resultPath)
          const subtitleOutputPath = path.join(parsedPath.dir, `${parsedPath.name}.subtitled.mp4`)
          if (!fs.existsSync(subtitleOutputPath)) {
            updateStatus(video.id, 'pending', '正在分析语音时间轴', 99)
            try {
              updateStatus(video.id, 'pending', '正在烧录字幕', 99)
              await renderVideoSubtitles(video, resultPath, subtitleOutputPath, { duration })
            } catch (error) {
              try {
                fs.rmSync(subtitleOutputPath, { force: true })
              } catch (cleanupError) {
                log.warn('Unable to remove failed subtitle output:', cleanupError.message)
              }
              updateStatus(video.id, 'failed', `字幕烧录失败：${error.message}`)
              setTimeout(() => loopPending(), 2000)
              return video
            }
          }
          resultPath = subtitleOutputPath
        }
        if (hasEnabledCover(video)) {
          const parsedPath = path.parse(resultPath)
          const coverOutputPath = path.join(parsedPath.dir, `${parsedPath.name}.covered.mp4`)
          if (!fs.existsSync(coverOutputPath)) {
            updateStatus(video.id, 'pending', '正在添加视频封面', 99)
            try {
              await renderVideoCover(video, resultPath, coverOutputPath)
            } catch (error) {
              try {
                fs.rmSync(coverOutputPath, { force: true })
              } catch (cleanupError) {
                log.warn('Unable to remove failed cover output:', cleanupError.message)
              }
              updateStatus(video.id, 'failed', `封面处理失败：${error.message}`)
              setTimeout(() => loopPending(), 2000)
              return video
            }
          }
          resultPath = coverOutputPath
        }
        statusRes.data.result = path.relative(assetPath.model, resultPath)
      }

      update({
        id: video.id,
        status: 'success',
        message: statusRes.data.msg,
        progress: statusRes.data.progress,
        file_path: statusRes.data.result,
        source_file_path: sourceResultPath
          ? path.relative(assetPath.model, sourceResultPath)
          : statusRes.data.result,
        duration
      })

    } else if (statusRes.data.status === 3) {
      updateStatus(video.id, 'failed', statusRes.data.msg)
    }
  }

  setTimeout(() => {
    loopPending()
  }, 2000)
  return video
}

/**
 * 合成下一个视频
 */
function synthesisNext() {
  // 查询所有未完成的视频任务
  const video = findFirstByStatus('waiting')
  if (video) {
    synthesisVideo(video.id)
  }
}

function removeVideo(videoId) {
  // 查询视频
  const video = selectVideoByID(videoId)
  log.debug('~ removeVideo ~ videoId:', videoId)

  // 删除视频
  const videoPaths = new Set([video.file_path, video.source_file_path].filter((filePath) => !isEmpty(filePath)))
  for (const filePath of videoPaths) {
    const videoPath = path.join(assetPath.model, filePath)
    if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath)
  }

  removeManagedCover(video.cover_style)

  // 删除音频
  const audioPath = path.join(assetPath.model, video.audio_path ||'')
  if (!isEmpty(video.audio_path) && fs.existsSync(audioPath)) {
    fs.unlinkSync(audioPath)
  }

  // 删除视频表
  return deleteVideo(videoId)
}

function exportVideo(videoId, outputPath) {
  const video = selectVideoByID(videoId)
  const filePath = path.join(assetPath.model, video.file_path)
  fs.copyFileSync(filePath, outputPath)
}

async function exportSubtitle(videoId, outputPath) {
  const video = selectVideoByID(videoId)
  if (!video) {
    throw new Error('找不到指定的视频作品')
  }
  const subtitleTiming = await getSubtitleTiming(video)
  const speechIntervals = await getSubtitleSpeechIntervals(video.audio_path)
  const srt = createSrt(
    video.text_content,
    video.duration,
    getVideoLeadInSeconds(video.audio_path),
    speechIntervals,
    subtitleTiming
  )
  fs.writeFileSync(outputPath, `\ufeff${srt}`, 'utf8')
  return outputPath
}

/**
 * 调用face2face生成视频
 * @param {string} audioPath
 * @param {string} videoPath
 * @returns
 */
async function makeVideoByF2F(audioPath, videoPath) {
  const uuid = crypto.randomUUID()
  const param = {
    audio_url: audioPath,
    video_url: videoPath,
    code: uuid,
    chaofen: 0,
    watermark_switch: 0,
    pn: 1
  }
  const result = await makeVideoApi(param)
  return { param, result }
}

function modify(video) {
  return update(video)
}

export function init() {
  ipcMain.handle(MODEL_NAME + '/page', (event, ...args) => {
    return page(...args)
  })
  ipcMain.handle(MODEL_NAME + '/make', (event, ...args) => {
    return makeVideo(...args)
  })
  ipcMain.handle(MODEL_NAME + '/modify', (event, ...args) => {
    return modify(...args)
  })
  ipcMain.handle(MODEL_NAME + '/save', (event, ...args) => {
    return saveVideo(...args)
  })
  ipcMain.handle(MODEL_NAME + '/find', (event, ...args) => {
    return findVideo(...args)
  })
  ipcMain.handle(MODEL_NAME + '/count', (event, ...args) => {
    return countVideo(...args)
  })
  ipcMain.handle(MODEL_NAME + '/export', (event, ...args) => {
    return exportVideo(...args)
  })
  ipcMain.handle(MODEL_NAME + '/export-subtitle', (event, ...args) => {
    return exportSubtitle(...args)
  })
  ipcMain.handle(MODEL_NAME + '/remove', (event, ...args) => {
    return removeVideo(...args)
  })
}
