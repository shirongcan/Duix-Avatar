import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import { app } from 'electron'
import log from '../logger.js'

function initFFmpeg() {
  const ffmpegPath = {
    'development-win32': path.join(__dirname, '../../resources/ffmpeg/win-amd64/bin/ffmpeg.exe'),
    'development-linux': path.join(__dirname, '../../resources/ffmpeg/linux-amd64/ffmpeg'),
    'production-win32': path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'resources',
      'ffmpeg',
      'win-amd64',
      'bin',
      'ffmpeg.exe'
    ),
    'production-linux': path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'resources',
      'ffmpeg',
      'linux-amd64',
      'ffmpeg'
    )
  }

  const runtimeEnvironment = app.isPackaged ? 'production' : 'development'
  const ffmpegPathValue = ffmpegPath[`${runtimeEnvironment}-${process.platform}`]
  log.debug('ENV:', `${runtimeEnvironment}-${process.platform}`)
  log.info('FFmpeg path:', ffmpegPathValue)
  ffmpeg.setFfmpegPath(ffmpegPathValue)

  const ffprobePath = {
    'development-win32': path.join(__dirname, '../../resources/ffmpeg/win-amd64/bin/ffprobe.exe'),
    'development-linux': path.join(__dirname, '../../resources/ffmpeg/linux-amd64/ffprobe'),
    'production-win32': path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'resources',
      'ffmpeg',
      'win-amd64',
      'bin',
      'ffprobe.exe'
    ),
    'production-linux': path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'resources',
      'ffmpeg',
      'linux-amd64',
      'ffprobe'
    )
  }

  const ffprobePathValue = ffprobePath[`${runtimeEnvironment}-${process.platform}`]
  log.info('FFprobe path:', ffprobePathValue)
  ffmpeg.setFfprobePath(ffprobePathValue)
}

initFFmpeg()

export function extractAudio(videoPath, audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .save(audioPath)
      .on('end', () => {
        log.info('audio split done')
        resolve(true)
      })
      .on('error', (err) => {
        reject(err)
      })
  })
}

/**
 * 在音频开头补静音，让数字人出场后稍作停顿再开口。
 */
export function prependAudioSilence(inputPath, outputPath, durationSeconds = 1.5) {
  const delayMilliseconds = Math.max(0, Math.round(Number(durationSeconds) * 1000))

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioFilters(`adelay=${delayMilliseconds}:all=1`)
      .audioCodec('pcm_s16le')
      .audioFrequency(44100)
      .save(outputPath)
      .on('end', () => {
        log.info('audio lead-in silence added:', outputPath)
        resolve(outputPath)
      })
      .on('error', (err) => {
        log.error('adding audio lead-in silence failed:', err.message)
        reject(err)
      })
  })
}

/**
 * 转为 FunASR 时间轴识别所需的 16 kHz 单声道裸 PCM。
 */
export function convertAudioToAsrPcm(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioChannels(1)
      .audioFrequency(16000)
      .audioCodec('pcm_s16le')
      .format('s16le')
      .save(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (error) => reject(error))
  })
}

/**
 * 检测音频中的真实说话区间，用于让字幕切换贴近语音停顿。
 */
export async function detectSpeechIntervals(inputPath) {
  const duration = Number(await getVideoDuration(inputPath))
  const silenceIntervals = []
  let silenceStart = null

  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFilters('silencedetect=noise=-40dB:d=0.15')
      .format('null')
      .output('-')
      .on('stderr', (line) => {
        const startMatch = /silence_start:\s*([\d.]+)/.exec(line)
        if (startMatch) silenceStart = Number(startMatch[1])

        const endMatch = /silence_end:\s*([\d.]+)/.exec(line)
        if (endMatch && silenceStart !== null) {
          silenceIntervals.push({ start: silenceStart, end: Number(endMatch[1]) })
          silenceStart = null
        }
      })
      .on('end', resolve)
      .on('error', reject)
      .run()
  })

  if (silenceStart !== null) {
    silenceIntervals.push({ start: silenceStart, end: duration })
  }

  const speechIntervals = []
  let cursor = 0
  silenceIntervals.forEach((silence) => {
    const silenceStartTime = Math.min(duration, Math.max(cursor, silence.start))
    if (silenceStartTime - cursor >= 0.08) {
      speechIntervals.push({ start: cursor, end: silenceStartTime })
    }
    cursor = Math.min(duration, Math.max(cursor, silence.end))
  })
  if (duration - cursor >= 0.08) {
    speechIntervals.push({ start: cursor, end: duration })
  }

  log.info('speech intervals detected:', speechIntervals.length)
  return speechIntervals
}

export async function toH264(videoPath, outputPath) {
  // const hasNvidia = await detectNvidia()
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .videoCodec('libx264')
      .outputOptions('-pix_fmt yuv420p')
      .save(outputPath)
      .on('end', () => {
        log.info('video convert to h264 done')
        resolve(true)
      })
      .on('error', (err) => {
        reject(err)
      })
  })
}

function detectNvidia() {
  return new Promise((resolve) => {
    const exec = require('child_process').exec
    exec('nvidia-smi', (error, stdout, stderr) => {
      if (error || stderr) {
        resolve(false)
      } else {
        resolve(true)
      }
    })
  })
}

export function getVideoDuration(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath).ffprobe((err, data) => {
      if (err) {
        log.error('🚀 ~ ffmpeg ~ err:', err)
        reject(err)
      } else if (data && data.streams && data.streams.length > 0) {
        resolve(data.streams[0].duration) // 单位秒
      } else {
        log.error('No streams found')
        reject(new Error('No streams found'))
      }
    })
  })
}

function clamp(value, min, max) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : min
}

/**
 * 使用 FFmpeg 内置滤镜对成片做轻量美颜，不依赖额外的人脸模型。
 */
export function applyBeautyFilter(inputPath, outputPath, beauty = {}) {
  const smoothing = clamp(beauty.smoothing, 0, 100)
  const brighten = clamp(beauty.brighten, 0, 100)
  const rosy = clamp(beauty.rosy, 0, 100)
  const filters = []

  if (smoothing > 0) {
    filters.push(
      `hqdn3d=${(smoothing * 0.06).toFixed(2)}:${(smoothing * 0.045).toFixed(2)}:${(smoothing * 0.09).toFixed(2)}:${(smoothing * 0.0675).toFixed(2)}`
    )
  }
  if (brighten > 0) {
    filters.push(
      `eq=brightness=${(brighten * 0.0012).toFixed(3)}:gamma=${(1 + brighten * 0.0015).toFixed(3)}:saturation=1.02`
    )
  }
  if (rosy > 0) {
    const red = (rosy * 0.0012).toFixed(3)
    const blue = (-rosy * 0.00045).toFixed(3)
    filters.push(`colorbalance=rm=${red}:rh=${red}:bm=${blue}:bh=${blue}`)
  }

  if (!filters.length) return Promise.resolve(inputPath)

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters(filters)
      .videoCodec('libx264')
      .audioCodec('copy')
      .outputOptions(['-preset medium', '-crf 18', '-pix_fmt yuv420p', '-movflags +faststart'])
      .save(outputPath)
      .on('end', () => {
        log.info('beauty filter done:', outputPath)
        resolve(outputPath)
      })
      .on('error', (err) => {
        log.error('beauty filter failed:', err.message)
        reject(err)
      })
  })
}

export function burnAssSubtitles(inputPath, outputPath, assPath) {
  const escapedAssPath = assPath.replaceAll('\\', '/').replaceAll(':', '\\:').replaceAll("'", "\\'")

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters(`ass='${escapedAssPath}'`)
      .videoCodec('libx264')
      .audioCodec('copy')
      .outputOptions(['-preset medium', '-crf 18', '-pix_fmt yuv420p', '-movflags +faststart'])
      .save(outputPath)
      .on('end', () => {
        log.info('subtitle burn-in done:', outputPath)
        resolve(outputPath)
      })
      .on('error', (err) => {
        log.error('subtitle burn-in failed:', err.message)
        reject(err)
      })
  })
}
