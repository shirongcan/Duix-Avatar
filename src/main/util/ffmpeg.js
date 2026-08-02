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
