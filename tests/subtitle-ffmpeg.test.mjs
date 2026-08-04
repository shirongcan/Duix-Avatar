import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { createAss } from '../src/main/util/subtitle.js'

const ffmpeg = path.resolve('resources/ffmpeg/win-amd64/bin/ffmpeg.exe')
const ffprobe = path.resolve('resources/ffmpeg/win-amd64/bin/ffprobe.exe')

function run(executable, args, cwd) {
  return execFileSync(executable, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

test('burns subtitles while preserving a matching clean video', { skip: !fs.existsSync(ffmpeg) }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'heygem-subtitle-test-'))
  try {
    const clean = path.join(directory, 'clean.mp4')
    const subtitled = path.join(directory, 'subtitled.mp4')
    const ass = path.join(directory, 'subtitle.ass')
    const { content } = createAss('这是字幕烧录测试。', 3, {
      enabled: true,
      burnEnabled: true,
      fontSize: 52,
      textColor: '#FFFFFF',
      outlineColor: '#000000',
      outlineWidth: 3,
      position: 'bottom',
      verticalOffset: -20
    })
    fs.writeFileSync(ass, `\ufeff${content}`, 'utf8')

    run(ffmpeg, [
      '-y', '-f', 'lavfi', '-i', 'color=c=#29405f:s=640x360:d=3:r=25',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-shortest',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', clean
    ], directory)
    run(ffmpeg, [
      '-y', '-i', 'clean.mp4', '-vf', 'ass=subtitle.ass', '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p', '-c:a', 'copy', 'subtitled.mp4'
    ], directory)

    const inspect = (file) => JSON.parse(run(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], directory))
    const cleanInfo = inspect(clean)
    const subtitledInfo = inspect(subtitled)
    const cleanVideo = cleanInfo.streams.find((stream) => stream.codec_type === 'video')
    const subtitleVideo = subtitledInfo.streams.find((stream) => stream.codec_type === 'video')
    const cleanAudio = cleanInfo.streams.find((stream) => stream.codec_type === 'audio')
    const subtitleAudio = subtitledInfo.streams.find((stream) => stream.codec_type === 'audio')
    assert.deepEqual([subtitleVideo.width, subtitleVideo.height], [cleanVideo.width, cleanVideo.height])
    assert.equal(subtitleAudio.codec_name, cleanAudio.codec_name)
    assert.ok(Math.abs(Number(subtitledInfo.format.duration) - Number(cleanInfo.format.duration)) < 0.08)

    const frameHash = (file) => run(ffmpeg, ['-v', 'error', '-ss', '1', '-i', file, '-frames:v', '1', '-f', 'md5', '-'], directory).trim()
    assert.notEqual(frameHash(clean), frameHash(subtitled))
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})
