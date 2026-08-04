import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveVideoSaveSource } from '../src/main/util/video-revision.js'

test('creates a TTS revision without reusing the source generated audio', () => {
  const source = { status: 'success', audio_path: 'old-generated.wav' }
  const resolved = resolveVideoSaveSource({
    source_video_id: 12,
    audio_source: 'tts',
    audio_path: 'old-generated.wav'
  }, source)

  assert.deepEqual(resolved, { audioSource: 'tts', audioPath: null })
  assert.equal(source.audio_path, 'old-generated.wav')
})

test('uses the source upload when a revision does not select a replacement audio file', () => {
  const resolved = resolveVideoSaveSource({
    source_video_id: 7,
    audio_source: 'upload'
  }, { status: 'failed', audio_path: 'original.wav' }, (value) => `D:/managed/${value}`)

  assert.deepEqual(resolved, { audioSource: 'upload', audioPath: 'D:/managed/original.wav' })
})

test('allows an existing draft to keep using an explicitly selected upload', () => {
  const resolved = resolveVideoSaveSource({
    id: 3,
    audio_source: 'upload',
    audio_path: 'D:/incoming/new.wav'
  })

  assert.deepEqual(resolved, { audioSource: 'upload', audioPath: 'D:/incoming/new.wav' })
})

test('rejects overwriting the source and revising active work', () => {
  assert.throws(
    () => resolveVideoSaveSource({ id: 2, source_video_id: 1 }, { status: 'success' }),
    /不能覆盖原作品/
  )
  for (const status of ['draft', 'waiting', 'pending']) {
    assert.throws(
      () => resolveVideoSaveSource({ source_video_id: 1 }, { status }),
      /当前状态不允许/
    )
  }
})

test('requires a usable upload but permits an empty optional script', () => {
  assert.throws(
    () => resolveVideoSaveSource({ source_video_id: 1, audio_source: 'upload' }, { status: 'success' }),
    /找不到上传音频/
  )
  const request = { audio_source: 'upload', audio_path: 'voice.wav', text_content: '' }
  assert.equal(resolveVideoSaveSource(request).audioPath, 'voice.wav')
  assert.equal(request.text_content, '')
})
