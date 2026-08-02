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
    video = {
      ...video,
      file_path: video.file_path ? path.join(assetPath.model, video.file_path) : video.file_path
    }

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
  const video = selectVideoByID(videoId)
  return {
    ...video,
    file_path: video.file_path ? path.join(assetPath.model, video.file_path) : video.file_path
  }
}

function countVideo(name = '') {
  return count(name)
}

function saveVideo({ id, model_id, name, text_content, voice_id, audio_path, beauty, subtitle_style }) {
  const video = selectVideoByID(id)
  if(audio_path){
    audio_path = copyAudio4Video(audio_path)
  }

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
      subtitle_timing: null
    })
  }
  return insertVideo({ model_id, name, status: 'draft', text_content, voice_id, audio_path, beauty, subtitle_style })
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
        text: video.text_content
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
      if(process.env.NODE_ENV === 'development'){
        duration = 88
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
        const subtitleStyle = parseSubtitleStyle(video.subtitle_style)
        if (subtitleStyle && video.text_content?.trim()) {
          const parsedPath = path.parse(resultPath)
          const subtitleOutputPath = path.join(parsedPath.dir, `${parsedPath.name}.subtitled.mp4`)
          const assPath = path.join(parsedPath.dir, `${parsedPath.name}.subtitle.ass`)
          if (!fs.existsSync(subtitleOutputPath)) {
            updateStatus(video.id, 'pending', '正在分析语音时间轴', 99)
            try {
              const leadInSeconds = getVideoLeadInSeconds(video.audio_path)
              const subtitleTiming = await getSubtitleTiming(video)
              const speechIntervals = await getSubtitleSpeechIntervals(video.audio_path)
              updateStatus(video.id, 'pending', '正在烧录字幕', 99)
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
              await burnAssSubtitles(resultPath, subtitleOutputPath, assPath)
            } catch (error) {
              try {
                fs.rmSync(subtitleOutputPath, { force: true })
              } catch (cleanupError) {
                log.warn('Unable to remove failed subtitle output:', cleanupError.message)
              }
              updateStatus(video.id, 'failed', `字幕烧录失败：${error.message}`)
              setTimeout(() => loopPending(), 2000)
              return video
            } finally {
              try {
                fs.rmSync(assPath, { force: true })
              } catch (cleanupError) {
                log.warn('Unable to remove temporary subtitle file:', cleanupError.message)
              }
            }
          }
          resultPath = subtitleOutputPath
        }
        statusRes.data.result = path.relative(assetPath.model, resultPath)
      }

      update({
        id: video.id,
        status: 'success',
        message: statusRes.data.msg,
        progress: statusRes.data.progress,
        file_path: statusRes.data.result,
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
  const videoPath = path.join(assetPath.model, video.file_path ||'')
  if (!isEmpty(video.file_path) && fs.existsSync(videoPath)) {
    fs.unlinkSync(videoPath)
  }

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
