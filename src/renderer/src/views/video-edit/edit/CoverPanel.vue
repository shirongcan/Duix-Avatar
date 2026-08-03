<template>
  <div class="cover-panel">
    <div class="cover-row">
      <div>
        <div class="cover-title">{{ $t('common.editView.coverEnable') }}</div>
        <div class="cover-description">{{ $t('common.editView.coverDescription') }}</div>
      </div>
      <t-switch v-model="cover.enabled" :disabled="!cover.imagePath" />
    </div>

    <button class="cover-upload" type="button" @click="selectCover">
      <img
        v-if="cover.imagePath"
        class="cover-image"
        :src="localUrl.addFileProtocol(cover.imagePath)"
      />
      <span v-else class="cover-placeholder">
        <span class="cover-plus">+</span>
        <span>{{ $t('common.editView.coverSelect') }}</span>
      </span>
      <span v-if="cover.imagePath" class="cover-change">{{ $t('common.editView.coverChange') }}</span>
    </button>

    <div class="cover-tip">{{ $t('common.editView.coverTip') }}</div>
    <t-button
      v-if="cover.imagePath"
      class="cover-remove"
      theme="default"
      variant="outline"
      block
      @click="removeCover"
    >
      {{ $t('common.editView.coverRemove') }}
    </t-button>
  </div>
</template>

<script setup>
import { Client } from '@renderer/client'
import { localUrl } from '@renderer/utils'

const cover = defineModel({
  default: () => ({ enabled: false, imagePath: '', duration: 1.5, previewing: false })
})

async function selectCover() {
  const imagePath = await Client.file.selectImage()
  if (!imagePath) return
  cover.value.imagePath = imagePath
  cover.value.enabled = true
  cover.value.previewing = true
}

function removeCover() {
  cover.value.imagePath = ''
  cover.value.enabled = false
  cover.value.previewing = false
}
</script>

<style lang="less" scoped>
.cover-panel {
  width: 100%;
  padding: 18px;
  border-radius: 8px;
  color: #ffffff;
  background: #161718;
}

.cover-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.cover-title {
  font-size: 14px;
  line-height: 22px;
}

.cover-description,
.cover-tip {
  margin-top: 4px;
  color: rgba(255, 255, 255, 0.56);
  font-size: 12px;
  line-height: 18px;
}

.cover-upload {
  position: relative;
  display: flex;
  width: 100%;
  aspect-ratio: 16 / 9;
  align-items: center;
  justify-content: center;
  padding: 0;
  overflow: hidden;
  border: 1px dashed rgba(255, 255, 255, 0.28);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.72);
  background: #202224;
  cursor: pointer;
}

.cover-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.cover-plus {
  font-size: 28px;
  font-weight: 300;
}

.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-change {
  position: absolute;
  right: 8px;
  bottom: 8px;
  padding: 4px 8px;
  border-radius: 4px;
  color: #ffffff;
  font-size: 12px;
  background: rgba(0, 0, 0, 0.68);
}

.cover-tip {
  margin: 10px 0 14px;
}

.cover-remove {
  --td-button-default-color: rgba(255, 255, 255, 0.78);
  --td-button-default-border-color: rgba(255, 255, 255, 0.2);
}
</style>
