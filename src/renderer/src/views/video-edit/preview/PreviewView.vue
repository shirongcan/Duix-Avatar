<template>
  <div class="preview">
    <div class="preview-header">{{ $t('common.preview.headerText') }}</div>
    <div class="preview-body">
      <div ref="previewStage" class="preview-stage">
        <div v-if="model.video_path" ref="videoFrame" class="video-frame">
          <video
            class="video"
            controls
            :src="localUrl.addFileProtocol(model.video_path)"
            @loadedmetadata="observeFrame"
          ></video>
          <div v-if="subtitle.enabled && subtitlePreviewText" class="subtitle-preview" :style="subtitlePreviewStyle">
            {{ subtitlePreviewText }}
          </div>
        </div>
        <button v-if="model.video_path" class="fullscreen-button" type="button" @click="toggleFullscreen">
          {{ isFullscreen ? '×' : '⛶' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { localUrl } from '@renderer/utils'
import { maximumLineUnits, wrapTextToWidth } from '@main/util/subtitle.js'

const props = defineProps({
  model: { type: Object, default: () => ({}) },
  subtitle: { type: Object, default: () => ({ enabled: false }) },
  text: { type: String, default: '' }
})
const previewStage = ref()
const videoFrame = ref()
const frameWidth = ref(0)
const frameHeight = ref(0)
const videoWidth = ref(0)
const videoHeight = ref(0)
const isFullscreen = ref(false)
let observer

const subtitlePreviewText = computed(() => {
  const normalized = props.text.replace(/\s+/g, ' ').trim()
  const sentence = normalized.match(/^.*?[。！？!?；;]/)?.[0] || normalized
  const fontSize = Math.min(72, Math.max(24, Number(props.subtitle.fontSize) || 42))
  const outlineWidth = Math.min(8, Math.max(0, Number(props.subtitle.outlineWidth) || 0))
  const videoSize =
    videoWidth.value && videoHeight.value
      ? { width: videoWidth.value, height: videoHeight.value }
      : null
  return wrapTextToWidth(sentence, maximumLineUnits(fontSize, outlineWidth, videoSize)).join('\n')
})
const subtitlePreviewStyle = computed(() => {
  const scaleX = frameWidth.value / 1920 || 1
  const scaleY = frameHeight.value / 1080 || 1
  const fontSize = Math.min(72, Math.max(24, Number(props.subtitle.fontSize) || 42))
  const outlineWidth = Math.min(8, Math.max(0, Number(props.subtitle.outlineWidth) || 0))
  const alignment = { top: 8, middle: 5, bottom: 2 }[props.subtitle.position] || 2
  const baseY = { 8: 64, 5: 540, 2: 1008 }[alignment]
  const offset = Math.min(160, Math.max(-160, Number(props.subtitle.verticalOffset) || 0))
  const y = Math.min(1050, Math.max(30, baseY + offset)) * scaleY
  const positions = {
    8: { top: `${y}px` },
    5: { top: `${y}px`, transform: 'translateY(-50%)' },
    2: { top: `${y}px`, transform: 'translateY(-100%)' }
  }
  return {
    visibility: frameWidth.value && frameHeight.value ? 'visible' : 'hidden',
    left: `${60 * scaleX}px`,
    right: `${60 * scaleX}px`,
    color: props.subtitle.textColor || '#FFFFFF',
    fontSize: `${fontSize * scaleY}px`,
    WebkitTextStroke: `${outlineWidth * scaleY}px ${props.subtitle.outlineColor || '#000000'}`,
    ...positions[alignment]
  }
})

function observeFrame() {
  updateVideoSize()
  nextTick(() => {
    observer?.disconnect()
    if (!videoFrame.value) return
    const update = () => {
      frameWidth.value = videoFrame.value?.clientWidth || 0
      frameHeight.value = videoFrame.value?.clientHeight || 0
    }
    observer = new ResizeObserver(update)
    observer.observe(videoFrame.value)
    update()
  })
}
function updateVideoSize() {
  const video = videoFrame.value?.querySelector('video')
  videoWidth.value = video?.videoWidth || 0
  videoHeight.value = video?.videoHeight || 0
}
async function toggleFullscreen() {
  if (document.fullscreenElement === previewStage.value) await document.exitFullscreen()
  else await previewStage.value?.requestFullscreen()
}
function fullscreenChanged() { isFullscreen.value = document.fullscreenElement === previewStage.value; observeFrame() }
onMounted(() => document.addEventListener('fullscreenchange', fullscreenChanged))
onBeforeUnmount(() => { observer?.disconnect(); document.removeEventListener('fullscreenchange', fullscreenChanged) })
</script>

<style lang="less" scoped>
.preview { display: flex; height: 100%; flex-direction: column; border-left: 1px solid #000; border-right: 1px solid #000; }
.preview-header { font-weight: 500; padding: 18px; font-size: 14px; color: #fff; line-height: 22px; text-align: center; border-bottom: 1px solid #000; }
.preview-body { flex: 1; min-height: 0; padding: 40px; display: flex; justify-content: center; align-items: center; background: #161718; overflow: hidden; }
.preview-stage { position: relative; display: flex; justify-content: center; align-items: center; max-width: 100%; max-height: 100%; background: #000; overflow: hidden; border-radius: 4px; }
.video-frame { position: relative; display: inline-flex; max-width: 100%; max-height: 100%; overflow: hidden; }
.video { display: block; max-width: 100%; max-height: calc(100vh - 140px); }
.subtitle-preview { position: absolute; z-index: 2; font-family: 'Microsoft YaHei', sans-serif; font-weight: 700; line-height: 1.2; text-align: center; white-space: pre-line; word-break: break-word; pointer-events: none; }
.fullscreen-button { position: absolute; right: 10px; bottom: 42px; z-index: 4; width: 32px; height: 32px; border: 0; border-radius: 4px; color: #fff; background: rgba(0,0,0,.65); cursor: pointer; font-size: 18px; }
.preview-stage:fullscreen { width: 100vw; height: 100vh; max-width: none; max-height: none; border-radius: 0; }
.preview-stage:fullscreen .video-frame { max-width: 100vw; max-height: 100vh; }
.preview-stage:fullscreen .video { max-width: 100vw; max-height: 100vh; }
</style>
