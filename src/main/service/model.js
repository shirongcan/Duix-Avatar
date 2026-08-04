import { ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import dayjs from 'dayjs'
import { isEmpty } from 'lodash'
import { insert, selectPage, count, selectByID, remove as deleteModel } from '../dao/f2f-model.js'
import { selectByID as selectVoiceByID } from '../dao/voice.js'
import { train as trainVoice } from './voice.js'
import { assetPath } from '../config/config.js'
import log from '../logger.js'
import { extractAudio, toH264 } from '../util/ffmpeg.js'
const MODEL_NAME = 'model'

/**
 * 新增模特
 * @param {string} modelName 模特名称
 * @param {string} videoPath 模特视频路径
 * @returns
 */
async function addModel(modelName, videoPath) {
  if (!fs.existsSync(assetPath.model)) {
    fs.mkdirSync(assetPath.model, {
      recursive: true
    })
  }
  // copy video to model video path
  const extname = path.extname(videoPath)
  const modelFileName = dayjs().format('YYYYMMDDHHmmssSSS') + extname
  const modelPath = path.join(assetPath.model, modelFileName)

  await toH264(videoPath, modelPath)

  // 用ffmpeg分离音频
  if (!fs.existsSync(assetPath.ttsTrain)) {
    fs.mkdirSync(assetPath.ttsTrain, {
      recursive: true
    })
  }
  const audioPath = path.join(assetPath.ttsTrain, modelFileName.replace(extname, '.wav'))
  return extractAudio(modelPath, audioPath).then(() => {
    // 训练语音模型
    const relativeAudioPath = path.relative(assetPath.ttsRoot, audioPath)
    if (process.env.NODE_ENV === 'development') {
      // TODO 写死调试
      return trainVoice('origin_audio/test.wav', 'zh')
    } else {
      return trainVoice(relativeAudioPath, 'zh')
    }
  }).then((voiceId)=>{
    // 插入模特信息
    const relativeModelPath = path.relative(assetPath.model, modelPath)
    const relativeAudioPath = path.relative(assetPath.ttsRoot, audioPath)

    // insert model info to db
    const id = insert({ modelName, videoPath: relativeModelPath, audioPath: relativeAudioPath, voiceId })
    return id
  })
}

function page({ page, pageSize, name = '' }) {
  const total = count(name)
  return {
    total,
    list: selectPage({ page, pageSize, name }).map((model) => {
      const voice = model.voice_id ? selectVoiceByID(model.voice_id) : null
      return {
        ...model,
        video_path: path.join(assetPath.model, model.video_path),
        audio_path: path.join(assetPath.ttsRoot, model.audio_path),
        reference_audio_text: voice?.reference_audio_text || '',
        reference_audio_url: resolveReferenceAudio(voice)
      }
    })
  }
}

function findModel(modelId) {
  const model = selectByID(modelId)
  const voice = model.voice_id ? selectVoiceByID(model.voice_id) : null
  return {
    ...model,
    video_path: path.join(assetPath.model, model.video_path),
    audio_path: path.join(assetPath.ttsRoot, model.audio_path),
    reference_audio_text: voice?.reference_audio_text || '',
    reference_audio_url: resolveReferenceAudio(voice)
  }
}

function removeModel(modelId) {
  const model = selectByID(modelId)
  log.debug('~ removeModel ~ modelId:', modelId)

  // 删除视频
  const videoPath = path.join(assetPath.model, model.video_path ||'')
  if (!isEmpty(model.video_path) && fs.existsSync(videoPath)) {
    fs.unlinkSync(videoPath)
  }

  // 删除音频
  const audioPath = path.join(assetPath.ttsRoot, model.audio_path ||'')
  if (!isEmpty(model.audio_path) && fs.existsSync(audioPath)) {
    fs.unlinkSync(audioPath)
  }

  deleteModel(modelId)
}

function countModel(name = '') {
  return count(name)
}

/**
 * 参考音频可能位于两个位置：
 * 1. 预处理产物 format_<原始文件名>.wav（服务端预处理时生成，通常保留在磁盘）
 * 2. 原始分离音频 <原始文件名>.wav（可能已被清理）
 * 优先返回实际存在的文件，用于前端试听。
 */
function resolveReferenceAudio(voice) {
  const origin = voice?.origin_audio_path || ''
  if (!origin) return ''
  const parsed = path.parse(origin)
  const candidates = [
    path.join(assetPath.ttsRoot, parsed.dir, `format_${parsed.base}`),
    path.join(assetPath.ttsRoot, parsed.dir, parsed.base)
  ]
  return candidates.find((candidate) => fs.existsSync(candidate)) || ''
}

export function init() {
  ipcMain.handle(MODEL_NAME + '/addModel', (event, ...args) => {
    return addModel(...args)
  })
  ipcMain.handle(MODEL_NAME + '/page', (event, ...args) => {
    return page(...args)
  })
  ipcMain.handle(MODEL_NAME + '/find', (event, ...args) => {
    return findModel(...args)
  })
  ipcMain.handle(MODEL_NAME + '/count', (event, ...args) => {
    return countModel(...args)
  })
  ipcMain.handle(MODEL_NAME + '/remove', (event, ...args) => {
    return removeModel(...args)
  })
}
