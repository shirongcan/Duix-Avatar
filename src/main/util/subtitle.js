const SENTENCE_END = /[。！？!?；;]/
const SOFT_BREAK = /[，,、：:]/

function visibleLength(text) {
  return Array.from(text.replace(/\s/g, '')).length
}

function findBreakPosition(characters, maximumLength) {
  const minimumLength = Math.max(6, Math.floor(maximumLength * 0.45))
  for (
    let index = Math.min(maximumLength, characters.length - 1);
    index >= minimumLength;
    index--
  ) {
    if (SOFT_BREAK.test(characters[index - 1])) return index
  }

  for (
    let index = Math.min(maximumLength, characters.length - 1);
    index >= minimumLength;
    index--
  ) {
    if (/\s/.test(characters[index - 1])) return index
  }
  return Math.min(maximumLength, characters.length)
}

function splitLongSentence(sentence, maximumLength = 24) {
  const segments = []
  let remainder = sentence.trim()

  while (visibleLength(remainder) > maximumLength) {
    const characters = Array.from(remainder)
    const position = findBreakPosition(characters, maximumLength)
    const segment = characters.slice(0, position).join('').trim()
    if (segment) segments.push(segment)
    remainder = characters.slice(position).join('').trim()
  }

  if (remainder) segments.push(remainder)
  return segments
}

export function splitSubtitleText(text, maximumLength = 24) {
  const normalized = String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim()

  if (!normalized) return []

  const sentences = normalized.match(/[^。！？!?；;\n]+[。！？!?；;]?/g) || []
  return sentences.flatMap((sentence) => splitLongSentence(sentence, maximumLength))
}

function cueWeight(text) {
  const lengthWeight = Math.max(1, visibleLength(text))
  const pauseWeight = SENTENCE_END.test(text.at(-1) || '')
    ? 3
    : SOFT_BREAK.test(text.at(-1) || '')
      ? 1.5
      : 0.5
  return lengthWeight + pauseWeight
}

function mergeForDuration(segments, durationSeconds) {
  const maximumCues = Math.max(1, Math.floor(durationSeconds / 1.1))
  const result = [...segments]

  while (result.length > maximumCues) {
    let mergeIndex = 0
    let smallestWeight = Number.POSITIVE_INFINITY
    for (let index = 0; index < result.length - 1; index++) {
      const weight = cueWeight(result[index]) + cueWeight(result[index + 1])
      if (weight < smallestWeight) {
        smallestWeight = weight
        mergeIndex = index
      }
    }
    result.splice(mergeIndex, 2, `${result[mergeIndex]}${result[mergeIndex + 1]}`)
  }
  return result
}

function formatSrtTime(seconds) {
  const totalMilliseconds = Math.max(0, Math.round(seconds * 1000))
  const milliseconds = totalMilliseconds % 1000
  const totalSeconds = Math.floor(totalMilliseconds / 1000)
  const second = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  const minute = totalMinutes % 60
  const hour = Math.floor(totalMinutes / 60)

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`
}

function createSubtitleCues(text, durationSeconds) {
  const duration = Number(durationSeconds)
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error('视频时长无效，无法生成字幕')
  }

  const initialSegments = splitSubtitleText(text)
  if (!initialSegments.length) {
    throw new Error('该作品没有可导出的原始文案')
  }

  const segments = mergeForDuration(initialSegments, duration)
  const weights = segments.map(cueWeight)
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  const minimumDuration = Math.min(1, (duration / segments.length) * 0.75)
  const remainingDuration = Math.max(0, duration - minimumDuration * segments.length)
  let cursor = 0

  return segments.map((text, index) => {
    const cueDuration =
      index === segments.length - 1
        ? duration - cursor
        : minimumDuration + remainingDuration * (weights[index] / totalWeight)
    const start = cursor
    const end = index === segments.length - 1 ? duration : Math.min(duration, cursor + cueDuration)
    cursor = end
    return { text, start, end }
  })
}

export function createSrt(text, durationSeconds) {
  return createSubtitleCues(text, durationSeconds)
    .map((cue, index) => {
      return `${index + 1}\n${formatSrtTime(cue.start)} --> ${formatSrtTime(cue.end)}\n${cue.text}\n`
    })
    .join('\n')
}

function formatAssTime(seconds) {
  const totalCentiseconds = Math.max(0, Math.round(seconds * 100))
  const centiseconds = totalCentiseconds % 100
  const totalSeconds = Math.floor(totalCentiseconds / 100)
  const second = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  const minute = totalMinutes % 60
  const hour = Math.floor(totalMinutes / 60)
  return `${hour}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`
}

function assColor(hexColor, fallback) {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(hexColor || ''))
  const hex = match?.[1] || fallback
  const red = hex.slice(0, 2)
  const green = hex.slice(2, 4)
  const blue = hex.slice(4, 6)
  return `&H00${blue}${green}${red}`.toUpperCase()
}

function escapeAssText(text) {
  return String(text)
    .replaceAll('\\', '\\\\')
    .replaceAll('{', '\\{')
    .replaceAll('}', '\\}')
    .replace(/\r?\n/g, '\\N')
}

export function createAss(text, durationSeconds, style = {}) {
  const fontSize = Math.min(72, Math.max(24, Number(style.fontSize) || 42))
  const outlineWidth = Math.min(8, Math.max(0, Number(style.outlineWidth) || 3))
  const alignment = { top: 8, middle: 5, bottom: 2 }[style.position] || 2
  const marginV = alignment === 2 ? 72 : alignment === 8 ? 54 : 0
  const verticalOffset = Math.min(160, Math.max(-160, Number(style.verticalOffset) || 0))
  const baseY = { 8: 64, 5: 540, 2: 1008 }[alignment]
  const positionY = Math.min(1050, Math.max(30, baseY + verticalOffset))
  const primaryColor = assColor(style.textColor, 'FFFFFF')
  const outlineColor = assColor(style.outlineColor, '000000')
  const cues = createSubtitleCues(text, durationSeconds)

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Microsoft YaHei,${fontSize},${primaryColor},${primaryColor},${outlineColor},&H60000000,-1,0,0,0,100,100,0,0,1,${outlineWidth},0,${alignment},60,60,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`

  const events = cues.map((cue) => {
    return `Dialogue: 0,${formatAssTime(cue.start)},${formatAssTime(cue.end)},Default,,0,0,0,,{\\an${alignment}\\pos(960,${positionY})}${escapeAssText(cue.text)}`
  })
  return `${header}\n${events.join('\n')}\n`
}
