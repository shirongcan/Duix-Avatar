import { selectAll, insert, selectByID } from '../dao/voice.js'
import { preprocessAndTran, makeAudio as makeAudioApi } from '../api/tts.js'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { assetPath } from '../config/config.js'
import log from '../logger.js'
import { ipcMain } from 'electron'
import dayjs from 'dayjs'
import { transcribePcmWithTimestamps } from '../api/asr.js'
import { concatAudioSegments, convertAudioToAsrPcm } from '../util/ffmpeg.js'
import { evaluateTtsTranscript, splitTtsText } from '../util/tts-text.js'

const MODEL_NAME = 'voice'
const TTS_SERVICE_CHUNK_LENGTH = 300
const TTS_MAX_ATTEMPTS = 3

export function getAllTimbre() {
  return selectAll()
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

export function makeAudio4Video({voiceId, text, onProgress}) {
  return makeAudio({voiceId, text, targetDir: assetPath.ttsProduct, onProgress})
}

export function copyAudio4Video(filePath) {
  // 将filePath复制到ttsProduct目录下
  const targetDir = assetPath.ttsProduct
  const fileName = dayjs().format('YYYYMMDDHHmmssSSS') + path.extname(filePath)
  const targetPath = path.join(targetDir, fileName)
  fs.copyFileSync(filePath, targetPath)
  return fileName
}

function createTtsSeed(voiceId, text, segmentIndex, attempt) {
  const digest = crypto
    .createHash('sha256')
    .update(`${voiceId}|${text}|${segmentIndex}|${attempt}`)
    .digest()
  return digest.readUInt32BE(0) & 0x7fffffff
}

function removeTemporaryFile(filePath) {
  if (!filePath) return
  try {
    fs.rmSync(filePath, { force: true })
  } catch (error) {
    log.warn('Unable to remove temporary TTS file:', error.message)
  }
}

async function verifyAudioSegment(audioPath, expectedText) {
  const parsedPath = path.parse(audioPath)
  const pcmPath = path.join(parsedPath.dir, `${parsedPath.name}.verify.pcm`)

  try {
    await convertAudioToAsrPcm(audioPath, pcmPath)
    const result = await transcribePcmWithTimestamps(pcmPath, { timeoutMilliseconds: 60000 })
    const transcript = result?.text || result?.stamp_sents
      ?.map((sentence) => sentence.text_seg || '')
      .join('') || ''
    return { skipped: false, transcript, ...evaluateTtsTranscript(expectedText, transcript) }
  } finally {
    removeTemporaryFile(pcmPath)
  }
}

function buildTtsParams({ speaker, text, voice, seed }) {
  return {
    speaker,
    text,
    format: 'wav',
    topP: 0.7,
    max_new_tokens: 1024,
    chunk_length: TTS_SERVICE_CHUNK_LENGTH,
    repetition_penalty: 1.2,
    temperature: 0.7,
    need_asr: false,
    streaming: false,
    seed,
    is_norm: 1,
    reference_audio: voice.asr_format_audio_url,
    reference_text: voice.reference_audio_text
  }
}

export async function makeAudio({voiceId, text, targetDir, onProgress}) {
  const uuid = crypto.randomUUID()
  const voice = selectByID(voiceId)
  if (!voice) throw new Error('找不到所选音色')

  const segments = splitTtsText(text)
  if (segments.length === 0) throw new Error('请输入需要转换为语音的文字')

  fs.mkdirSync(targetDir, { recursive: true })
  const outputName = `${uuid}.wav`
  const outputPath = path.join(targetDir, outputName)
  const completedSegmentPaths = []

  try {
    for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
      const segmentText = segments[segmentIndex]
      let completedPath = null

      for (let attempt = 1; attempt <= TTS_MAX_ATTEMPTS; attempt++) {
        onProgress?.({ phase: 'generating', index: segmentIndex + 1, total: segments.length, attempt })
        const segmentPath = path.join(
          targetDir,
          `${uuid}.part-${String(segmentIndex + 1).padStart(3, '0')}.attempt-${attempt}.wav`
        )
        const seed = createTtsSeed(voiceId, segmentText, segmentIndex, attempt)
        const response = await makeAudioApi(
          buildTtsParams({
            speaker: `${uuid}-${segmentIndex + 1}-${attempt}`,
            text: segmentText,
            voice,
            seed
          })
        )
        fs.writeFileSync(segmentPath, response, 'binary')

        let verification
        try {
          onProgress?.({ phase: 'verifying', index: segmentIndex + 1, total: segments.length, attempt })
          verification = await verifyAudioSegment(segmentPath, segmentText)
        } catch (error) {
          log.warn('Unable to verify TTS segment; keeping generated audio:', error.message)
          verification = { passed: true, skipped: true }
        }

        if (verification.passed) {
          completedPath = segmentPath
          log.info(
            `TTS segment ${segmentIndex + 1}/${segments.length} accepted`,
            verification.skipped ? '(verification unavailable)' : `coverage=${verification.coverage.toFixed(3)}`
          )
          break
        }

        log.warn(
          `TTS segment ${segmentIndex + 1}/${segments.length} incomplete; retrying`,
          `coverage=${verification.coverage.toFixed(3)}`,
          `end=${verification.endCoverage.toFixed(3)}`
        )
        removeTemporaryFile(segmentPath)
      }

      if (!completedPath) {
        throw new Error(`第 ${segmentIndex + 1} 段语音连续生成不完整，请重新生成`)
      }
      completedSegmentPaths.push(completedPath)
    }

    onProgress?.({ phase: 'merging', index: segments.length, total: segments.length, attempt: 1 })
    if (completedSegmentPaths.length === 1) {
      fs.renameSync(completedSegmentPaths[0], outputPath)
      completedSegmentPaths.length = 0
    } else {
      await concatAudioSegments(completedSegmentPaths, outputPath)
    }
    return outputName
  } catch (error) {
    removeTemporaryFile(outputPath)
    log.error('Error generating audio:', error)
    throw error
  } finally {
    completedSegmentPaths.forEach(removeTemporaryFile)
  }
}

/**
 * 试听音频
 * @param {string} voiceId
 * @param {string} text
 * @returns
 */
export async function audition(voiceId, text) {
  const tmpDir = require('os').tmpdir()
  console.log("🚀 ~ audition ~ tmpDir:", tmpDir)
  const audioPath = await makeAudio({ voiceId, text, targetDir: tmpDir })
  return path.join(tmpDir, audioPath)
}

export function init() {
  ipcMain.handle(MODEL_NAME + '/audition', (event, ...args) => {
    return audition(...args)
  })
}
