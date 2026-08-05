import { execFile } from 'child_process'
import fs from 'fs'
import path from 'path'
import ffmpeg from 'fluent-ffmpeg'

export const RVM_CONTAINER = 'duix-avatar-gen-video'
export const RVM_SCRIPT = '/postprocess/replace_background.py'
export const RVM_MODEL = '/postprocess/models/rvm_mobilenetv3_fp16.torchscript'

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.bmp', '.webp']

export function normalizeBackgroundStyle(style) {
  const value = style && typeof style === 'object' ? style : {}
  const type = value.type === 'image' || value.type === 'video' ? value.type : 'color'
  return {
    enabled: Boolean(value.enabled),
    type,
    color: /^#[0-9a-fA-F]{6}$/.test(value.color) ? value.color : '#FFFFFF',
    imagePath: typeof value.imagePath === 'string' ? value.imagePath : ''
  }
}

export function isImageBackgroundFile(filePath) {
  return IMAGE_EXTENSIONS.includes(path.extname(filePath).toLowerCase())
}

/**
 * 把 HeyGem 数据目录（face2face 根目录）下的宿主机路径映射为容器内路径。
 */
export function toContainerPath(face2faceRoot, hostPath) {
  const relativePath = path.relative(face2faceRoot, hostPath)
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('处理文件必须位于 HeyGem 数据目录中')
  }
  return `/code/data/${relativePath.replaceAll('\\', '/')}`
}

/**
 * 检查容器内是否已经挂载了 /postprocess 脚本（未挂载时给出明确提示）。
 */
export function checkContainerPostprocess() {
  return new Promise((resolve) => {
    execFile(
      'docker.exe',
      ['exec', RVM_CONTAINER, 'sh', '-c', `test -f ${RVM_SCRIPT}`],
      { windowsHide: true },
      (error) => resolve(!error)
    )
  })
}

/**
 * 调用容器里的 RVM 脚本做抠像换背景（图片或视频背景均可）。
 * 源视频、背景、输出都必须位于 face2faceRoot 之下（会被挂载为 /code/data）。
 */
export function runRvmMatting({
  sourcePath,
  backgroundPath,
  outputPath,
  face2faceRoot,
  modelPath = RVM_MODEL,
  onProgress = () => {}
}) {
  const args = [
    'exec',
    RVM_CONTAINER,
    'python3',
    RVM_SCRIPT,
    '--source',
    toContainerPath(face2faceRoot, sourcePath),
    '--background',
    toContainerPath(face2faceRoot, backgroundPath),
    '--output',
    toContainerPath(face2faceRoot, outputPath),
    '--model',
    modelPath
  ]

  return new Promise((resolve, reject) => {
    const child = execFile(
      'docker.exe',
      args,
      { windowsHide: true, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const detail = (stderr || '').trim() || error.message
          reject(new Error(detail))
          return
        }
        resolve(outputPath)
      }
    )
    child.stdout?.on('data', (chunk) => {
      const text = String(chunk)
      const match = text.match(/PROGRESS\s+(\d+)/)
      if (match) onProgress(Math.min(99, Math.max(0, Number(match[1]))))
    })
    child.stderr?.on('data', (chunk) => {
      const text = String(chunk)
      const match = text.match(/PROGRESS\s+(\d+)/)
      if (match) onProgress(Math.min(99, Math.max(0, Number(match[1]))))
    })
  })
}

/**
 * 把 RVM 产出的无声视频与原音频合并，并统一转成 H.264（兼容性与体积更好）。
 */
export function mergeAudioAndH264(silentVideoPath, sourcePath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(silentVideoPath)
      .input(sourcePath)
      .outputOptions([
        '-map', '0:v:0',
        '-map', '1:a:0?',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '18',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-movflags', '+faststart',
        '-shortest'
      ])
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .save(outputPath)
  })
}

/**
 * 生成一个 1 秒 10fps 的短片段，用于预览换背景效果。
 */
export function createPreviewClip(sourcePath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(sourcePath)
      .seekInput(0)
      .noAudio()
      .outputOptions([
        '-t', '1',
        '-r', '10',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p'
      ])
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .save(outputPath)
  })
}

/**
 * 生成纯色背景图片（RVM 只接受图片/视频文件，颜色需要转成图片）。
 */
export function createSolidColorImage(hexColor, outputPath, size = { width: 1920, height: 1080 }) {
  const color = String(hexColor || '#FFFFFF').replace('#', '')
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(`color=c=0x${color}:s=${size.width}x${size.height}`)
      .inputOptions(['-f', 'lavfi'])
      .outputOptions(['-frames:v', '1'])
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .save(outputPath)
  })
}

/**
 * 抽取视频第一帧为图片（用于背景替换预览）。
 */
export function extractFirstFrame(videoPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .seekInput(0)
      .outputOptions(['-frames:v', '1'])
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .save(outputPath)
  })
}
