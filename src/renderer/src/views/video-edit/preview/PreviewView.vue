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
