import { ipcMain } from 'electron'
import { execFile } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import ffmpeg from 'fluent-ffmpeg'
import { assetPath } from '../config/config.js'
import { selectByID as selectVideoByID } from '../dao/video.js'
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

async function replaceBackground(videoId, backgroundPath, outputPath) {
  if (!backgroundPath || !outputPath) {
    throw new Error('请选择背景和输出位置')
  }

  const video = selectVideoByID(videoId)
  if (!video?.file_path) {
    throw new Error('找不到已生成的视频')
  }

  fs.mkdirSync(stagingDirectory, { recursive: true })
  const sourcePath = path.join(assetPath.model, video.file_path)
  const taskId = crypto.randomUUID()
  const backgroundExtension = path.extname(backgroundPath).toLowerCase()
  const stagedBackgroundPath = path.join(stagingDirectory, `${taskId}-background${backgroundExtension}`)
  const silentOutputPath = path.join(stagingDirectory, `${taskId}-silent.mp4`)

  try {
    fs.copyFileSync(backgroundPath, stagedBackgroundPath)
    await runMatting(sourcePath, stagedBackgroundPath, silentOutputPath)
    await mergeOriginalAudio(silentOutputPath, sourcePath, outputPath)
    return outputPath
  } finally {
    for (const temporaryPath of [stagedBackgroundPath, silentOutputPath]) {
      try {
        fs.rmSync(temporaryPath, { force: true })
      } catch (error) {
        log.warn('Unable to remove temporary postprocess file:', temporaryPath, error.message)
      }
    }
  }
}

export function init() {
  ipcMain.handle(`${MODEL_NAME}/replace`, (event, ...args) => replaceBackground(...args))
}
