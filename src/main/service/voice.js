import { selectAll, insert, selectByID, updateReferenceText as updateReferenceTextDao } from '../dao/voice.js'
import { preprocessAndTran, makeAudio as makeAudioApi } from '../api/tts.js'
import { adjustAudioSpeed } from '../util/ffmpeg.js'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { assetPath } from '../config/config.js'
import log from '../logger.js'
import { ipcMain } from 'electron'
import dayjs from 'dayjs'

const MODEL_NAME = 'voice'
const TTS_CONTAINER = process.env.HEYGEM_TTS_CONTAINER || 'duix-avatar-tts'

export function normalizeSpeed(speed) {
  const value = Number(speed)
  if (!Number.isFinite(value) || value <= 0) return 1
  return Math.min(2, Math.max(0.5, value))
}

function runDockerCat(containerPath, timeoutMilliseconds = 60000) {
  return new Promise((resolve, reject) => {
    execFile(
      'docker',
      ['exec', TTS_CONTAINER, 'cat', containerPath],
      { encoding: 'buffer', maxBuffer: 256 * 1024 * 1024, timeout: timeoutMilliseconds },
      (error, stdout) => {
        if (error) reject(error)
        else resolve(stdout)
      }
    )
  })
}

function resolveSessionsCacheRoot() {
  return path.resolve(assetPath.ttsRoot, '..', 'sessions_cache')
}

/**
 * 将服务端容器内的参考音频路径映射为宿主机路径。
 * - /code/data/... 直接映射到 D:\duix_avatar_data\voice\data\...
 * - /code/sessions/... 映射到 voice\sessions_cache\...，不存在时用 docker exec cat 拷出缓存
 */
async function resolveReferenceAudioHostPath(containerPath) {
  if (containerPath.startsWith('/code/data/')) {
    const hostPath = path.join(assetPath.ttsRoot, containerPath.replace('/code/data/', ''))
    return fs.existsSync(hostPath) ? hostPath : ''
  }
  if (containerPath.startsWith('/code/sessions/')) {
    const relative = containerPath.replace('/code/sessions/', '')
    const hostPath = path.join(resolveSessionsCacheRoot(), relative)
    if (fs.existsSync(hostPath)) return hostPath
    try {
      fs.mkdirSync(path.dirname(hostPath), { recursive: true })
      const content = await runDockerCat(containerPath)
      fs.writeFileSync(hostPath, content, 'binary')
      return hostPath
    } catch (error) {
      log.warn('无法从 TTS 容器获取参考音频分片:', error.message)
      return ''
    }
  }
  return ''
}

/**
 * 返回该音色的参考音频分片列表（与参考文本分段一一对应），供逐段试听。
 */
export async function referenceAudioParts(voiceId) {
  const voice = selectByID(voiceId)
  if (!voice) return { parts: [], fullAudio: '' }
  const partPaths = (voice.asr_format_audio_url || '')
    .split('|||')
    .map((item) => item.trim())
    .filter(Boolean)

  const parts = []
  for (const containerPath of partPaths) {
    parts.push({
      available: true,
      path: await resolveReferenceAudioHostPath(containerPath)
    })
  }

  // 整段去噪音频（宿主机通常存在），作为兜底
  const origin = voice.origin_audio_path || ''
  const parsedOrigin = path.parse(origin)
  const fullAudio = parsedOrigin.base
    ? path.join(assetPath.ttsRoot, parsedOrigin.dir, `format_denoise_${parsedOrigin.base}`)
    : ''
  return {
    parts: parts.map((part) => ({
      ...part,
      available: part.available && Boolean(part.path)
    })),
    fullAudio: fs.existsSync(fullAudio) ? fullAudio : ''
  }
}

export function getAllTimbre() {
  return selectAll()
}

export function updateReferenceText(voiceId, referenceAudioText) {
  if (!voiceId || referenceAudioText === undefined || referenceAudioText === null) {
    return false
  }
  return updateReferenceTextDao(voiceId, String(referenceAudioText))
}

export async function train(path, lang = 'zh') {
  path = path.replace(/\\/g, '/') // 将路径中的\替换为/
  const res = await preprocessAndTran({
    format: path.split('.').pop(),
    reference_audio: path,
    lang
  })
  log.debug('~ train ~ res:', res)
  if (res.code !== 0) {
    return false
  } else {
    const { asr_format_audio_url, reference_audio_text } = res
    return insert({ origin_audio_path: path, lang, asr_format_audio_url, reference_audio_text })
  }
}

export function makeAudio4Video({voiceId, text, speed = 1}) {
  return makeAudio({voiceId, text, speed, targetDir: assetPath.ttsProduct})
}

export function copyAudio4Video(filePath) {
  // 将filePath复制到ttsProduct目录下
  const targetDir = assetPath.ttsProduct
  const fileName = dayjs().format('YYYYMMDDHHmmssSSS') + path.extname(filePath)
  const targetPath = path.join(targetDir, fileName)
  fs.copyFileSync(filePath, targetPath)
  return fileName
}

export async function makeAudio({voiceId, text, targetDir, speed = 1}) {
  const uuid = crypto.randomUUID()
  const voice = selectByID(voiceId)
  const speedValue = normalizeSpeed(speed)

  return makeAudioApi({
    speaker: uuid,
    text,
    format: 'wav',
    topP: 0.7,
    max_new_tokens: 1024,
    chunk_length: 100,
    repetition_penalty: 1.2,
    temperature: 0.7,
    need_asr: false,
    streaming: false,
    is_fixed_seed: 0,
    is_norm: 1,
    reference_audio: voice.asr_format_audio_url,
    reference_text: voice.reference_audio_text
  })
    .then((res) => {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, {
          recursive: true
        })
      }
      const finalPath = path.join(targetDir, `${uuid}.wav`)
      if (speedValue === 1) {
        fs.writeFileSync(finalPath, res, 'binary')
        return `${uuid}.wav`
      }
      // 服务端不支持语速参数，用 atempo 在本地调整播放速度
      const originalPath = path.join(targetDir, `${uuid}.original.wav`)
      fs.writeFileSync(originalPath, res, 'binary')
      return adjustAudioSpeed(originalPath, finalPath, speedValue).then(() => {
        fs.rmSync(originalPath, { force: true })
        return `${uuid}.wav`
      })
    })
    .catch((error) => {
      log.error('Error generating audio:', error)
      throw error
    })
}

/**
 * 试听音频
 * @param {string} voiceId
 * @param {string} text
 * @param {number} speed
 * @returns
 */
export async function audition(voiceId, text, speed = 1) {
  const tmpDir = require('os').tmpdir()
  console.log("🚀 ~ audition ~ tmpDir:", tmpDir)
  const audioPath = await makeAudio({ voiceId, text, speed, targetDir: tmpDir })
  return path.join(tmpDir, audioPath)
}

export function init() {
  ipcMain.handle(MODEL_NAME + '/audition', (event, ...args) => {
    return audition(...args)
  })
  ipcMain.handle(MODEL_NAME + '/updateReferenceText', (event, ...args) => {
    return updateReferenceText(...args)
  })
  ipcMain.handle(MODEL_NAME + '/referenceAudioParts', (event, ...args) => {
    return referenceAudioParts(...args)
  })
}
