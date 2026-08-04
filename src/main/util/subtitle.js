const SENTENCE_END = /[。！？!?；;]/
const SOFT_BREAK = /[，,、：:]/
const PUNCTUATION_ONLY = /^[\s。！？!?；;，,、：:]+$/

function visibleLength(text) {
  return Array.from(String(text || '').replace(/\s/g, '')).length
}

function splitLongSentence(sentence, maximumLength) {
  const segments = []
  let remainder = sentence.trim()
  while (visibleLength(remainder) > maximumLength) {
    const characters = Array.from(remainder)
    const minimum = Math.max(6, Math.floor(maximumLength * 0.45))
    let position = Math.min(maximumLength, characters.length)
    for (let index = position; index >= minimum; index--) {
      if (SOFT_BREAK.test(characters[index - 1]) || /\s/.test(characters[index - 1])) {
        position = index
        break
      }
    }
    const segment = characters.slice(0, position).join('').trim()
    remainder = characters.slice(position).join('').trim()
    if (segment) segments.push(segment)
    if (remainder && PUNCTUATION_ONLY.test(remainder)) {
      // 不要把句子末尾的标点单独拆成一条字幕
      if (segments.length) {
        segments[segments.length - 1] = `${segments.at(-1)}${remainder}`.trim()
      } else {
        segments.push(remainder)
      }
      remainder = ''
    }
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
  return sentences
    .flatMap((sentence) => splitLongSentence(sentence, maximumLength))
    .filter((segment) => !PUNCTUATION_ONLY.test(segment))
}

function cueWeight(text) {
  const last = text.at(-1) || ''
  return Math.max(1, visibleLength(text)) + (SENTENCE_END.test(last) ? 3 : SOFT_BREAK.test(last) ? 1.5 : 0.5)
}

function normalizeIntervals(intervals, duration) {
  if (!Array.isArray(intervals)) return []
  return intervals
    .map((interval) => ({
      start: Math.min(duration, Math.max(0, Number(interval?.start) || 0)),
      end: Math.min(duration, Math.max(0, Number(interval?.end) || 0))
    }))
    .filter((interval) => interval.end - interval.start >= 0.08)
    .sort((left, right) => left.start - right.start)
}

function partitionSpeechIntervals(segments, speechIntervals) {
  const cueCount = segments.length
  const intervalCount = speechIntervals.length
  if (!cueCount || cueCount > intervalCount) return null
  if (cueCount === 1) return [0]

  const speechWeights = segments.map((segment) => Math.max(1, visibleLength(segment)))
  const totalWeight = speechWeights.reduce((sum, weight) => sum + weight, 0)
  const intervalDurations = speechIntervals.map((interval) => interval.end - interval.start)
  const durationPrefix = [0]
  intervalDurations.forEach((intervalDuration) => {
    durationPrefix.push(durationPrefix.at(-1) + intervalDuration)
  })
  const totalSpeechDuration = durationPrefix.at(-1)
  const maximumIntervalsPerCue = Math.min(
    100,
    Math.max(4, Math.ceil((intervalCount / cueCount) * 3) + 2)
  )
  const costs = Array.from({ length: cueCount + 1 }, () =>
    Array(intervalCount + 1).fill(Number.POSITIVE_INFINITY)
  )
  const previous = Array.from({ length: cueCount + 1 }, () => Array(intervalCount + 1).fill(-1))
  costs[0][0] = 0

  for (let cueIndex = 1; cueIndex <= cueCount; cueIndex++) {
    const minimumEnd = cueIndex
    const maximumEnd = intervalCount - (cueCount - cueIndex)
    const expectedDuration = totalSpeechDuration * (speechWeights[cueIndex - 1] / totalWeight)

    for (let intervalEnd = minimumEnd; intervalEnd <= maximumEnd; intervalEnd++) {
      const minimumStart = Math.max(cueIndex - 1, intervalEnd - maximumIntervalsPerCue)
      for (let intervalStart = minimumStart; intervalStart < intervalEnd; intervalStart++) {
        const previousCost = costs[cueIndex - 1][intervalStart]
        if (!Number.isFinite(previousCost)) continue

        const groupDuration = durationPrefix[intervalEnd] - durationPrefix[intervalStart]
        const durationError = (groupDuration - expectedDuration) / Math.max(0.4, expectedDuration)
        const candidateCost = previousCost + durationError * durationError
        if (candidateCost < costs[cueIndex][intervalEnd]) {
          costs[cueIndex][intervalEnd] = candidateCost
          previous[cueIndex][intervalEnd] = intervalStart
        }
      }
    }
  }

  if (!Number.isFinite(costs[cueCount][intervalCount])) return null
  const intervalStarts = Array(cueCount)
  let intervalEnd = intervalCount
  for (let cueIndex = cueCount; cueIndex > 0; cueIndex--) {
    const intervalStart = previous[cueIndex][intervalEnd]
    if (intervalStart < 0) return null
    intervalStarts[cueIndex - 1] = intervalStart
    intervalEnd = intervalStart
  }
  return intervalStarts
}

function createAudioAlignedCues(segments, duration, speechIntervals) {
  const intervals = normalizeIntervals(speechIntervals, duration)
  if (!intervals.length || segments.length < 1) return null
  const intervalStarts = partitionSpeechIntervals(segments, intervals)
  if (!intervalStarts) return null

  return segments.map((text, index) => ({
    text,
    start: intervals[intervalStarts[index]].start,
    end:
      index === segments.length - 1
        ? Math.max(intervals[intervalStarts[index]].start + 0.1, intervals.at(-1).end)
        : intervals[intervalStarts[index + 1]].start
  }))
}

function tokenCharacters(value) {
  return Array.from(String(value || '').normalize('NFKC').toLowerCase()).filter((character) =>
    /[\p{L}\p{N}]/u.test(character)
  )
}

function extractAsrCharacters(subtitleTiming, duration) {
  if (!Array.isArray(subtitleTiming?.stamp_sents)) return []
  const result = []

  subtitleTiming.stamp_sents.forEach((sentence) => {
    const timestampList = Array.isArray(sentence?.ts_list) ? sentence.ts_list : []
    const rawTokens = String(sentence?.text_seg || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
    let tokenGroups = rawTokens.map(tokenCharacters)

    if (tokenGroups.length !== timestampList.length) {
      const characters = tokenCharacters(sentence?.text_seg)
      if (characters.length === timestampList.length) {
        tokenGroups = characters.map((character) => [character])
      }
    }

    const pairCount = Math.min(tokenGroups.length, timestampList.length)
    for (let index = 0; index < pairCount; index++) {
      const characters = tokenGroups[index]
      const timestamp = timestampList[index]
      if (!characters.length || !Array.isArray(timestamp) || timestamp.length < 2) continue

      const tokenStart = Math.min(duration, Math.max(0, Number(timestamp[0]) / 1000 || 0))
      const tokenEnd = Math.min(
        duration,
        Math.max(tokenStart + 0.01, Number(timestamp[1]) / 1000 || tokenStart + 0.01)
      )
      const characterDuration = (tokenEnd - tokenStart) / characters.length
      characters.forEach((character, characterIndex) => {
        result.push({
          character,
          start: tokenStart + characterDuration * characterIndex,
          end: tokenStart + characterDuration * (characterIndex + 1)
        })
      })
    }
  })

  return result.sort((left, right) => left.start - right.start)
}

function createSourceCharacters(segments) {
  return segments.flatMap((segment, cueIndex) =>
    tokenCharacters(segment).map((character) => ({ character, cueIndex }))
  )
}

function alignCharacters(sourceCharacters, asrCharacters) {
  const sourceLength = sourceCharacters.length
  const asrLength = asrCharacters.length
  if (!sourceLength || !asrLength || sourceLength * asrLength > 4000000) return null

  const costs = Array.from({ length: sourceLength + 1 }, () => new Float64Array(asrLength + 1))
  const operations = Array.from({ length: sourceLength + 1 }, () => new Uint8Array(asrLength + 1))

  for (let sourceIndex = 1; sourceIndex <= sourceLength; sourceIndex++) {
    costs[sourceIndex][0] = sourceIndex
    operations[sourceIndex][0] = 2
  }
  for (let asrIndex = 1; asrIndex <= asrLength; asrIndex++) {
    costs[0][asrIndex] = asrIndex
    operations[0][asrIndex] = 3
  }

  for (let sourceIndex = 1; sourceIndex <= sourceLength; sourceIndex++) {
    for (let asrIndex = 1; asrIndex <= asrLength; asrIndex++) {
      const exact =
        sourceCharacters[sourceIndex - 1].character === asrCharacters[asrIndex - 1].character
      const diagonalCost = costs[sourceIndex - 1][asrIndex - 1] + (exact ? 0 : 1.5)
      const deletionCost = costs[sourceIndex - 1][asrIndex] + 1
      const insertionCost = costs[sourceIndex][asrIndex - 1] + 1

      if (diagonalCost <= deletionCost && diagonalCost <= insertionCost) {
        costs[sourceIndex][asrIndex] = diagonalCost
        operations[sourceIndex][asrIndex] = 1
      } else if (deletionCost <= insertionCost) {
        costs[sourceIndex][asrIndex] = deletionCost
        operations[sourceIndex][asrIndex] = 2
      } else {
        costs[sourceIndex][asrIndex] = insertionCost
        operations[sourceIndex][asrIndex] = 3
      }
    }
  }

  const exactMappings = Array(sourceLength).fill(-1)
  const approximateMappings = Array(sourceLength).fill(-1)
  let exactMatchCount = 0
  let sourceIndex = sourceLength
  let asrIndex = asrLength
  while (sourceIndex > 0 || asrIndex > 0) {
    const operation = operations[sourceIndex][asrIndex]
    if (operation === 1) {
      sourceIndex--
      asrIndex--
      approximateMappings[sourceIndex] = asrIndex
      if (sourceCharacters[sourceIndex].character === asrCharacters[asrIndex].character) {
        exactMappings[sourceIndex] = asrIndex
        exactMatchCount++
      }
    } else if (operation === 2) {
      sourceIndex--
    } else if (operation === 3) {
      asrIndex--
    } else {
      break
    }
  }

  const coverage = exactMatchCount / Math.max(1, Math.min(sourceLength, asrLength))
  if (coverage < 0.35) return null
  return { exactMappings, approximateMappings, coverage }
}

function createAsrAlignedCues(segments, duration, subtitleTiming) {
  if (!Array.isArray(subtitleTiming?.stamp_sents) || !subtitleTiming.stamp_sents.length) return null
  const asrCharacters = extractAsrCharacters(subtitleTiming, duration)
  if (!asrCharacters.length) return null
  const sourceCharacters = createSourceCharacters(segments)
  const alignment = alignCharacters(sourceCharacters, asrCharacters)
  if (!alignment) return null

  const cueStarts = Array(segments.length).fill(null)
  for (let cueIndex = 0; cueIndex < segments.length; cueIndex++) {
    const sourceIndexes = []
    sourceCharacters.forEach((sourceCharacter, sourceIndex) => {
      if (sourceCharacter.cueIndex === cueIndex) sourceIndexes.push(sourceIndex)
    })
    const exactSourceIndex = sourceIndexes.find(
      (sourceIndex) => alignment.exactMappings[sourceIndex] >= 0
    )
    const approximateSourceIndex = sourceIndexes.find(
      (sourceIndex) => alignment.approximateMappings[sourceIndex] >= 0
    )
    const mappedSourceIndex = exactSourceIndex ?? approximateSourceIndex
    if (mappedSourceIndex !== undefined) {
      const asrIndex =
        alignment.exactMappings[mappedSourceIndex] >= 0
          ? alignment.exactMappings[mappedSourceIndex]
          : alignment.approximateMappings[mappedSourceIndex]
      cueStarts[cueIndex] = asrCharacters[asrIndex].start
    }
  }

  if (cueStarts.some((start) => start === null)) return null
  let previousStart = -0.08
  for (let index = 0; index < cueStarts.length; index++) {
    cueStarts[index] = Math.min(
      Math.max(0, duration - 0.05),
      Math.max(0, previousStart + 0.08, cueStarts[index])
    )
    previousStart = cueStarts[index]
  }

  return segments.map((text, index) => ({
    text,
    start: cueStarts[index],
    end: index === segments.length - 1 ? duration : cueStarts[index + 1]
  }))
}

export function createSubtitleCues(
  text,
  durationSeconds,
  speechIntervals = [],
  cachedTiming = null,
  asrTiming = null
) {
  const duration = Number(durationSeconds)
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('视频时长无效，无法生成字幕')
  const segments = splitSubtitleText(text)
  if (!segments.length) throw new Error('该作品没有可用的字幕文稿')

  if (Array.isArray(cachedTiming) && cachedTiming.length === segments.length) {
    const cached = cachedTiming.map((cue, index) => ({
      text: segments[index],
      start: Math.min(duration, Math.max(0, Number(cue?.start) || 0)),
      end: Math.min(duration, Math.max(0, Number(cue?.end) || 0))
    }))
    if (cached.every((cue, index) => cue.end > cue.start && (!index || cue.start >= cached[index - 1].start))) {
      return cached
    }
  }

  const asrAlignedCues = createAsrAlignedCues(segments, duration, asrTiming)
  if (asrAlignedCues) return asrAlignedCues

  const audioAlignedCues = createAudioAlignedCues(segments, duration, speechIntervals)
  if (audioAlignedCues) return audioAlignedCues

  const weights = segments.map(cueWeight)
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  const minimum = Math.min(1, duration / segments.length * 0.7)
  const flexible = Math.max(0, duration - minimum * segments.length)
  let cursor = 0
  return segments.map((segment, index) => {
    const start = cursor
    const cueDuration = index === segments.length - 1 ? duration - cursor : minimum + flexible * weights[index] / totalWeight
    const end = index === segments.length - 1 ? duration : Math.min(duration, cursor + cueDuration)
    cursor = end
    return { text: segment, start, end }
  })
}

function formatAssTime(seconds) {
  const total = Math.max(0, Math.round(seconds * 100))
  const centiseconds = total % 100
  const totalSeconds = Math.floor(total / 100)
  const second = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  const minute = totalMinutes % 60
  const hour = Math.floor(totalMinutes / 60)
  return `${hour}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`
}

function assColor(value, fallback) {
  const hex = /^#?([0-9a-f]{6})$/i.exec(String(value || ''))?.[1] || fallback
  return `&H00${hex.slice(4, 6)}${hex.slice(2, 4)}${hex.slice(0, 2)}`.toUpperCase()
}

function escapeAssText(text) {
  return String(text).replaceAll('\\', '\\\\').replaceAll('{', '\\{').replaceAll('}', '\\}').replace(/\r?\n/g, '\\N')
}

export function normalizeSubtitleStyle(style = {}) {
  const outlineWidth = Number(style.outlineWidth)
  const burnEnabled = Boolean(style.burnEnabled)
  return {
    enabled: Boolean(style.enabled || burnEnabled),
    burnEnabled,
    fontSize: Math.min(72, Math.max(24, Number(style.fontSize) || 42)),
    textColor: /^#[0-9a-f]{6}$/i.test(style.textColor) ? style.textColor.toUpperCase() : '#FFFFFF',
    outlineColor: /^#[0-9a-f]{6}$/i.test(style.outlineColor) ? style.outlineColor.toUpperCase() : '#000000',
    outlineWidth: Number.isFinite(outlineWidth) ? Math.min(8, Math.max(0, outlineWidth)) : 3,
    position: ['top', 'middle', 'bottom'].includes(style.position) ? style.position : 'bottom',
    verticalOffset: Math.min(160, Math.max(-160, Number(style.verticalOffset) || 0))
  }
}

export function createAss(
  text,
  durationSeconds,
  style = {},
  speechIntervals = [],
  cachedTiming = null,
  asrTiming = null
) {
  const normalized = normalizeSubtitleStyle(style)
  const alignment = { top: 8, middle: 5, bottom: 2 }[normalized.position]
  const baseY = { 8: 64, 5: 540, 2: 1008 }[alignment]
  const positionY = Math.min(1050, Math.max(30, baseY + normalized.verticalOffset))
  const primaryColor = assColor(normalized.textColor, 'FFFFFF')
  const outlineColor = assColor(normalized.outlineColor, '000000')
  const cues = createSubtitleCues(text, durationSeconds, speechIntervals, cachedTiming, asrTiming)
  const header = `[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Microsoft YaHei,${normalized.fontSize},${primaryColor},${primaryColor},${outlineColor},&H60000000,-1,0,0,0,100,100,0,0,1,${normalized.outlineWidth},0,${alignment},60,60,0,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`
  const events = cues.map((cue) => `Dialogue: 0,${formatAssTime(cue.start)},${formatAssTime(cue.end)},Default,,0,0,0,,{\\an${alignment}\\pos(960,${positionY})}${escapeAssText(cue.text)}`)
  return { content: `${header}\n${events.join('\n')}\n`, cues }
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

export function createSrtFromCues(cues) {
  if (!Array.isArray(cues) || !cues.length) throw new Error('没有可导出的字幕时间轴')
  return (
    cues
      .map(
        (cue, index) =>
          `${index + 1}\n${formatSrtTime(cue.start)} --> ${formatSrtTime(cue.end)}\n${cue.text}`
      )
      .join('\n\n') + '\n'
  )
}
