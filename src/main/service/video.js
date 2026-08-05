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
  burnAssSubtitles,
  convertAudioToAsrPcm,
  detectSpeechIntervals,
  getVideoDimensions,
  getVideoDuration
} from '../util/ffmpeg.js'
import {
  checkContainerPostprocess,
  createPreviewClip,
  createSolidColorImage,
  extractFirstFrame,
  mergeAudioAndH264,
  normalizeBackgroundStyle,
  runRvmMatting
} from '../util/background-pipeline.js'
import { createAss, createSrtFromCues, normalizeSubtitleStyle } from '../util/subtitle.js'
import { resolveVideoSaveSource } from '../util/video-revision.js'

const MODEL_NAME = 'video'

function parseJSON(value, fallback = null) {
  if (!value) return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch (error) {
    log.warn('invalid JSON value:', error.message)
    return fallback
  }
}

function absoluteVideoPath(filePath) {
  if (!filePath) return ''
  // The synthesis service historically stores managed files as `/name.mp4`.
  // On Windows that is drive-root-relative, not an external absolute path.
  if (/^[\\/](?![\\/])/.test(filePath)) {
    return path.join(assetPath.model, filePath.replace(/^[\\/]+/, ''))
  }
  return path.isAbsolute(filePath) ? filePath : path.join(assetPath.model, filePath)
}

function relativeVideoPath(filePath) {
  return filePath ? path.relative(assetPath.model, filePath) : null
}

function isManagedVideoPath(filePath) {
  const root = path.resolve(assetPath.model)
  const target = path.resolve(filePath)
  return target.startsWith(`${root}${path.sep}`)
}

function exposeVideoPaths(video) {
  if (!video) return video
  const cleanPath = video.clean_file_path || video.file_path
  return {
    ...video,
    file_path: absoluteVideoPath(video.file_path),
    clean_file_path: absoluteVideoPath(cleanPath),
    subtitled_file_path: absoluteVideoPath(video.subtitled_file_path)
  }
}

function exposeVideoForEdit(video) {
  if (!video) return video
  return {
    ...exposeVideoPaths(video),
    audio_path: video.audio_path ? absoluteVideoPath(video.audio_path) : '',
    audio_source: video.voice_id ? 'tts' : 'upload'
  }
}

function subtitleRequested(video) {
  const style = normalizeSubtitleStyle(parseJSON(video?.subtitle_style, {}))
  return Boolean(style.enabled && style.burnEnabled && video?.text_content?.trim())
}

function isInsideDirectory(root, filePath) {
  const relativePath = path.relative(root, filePath)
  return !relativePath.startsWith('..') && !path.isAbsolute(relativePath)
}

function resolveBackgroundInput(rawStyle) {
  const style = normalizeBackgroundStyle({ ...parseJSON(rawStyle, {}), enabled: true })
  if (style.type === 'color') {
    return { type: 'color', value: style.color }
  }
  const filePath = absoluteVideoPath(style.imagePath)
  if (filePath && fs.existsSync(filePath)) {
    return { type: style.type, value: filePath }
  }
  return null
}

async function stageBackgroundForContainer(background, face2faceRoot, postprocessDir, taskId, size) {
  if (background.type === 'color') {
    return createSolidColorImage(
      background.value,
      path.join(postprocessDir, `${taskId}-color.png`),
      size
    )
  }
  if (isInsideDirectory(face2faceRoot, background.value)) {
    return background.value
  }
  const extension = path.extname(background.value).toLowerCase() || '.png'
  const staged = path.join(postprocessDir, `${taskId}-background${extension}`)
  fs.copyFileSync(background.value, staged)
  return staged
}

/**
 * 背景替换：原视频完全不动，生成的新视频作为一条新的作品保存到数据库。
 */
async function replaceVideoBackground(videoId, rawStyle, options = {}) {
  const background = resolveBackgroundInput(rawStyle)
  if (!background) throw new Error('背景资源不存在，请重新选择背景')

  const video = selectVideoByID(videoId)
  if (!video?.file_path) throw new Error('找不到已生成的视频')
  const cleanPath = absoluteVideoPath(video.clean_file_path || video.file_path)
  if (!cleanPath || !fs.existsSync(cleanPath)) throw new Error('找不到无字幕版视频')
  if (!isManagedVideoPath(cleanPath)) throw new Error('无字幕版不在受管理的视频目录中')

  const face2faceRoot = path.dirname(assetPath.model)
  const postprocessDir = path.join(face2faceRoot, 'postprocess')
  fs.mkdirSync(postprocessDir, { recursive: true })
  if (!(await checkContainerPostprocess())) {
    throw new Error('背景处理容器未就绪（未运行或未挂载处理脚本），请先启动 Docker 并在 deploy 目录执行 docker-compose up -d 后重试')
  }

  const taskId = crypto.randomUUID()
  const parsedPath = path.parse(cleanPath)
  const bgOutputPath = path.join(parsedPath.dir, `${parsedPath.name}.bg-${Date.now()}.mp4`)
  const subtitledOutputPath = path.join(parsedPath.dir, `${parsedPath.name}.bg-sub-${Date.now()}.mp4`)
  const silentOutputPath = path.join(postprocessDir, `${taskId}-silent.mp4`)
  const tempFiles = []
  try {
    const dims = await getVideoDimensions(cleanPath)
    const stagedBackground = await stageBackgroundForContainer(
      background,
      face2faceRoot,
      postprocessDir,
      taskId,
      { width: dims.width, height: dims.height }
    )
    if (stagedBackground !== background.value) tempFiles.push(stagedBackground)

    await runRvmMatting({
      sourcePath: cleanPath,
      backgroundPath: stagedBackground,
      outputPath: silentOutputPath,
      face2faceRoot,
      onProgress: (percent) => {
        options.progress?.({ percent, message: `正在处理人像 ${percent}%` })
      }
    })

    const includeSubtitles = options.includeSubtitles !== false && subtitleRequested(video)
    let cues = null
    if (includeSubtitles) {
      await mergeAudioAndH264(silentOutputPath, cleanPath, bgOutputPath)
      cues = await renderVideoSubtitles({ ...video }, bgOutputPath, subtitledOutputPath)
    } else {
      await mergeAudioAndH264(silentOutputPath, cleanPath, bgOutputPath)
    }

    const duration = Number(await getVideoDuration(bgOutputPath)) || 0
    const newId = insertVideo({
      model_id: video.model_id,
      name: options.name || `${video.name}-新背景`,
      status: 'success',
      message: '背景替换完成',
      progress: 100,
      duration,
      text_content: video.text_content,
      voice_id: video.voice_id,
      audio_path: null,
      speed: Number(video.speed) > 0 ? Number(video.speed) : 1,
      subtitle_style: video.subtitle_style,
      subtitle_timing: cues,
      subtitle_render_status: includeSubtitles ? 'success' : 'not_requested',
      subtitle_render_message: null,
      file_path: relativeVideoPath(bgOutputPath),
      clean_file_path: relativeVideoPath(bgOutputPath),
      subtitled_file_path: includeSubtitles ? relativeVideoPath(subtitledOutputPath) : null
    })
    options.progress?.({ percent: 100, message: '背景替换完成' })
    return exposeVideoPaths(selectVideoByID(newId))
  } finally {
    for (const file of [silentOutputPath, ...tempFiles]) {
      try {
        fs.rmSync(file, { force: true })
      } catch (error) {
        log.warn('清理背景替换临时文件失败:', error.message)
      }
    }
  }
}

async function previewVideoBackground(videoId, rawStyle) {
  const video = selectVideoByID(videoId)
  if (!video) throw new Error('找不到指定的视频作品')
  const background = resolveBackgroundInput(rawStyle)
  if (!background) throw new Error('背景资源不存在，请重新选择背景')

  const cleanPath = absoluteVideoPath(video.clean_file_path || video.file_path)
  if (!cleanPath || !fs.existsSync(cleanPath)) throw new Error('找不到原始视频')
  const face2faceRoot = path.dirname(assetPath.model)
  const postprocessDir = path.join(face2faceRoot, 'postprocess')
  fs.mkdirSync(postprocessDir, { recursive: true })
  if (!(await checkContainerPostprocess())) {
    throw new Error('背景处理容器未就绪（未运行或未挂载处理脚本），请先启动 Docker 并在 deploy 目录执行 docker-compose up -d 后重试')
  }

  const parsedPath = path.parse(cleanPath)
  const previewOutputPath = path.join(parsedPath.dir, `${parsedPath.name}.bg-preview.png`)
  const taskId = crypto.randomUUID()
  const clipPath = path.join(postprocessDir, `${taskId}-preview-clip.mp4`)
  const silentPreviewPath = path.join(postprocessDir, `${taskId}-preview-silent.mp4`)
  const tempFiles = []

  try {
    const dims = await getVideoDimensions(cleanPath)
    const stagedBackground = await stageBackgroundForContainer(
      background,
      face2faceRoot,
      postprocessDir,
      taskId,
      { width: dims.width, height: dims.height }
    )
    if (stagedBackground !== background.value) tempFiles.push(stagedBackground)
    await createPreviewClip(cleanPath, clipPath)
    await runRvmMatting({
      sourcePath: clipPath,
      backgroundPath: stagedBackground,
      outputPath: silentPreviewPath,
      face2faceRoot
    })
    await extractFirstFrame(silentPreviewPath, previewOutputPath)
    return { previewPath: previewOutputPath }
  } finally {
    for (const file of [clipPath, silentPreviewPath, ...tempFiles]) {
      try {
        fs.rmSync(file, { force: true })
      } catch (error) {
        log.warn('清理背景预览临时文件失败:', error.message)
      }
    }
  }
}

async function getSubtitleAsrTiming(video) {
  const audioName = video?.audio_path
  if (!audioName) return null
  const audioPath = path.join(assetPath.model, audioName)
  if (!fs.existsSync(audioPath)) return null
  const parsedPath = path.parse(audioPath)
  const pcmPath = path.join(parsedPath.dir, `${parsedPath.name}.subtitle-asr.pcm`)
  try {
    await convertAudioToAsrPcm(audioPath, pcmPath)
    return await transcribePcmWithTimestamps(pcmPath)
  } catch (error) {
    log.warn('Unable to recognize subtitle timing, using silence-based fallback:', error.message)
    return null
  } finally {
    try {
      fs.rmSync(pcmPath, { force: true })
    } catch (error) {
      log.warn('Unable to remove temporary ASR audio:', error.message)
    }
  }
}

async function resolveSubtitleCues(video, inputPath, options = {}) {
  const duration = Number(video.duration) || Number(await getVideoDuration(inputPath))
  let videoSize = null
  try {
    videoSize = await getVideoDimensions(inputPath)
  } catch (error) {
    log.warn('Unable to detect video dimensions, using 1920x1080 subtitle baseline:', error.message)
  }
  let speechIntervals = []
  try {
    speechIntervals = await detectSpeechIntervals(inputPath)
  } catch (error) {
    log.warn('Unable to detect speech intervals, using estimated subtitle timing:', error.message)
  }
  const cachedTiming = options.ignoreCached ? null : parseJSON(video.subtitle_timing, null)
  const asrTiming = await getSubtitleAsrTiming(video)
  const style = normalizeSubtitleStyle(parseJSON(video?.subtitle_style, {}))
  return createAss(
    video.text_content,
    duration,
    style,
    speechIntervals,
    cachedTiming,
    asrTiming,
    videoSize
  )
}

export async function renderVideoSubtitles(video, inputPath, outputPath) {
  const style = normalizeSubtitleStyle(parseJSON(video?.subtitle_style, {}))
  if (!style.enabled || !style.burnEnabled || !video?.text_content?.trim()) return null
  const { content, cues } = await resolveSubtitleCues(video, inputPath)
  const assPath = path.join(path.dirname(outputPath), `${path.parse(outputPath).name}.${crypto.randomUUID()}.ass`)
  try {
    fs.writeFileSync(assPath, `\ufeff${content}`, 'utf8')
    await burnAssSubtitles(inputPath, outputPath, assPath)
    return cues
  } finally {
    try {
      fs.rmSync(assPath, { force: true })
    } catch (error) {
      log.warn('Unable to remove temporary subtitle file:', error.message)
    }
  }
}

async function exportVideoSrt(videoId, outputPath) {
  const video = selectVideoByID(videoId)
  if (!video) throw new Error('找不到指定的视频作品')
  const style = normalizeSubtitleStyle(parseJSON(video?.subtitle_style, {}))
  if (!style.enabled || !video?.text_content?.trim()) throw new Error('该作品没有可导出的字幕')
  const sourcePath = video.clean_file_path || video.file_path
  if (!sourcePath) throw new Error('视频尚未生成，无法导出字幕')
  const videoPath = absoluteVideoPath(sourcePath)
  if (!fs.existsSync(videoPath)) throw new Error('找不到视频文件')
  const { cues } = await resolveSubtitleCues(video, videoPath, { ignoreCached: true })
  fs.writeFileSync(outputPath, `\ufeff${createSrtFromCues(cues)}`, 'utf8')
  return outputPath
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
    video = exposeVideoPaths(video)

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
  return exposeVideoForEdit(selectVideoByID(videoId))
}

function countVideo(name = '') {
  return count(name)
}

function saveVideo({
  id,
  source_video_id,
  audio_source = 'tts',
  model_id,
  name,
  text_content,
  voice_id,
  audio_path,
  speed = 1,
  subtitle_style
}) {
  const sourceVideo = source_video_id ? selectVideoByID(source_video_id) : null
  const resolvedSource = resolveVideoSaveSource(
    { id, source_video_id, audio_source, audio_path },
    sourceVideo,
    absoluteVideoPath
  )

  if (resolvedSource.audioSource === 'upload') {
    audio_path = copyAudio4Video(resolvedSource.audioPath)
    voice_id = null
  } else {
    audio_path = null
  }

  const video = selectVideoByID(id)

  if (video) {
    return update({
      id,
      model_id,
      name,
      text_content,
      voice_id,
      audio_path,
      speed: Number(speed) > 0 ? Number(speed) : 1,
      subtitle_style: normalizeSubtitleStyle(subtitle_style),
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
    speed: Number(speed) > 0 ? Number(speed) : 1,
    subtitle_style: normalizeSubtitleStyle(subtitle_style),
    subtitle_render_status: 'not_requested'
  })
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
    const previousVideo = selectVideoByID(videoId)
    const previousSubtitlePath = absoluteVideoPath(previousVideo?.subtitled_file_path)
    if (previousSubtitlePath && isManagedVideoPath(previousSubtitlePath)) {
      fs.rmSync(previousSubtitlePath, { force: true })
    }
    update({
      id: videoId,
      file_path: null,
      clean_file_path: null,
      subtitled_file_path: null,
      subtitle_render_status: 'not_requested',
      subtitle_render_message: null,
      status: 'pending',
      message: '正在提交任务',
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
        speed: video.speed || 1
      })
      log.debug('~ makeVideo ~ audioPath:', audioPath)
    }

    // 调用视频生成接口生成视频
    let result, param
    if (process.env.NODE_ENV === 'development') {
      // 写死调试
      ({ result, param } = await makeVideoByF2F('test.wav', 'test.mp4'))
    } else {
      ({ result, param } = await makeVideoByF2F(audioPath, model.video_path))
    }

    log.debug('~ makeVideo ~ result, param:', result, param)

    // 插入视频表
    if(10000 === result.code){ // 成功
      update({
        id: videoId,
        file_path: null,
        clean_file_path: null,
        subtitled_file_path: null,
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
        const resultPath = path.join(assetPath.model, statusRes.data.result)
        duration = await getVideoDuration(resultPath)
      }

      const cleanRelativePath = statusRes.data.result
      const cleanAbsolutePath = path.join(assetPath.model, cleanRelativePath)
      const baseUpdate = {
        id: video.id,
        status: 'success',
        message: statusRes.data.msg,
        progress: statusRes.data.progress,
        file_path: cleanRelativePath,
        clean_file_path: cleanRelativePath,
        subtitled_file_path: null,
        subtitle_render_status: 'not_requested',
        subtitle_render_message: null,
        duration
      }

      if (subtitleRequested(video)) {
        const parsedPath = path.parse(cleanAbsolutePath)
        const subtitledAbsolutePath = path.join(parsedPath.dir, `${parsedPath.name}.subtitled.mp4`)
        try {
          update({
            id: video.id,
            message: '正在烧录字幕',
            subtitle_render_status: 'pending',
            subtitle_render_message: null
          })
          const cues = await renderVideoSubtitles({ ...video, duration }, cleanAbsolutePath, subtitledAbsolutePath)
          update({
            ...baseUpdate,
            file_path: relativeVideoPath(subtitledAbsolutePath),
            subtitled_file_path: relativeVideoPath(subtitledAbsolutePath),
            subtitle_timing: cues,
            subtitle_render_status: 'success'
          })
        } catch (error) {
          try {
            fs.rmSync(subtitledAbsolutePath, { force: true })
          } catch (cleanupError) {
            log.warn('Unable to remove failed subtitle output:', cleanupError.message)
          }
          log.error('subtitle burn-in failed:', error.message)
          update({
            ...baseUpdate,
            subtitle_render_status: 'failed',
            subtitle_render_message: error.message
          })
        }
      } else {
        update(baseUpdate)
      }

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
  const videoPaths = new Set([
    video.file_path,
    video.clean_file_path,
    video.subtitled_file_path
  ].filter((filePath) => !isEmpty(filePath)))
  for (const filePath of videoPaths) {
    const videoPath = absoluteVideoPath(filePath)
    if (!isManagedVideoPath(videoPath)) {
      log.warn('Skipping video deletion outside managed directory:', videoPath)
      continue
    }
    if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath)
  }

  // 删除音频
  const audioPath = path.join(assetPath.model, video.audio_path ||'')
  if (!isEmpty(video.audio_path) && fs.existsSync(audioPath)) {
    fs.unlinkSync(audioPath)
  }

  // 删除视频表
  return deleteVideo(videoId)
}

function exportVideo(videoId, outputPath, variant = 'default') {
  const video = selectVideoByID(videoId)
  const selectedPath = variant === 'clean'
    ? video.clean_file_path || video.file_path
    : variant === 'subtitled'
      ? video.subtitled_file_path
      : video.file_path
  if (!selectedPath) throw new Error('所选视频版本尚不可用')
  const filePath = absoluteVideoPath(selectedPath)
  if (!fs.existsSync(filePath)) throw new Error('找不到所选视频文件')
  fs.copyFileSync(filePath, outputPath)
}

async function retrySubtitle(videoId) {
  const video = selectVideoByID(videoId)
  if (!video) throw new Error('找不到指定的视频作品')
  const subtitleStyle = normalizeSubtitleStyle(parseJSON(video.subtitle_style, {}))
  if (!subtitleStyle.enabled || !video.text_content?.trim()) throw new Error('该作品未启用字幕')
  subtitleStyle.burnEnabled = true
  const cleanPath = absoluteVideoPath(video.clean_file_path || video.file_path)
  if (!cleanPath || !fs.existsSync(cleanPath)) throw new Error('找不到无字幕版视频')
  if (!isManagedVideoPath(cleanPath)) throw new Error('无字幕版不在受管理的视频目录中')
  const parsedPath = path.parse(cleanPath)
  const outputPath = path.join(parsedPath.dir, `${parsedPath.name}.subtitled.mp4`)
  const cleanRelativePath = relativeVideoPath(cleanPath)
  update({
    id: videoId,
    file_path: cleanRelativePath,
    clean_file_path: cleanRelativePath,
    subtitled_file_path: null,
    subtitle_render_status: 'pending',
    subtitle_render_message: null,
    subtitle_style: subtitleStyle
  })
  try {
    fs.rmSync(outputPath, { force: true })
    const cues = await renderVideoSubtitles({ ...video, subtitle_style: subtitleStyle }, cleanPath, outputPath)
    const relativePath = relativeVideoPath(outputPath)
    const subtitleUpdate = {
      id: videoId,
      file_path: relativePath,
      subtitled_file_path: relativePath,
      subtitle_timing: cues,
      subtitle_render_status: 'success',
      subtitle_render_message: null
    }
    update(subtitleUpdate)
    return exposeVideoPaths(selectVideoByID(videoId))
  } catch (error) {
    fs.rmSync(outputPath, { force: true })
    update({ id: videoId, subtitle_render_status: 'failed', subtitle_render_message: error.message })
    throw error
  }
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
    return exportVideoSrt(...args)
  })
  ipcMain.handle(MODEL_NAME + '/retry-subtitle', (event, ...args) => {
    return retrySubtitle(...args)
  })
  ipcMain.handle(MODEL_NAME + '/replace-background', async (event, ...args) => {
    const [videoId, style, options] = args
    const sendProgress = (payload) => {
      if (event.sender && !event.sender.isDestroyed()) {
        event.sender.send('video/background-progress', { videoId, ...payload })
      }
    }
    return replaceVideoBackground(videoId, style, { ...(options || {}), progress: sendProgress })
  })
  ipcMain.handle(MODEL_NAME + '/preview-background', (event, ...args) => {
    return previewVideoBackground(...args)
  })
  ipcMain.handle(MODEL_NAME + '/remove', (event, ...args) => {
    return removeVideo(...args)
  })
}
