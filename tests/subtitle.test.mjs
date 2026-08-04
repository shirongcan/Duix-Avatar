import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createAss,
  createSrtFromCues,
  createSubtitleCues,
  normalizeSubtitleStyle,
  splitSubtitleText
} from '../src/main/util/subtitle.js'

test('splits Chinese punctuation and preserves all text', () => {
  const text = '第一句话。第二句话！第三句话？'
  assert.deepEqual(splitSubtitleText(text), ['第一句话。', '第二句话！', '第三句话？'])
  assert.equal(splitSubtitleText(text).join(''), text)
})

test('splits long captions without dropping content', () => {
  const text = '这是一个非常长的字幕句子，需要在逗号附近合理拆分，避免单行文字超出画面安全区域。'
  const segments = splitSubtitleText(text, 18)
  assert.ok(segments.length > 1)
  assert.equal(segments.join(''), text)
  assert.ok(segments.every((segment) => Array.from(segment).length <= 18))
})

test('never emits a punctuation-only subtitle', () => {
  const text =
    '因为在很多情况下，群体经验确实能够提供有效的信息。 例如： 一家餐厅长期获得大量好评，可能说明它确实不错； 一个科学理论被大量研究者接受，通常说明它经过了长期检验。'
  const segments = splitSubtitleText(text)
  assert.ok(segments.length >= 4)
  assert.ok(segments.every((segment) => !/^[\s。！？!?；;，,、：:]+$/.test(segment)))
  assert.equal(segments.join('').replace(/\s/g, ''), text.replace(/\s/g, ''))
})

test('returns no segments for empty scripts', () => {
  assert.deepEqual(splitSubtitleText('  \n '), [])
})

test('uses speech timestamps when enough intervals exist', () => {
  const cues = createSubtitleCues('第一句。第二句。', 8, [
    { start: 1, end: 2 },
    { start: 4, end: 6 }
  ])
  assert.equal(cues[0].start, 1)
  assert.equal(cues[0].end, 4)
  assert.equal(cues[1].start, 4)
  assert.equal(cues[1].end, 6)
})

test('aligns cues to ASR timestamps when available', () => {
  const text = '第一句话。第二句话。'
  const asrTiming = {
    stamp_sents: [
      {
        text_seg: '第 一 句 话',
        ts_list: [[1000, 1100], [1100, 1200], [1200, 1300], [1300, 1400]]
      },
      {
        text_seg: '第 二 句 话',
        ts_list: [[2500, 2600], [2600, 2700], [2700, 2800], [2800, 2900]]
      }
    ]
  }
  const cues = createSubtitleCues(text, 6, [], null, asrTiming)
  assert.ok(Math.abs(cues[0].start - 1) < 0.01)
  assert.ok(Math.abs(cues[1].start - 2.5) < 0.01)
  assert.equal(cues[1].end, 6)
  assert.equal(cues.length, 2)
})

test('falls back to a complete monotonic timeline', () => {
  const cues = createSubtitleCues('第一句。第二句。第三句。', 9)
  assert.equal(cues[0].start, 0)
  assert.equal(cues.at(-1).end, 9)
  assert.ok(cues.every((cue) => cue.end > cue.start))
})

test('normalizes style boundaries and escapes ASS text', () => {
  const style = normalizeSubtitleStyle({
    enabled: true,
    burnEnabled: true,
    fontSize: 200,
    outlineWidth: -4,
    position: 'unknown',
    textColor: 'bad'
  })
  assert.equal(style.fontSize, 72)
  assert.equal(style.outlineWidth, 0)
  assert.equal(style.position, 'bottom')
  assert.equal(style.textColor, '#FFFFFF')
  const { content } = createAss('花括号{测试}\\路径。', 3, style)
  assert.match(content, /PlayResX: 1920/)
  assert.match(content, /PlayResY: 1080/)
  assert.ok(content.includes('\\{测试\\}'))
  assert.ok(content.includes('\\\\路径'))
})

test('burn intent always enables subtitles', () => {
  const style = normalizeSubtitleStyle({ enabled: false, burnEnabled: true })
  assert.equal(style.enabled, true)
  assert.equal(style.burnEnabled, true)
})

test('formats SRT cues with standard timestamps and blank-line separation', () => {
  const srt = createSrtFromCues([
    { text: '大家好！', start: 0.159, end: 1.564 },
    { text: '今天的话题。', start: 1.564, end: 4.5 }
  ])
  assert.equal(
    srt,
    '1\n00:00:00,159 --> 00:00:01,564\n大家好！\n\n2\n00:00:01,564 --> 00:00:04,500\n今天的话题。\n'
  )
})

test('rejects SRT export without usable cues', () => {
  assert.throws(() => createSrtFromCues([]), /没有可导出的字幕时间轴/)
  assert.throws(() => createSrtFromCues(null), /没有可导出的字幕时间轴/)
})
