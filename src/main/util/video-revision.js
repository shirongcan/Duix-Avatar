export function resolveVideoSaveSource(request, sourceVideo, resolveSourceAudio = (value) => value) {
  const isRevision = Boolean(request.source_video_id)
  if (request.id && isRevision) throw new Error('修改版不能覆盖原作品')
  if (isRevision && !sourceVideo) throw new Error('找不到原作品')
  if (isRevision && !['success', 'failed'].includes(sourceVideo.status)) {
    throw new Error('原作品当前状态不允许创建修改版')
  }

  const audioSource = request.audio_source === 'upload' ? 'upload' : 'tts'
  if (audioSource === 'tts') {
    return { audioSource, audioPath: null }
  }

  const sourceAudioPath = sourceVideo?.audio_path
    ? resolveSourceAudio(sourceVideo.audio_path)
    : ''
  const audioPath = request.audio_path || sourceAudioPath
  if (!audioPath) throw new Error('找不到上传音频')
  return { audioSource, audioPath }
}
