function parseSubtitleStyle(value) {
  if (!value) return null
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export function inheritRevisionSubtitleStyle(value) {
  const style = parseSubtitleStyle(value)
  if (!style) return null
  return {
    ...style,
    burnEnabled: Boolean(style.enabled)
  }
}

export function canGenerateSubtitle(video) {
  const style = parseSubtitleStyle(video?.subtitle_style)
  return Boolean(
    video?.status === 'success' &&
    video?.text_content?.trim() &&
    style?.enabled &&
    !video?.subtitled_file_path
  )
}

export function canExportSubtitleSrt(video) {
  const style = parseSubtitleStyle(video?.subtitle_style)
  return Boolean(
    video?.status === 'success' &&
    video?.text_content?.trim() &&
    style?.enabled
  )
}
