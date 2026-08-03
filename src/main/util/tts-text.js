const SENTENCE_ENDINGS = new Set(['。', '！', '？', '!', '?'])
const CLAUSE_ENDINGS = new Set(['，', ',', '；', ';', '：', ':'])

export const DEFAULT_TTS_SEGMENT_MAX_BYTES = 120

function utf8Length(value) {
  return Buffer.byteLength(value, 'utf8')
}

function splitAfterDelimiters(text, delimiters) {
  const pieces = []
  let current = ''

  for (const character of text) {
    current += character
    if (delimiters.has(character)) {
      if (current.trim()) pieces.push(current.trim())
      current = ''
    }
  }

  if (current.trim()) pieces.push(current.trim())
  return pieces
}

function splitByUtf8Length(text, maxBytes) {
  const pieces = []
  let current = ''

  for (const character of text) {
    if (current && utf8Length(current + character) > maxBytes) {
      pieces.push(current)
      current = character
    } else {
      current += character
    }
  }

  if (current) pieces.push(current)
  return pieces
}

function splitLongSentence(sentence, maxBytes) {
  const clauses = splitAfterDelimiters(sentence, CLAUSE_ENDINGS)
  const segments = []
  let current = ''

  const append = (piece) => {
    if (!piece) return
    if (!current) {
      current = piece
      return
    }
    if (utf8Length(current + piece) <= maxBytes) {
      current += piece
      return
    }
    segments.push(current)
    current = piece
  }

  for (const clause of clauses) {
    if (utf8Length(clause) <= maxBytes) {
      append(clause)
      continue
    }

    if (current) {
      segments.push(current)
      current = ''
    }
    const hardPieces = splitByUtf8Length(clause, maxBytes)
    segments.push(...hardPieces.slice(0, -1))
    current = hardPieces.at(-1) || ''
  }

  if (current) segments.push(current)
  return segments
}

/**
 * 按段落和完整句子切分长文。不同段落绝不合并，避免 TTS 将下一段开头
 * 拼到上一段末尾后漏读；超长句子再按逗号等停顿符切分。
 */
export function splitTtsText(text, maxBytes = DEFAULT_TTS_SEGMENT_MAX_BYTES) {
  const safeMaxBytes = Math.max(30, Number(maxBytes) || DEFAULT_TTS_SEGMENT_MAX_BYTES)
  const paragraphs = String(text || '')
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

  const segments = []
  for (const paragraph of paragraphs) {
    const sentences = splitAfterDelimiters(paragraph, SENTENCE_ENDINGS)
    for (const sentence of sentences) {
      if (utf8Length(sentence) <= safeMaxBytes) {
        segments.push(sentence)
      } else {
        segments.push(...splitLongSentence(sentence, safeMaxBytes))
      }
    }
  }

  return segments.filter(Boolean)
}

export function normalizeTtsComparisonText(text) {
  return String(text || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
}

function longestCommonSubsequenceLength(left, right) {
  if (!left || !right) return 0
  const previous = new Uint16Array(right.length + 1)
  const current = new Uint16Array(right.length + 1)

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex++) {
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex++) {
      current[rightIndex] =
        left[leftIndex - 1] === right[rightIndex - 1]
          ? previous[rightIndex - 1] + 1
          : Math.max(previous[rightIndex], current[rightIndex - 1])
    }
    previous.set(current)
    current.fill(0)
  }

  return previous[right.length]
}

function edgeCoverage(expectedEdge, actualWindow) {
  if (!expectedEdge) return 1
  return longestCommonSubsequenceLength(expectedEdge, actualWindow) / expectedEdge.length
}

/**
 * 使用宽松的字符序列匹配判断语音识别结果是否完整。允许少量同音字误识别，
 * 但会拦截整段开头/结尾缺失以及明显的漏词。
 */
export function evaluateTtsTranscript(expectedText, actualText) {
  const expected = normalizeTtsComparisonText(expectedText)
  const actual = normalizeTtsComparisonText(actualText)

  if (!expected || !actual) {
    return { passed: false, coverage: 0, startCoverage: 0, endCoverage: 0, lengthRatio: 0 }
  }

  const coverage = longestCommonSubsequenceLength(expected, actual) / expected.length
  const lengthRatio = actual.length / expected.length
  const edgeSize = Math.min(5, Math.max(3, Math.floor(expected.length / 4)))
  const actualWindowSize = Math.min(actual.length, edgeSize * 2 + 2)
  const startCoverage = edgeCoverage(
    expected.slice(0, edgeSize),
    actual.slice(0, actualWindowSize)
  )
  const endCoverage = edgeCoverage(
    expected.slice(-edgeSize),
    actual.slice(-actualWindowSize)
  )
  const minimumCoverage = expected.length <= 6 ? 0.65 : expected.length <= 12 ? 0.75 : 0.82
  const edgesPassed = expected.length < 10 || (startCoverage >= 0.4 && endCoverage >= 0.55)

  return {
    passed:
      coverage >= minimumCoverage &&
      lengthRatio >= 0.55 &&
      lengthRatio <= 1.6 &&
      edgesPassed,
    coverage,
    startCoverage,
    endCoverage,
    lengthRatio
  }
}
