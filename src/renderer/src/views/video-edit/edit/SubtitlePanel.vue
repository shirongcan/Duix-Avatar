<template>
  <div class="subtitle-panel">
    <div v-if="!hasText" class="empty-tip">{{ $t('common.editView.subtitleNeedsText') }}</div>

    <div class="switch-row">
      <div>
        <div class="row-title">{{ $t('common.editView.subtitleEnable') }}</div>
        <div class="row-description">{{ $t('common.editView.subtitleDescription') }}</div>
      </div>
      <t-switch :model-value="subtitle.enabled" :disabled="!hasText" @change="setEnabled" />
    </div>
    <div class="switch-row secondary" :class="{ disabled: !subtitle.enabled }">
      <div>
        <div class="row-title">{{ $t('common.editView.subtitleBurn') }}</div>
        <div class="row-description">{{ $t('common.editView.subtitleBurnTip') }}</div>
      </div>
      <t-switch :model-value="subtitle.burnEnabled" :disabled="!hasText" @change="setBurnEnabled" />
    </div>

    <div class="preset-card">
      <div class="preset-header">
        <div>
          <div class="row-title">{{ $t('common.editView.subtitlePresets') }}</div>
          <div class="row-description">{{ $t('common.editView.subtitlePresetCount', { count: state.presets.length, max: MAX_PRESETS }) }}</div>
        </div>
        <t-button size="small" variant="outline" :disabled="state.presets.length >= MAX_PRESETS" @click="state.naming = true">
          {{ $t('common.editView.subtitlePresetSave') }}
        </t-button>
      </div>
      <t-select
        v-model="state.selectedId"
        class="preset-select"
        :options="presetOptions"
        :popup-props="{ overlayClassName: 'subtitle-preset-popup' }"
        :placeholder="$t('common.editView.subtitlePresetPlaceholder')"
        @change="applyPreset"
      />
      <div v-if="selectedUserPreset" class="preset-actions">
        <t-button size="small" variant="outline" @click="overwritePreset">{{ $t('common.editView.subtitlePresetOverwrite') }}</t-button>
        <t-popconfirm :content="$t('common.editView.subtitlePresetDeleteConfirm')" @confirm="deletePreset">
          <t-button size="small" theme="danger" variant="text">{{ $t('common.editView.subtitlePresetDelete') }}</t-button>
        </t-popconfirm>
      </div>
      <div v-if="state.naming" class="preset-name">
        <t-input
          v-model="state.name"
          class="preset-name-input"
          :maxlength="24"
          :placeholder="$t('common.editView.subtitlePresetNamePlaceholder')"
          @enter="savePreset"
        />
        <t-button size="small" :loading="state.saving" @click="savePreset">{{ $t('common.editView.subtitlePresetConfirm') }}</t-button>
        <t-button class="preset-cancel-button" size="small" theme="default" variant="text" @click="cancelName">{{ $t('common.editView.subtitlePresetCancel') }}</t-button>
      </div>
    </div>

    <div class="controls" :class="{ disabled: !subtitle.enabled }">
      <label>{{ $t('common.editView.subtitlePosition') }}</label>
      <t-radio-group v-model="subtitle.position" :disabled="!subtitle.enabled" variant="default-filled">
        <t-radio-button value="top">{{ $t('common.editView.subtitleTop') }}</t-radio-button>
        <t-radio-button value="middle">{{ $t('common.editView.subtitleMiddle') }}</t-radio-button>
        <t-radio-button value="bottom">{{ $t('common.editView.subtitleBottom') }}</t-radio-button>
      </t-radio-group>
      <label>{{ $t('common.editView.subtitleFontSize') }} <span>{{ subtitle.fontSize }}</span></label>
      <t-slider v-model="subtitle.fontSize" :min="24" :max="72" :step="2" :disabled="!subtitle.enabled" />
      <label>{{ $t('common.editView.subtitleVerticalOffset') }} <span>{{ subtitle.verticalOffset }}</span></label>
      <t-slider v-model="subtitle.verticalOffset" :min="-160" :max="160" :step="5" :disabled="!subtitle.enabled" />
      <label>{{ $t('common.editView.subtitleOutlineWidth') }} <span>{{ subtitle.outlineWidth }}</span></label>
      <t-slider v-model="subtitle.outlineWidth" :min="0" :max="8" :disabled="!subtitle.enabled" />
      <div class="color-row">
        <label>{{ $t('common.editView.subtitleTextColor') }}<input v-model="subtitle.textColor" type="color" :disabled="!subtitle.enabled" /></label>
        <label>{{ $t('common.editView.subtitleOutlineColor') }}<input v-model="subtitle.outlineColor" type="color" :disabled="!subtitle.enabled" /></label>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { getContext, saveContext } from '@renderer/api'
import { useI18n } from 'vue-i18n'

const props = defineProps({ hasText: Boolean })
const subtitle = defineModel({ required: true })
const { t } = useI18n()
const CONTEXT_KEY = 'subtitle_style_presets_v1'
const MAX_PRESETS = 12
const state = reactive({ presets: [], selectedId: '', naming: false, name: '', saving: false })

const builtIns = computed(() => [
  { id: 'builtin-white', name: t('common.editView.subtitlePresetWhite'), style: { fontSize: 42, textColor: '#FFFFFF', outlineColor: '#000000', outlineWidth: 3, position: 'bottom', verticalOffset: 0 } },
  { id: 'builtin-yellow', name: t('common.editView.subtitlePresetYellow'), style: { fontSize: 38, textColor: '#FADB14', outlineColor: '#161616', outlineWidth: 4, position: 'bottom', verticalOffset: -20 } },
  { id: 'builtin-top', name: t('common.editView.subtitlePresetTop'), style: { fontSize: 36, textColor: '#FFFFFF', outlineColor: '#1A1A1A', outlineWidth: 3, position: 'top', verticalOffset: 20 } }
])
const presetOptions = computed(() => [
  { group: t('common.editView.subtitlePresetBuiltins'), children: builtIns.value.map((item) => ({ label: item.name, value: item.id })) },
  { group: t('common.editView.subtitlePresetMine'), children: state.presets.map((item) => ({ label: item.name, value: item.id })) }
])
const selectedUserPreset = computed(() => state.presets.find((item) => item.id === state.selectedId))

function normalizeStyle(style = {}) {
  const color = (value, fallback) => /^#[0-9A-F]{6}$/i.test(value) ? value.toUpperCase() : fallback
  const outlineWidth = Number(style.outlineWidth)
  return {
    fontSize: Math.min(72, Math.max(24, Number(style.fontSize) || 42)),
    textColor: color(style.textColor, '#FFFFFF'),
    outlineColor: color(style.outlineColor, '#000000'),
    outlineWidth: Number.isFinite(outlineWidth) ? Math.min(8, Math.max(0, outlineWidth)) : 3,
    position: ['top', 'middle', 'bottom'].includes(style.position) ? style.position : 'bottom',
    verticalOffset: Math.min(160, Math.max(-160, Number(style.verticalOffset) || 0))
  }
}

async function persist(next) {
  await saveContext(CONTEXT_KEY, JSON.stringify(next))
  state.presets = next
}
function applyPreset(id) {
  const preset = builtIns.value.find((item) => item.id === id) || state.presets.find((item) => item.id === id)
  if (preset) Object.assign(subtitle.value, normalizeStyle(preset.style))
}
function setEnabled(enabled) {
  subtitle.value.enabled = Boolean(enabled)
  if (!enabled) subtitle.value.burnEnabled = false
}
function setBurnEnabled(enabled) {
  subtitle.value.burnEnabled = Boolean(enabled)
  if (enabled) subtitle.value.enabled = true
}
function cancelName() { state.naming = false; state.name = '' }
async function savePreset() {
  const name = state.name.trim().slice(0, 24)
  if (!name) return MessagePlugin.warning(t('common.editView.subtitlePresetNameRequired'))
  if (state.presets.some((item) => item.name.toLowerCase() === name.toLowerCase())) return MessagePlugin.warning(t('common.editView.subtitlePresetNameDuplicate'))
  state.saving = true
  try {
    const id = `user-${globalThis.crypto?.randomUUID?.() || Date.now()}`
    await persist([...state.presets, { id, name, style: normalizeStyle(subtitle.value) }])
    state.selectedId = id
    cancelName()
  } finally { state.saving = false }
}
async function overwritePreset() {
  await persist(state.presets.map((item) => item.id === state.selectedId ? { ...item, style: normalizeStyle(subtitle.value) } : item))
}
async function deletePreset() {
  await persist(state.presets.filter((item) => item.id !== state.selectedId))
  state.selectedId = ''
}

watch(() => props.hasText, (hasText) => {
  if (!hasText) { subtitle.value.enabled = false; subtitle.value.burnEnabled = false }
})
onMounted(async () => {
  try {
    const saved = await getContext(CONTEXT_KEY)
    const value = saved?.val ? JSON.parse(saved.val) : []
    state.presets = Array.isArray(value) ? value.filter((item) => item?.id && item?.name && item?.style).slice(0, MAX_PRESETS) : []
  } catch (error) {
    console.warn('字幕预设读取失败', error)
  }
})
</script>

<style lang="less" scoped>
.subtitle-panel { width: 100%; color: #fff; display: flex; flex-direction: column; gap: 12px; }
.empty-tip { padding: 10px; color: #ffb65c; background: rgba(255,147,47,.12); border-radius: 4px; font-size: 12px; }
.switch-row, .preset-header { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.switch-row, .preset-card, .controls { padding: 12px; background: #161718; border: 1px solid #2e3033; border-radius: 6px; }
.secondary { margin-top: -6px; }
.row-title { font-size: 13px; font-weight: 500; }
.row-description { margin-top: 3px; color: rgba(255,255,255,.5); font-size: 11px; line-height: 16px; }
.disabled { opacity: .5; }
.preset-card { display: flex; flex-direction: column; gap: 10px; }
.preset-select {
  width: 100%;
  --td-text-color-primary: rgba(255, 255, 255, .9);
  --td-text-color-placeholder: rgba(255, 255, 255, .48);

  :deep(.t-input) {
    color: #fff;
    border-color: rgba(255, 255, 255, .12);
    background: rgba(7, 8, 11, .45);
  }

  :deep(.t-input__inner) {
    color: rgba(255, 255, 255, .9);

    &::placeholder { color: rgba(255, 255, 255, .48); }
  }

  :deep(.t-fake-arrow) { color: rgba(255, 255, 255, .62); }
}
.preset-actions, .preset-name, .color-row { display: flex; align-items: center; gap: 8px; }
.preset-name :deep(.t-input__wrap) { flex: 1; }
.preset-header :deep(.t-button--variant-outline),
.preset-actions :deep(.t-button--variant-outline) {
  color: rgba(255, 255, 255, .82);
  border-color: rgba(255, 255, 255, .24);
  background: transparent;
}
.preset-name :deep(.t-button--theme-default.t-button--variant-text) {
  color: rgba(255, 255, 255, .72);

  &:hover {
    color: #fff;
    background: rgba(255, 255, 255, .08);
  }
}
.preset-name :deep(.preset-cancel-button) { color: rgba(255, 255, 255, .72) !important; }
.preset-actions :deep(.t-button--theme-danger.t-button--variant-text) { color: #ff8f8f; }
.preset-name-input {
  --td-text-color-primary: rgba(255, 255, 255, .9);
  --td-text-color-placeholder: rgba(255, 255, 255, .48);

  :deep(.t-input) {
    color: #fff;
    border-color: rgba(255, 255, 255, .14);
    background: rgba(7, 8, 11, .55);
  }

  :deep(.t-input__inner) {
    color: rgba(255, 255, 255, .9);

    &::placeholder { color: rgba(255, 255, 255, .48); }
  }
}
.controls { display: flex; flex-direction: column; gap: 8px; }
.controls > label { display: flex; justify-content: space-between; font-size: 12px; }
.controls :deep(.t-radio-group) { display: flex; }
.controls :deep(.t-radio-button) { flex: 1; }
.color-row { justify-content: space-between; }
.color-row label { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.color-row input { width: 30px; height: 24px; border: 0; padding: 0; background: none; }
</style>

<style lang="less">
.subtitle-preset-popup {
  --td-text-color-primary: rgba(255, 255, 255, .9);
  --td-text-color-placeholder: rgba(255, 255, 255, .5);
  --td-border-level-1-color: rgba(255, 255, 255, .08);
  --td-bg-color-container: #24262b;
  --td-bg-color-container-hover: #32353d;
  --td-bg-color-container-active: #393d48;
  --td-brand-color: #aeb1ff;
  --td-brand-color-light: rgba(141, 145, 255, .16);
  --td-brand-color-light-hover: rgba(141, 145, 255, .24);

  .t-popup__content {
    border: 1px solid rgba(255, 255, 255, .12);
    background: #24262b;
    box-shadow: 0 10px 28px rgba(0, 0, 0, .42);
  }

  .t-select-option { color: rgba(255, 255, 255, .9); }
  .t-select-option:hover { color: #fff; background: #32353d; }
  .t-select-option-group__header { color: rgba(255, 255, 255, .5); }
  .t-select-option.t-is-selected:not(.t-is-disabled) {
    color: #c7c9ff;
    background: rgba(141, 145, 255, .16);
  }
}
</style>
