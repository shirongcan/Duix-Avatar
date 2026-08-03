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

function normalizeSpeechIntervals(speechIntervals, duration) {
  if (!Array.isArray(speechIntervals)) return []
  return speechIntervals
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
  const intervals = normalizeSpeechIntervals(speechIntervals, duration)
  if (!intervals.length || segments.length < 1) return null
  const intervalStarts = partitionSpeechIntervals(segments, intervals)
  if (!intervalStarts) return null

  return segments.map((text, index) => ({
    text,
    start: intervals[intervalStarts[index]].start,
    end: index === segments.length - 1 ? duration : intervals[intervalStarts[index + 1]].start
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

function createAsrAlignedCues(segments, duration, startOffset, subtitleTiming) {
  const asrCharacters = extractAsrCharacters(subtitleTiming, duration)
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
  let previousStart = Math.max(0, startOffset - 0.08)
  for (let index = 0; index < cueStarts.length; index++) {
    cueStarts[index] = Math.min(
      Math.max(0, duration - 0.05),
      Math.max(startOffset, previousStart + 0.08, cueStarts[index])
    )
    previousStart = cueStarts[index]
  }

  return segments.map((text, index) => ({
    text,
    start: cueStarts[index],
    end: index === segments.length - 1 ? duration : cueStarts[index + 1]
  }))
}

function createSubtitleCues(
  text,
  durationSeconds,
  startOffsetSeconds = 0,
  speechIntervals = [],
  subtitleTiming = null
) {
  const duration = Number(durationSeconds)
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error('视频时长无效，无法生成字幕')
  }

  const startOffset = Math.min(
    Math.max(0, Number(startOffsetSeconds) || 0),
    Math.max(0, duration - 0.1)
  )
  const spokenDuration = duration - startOffset

  const initialSegments = splitSubtitleText(text)
  if (!initialSegments.length) {
    throw new Error('该作品没有可导出的原始文案')
  }

  const segments = mergeForDuration(initialSegments, spokenDuration)
  const weights = segments.map(cueWeight)
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  const asrAlignedCues = createAsrAlignedCues(segments, duration, startOffset, subtitleTiming)
  if (asrAlignedCues) return asrAlignedCues
  const alignedCues = createAudioAlignedCues(segments, duration, speechIntervals)
  if (alignedCues) return alignedCues

  const minimumDuration = Math.min(1, (spokenDuration / segments.length) * 0.75)
  const remainingDuration = Math.max(0, spokenDuration - minimumDuration * segments.length)
  let cursor = startOffset

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

export function createSrt(
  text,
  durationSeconds,
  startOffsetSeconds = 0,
  speechIntervals = [],
  subtitleTiming = null
) {
  return createSubtitleCues(
    text,
    durationSeconds,
    startOffsetSeconds,
    speechIntervals,
    subtitleTiming
  )
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

export function createAss(
  text,
  durationSeconds,
  style = {},
  startOffsetSeconds = 0,
  speechIntervals = [],
  subtitleTiming = null
) {
  const fontSize = Math.min(72, Math.max(24, Number(style.fontSize) || 42))
  const outlineWidth = Math.min(8, Math.max(0, Number(style.outlineWidth) || 3))
  const alignment = { top: 8, middle: 5, bottom: 2 }[style.position] || 2
  const marginV = alignment === 2 ? 72 : alignment === 8 ? 54 : 0
  const verticalOffset = Math.min(160, Math.max(-160, Number(style.verticalOffset) || 0))
  const baseY = { 8: 64, 5: 540, 2: 1008 }[alignment]
  const positionY = Math.min(1050, Math.max(30, baseY + verticalOffset))
  const primaryColor = assColor(style.textColor, 'FFFFFF')
  const outlineColor = assColor(style.outlineColor, '000000')
  const cues = createSubtitleCues(
    text,
    durationSeconds,
    startOffsetSeconds,
    speechIntervals,
    subtitleTiming
  )

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
