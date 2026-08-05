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
      // TTS 服务端 ASR 按 16kHz 单声道 s16le 切块发送，必须先把声道归一，
      // 否则立体声音频会以交错采样被当作单声道识别，产生乱码文本
      .audioChannels(1)
      .audioFrequency(16000)
      .audioCodec('pcm_s16le')
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

export async function detectSpeechIntervals(inputPath) {
  const duration = Number(await getVideoDuration(inputPath))
  const silences = []
  let silenceStart = null
  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFilters('silencedetect=noise=-40dB:d=0.15')
      .format('null')
      .output('-')
      .on('stderr', (line) => {
        const start = /silence_start:\s*([\d.]+)/.exec(line)
        if (start) silenceStart = Number(start[1])
        const end = /silence_end:\s*([\d.]+)/.exec(line)
        if (end && silenceStart !== null) {
          silences.push({ start: silenceStart, end: Number(end[1]) })
          silenceStart = null
        }
      })
      .on('end', resolve)
      .on('error', reject)
      .run()
  })
  if (silenceStart !== null) silences.push({ start: silenceStart, end: duration })
  const speech = []
  let cursor = 0
  for (const silence of silences) {
    const start = Math.min(duration, Math.max(cursor, silence.start))
    if (start - cursor >= 0.08) speech.push({ start: cursor, end: start })
    cursor = Math.min(duration, Math.max(cursor, silence.end))
  }
  if (duration - cursor >= 0.08) speech.push({ start: cursor, end: duration })
  return speech
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
      .on('end', () => resolve(outputPath))
      .on('error', reject)
  })
}

/**
 * 将音频转为 FunASR 时间轴识别所需的 16 kHz 单声道裸 PCM。
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
 * 使用 atempo 调整音频播放速度（支持 0.5 ~ 2.0）。
 */
export function adjustAudioSpeed(inputPath, outputPath, speed) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioFilters(`atempo=${speed}`)
      .audioCodec('pcm_s16le')
      .save(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (error) => reject(error))
  })
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
    const exec = require('child_process').exec;
    exec('nvidia-smi', (error, stdout, stderr) => {
      if (error || stderr) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

export function getVideoDuration(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath).ffprobe((err, data) => {
      if (err) {
        log.error("🚀 ~ ffmpeg ~ err:", err)
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
