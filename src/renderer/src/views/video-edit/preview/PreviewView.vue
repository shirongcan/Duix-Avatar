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
      <div v-if="model.video_path" class="preview-stage">
        <video
          class="video"
          :style="getter.previewStyle.value"
          controls
          :src="localUrl.addFileProtocol(model.video_path)"
        ></video>
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
import { computed, reactive } from 'vue'
import { localUrl } from '@renderer/utils'
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
  text: {
    type: String,
    default: ''
  }
})

const state = reactive({
  showOriginal: false
})

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
  subtitlePreviewText: computed(() => {
    const normalized = props.text.replace(/\s+/g, ' ').trim()
    const firstSentence = normalized.match(/^.*?[。！？!?；;]/)?.[0] || normalized
    const characters = Array.from(firstSentence)
    return characters.length > 24 ? `${characters.slice(0, 24).join('')}…` : firstSentence
  }),
  subtitlePreviewStyle: computed(() => {
    const fontSize = Math.min(72, Math.max(24, Number(props.subtitle.fontSize) || 42))
    const outlineWidth = Math.min(8, Math.max(0, Number(props.subtitle.outlineWidth) || 3))
    const offset = Math.min(160, Math.max(-160, Number(props.subtitle.verticalOffset) || 0)) * 0.18
    const positionStyles = {
      top: { top: `calc(7% + ${offset}px)` },
      middle: { top: '50%', transform: `translateY(calc(-50% + ${offset}px))` },
      bottom: { bottom: `calc(10% - ${offset}px)` }
    }
    return {
      color: props.subtitle.textColor || '#FFFFFF',
      fontSize: `${12 + ((fontSize - 24) / 48) * 20}px`,
      WebkitTextStroke: `${outlineWidth * 0.32}px ${props.subtitle.outlineColor || '#000000'}`,
      textShadow: `0 1px ${Math.max(1, outlineWidth * 0.5)}px ${props.subtitle.outlineColor || '#000000'}`,
      ...(positionStyles[props.subtitle.position] || positionStyles.bottom)
    }
  })
}
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
      max-width: 100%;
      max-height: 100%;
      overflow: hidden;
      border-radius: 4px;
    }

    .video {
      max-width: 100%;
      max-height: 100%;
      transition: filter 0.16s ease;
    }

    .beauty-tint {
      position: absolute;
      inset: 0;
      background: #ff8193;
      mix-blend-mode: soft-light;
      pointer-events: none;
    }

    .subtitle-preview {
      position: absolute;
      left: 6%;
      right: 6%;
      z-index: 2;
      font-family: 'Microsoft YaHei', sans-serif;
      font-weight: 700;
      line-height: 1.35;
      text-align: center;
      word-break: break-word;
      pointer-events: none;
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
