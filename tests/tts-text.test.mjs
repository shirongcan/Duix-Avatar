import assert from 'node:assert/strict'
import test from 'node:test'

import {
  evaluateTtsTranscript,
  normalizeTtsComparisonText,
  splitTtsText
} from '../src/main/util/tts-text.js'

test('keeps the start of a new paragraph out of the previous TTS segment', () => {
  const text = `我们常常有一种错觉，觉得别人一直在看着自己。

说错一句话，回家以后还在反复回想；做了一件尴尬的事，几天过去了。`
  const segments = splitTtsText(text)

  assert.equal(segments[0], '我们常常有一种错觉，觉得别人一直在看着自己。')
  assert.ok(segments[1].startsWith('说错一句话'))
  assert.ok(!segments[0].includes('说错一句话'))
})

test('splits long sentences without dropping text', () => {
  const text = '仍然觉得别人一定记得；发了一条朋友圈，也会忍不住猜测，别人会怎么评价。'
  const segments = splitTtsText(text, 60)

  assert.ok(segments.length > 1)
  assert.ok(segments.every((segment) => Buffer.byteLength(segment, 'utf8') <= 60))
  assert.equal(segments.join(''), text)
})

test('rejects the observed opening filler and missing final clause', () => {
  const expected = '我们常常有一种错觉，觉得别人一直在看着自己。说错一句话，'
  const actual = '哦哦，常常有一种错觉，觉得别人一直在看着自己。'
  const result = evaluateTtsTranscript(expected, actual)

  assert.equal(result.passed, false)
  assert.ok(result.endCoverage < 0.55)
})

test('allows minor ASR substitutions while keeping the sentence complete', () => {
  const expected = '心理学把这种现象叫作聚光灯效应。'
  const actual = '心理学把这种现象叫做聚光灯效应。'
  const result = evaluateTtsTranscript(expected, actual)

  assert.equal(result.passed, true)
  assert.ok(result.coverage > 0.9)
})

test('comparison normalization removes punctuation and whitespace', () => {
  assert.equal(normalizeTtsComparisonText(' 你 好，World！\n'), '你好world')
})
