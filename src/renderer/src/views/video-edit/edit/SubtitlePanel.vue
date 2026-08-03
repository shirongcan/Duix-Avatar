<template>
  <div class="subtitle-panel">
    <div class="subtitle-switch-row">
      <div>
        <div class="subtitle-title">{{ $t('common.editView.subtitleEnable') }}</div>
        <div class="subtitle-description">{{ $t('common.editView.subtitleDescription') }}</div>
      </div>
      <t-switch v-model="subtitle.enabled" />
    </div>

    <div class="subtitle-presets">
      <div class="preset-header">
        <div>
          <div class="preset-title">{{ $t('common.editView.subtitlePresets') }}</div>
          <div class="preset-description">
            {{
              $t('common.editView.subtitlePresetCount', {
                count: state.presets.length,
                max: MAX_USER_PRESETS
              })
            }}
          </div>
        </div>
        <t-button
          size="small"
          theme="primary"
          variant="outline"
          :disabled="state.saving || state.presets.length >= MAX_USER_PRESETS"
          @click="startSavingPreset"
        >
          {{ $t('common.editView.subtitlePresetSave') }}
        </t-button>
      </div>

      <t-select
        v-model="state.selectedPresetId"
        class="preset-select"
        :options="presetOptions"
        :popup-props="{ overlayClassName: 'subtitle-preset-popup' }"
        :placeholder="$t('common.editView.subtitlePresetPlaceholder')"
        :disabled="state.loading"
        @change="applyPreset"
      />

      <div v-if="selectedUserPreset" class="preset-actions">
        <t-button
          size="small"
          theme="default"
          variant="outline"
          :loading="state.saving"
          @click="overwriteSelectedPreset"
        >
          {{ $t('common.editView.subtitlePresetOverwrite') }}
        </t-button>
        <t-popconfirm
          :content="$t('common.editView.subtitlePresetDeleteConfirm')"
          @confirm="deleteSelectedPreset"
        >
          <t-button size="small" theme="danger" variant="text" :disabled="state.saving">
            {{ $t('common.editView.subtitlePresetDelete') }}
          </t-button>
        </t-popconfirm>
      </div>

      <div v-if="state.naming" class="preset-name-editor">
        <t-input
          v-model="state.presetName"
          autofocus
          clearable
          :maxlength="24"
          :placeholder="$t('common.editView.subtitlePresetNamePlaceholder')"
          @enter="saveNewPreset"
        />
        <t-button size="small" :loading="state.saving" @click="saveNewPreset">
          {{ $t('common.editView.subtitlePresetConfirm') }}
        </t-button>
        <t-button size="small" theme="default" variant="text" @click="cancelSavingPreset">
          {{ $t('common.editView.subtitlePresetCancel') }}
        </t-button>
      </div>
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
import { computed, onMounted, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { MessagePlugin } from 'tdesign-vue-next'
import { getContext, saveContext } from '@renderer/api'

const subtitle = defineModel({ required: true })
const { t } = useI18n()
const PRESET_CONTEXT_KEY = 'subtitle_style_presets_v1'
const MAX_USER_PRESETS = 12

const state = reactive({
  presets: [],
  selectedPresetId: '',
  naming: false,
  presetName: '',
  loading: true,
  saving: false
})

const builtInPresets = computed(() => [
  {
    id: 'builtin-white',
    name: t('common.editView.subtitlePresetBuiltinWhite'),
    style: {
      fontSize: 42,
      textColor: '#FFFFFF',
      outlineColor: '#000000',
      outlineWidth: 3,
      position: 'bottom',
      verticalOffset: 0
    }
  },
  {
    id: 'builtin-yellow',
    name: t('common.editView.subtitlePresetBuiltinYellow'),
    style: {
      fontSize: 38,
      textColor: '#FADB14',
      outlineColor: '#161616',
      outlineWidth: 4,
      position: 'bottom',
      verticalOffset: -20
    }
  },
  {
    id: 'builtin-top',
    name: t('common.editView.subtitlePresetBuiltinTop'),
    style: {
      fontSize: 36,
      textColor: '#FFFFFF',
      outlineColor: '#1A1A1A',
      outlineWidth: 3,
      position: 'top',
      verticalOffset: 20
    }
  }
])

const presetOptions = computed(() => [
  {
    group: t('common.editView.subtitlePresetBuiltins'),
    children: builtInPresets.value.map((preset) => ({
      label: preset.name,
      value: preset.id
    }))
  },
  {
    group: t('common.editView.subtitlePresetMine'),
    children: state.presets.map((preset) => ({
      label: preset.name,
      value: preset.id
    }))
  }
])

const selectedUserPreset = computed(() =>
  state.presets.find((preset) => preset.id === state.selectedPresetId)
)

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

function clampNumber(value, minimum, maximum, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback
}

function normalizeColor(value, fallback) {
  const color = String(value || '').toUpperCase()
  return /^#[0-9A-F]{6}$/.test(color) ? color : fallback
}

function normalizeStyle(style = {}) {
  return {
    fontSize: clampNumber(style.fontSize, 24, 72, 42),
    textColor: normalizeColor(style.textColor, '#FFFFFF'),
    outlineColor: normalizeColor(style.outlineColor, '#000000'),
    outlineWidth: clampNumber(style.outlineWidth, 0, 8, 3),
    position: ['top', 'middle', 'bottom'].includes(style.position) ? style.position : 'bottom',
    verticalOffset: clampNumber(style.verticalOffset, -160, 160, 0)
  }
}

function currentStyle() {
  return normalizeStyle(subtitle.value)
}

function normalizeStoredPresets(value) {
  if (!Array.isArray(value)) return []
  const usedIds = new Set()
  return value
    .map((preset, index) => {
      const name = String(preset?.name || '')
        .trim()
        .slice(0, 24)
      const candidateId = String(preset?.id || `user-${index}`)
      const id = candidateId.startsWith('user-') ? candidateId : `user-${candidateId}`
      if (!name || usedIds.has(id)) return null
      usedIds.add(id)
      return {
        id,
        name,
        style: normalizeStyle(preset?.style),
        createdAt: Number(preset?.createdAt) || Date.now(),
        updatedAt: Number(preset?.updatedAt) || Date.now()
      }
    })
    .filter(Boolean)
    .slice(0, MAX_USER_PRESETS)
}

async function persistPresets(presets) {
  await saveContext(PRESET_CONTEXT_KEY, JSON.stringify(presets))
}

async function loadPresets() {
  state.loading = true
  try {
    const context = await getContext(PRESET_CONTEXT_KEY)
    if (!context?.val) return
    state.presets = normalizeStoredPresets(JSON.parse(context.val))
  } catch (error) {
    console.warn('字幕预设读取失败', error)
    MessagePlugin.warning(t('common.editView.subtitlePresetLoadFailed'))
  } finally {
    state.loading = false
  }
}

function applyPreset(presetId) {
  const preset =
    builtInPresets.value.find((item) => item.id === presetId) ||
    state.presets.find((item) => item.id === presetId)
  if (!preset) return
  Object.assign(subtitle.value, normalizeStyle(preset.style))
}

function startSavingPreset() {
  if (state.presets.length >= MAX_USER_PRESETS) {
    MessagePlugin.warning(
      t('common.editView.subtitlePresetLimitReached', { max: MAX_USER_PRESETS })
    )
    return
  }
  state.naming = true
  state.presetName = t('common.editView.subtitlePresetDefaultName', {
    number: state.presets.length + 1
  })
}

function cancelSavingPreset() {
  state.naming = false
  state.presetName = ''
}

async function saveNewPreset() {
  const name = state.presetName.trim().slice(0, 24)
  if (!name) {
    MessagePlugin.warning(t('common.editView.subtitlePresetNameRequired'))
    return
  }
  if (state.presets.some((preset) => preset.name.toLowerCase() === name.toLowerCase())) {
    MessagePlugin.warning(t('common.editView.subtitlePresetNameDuplicate'))
    return
  }
  if (state.presets.length >= MAX_USER_PRESETS) {
    MessagePlugin.warning(
      t('common.editView.subtitlePresetLimitReached', { max: MAX_USER_PRESETS })
    )
    return
  }

  const now = Date.now()
  const id = `user-${globalThis.crypto?.randomUUID?.() || now}`
  const preset = { id, name, style: currentStyle(), createdAt: now, updatedAt: now }
  const nextPresets = [...state.presets, preset]
  state.saving = true
  try {
    await persistPresets(nextPresets)
    state.presets = nextPresets
    state.selectedPresetId = id
    cancelSavingPreset()
    MessagePlugin.success(t('common.editView.subtitlePresetSaved'))
  } catch (error) {
    console.error('字幕预设保存失败', error)
    MessagePlugin.error(t('common.editView.subtitlePresetSaveFailed'))
  } finally {
    state.saving = false
  }
}

async function overwriteSelectedPreset() {
  if (!selectedUserPreset.value) return
  const now = Date.now()
  const nextPresets = state.presets.map((preset) =>
    preset.id === selectedUserPreset.value.id
      ? { ...preset, style: currentStyle(), updatedAt: now }
      : preset
  )
  state.saving = true
  try {
    await persistPresets(nextPresets)
    state.presets = nextPresets
    MessagePlugin.success(t('common.editView.subtitlePresetUpdated'))
  } catch (error) {
    console.error('字幕预设更新失败', error)
    MessagePlugin.error(t('common.editView.subtitlePresetSaveFailed'))
  } finally {
    state.saving = false
  }
}

async function deleteSelectedPreset() {
  if (!selectedUserPreset.value) return
  const nextPresets = state.presets.filter((preset) => preset.id !== selectedUserPreset.value.id)
  state.saving = true
  try {
    await persistPresets(nextPresets)
    state.presets = nextPresets
    state.selectedPresetId = ''
    MessagePlugin.success(t('common.editView.subtitlePresetDeleted'))
  } catch (error) {
    console.error('字幕预设删除失败', error)
    MessagePlugin.error(t('common.editView.subtitlePresetDeleteFailed'))
  } finally {
    state.saving = false
  }
}

onMounted(loadPresets)
</script>

<style lang="less" scoped>
.subtitle-panel {
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  padding: 18px 18px 30px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  color: #fff;
  background: #161718;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.04);
  }

  &::-webkit-scrollbar-thumb {
    border: 2px solid transparent;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.24);
    background-clip: padding-box;
  }
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

.subtitle-presets {
  margin-top: 16px;
  padding: 13px;
  border: 1px solid rgba(141, 145, 255, 0.22);
  border-radius: 8px;
  background: linear-gradient(145deg, rgba(62, 67, 112, 0.2), rgba(255, 255, 255, 0.025));
}

.preset-header,
.preset-actions,
.preset-name-editor {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preset-header {
  justify-content: space-between;
}

.preset-title {
  font-size: 13px;
  font-weight: 500;
}

.preset-description {
  margin-top: 3px;
  color: rgba(255, 255, 255, 0.44);
  font-size: 11px;
}

.preset-select {
  width: 100%;
  margin-top: 11px;
  --td-text-color-primary: rgba(255, 255, 255, 0.9);
  --td-text-color-placeholder: rgba(255, 255, 255, 0.48);

  :deep(.t-input) {
    color: #fff;
    border-color: rgba(255, 255, 255, 0.12);
    background: rgba(7, 8, 11, 0.45);
  }

  :deep(.t-input__inner) {
    color: rgba(255, 255, 255, 0.9);

    &::placeholder {
      color: rgba(255, 255, 255, 0.48);
    }
  }

  :deep(.t-fake-arrow) {
    color: rgba(255, 255, 255, 0.62);
  }
}

.preset-actions {
  justify-content: flex-end;
  margin-top: 9px;
}

.preset-name-editor {
  margin-top: 10px;

  :deep(.t-input) {
    color: #fff;
    border-color: rgba(255, 255, 255, 0.12);
    background: rgba(7, 8, 11, 0.45);
  }

  :deep(.t-input__wrap) {
    min-width: 0;
    flex: 1;
  }
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

<style lang="less">
.subtitle-preset-popup {
  --td-text-color-primary: rgba(255, 255, 255, 0.9);
  --td-text-color-placeholder: rgba(255, 255, 255, 0.5);
  --td-border-level-1-color: rgba(255, 255, 255, 0.08);
  --td-bg-color-container: #24262b;
  --td-bg-color-container-hover: #32353d;
  --td-bg-color-container-active: #393d48;
  --td-brand-color: #aeb1ff;
  --td-brand-color-light: rgba(141, 145, 255, 0.16);
  --td-brand-color-light-hover: rgba(141, 145, 255, 0.24);

  .t-popup__content {
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: #24262b;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.42);
  }

  .t-select-option {
    color: rgba(255, 255, 255, 0.9);
  }

  .t-select-option-group__header {
    color: rgba(255, 255, 255, 0.5);
  }

  .t-select-option.t-is-selected:not(.t-is-disabled) {
    color: #c7c9ff;
    background: rgba(141, 145, 255, 0.16);
  }
}
</style>
