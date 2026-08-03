<template>
  <div class="preview">
    <div class="preview-header">{{ $t('common.preview.headerText') }}</div>
    <div class="preview-body">
      <svg class="preview-filters" aria-hidden="true">
        <defs>
          <filter
            id="beauty-preview-filter"
            x="-10%"
            y="-10%"
            width="120%"
            height="120%"
            color-interpolation-filters="sRGB"
          >
            <feGaussianBlur
              in="SourceGraphic"
              :stdDeviation="getter.blurRadius.value"
              result="softened"
            />
            <feComposite
              in="SourceGraphic"
              in2="softened"
              operator="arithmetic"
              :k2="getter.detailMix.value"
              :k3="getter.softMix.value"
            />
          </filter>
        </defs>
      </svg>
      <div v-if="model.video_path" ref="previewStage" class="preview-stage">
        <div ref="videoFrame" class="video-frame" :style="getter.videoFrameStyle.value">
          <video
            class="video"
            :style="getter.previewStyle.value"
            controls
            :src="localUrl.addFileProtocol(model.video_path)"
            @loadedmetadata="action.handleVideoMetadata"
          ></video>
          <img
            v-if="cover.enabled && cover.imagePath && cover.previewing"
            class="cover-preview"
            :src="localUrl.addFileProtocol(cover.imagePath)"
          />
          <span
            v-if="getter.isEffectVisible.value"
            class="beauty-tint"
            :style="getter.tintStyle.value"
          ></span>
          <span
            v-if="subtitle.enabled"
            class="subtitle-preview"
            :style="getter.subtitlePreviewStyle.value"
          >
            {{ getter.subtitlePreviewText.value || $t('common.editView.subtitleSample') }}
          </span>
        </div>
        <button
          class="fullscreen-button"
          type="button"
          :title="state.isFullscreen ? '退出全屏' : '全屏预览'"
          :aria-label="state.isFullscreen ? '退出全屏' : '全屏预览'"
          @click="action.toggleFullscreen"
        >
          <svg v-if="state.isFullscreen" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
          </svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </svg>
        </button>
      </div>
      <template v-if="beauty.enabled">
        <button
          class="compare-button"
          type="button"
          @pointerdown.prevent="state.showOriginal = true"
          @pointerup="state.showOriginal = false"
          @pointerleave="state.showOriginal = false"
          @pointercancel="state.showOriginal = false"
        >
          {{
            state.showOriginal
              ? $t('common.preview.originalViewing')
              : $t('common.preview.holdForOriginal')
          }}
        </button>
        <span class="beauty-badge">
          {{
            state.showOriginal ? $t('common.preview.original') : $t('common.preview.beautyPreview')
          }}
        </span>
      </template>
    </div>
  </div>
</template>
<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { localUrl } from '@renderer/utils'

const SUBTITLE_CANVAS_WIDTH = 1920
const SUBTITLE_CANVAS_HEIGHT = 1080

const props = defineProps({
  model: {
    type: Object,
    default: () => ({})
  },
  beauty: {
    type: Object,
    default: () => ({ enabled: false })
  },
  subtitle: {
    type: Object,
    default: () => ({ enabled: false })
  },
  cover: {
    type: Object,
    default: () => ({ enabled: false, imagePath: '', previewing: false })
  },
  text: {
    type: String,
    default: ''
  }
})

const state = reactive({
  showOriginal: false,
  isFullscreen: false,
  previewStageWidth: 0,
  previewStageHeight: 0,
  videoFrameWidth: 0,
  videoFrameHeight: 0,
  videoWidth: SUBTITLE_CANVAS_WIDTH,
  videoHeight: SUBTITLE_CANVAS_HEIGHT
})

const previewStage = ref()
const videoFrame = ref()
let frameResizeObserver

const getter = {
  isEffectVisible: computed(() => props.beauty.enabled && !state.showOriginal),
  blurRadius: computed(() => Number(props.beauty.smoothing || 0) * 0.022),
  softMix: computed(() => Number(props.beauty.smoothing || 0) * 0.005),
  detailMix: computed(() => 1 - getter.softMix.value),
  previewStyle: computed(() => {
    if (!getter.isEffectVisible.value) return {}
    const brighten = Number(props.beauty.brighten || 0)
    const rosy = Number(props.beauty.rosy || 0)
    return {
      filter: `url("#beauty-preview-filter") brightness(${1 + brighten * 0.0035}) saturate(${1 + rosy * 0.006})`
    }
  }),
  tintStyle: computed(() => {
    const rosy = Number(props.beauty.rosy || 0)
    return { opacity: rosy * 0.0008 }
  }),
  videoFrameStyle: computed(() => {
    if (!state.isFullscreen || !state.previewStageWidth || !state.previewStageHeight) return {}

    const videoAspectRatio = state.videoWidth / state.videoHeight
    const stageAspectRatio = state.previewStageWidth / state.previewStageHeight
    if (stageAspectRatio > videoAspectRatio) {
      return {
        width: `${state.previewStageHeight * videoAspectRatio}px`,
        height: `${state.previewStageHeight}px`
      }
    }
    return {
      width: `${state.previewStageWidth}px`,
      height: `${state.previewStageWidth / videoAspectRatio}px`
    }
  }),
  subtitlePreviewText: computed(() => {
    const normalized = props.text.replace(/\s+/g, ' ').trim()
    const firstSentence = normalized.match(/^.*?[。！？!?；;]/)?.[0] || normalized
    const characters = Array.from(firstSentence)
    return characters.length > 24 ? `${characters.slice(0, 24).join('')}…` : firstSentence
  }),
  subtitlePreviewStyle: computed(() => {
    const fontSize = Math.min(72, Math.max(24, Number(props.subtitle.fontSize) || 42))
    const outlineWidth = Math.min(8, Math.max(0, Number(props.subtitle.outlineWidth) || 3))
    const verticalOffset = Math.min(
      160,
      Math.max(-160, Number(props.subtitle.verticalOffset) || 0)
    )
    const scaleX = state.videoFrameWidth / SUBTITLE_CANVAS_WIDTH
    const scaleY = state.videoFrameHeight / SUBTITLE_CANVAS_HEIGHT
    const safeScaleX = scaleX || 1
    const safeScaleY = scaleY || 1
    const alignment = { top: 8, middle: 5, bottom: 2 }[props.subtitle.position] || 2
    const baseY = { 8: 64, 5: 540, 2: 1008 }[alignment]
    const positionY = Math.min(1050, Math.max(30, baseY + verticalOffset)) * safeScaleY
    const positionStyles = {
      8: { top: `${positionY}px` },
      5: { top: `${positionY}px`, transform: 'translateY(-50%)' },
      2: { top: `${positionY}px`, transform: 'translateY(-100%)' }
    }
    return {
      visibility: state.videoFrameWidth && state.videoFrameHeight ? 'visible' : 'hidden',
      color: props.subtitle.textColor || '#FFFFFF',
      left: `${60 * safeScaleX}px`,
      right: `${60 * safeScaleX}px`,
      fontSize: `${fontSize * safeScaleY}px`,
      WebkitTextStroke: `${outlineWidth * safeScaleY}px ${props.subtitle.outlineColor || '#000000'}`,
      textShadow: 'none',
      ...positionStyles[alignment]
    }
  })
}

const action = {
  observeVideoFrame() {
    frameResizeObserver?.disconnect()
    if (!videoFrame.value) return

    const updateSize = () => {
      const stageRect = previewStage.value?.getBoundingClientRect()
      const frameRect = videoFrame.value?.getBoundingClientRect()
      state.previewStageWidth = stageRect?.width || 0
      state.previewStageHeight = stageRect?.height || 0
      state.videoFrameWidth = frameRect?.width || 0
      state.videoFrameHeight = frameRect?.height || 0
    }

    frameResizeObserver = new ResizeObserver(updateSize)
    frameResizeObserver.observe(previewStage.value)
    frameResizeObserver.observe(videoFrame.value)
    updateSize()
  },
  handleVideoMetadata(event) {
    state.videoWidth = event.currentTarget.videoWidth || SUBTITLE_CANVAS_WIDTH
    state.videoHeight = event.currentTarget.videoHeight || SUBTITLE_CANVAS_HEIGHT
  },
  async toggleFullscreen() {
    try {
      if (document.fullscreenElement === previewStage.value) {
        await document.exitFullscreen()
        return
      }
      await previewStage.value?.requestFullscreen()
    } catch (error) {
      console.warn('无法切换全屏预览', error)
    }
  },
  handleFullscreenChange() {
    state.isFullscreen = document.fullscreenElement === previewStage.value
  }
}

watch(
  () => props.model.video_path,
  async () => {
    await nextTick()
    action.observeVideoFrame()
  },
  { immediate: true }
)

onMounted(() => {
  document.addEventListener('fullscreenchange', action.handleFullscreenChange)
  action.observeVideoFrame()
})

onBeforeUnmount(() => {
  frameResizeObserver?.disconnect()
  document.removeEventListener('fullscreenchange', action.handleFullscreenChange)
})
</script>
<style lang="less" scoped>
.preview {
  display: flex;
  height: 100%;
  flex-direction: column;
  border-left: 1px solid #000000;
  border-right: 1px solid #000000;

  &-header {
    font-weight: 500;
    padding: 18px;
    font-size: 14px;
    color: #ffffff;
    line-height: 22px;
    text-align: center;
    border-bottom: 1px solid #000000;
  }

  &-body {
    flex: 1;
    width: 100%;
    height: 100%;
    padding: 0 12px;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: #161718;
    padding: 40px;
    overflow: hidden;
    position: relative;

    .preview-stage {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      max-width: 100%;
      max-height: 100%;
      overflow: hidden;
      border-radius: 4px;
      background: #000000;
    }

    .video-frame {
      position: relative;
      display: flex;
      max-width: 100%;
      max-height: 100%;
      overflow: hidden;
    }

    .video {
      display: block;
      max-width: 100%;
      max-height: 100%;
      transition: filter 0.16s ease;
    }

    .video::-webkit-media-controls-fullscreen-button {
      display: none;
    }

    .beauty-tint {
      position: absolute;
      inset: 0;
      background: #ff8193;
      mix-blend-mode: soft-light;
      pointer-events: none;
    }

    .cover-preview {
      position: absolute;
      inset: 0;
      z-index: 3;
      width: 100%;
      height: 100%;
      object-fit: cover;
      pointer-events: none;
    }

    .subtitle-preview {
      position: absolute;
      z-index: 2;
      font-family: 'Microsoft YaHei', sans-serif;
      font-weight: 700;
      line-height: 1.2;
      text-align: center;
      word-break: break-word;
      pointer-events: none;
    }

    .fullscreen-button {
      position: absolute;
      right: 10px;
      bottom: 10px;
      z-index: 4;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      border: 0;
      border-radius: 4px;
      color: #ffffff;
      background: rgba(0, 0, 0, 0.62);
      cursor: pointer;

      &:hover {
        background: rgba(0, 0, 0, 0.82);
      }

      svg {
        width: 20px;
        height: 20px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
    }

    .preview-stage:fullscreen {
      width: 100vw;
      height: 100vh;
      max-width: none;
      max-height: none;
      border-radius: 0;

      .video-frame {
        max-width: 100vw;
        max-height: 100vh;
      }

      .video {
        width: 100%;
        height: 100%;
      }
    }
  }

  .preview-filters {
    position: absolute;
    width: 0;
    height: 0;
  }

  .compare-button {
    position: absolute;
    left: 20px;
    bottom: 16px;
    z-index: 2;
    padding: 5px 10px;
    border: 1px solid rgba(255, 255, 255, 0.28);
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.9);
    background: rgba(0, 0, 0, 0.58);
    font-size: 12px;
    cursor: pointer;
    user-select: none;
  }

  .beauty-badge {
    position: absolute;
    right: 20px;
    bottom: 16px;
    z-index: 2;
    padding: 4px 8px;
    border-radius: 10px;
    color: rgba(255, 255, 255, 0.82);
    background: rgba(0, 0, 0, 0.55);
    font-size: 12px;
    pointer-events: none;
  }
}
</style>
