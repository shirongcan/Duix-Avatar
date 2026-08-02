<template>
  <div class="subtitle-panel">
    <div class="subtitle-switch-row">
      <div>
        <div class="subtitle-title">{{ $t('common.editView.subtitleEnable') }}</div>
        <div class="subtitle-description">{{ $t('common.editView.subtitleDescription') }}</div>
      </div>
      <t-switch v-model="subtitle.enabled" />
    </div>

    <div class="subtitle-live-preview" :class="{ disabled: !subtitle.enabled }">
      <span class="preview-label">{{ $t('common.editView.subtitleLivePreview') }}</span>
      <span class="preview-head"></span>
      <span class="preview-body"></span>
      <span class="preview-caption" :style="previewCaptionStyle">
        {{ $t('common.editView.subtitleSample') }}
      </span>
    </div>

    <div class="subtitle-controls" :class="{ disabled: !subtitle.enabled }">
      <div class="subtitle-control">
        <div class="subtitle-control-header">
          <span>{{ $t('common.editView.subtitlePosition') }}</span>
        </div>
        <t-radio-group
          v-model="subtitle.position"
          :disabled="!subtitle.enabled"
          variant="default-filled"
        >
          <t-radio-button
            v-for="position in positions"
            :key="position.value"
            :value="position.value"
          >
            {{ position.label }}
          </t-radio-button>
        </t-radio-group>
      </div>

      <div class="subtitle-control">
        <div class="subtitle-control-header">
          <span>{{ $t('common.editView.subtitleFontSize') }}</span>
          <span class="subtitle-value">{{ subtitle.fontSize }}</span>
        </div>
        <t-slider
          v-model="subtitle.fontSize"
          :min="24"
          :max="72"
          :step="2"
          :disabled="!subtitle.enabled"
        />
      </div>

      <div class="subtitle-control">
        <div class="subtitle-control-header">
          <span>{{ $t('common.editView.subtitleVerticalOffset') }}</span>
          <span class="subtitle-value">{{ verticalOffsetLabel }}</span>
        </div>
        <t-slider
          v-model="subtitle.verticalOffset"
          :min="-160"
          :max="160"
          :step="5"
          :disabled="!subtitle.enabled"
        />
        <div class="subtitle-control-hint">
          {{ $t('common.editView.subtitleVerticalOffsetTip') }}
        </div>
      </div>

      <div class="subtitle-control">
        <div class="subtitle-control-header">
          <span>{{ $t('common.editView.subtitleOutlineWidth') }}</span>
          <span class="subtitle-value">{{ subtitle.outlineWidth }}</span>
        </div>
        <t-slider v-model="subtitle.outlineWidth" :min="0" :max="8" :disabled="!subtitle.enabled" />
      </div>

      <div class="subtitle-colors">
        <label class="subtitle-color">
          <span>{{ $t('common.editView.subtitleTextColor') }}</span>
          <span class="color-input-wrap">
            <input v-model="subtitle.textColor" type="color" :disabled="!subtitle.enabled" />
            <span>{{ subtitle.textColor }}</span>
          </span>
        </label>
        <label class="subtitle-color">
          <span>{{ $t('common.editView.subtitleOutlineColor') }}</span>
          <span class="color-input-wrap">
            <input v-model="subtitle.outlineColor" type="color" :disabled="!subtitle.enabled" />
            <span>{{ subtitle.outlineColor }}</span>
          </span>
        </label>
      </div>
    </div>

    <div class="subtitle-tip">{{ $t('common.editView.subtitleTip') }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const subtitle = defineModel({ required: true })
const { t } = useI18n()

const positions = computed(() => [
  { value: 'top', label: t('common.editView.subtitleTop') },
  { value: 'middle', label: t('common.editView.subtitleMiddle') },
  { value: 'bottom', label: t('common.editView.subtitleBottom') }
])

const verticalOffsetLabel = computed(() => {
  const offset = Number(subtitle.value.verticalOffset || 0)
  if (offset === 0) return '0'
  return offset > 0 ? `↓ ${offset}` : `↑ ${Math.abs(offset)}`
})

const previewCaptionStyle = computed(() => {
  const fontSize = Math.min(72, Math.max(24, Number(subtitle.value.fontSize) || 42))
  const outlineWidth = Math.min(8, Math.max(0, Number(subtitle.value.outlineWidth) || 3))
  const offset = Math.min(160, Math.max(-160, Number(subtitle.value.verticalOffset) || 0)) * 0.16
  const positionStyles = {
    top: { top: `${Math.max(4, 14 + offset)}px` },
    middle: { top: '50%', transform: `translateY(calc(-50% + ${offset}px))` },
    bottom: { bottom: `${Math.max(4, 14 - offset)}px` }
  }
  return {
    color: subtitle.value.textColor || '#FFFFFF',
    fontSize: `${14 + ((fontSize - 24) / 48) * 14}px`,
    WebkitTextStroke: `${outlineWidth * 0.28}px ${subtitle.value.outlineColor || '#000000'}`,
    textShadow: `0 1px ${Math.max(1, outlineWidth * 0.45)}px ${subtitle.value.outlineColor || '#000000'}`,
    ...(positionStyles[subtitle.value.position] || positionStyles.bottom)
  }
})
</script>

<style lang="less" scoped>
.subtitle-panel {
  padding: 18px;
  color: #fff;
  background: #161718;
}

.subtitle-switch-row,
.subtitle-control-header,
.subtitle-color,
.color-input-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.subtitle-switch-row {
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.subtitle-title {
  font-size: 14px;
  font-weight: 500;
}

.subtitle-description,
.subtitle-tip {
  margin-top: 5px;
  color: rgba(255, 255, 255, 0.48);
  font-size: 12px;
  line-height: 18px;
}

.subtitle-controls {
  transition: opacity 0.2s;

  &.disabled {
    opacity: 0.42;
  }
}

.subtitle-live-preview {
  position: relative;
  height: 142px;
  margin-top: 16px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background:
    radial-gradient(circle at 50% 42%, rgba(111, 121, 150, 0.3), transparent 34%),
    linear-gradient(145deg, #28313f 0%, #171b22 65%, #101216 100%);
  transition: opacity 0.2s;

  &.disabled {
    opacity: 0.42;
  }
}

.preview-label {
  position: absolute;
  top: 8px;
  left: 10px;
  z-index: 3;
  padding: 2px 6px;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.62);
  background: rgba(0, 0, 0, 0.34);
  font-size: 10px;
}

.preview-head,
.preview-body {
  position: absolute;
  left: 50%;
  background: rgba(168, 178, 202, 0.2);
  transform: translateX(-50%);
}

.preview-head {
  top: 30px;
  width: 38px;
  height: 38px;
  border-radius: 50%;
}

.preview-body {
  top: 70px;
  width: 104px;
  height: 82px;
  border-radius: 52px 52px 12px 12px;
}

.preview-caption {
  position: absolute;
  left: 8px;
  right: 8px;
  z-index: 2;
  font-family: 'Microsoft YaHei', sans-serif;
  font-weight: 700;
  line-height: 1.25;
  text-align: center;
  pointer-events: none;
}

.subtitle-control {
  margin-top: 18px;

  :deep(.t-radio-group) {
    display: flex;
    margin-top: 8px;
  }

  :deep(.t-radio-button) {
    flex: 1;
    text-align: center;
  }
}

.subtitle-control-header,
.subtitle-color {
  font-size: 13px;
}

.subtitle-control-hint {
  margin-top: 4px;
  color: rgba(255, 255, 255, 0.38);
  font-size: 11px;
}

.subtitle-value {
  color: #8d91ff;
}

.subtitle-colors {
  display: grid;
  gap: 12px;
  margin-top: 20px;
}

.color-input-wrap {
  justify-content: flex-end;
  color: rgba(255, 255, 255, 0.62);
  font-size: 12px;
}

input[type='color'] {
  width: 28px;
  height: 24px;
  padding: 0;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
}

.subtitle-tip {
  margin-top: 20px;
  padding: 10px 12px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
}
</style>
