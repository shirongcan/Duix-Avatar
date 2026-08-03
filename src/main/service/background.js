import { ipcMain } from 'electron'
import { execFile } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import ffmpeg from 'fluent-ffmpeg'
import { assetPath } from '../config/config.js'
import { selectByID as selectVideoByID } from '../dao/video.js'
import {
  hasEnabledCover,
  hasEnabledSubtitles,
  renderVideoCover,
  renderVideoSubtitles
} from './video.js'
import log from '../logger.js'

const MODEL_NAME = 'background'
const face2faceRoot = path.dirname(assetPath.model)
const stagingDirectory = path.join(face2faceRoot, 'postprocess')

function toContainerPath(windowsPath) {
  const relativePath = path.relative(face2faceRoot, windowsPath)
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('处理文件必须位于 HeyGem 数据目录中')
  }
  return `/code/data/${relativePath.replaceAll('\\', '/')}`
}

function runMatting(sourcePath, backgroundPath, silentOutputPath) {
  const args = [
    'exec',
    'duix-avatar-gen-video',
    'python3',
    '/postprocess/replace_background.py',
    '--source',
    toContainerPath(sourcePath),
    '--background',
    toContainerPath(backgroundPath),
    '--output',
    toContainerPath(silentOutputPath),
    '--model',
    '/postprocess/models/rvm_mobilenetv3_fp16.torchscript'
  ]

  return new Promise((resolve, reject) => {
    execFile('docker.exe', args, { windowsHide: true, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        log.error('Background replacement failed:', stderr || error.message)
        reject(new Error((stderr || error.message).trim()))
        return
      }
      log.info('Background replacement completed:', stdout.trim())
      resolve()
    })
  })
}

function mergeOriginalAudio(silentVideoPath, sourcePath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(silentVideoPath)
      .input(sourcePath)
      .outputOptions(['-map 0:v:0', '-map 1:a:0?', '-c:v copy', '-c:a aac', '-shortest'])
      .on('end', resolve)
      .on('error', reject)
      .save(outputPath)
  })
}

function resolveCleanSourcePath(video) {
  const candidates = []
  if (video.source_file_path) candidates.push(video.source_file_path)

  if (video.file_path) {
    const parsedPath = path.parse(video.file_path)
    if (parsedPath.name.endsWith('.subtitled')) {
      candidates.push(path.join(parsedPath.dir, `${parsedPath.name.slice(0, -'.subtitled'.length)}${parsedPath.ext}`))
    } else {
      candidates.push(video.file_path)
    }
  }

  const sourceFilePath = candidates.find((candidate) => fs.existsSync(path.join(assetPath.model, candidate)))
  if (!sourceFilePath) throw new Error('找不到可用于背景处理的无字幕视频')
  return path.join(assetPath.model, sourceFilePath)
}

async function replaceBackground(videoId, backgroundPath, outputPath, options = {}, onProgress = () => {}) {
  if (!backgroundPath || !outputPath) {
    throw new Error('请选择背景和输出位置')
  }

  const video = selectVideoByID(videoId)
  if (!video?.file_path) {
    throw new Error('找不到已生成的视频')
  }

  fs.mkdirSync(stagingDirectory, { recursive: true })
  const sourcePath = resolveCleanSourcePath(video)
  const taskId = crypto.randomUUID()
  const backgroundExtension = path.extname(backgroundPath).toLowerCase()
  const stagedBackgroundPath = path.join(stagingDirectory, `${taskId}-background${backgroundExtension}`)
  const silentOutputPath = path.join(stagingDirectory, `${taskId}-silent.mp4`)
  const audioOutputPath = path.join(stagingDirectory, `${taskId}-audio.mp4`)
  const subtitleOutputPath = path.join(stagingDirectory, `${taskId}-subtitled.mp4`)
  const includeSubtitles = options.includeSubtitles !== false && hasEnabledSubtitles(video)
  const includeCover = hasEnabledCover(video)
  const requiresPostProcessing = includeSubtitles || includeCover

  try {
    fs.copyFileSync(backgroundPath, stagedBackgroundPath)
    onProgress('background')
    await runMatting(sourcePath, stagedBackgroundPath, silentOutputPath)
    onProgress('audio')
    await mergeOriginalAudio(silentOutputPath, sourcePath, requiresPostProcessing ? audioOutputPath : outputPath)
    let processedPath = audioOutputPath
    if (includeSubtitles) {
      onProgress('subtitles')
      await renderVideoSubtitles(video, processedPath, includeCover ? subtitleOutputPath : outputPath)
      processedPath = subtitleOutputPath
    }
    if (includeCover) {
      onProgress('cover')
      await renderVideoCover(video, processedPath, outputPath)
    }
    onProgress('complete')
    return outputPath
  } finally {
    for (const temporaryPath of [stagedBackgroundPath, silentOutputPath, audioOutputPath, subtitleOutputPath]) {
      try {
        fs.rmSync(temporaryPath, { force: true })
      } catch (error) {
        log.warn('Unable to remove temporary postprocess file:', temporaryPath, error.message)
      }
    }
  }
}

export function init() {
  ipcMain.handle(`${MODEL_NAME}/replace`, (event, videoId, backgroundPath, outputPath, options = {}) =>
    replaceBackground(
      videoId,
      backgroundPath,
      outputPath,
      options,
      (phase) => event.sender.send(`${MODEL_NAME}/progress`, phase)
    )
  )
}
