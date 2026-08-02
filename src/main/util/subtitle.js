const SENTENCE_END = /[。！？!?；;]/
const SOFT_BREAK = /[，,、：:]/

function visibleLength(text) {
  return Array.from(text.replace(/\s/g, '')).length
}

function findBreakPosition(characters, maximumLength) {
  const minimumLength = Math.max(6, Math.floor(maximumLength * 0.45))
  for (let index = Math.min(maximumLength, characters.length - 1); index >= minimumLength; index--) {
    if (SOFT_BREAK.test(characters[index - 1])) return index
  }

  for (let index = Math.min(maximumLength, characters.length - 1); index >= minimumLength; index--) {
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

export function createSrt(text, durationSeconds) {
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

  return segments.map((segment, index) => {
    const cueDuration = index === segments.length - 1
      ? duration - cursor
      : minimumDuration + remainingDuration * (weights[index] / totalWeight)
    const start = cursor
    const end = index === segments.length - 1 ? duration : Math.min(duration, cursor + cueDuration)
    cursor = end
    return `${index + 1}\n${formatSrtTime(start)} --> ${formatSrtTime(end)}\n${segment}\n`
  }).join('\n')
}
