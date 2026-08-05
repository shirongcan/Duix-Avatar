import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import ffmpeg from 'fluent-ffmpeg'

import {
  createPreviewClip,
  createSolidColorImage,
  isImageBackgroundFile,
  mergeAudioAndH264,
  normalizeBackgroundStyle,
  runRvmMatting,
  toContainerPath
} from '../src/main/util/background-pipeline.js'

const ffmpegExe = path.resolve('resources/ffmpeg/win-amd64/bin/ffmpeg.exe')
const ffprobeExe = path.resolve('resources/ffmpeg/win-amd64/bin/ffprobe.exe')
const face2faceRoot = 'D:/duix_avatar_data/face2face'

ffmpeg.setFfmpegPath(ffmpegExe)
ffmpeg.setFfprobePath(ffprobeExe)

function run(executable, args, cwd) {
  return execFileSync(executable, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

function dockerAvailable() {
  try {
    execFileSync('docker.exe', ['version', '--format', '{{.Server.Version}}'], {
      stdio: ['ignore', 'pipe', 'ignore']
    })
    return true
  } catch {
    return false
  }
}

function containerHasPostprocess() {
  try {
    execFileSync('docker.exe', [
      'exec', 'duix-avatar-gen-video', 'sh', '-c', 'test -f /postprocess/replace_background.py'
    ], { stdio: ['ignore', 'pipe', 'ignore'] })
    return true
  } catch {
    return false
  }
}

function inspect(file) {
  return JSON.parse(run(ffprobeExe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]))
}

test('normalizes background styles with color/image/video types', () => {
  assert.deepEqual(normalizeBackgroundStyle({ enabled: true, type: 'color', color: '#FF0000' }), {
    enabled: true,
    type: 'color',
    color: '#FF0000',
    imagePath: ''
  })
  assert.equal(normalizeBackgroundStyle({ enabled: true, type: 'image', imagePath: 'a.png' }).type, 'image')
  assert.equal(normalizeBackgroundStyle({ enabled: true, type: 'video', imagePath: 'a.mp4' }).type, 'video')
  assert.equal(normalizeBackgroundStyle({ enabled: true, color: 'not-a-color' }).color, '#FFFFFF')
  assert.equal(normalizeBackgroundStyle({ enabled: true, type: 'unknown' }).type, 'color')
  assert.equal(normalizeBackgroundStyle(null).enabled, false)
  assert.equal(isImageBackgroundFile('bg.png'), true)
  assert.equal(isImageBackgroundFile('bg.mp4'), false)
})

test('maps HeyGem data paths into the container and rejects outside paths', () => {
  assert.equal(
    toContainerPath(face2faceRoot, 'D:/duix_avatar_data/face2face/temp/xxx.mp4'),
    '/code/data/temp/xxx.mp4'
  )
  assert.throws(() => toContainerPath(face2faceRoot, 'C:/outside/xxx.mp4'), /必须位于 HeyGem 数据目录/)
  assert.throws(() => toContainerPath(face2faceRoot, 'D:/duix_avatar_data/other/xxx.mp4'), /必须位于 HeyGem 数据目录/)
})

test(
  'runs RVM matting in the docker container and merges the original audio',
  { skip: !fs.existsSync(ffmpegExe) || !dockerAvailable() || !containerHasPostprocess() },
  async () => {
    const directory = fs.mkdtempSync(path.join(face2faceRoot, 'temp', 'heygem-rvm-test-'))
    try {
      const portrait = path.resolve('tests/assets/person-frame.jpg')
      const source = path.join(directory, 'source.mp4')
      const bg = path.join(directory, 'bg.png')
      const silent = path.join(directory, 'silent.mp4')
      const output = path.join(directory, 'output.mp4')

      run(ffmpegExe, [
        '-y',
        '-loop', '1', '-i', portrait,
        '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1',
        '-vf', 'scale=640:360',
        '-t', '1', '-r', '10',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
        source
      ], directory)
      await createSolidColorImage('#1E90FF', bg, { width: 640, height: 360 })

      const progress = []
      await runRvmMatting({
        sourcePath: source,
        backgroundPath: bg,
        outputPath: silent,
        face2faceRoot,
        onProgress: (percent) => progress.push(percent)
      })
      assert.ok(fs.existsSync(silent), 'RVM should produce a silent video')
      assert.ok(progress.length > 0, 'RVM should report progress')
      assert.equal(progress.at(-1), 99)

      await mergeAudioAndH264(silent, source, output)
      const info = inspect(output)
      const videoStream = info.streams.find((stream) => stream.codec_type === 'video')
      const audioStream = info.streams.find((stream) => stream.codec_type === 'audio')
      assert.deepEqual([videoStream.width, videoStream.height], [640, 360])
      assert.equal(videoStream.codec_name, 'h264')
      assert.ok(audioStream, 'composited video should keep the source audio')
      assert.ok(Math.abs(Number(info.format.duration) - 1) < 0.25)

      const clip = path.join(directory, 'preview-clip.mp4')
      await createPreviewClip(source, clip)
      assert.ok(fs.existsSync(clip))
    } finally {
      fs.rmSync(directory, { recursive: true, force: true })
    }
  }
)
