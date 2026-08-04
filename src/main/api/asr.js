import fs from 'fs'
import WebSocket from 'ws'

const DEFAULT_ASR_URL = 'ws://127.0.0.1:10095'
const PCM_CHUNK_SIZE = 32000
const MAX_BUFFERED_BYTES = 512 * 1024

function waitForSocketBuffer(socket) {
  if (socket.bufferedAmount <= MAX_BUFFERED_BYTES) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const check = () => {
      if (socket.readyState !== WebSocket.OPEN) {
        reject(new Error('语音识别连接已断开'))
        return
      }
      if (socket.bufferedAmount <= MAX_BUFFERED_BYTES) {
        resolve()
        return
      }
      setTimeout(check, 10)
    }
    check()
  })
}

function send(socket, data) {
  return new Promise((resolve, reject) => {
    socket.send(data, (error) => (error ? reject(error) : resolve()))
  })
}

/**
 * 将 16 kHz、单声道、s16le PCM 交给本机 FunASR，返回逐字时间戳。
 */
export function transcribePcmWithTimestamps(pcmPath, options = {}) {
  const asrUrl = options.url || process.env.HEYGEM_ASR_URL || DEFAULT_ASR_URL
  const timeoutMilliseconds = Math.max(10000, Number(options.timeoutMilliseconds) || 120000)

  return new Promise((resolve, reject) => {
    const socket = new WebSocket(asrUrl)
    let settled = false
    const timeout = setTimeout(() => finish(new Error('语音时间轴识别超时')), timeoutMilliseconds)

    function finish(error, result) {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close()
      }
      if (error) reject(error)
      else resolve(result)
    }

    socket.on('open', async () => {
      try {
        const pcm = fs.readFileSync(pcmPath)
        await send(
          socket,
          JSON.stringify({
            mode: 'offline',
            chunk_size: [5, 10, 5],
            chunk_interval: 10,
            audio_fs: 16000,
            wav_name: 'subtitle-timing',
            wav_format: 'pcm',
            is_speaking: true,
            hotwords: '',
            itn: true
          })
        )

        for (let offset = 0; offset < pcm.length; offset += PCM_CHUNK_SIZE) {
          await waitForSocketBuffer(socket)
          await send(socket, pcm.subarray(offset, Math.min(pcm.length, offset + PCM_CHUNK_SIZE)))
        }
        await send(socket, JSON.stringify({ is_speaking: false }))
      } catch (error) {
        finish(error)
      }
    })

    socket.on('message', (data) => {
      try {
        const result = JSON.parse(data.toString())
        if (Array.isArray(result.stamp_sents) && result.stamp_sents.length > 0) {
          finish(null, result)
        }
      } catch (error) {
        finish(new Error(`语音识别结果解析失败：${error.message}`))
      }
    })
    socket.on('error', (error) => finish(new Error(`无法连接本机语音识别服务：${error.message}`)))
    socket.on('close', () => {
      if (!settled) finish(new Error('语音识别连接已关闭，未返回时间轴'))
    })
  })
}
