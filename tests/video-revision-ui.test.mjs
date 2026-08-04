import assert from 'node:assert/strict'
import test from 'node:test'

import {
  canGenerateSubtitle,
  inheritRevisionSubtitleStyle
} from '../src/renderer/src/utils/video-revision.js'

test('a revision burns subtitles when the source had subtitles enabled', () => {
  assert.deepEqual(inheritRevisionSubtitleStyle({
    enabled: true,
    burnEnabled: false,
    fontSize: 42
  }), {
    enabled: true,
    burnEnabled: true,
    fontSize: 42
  })
})

test('a revision keeps subtitles disabled when the source disabled them', () => {
  assert.equal(inheritRevisionSubtitleStyle({ enabled: false }).burnEnabled, false)
})

test('offers subtitle generation for a completed clean video with an enabled script', () => {
  assert.equal(canGenerateSubtitle({
    status: 'success',
    text_content: '需要烧录的字幕',
    subtitle_style: JSON.stringify({ enabled: true, burnEnabled: false }),
    subtitled_file_path: null
  }), true)
})

test('does not offer subtitle generation without text or for an existing subtitle output', () => {
  assert.equal(canGenerateSubtitle({ status: 'success', text_content: '', subtitle_style: { enabled: true } }), false)
  assert.equal(canGenerateSubtitle({
    status: 'success',
    text_content: '已有字幕',
    subtitle_style: { enabled: true },
    subtitled_file_path: 'ready.subtitled.mp4'
  }), false)
})
