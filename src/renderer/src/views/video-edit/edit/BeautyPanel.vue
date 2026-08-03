<template>
  <div class="beauty-panel">
    <div class="beauty-switch-row">
      <div>
        <div class="beauty-title">{{ $t('common.editView.beautyEnable') }}</div>
        <div class="beauty-description">{{ $t('common.editView.beautyDescription') }}</div>
      </div>
      <t-switch v-model="beauty.enabled" />
    </div>

    <div class="beauty-controls" :class="{ disabled: !beauty.enabled }">
      <div v-for="item in controls" :key="item.key" class="beauty-control">
        <div class="beauty-control-header">
          <span>{{ item.label }}</span>
          <span class="beauty-value">{{ beauty[item.key] }}</span>
        </div>
        <t-slider v-model="beauty[item.key]" :min="0" :max="100" :disabled="!beauty.enabled" />
      </div>
    </div>

    <div class="beauty-tip">{{ $t('common.editView.beautyTip') }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const beauty = defineModel({ required: true })
const { t } = useI18n()

const controls = computed(() => [
  { key: 'smoothing', label: t('common.editView.smoothing') },
  { key: 'brighten', label: t('common.editView.brighten') },
  { key: 'rosy', label: t('common.editView.rosy') }
])
</script>

<style lang="less" scoped>
.beauty-panel {
  padding: 18px;
  color: #fff;
  background: #161718;
}

.beauty-switch-row,
.beauty-control-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.beauty-switch-row {
  padding-bottom: 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.beauty-title {
  font-size: 14px;
  font-weight: 500;
}

.beauty-description,
.beauty-tip {
  margin-top: 5px;
  color: rgba(255, 255, 255, 0.48);
  font-size: 12px;
  line-height: 18px;
}

.beauty-controls {
  transition: opacity 0.2s;

  &.disabled {
    opacity: 0.42;
  }
}

.beauty-control {
  margin-top: 22px;
}

.beauty-control-header {
  margin-bottom: 8px;
  font-size: 13px;
}

.beauty-value {
  min-width: 28px;
  color: #8d91ff;
  text-align: right;
}

.beauty-tip {
  margin-top: 24px;
  padding: 10px 12px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
}
</style>
