

export function videoPage({ page = 1, pageSize = 1, name = '' }) {
  return window.electron.ipcRenderer.invoke('video/page', { page, pageSize, name })
}

export function findVideo(id) {
  return window.electron.ipcRenderer.invoke('video/find', id)
}

export function removeVideo(id) {
  return window.electron.ipcRenderer.invoke('video/remove', id)
}

export function saveVideo(video) {
  return window.electron.ipcRenderer.invoke('video/save', video)
}

export function makeVideo(id) {
  return window.electron.ipcRenderer.invoke('video/make', id)
}

export function exportVideo(id, outputPath, variant = 'default') {
  return window.electron.ipcRenderer.invoke('video/export', id, outputPath, variant)
}

export function exportVideoSrt(id, outputPath) {
  return window.electron.ipcRenderer.invoke('video/export-subtitle', id, outputPath)
}

export function retryVideoSubtitle(id) {
  return window.electron.ipcRenderer.invoke('video/retry-subtitle', id)
}

export function modifyVideo(video) {
  return window.electron.ipcRenderer.invoke('video/modify', video)
}

export function countVideo(name = '') {
  return window.electron.ipcRenderer.invoke('video/count', name)
}

export function modelPage({ page = 1, pageSize = 1, name = '' }) {
  return window.electron.ipcRenderer.invoke('model/page', { page, pageSize, name })
  
}

export function findModel(id) {
  return window.electron.ipcRenderer.invoke('model/find', id)
}

export function addModel({ name, videoPath }) {
  return window.electron.ipcRenderer.invoke('model/addModel', name, videoPath)
}

export function countModel(name = '') {
  return window.electron.ipcRenderer.invoke('model/count', name)
}

export function removeModel(id) {
  return window.electron.ipcRenderer.invoke('model/remove', id)
}

export function getContext(key) {
  return window.electron.ipcRenderer.invoke('context/get', key)
}

export function saveContext(key, val) {
  return window.electron.ipcRenderer.invoke('context/save', key, val)
}

export function audition(voiceId, text, speed = 1) {
  return window.electron.ipcRenderer.invoke('voice/audition', voiceId, text, speed)
}

export function updateVoiceReferenceText(voiceId, text) {
  return window.electron.ipcRenderer.invoke('voice/updateReferenceText', voiceId, text)
}

export function getVoiceReferenceAudioParts(voiceId) {
  return window.electron.ipcRenderer.invoke('voice/referenceAudioParts', voiceId)
}
