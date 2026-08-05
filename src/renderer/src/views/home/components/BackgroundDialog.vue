<template>
  <div class="background-dialog-box">
    <t-dialog
      :width="860"
      :visible="props.visible"
      top="6vh"
      :footer="false"
      :close-on-overlay-click="false"
      :on-close="close"
    >
      <div class="bg-body">
        <div class="bg-left">
          <div class="bg-video-box">
            <video
              v-if="currentVideoUrl"
              :src="localUrl.addFileProtocol(currentVideoUrl)"
              controls
            ></video>
            <div v-else class="bg-video-empty">{{ $t('common.videoList.backgroundTitle') }}</div>
          </div>
          <div v-if="previewUrl" class="bg-preview-result">
            <img :src="localUrl.addFileProtocol(previewUrl)" />
            <span>{{ $t('common.videoList.backgroundPreview') }}</span>
          </div>
        </div>

        <div class="bg-right">
          <div class="bg-row">
            <t-radio-group v-model="state.type" variant="default-filled">
              <t-radio-button value="color">{{ $t('common.videoList.backgroundTypeColor') }}</t-radio-button>
              <t-radio-button value="image">{{ $t('common.videoList.backgroundTypeImage') }}</t-radio-button>
              <t-radio-button value="video">{{ $t('common.videoList.backgroundTypeVideo') }}</t-radio-button>
            </t-radio-group>
          </div>

          <div class="bg-row" v-if="state.type === 'color'">
            <span class="bg-row-label">{{ $t('common.videoList.backgroundColorLabel') }}</span>
            <div class="color-picker-row">
              <button
                v-for="color in presetColors"
                :key="color"
                type="button"
                class="color-swatch"
                :class="{ active: state.color.toLowerCase() === color.toLowerCase() }"
                :style="{ background: color }"
                @click="state.color = color"
              ></button>
              <label class="color-custom" :style="{ background: state.color }">
                <input v-model="state.color" type="color" />
              </label>
            </div>
          </div>

          <div class="bg-row" v-if="state.type === 'image'">
            <span class="bg-row-label">{{ $t('common.videoList.backgroundImageLabel') }}</span>
            <div class="image-picker-row">
              <t-button theme="default" class="bg-btn" :loading="state.uploading" @click="action.chooseImage">
                {{ $t('common.videoList.backgroundUploadImage') }}
              </t-button>
              <div v-if="state.imagePath" class="image-thumb">
                <img :src="localUrl.addFileProtocol(state.imagePath)" />
                <span class="image-remove" @click="state.imagePath = ''">×</span>
              </div>
            </div>
          </div>

          <div class="bg-row" v-if="state.type === 'video'">
            <span class="bg-row-label">{{ $t('common.videoList.backgroundVideoLabel') }}</span>
            <div class="image-picker-row">
              <t-button theme="default" class="bg-btn" :loading="state.uploading" @click="action.chooseVideo">
                {{ $t('common.videoList.backgroundUploadVideo') }}
              </t-button>
              <div v-if="state.imagePath" class="video-thumb">
                <span class="video-name">{{ state.imagePath.split(/[\\/]/).pop() }}</span>
                <span class="image-remove" @click="state.imagePath = ''">×</span>
              </div>
            </div>
          </div>

          <div class="bg-row subtitle-row" v-if="hasSubtitles">
            <div class="subtitle-row-text">
              <div class="subtitle-row-title">{{ $t('common.videoList.keepSubtitles') }}</div>
              <div class="subtitle-row-desc">{{ $t('common.videoList.keepSubtitlesTip') }}</div>
            </div>
            <t-switch v-model="state.includeSubtitles"></t-switch>
          </div>

          <div class="bg-tip">
            <img class="bg-tip-icon" src="@renderer/assets/images/icons/icon-alert.png" />
            <span>{{ $t('common.videoList.backgroundTip') }}</span>
          </div>

          <div v-if="state.progress > 0" class="bg-progress">
            <t-progress :percentage="state.progress" :label="state.progressMessage" />
          </div>

          <div class="bg-actions">
            <t-button
              theme="default"
              class="bg-btn"
              :loading="state.previewing"
              :disabled="state.processing"
              @click="action.preview"
            >
              {{ $t('common.videoList.backgroundPreview') }}
            </t-button>
            <t-button
              theme="primary"
              class="bg-btn primary"
              :loading="state.processing"
              @click="action.replace"
            >
              {{ $t('common.videoList.backgroundStartReplace') }}
            </t-button>
          </div>
        </div>
      </div>
    </t-dialog>
  </div>
</template>

<script setup>
import { computed, reactive, watch } from 'vue'
import { localUrl } from '@renderer/utils'
import { Client } from '@renderer/client'
import { MessagePlugin } from 'tdesign-vue-next'
import {
  onVideoBackgroundProgress,
  previewVideoBackground,
  replaceVideoBackground
} from '@renderer/api'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const emit = defineEmits(['cancel', 'success'])
const props = defineProps({
  visible: { type: Boolean, default: false },
  video: { type: Object, default: () => ({}) }
})

const presetColors = ['#FFFFFF', '#000000', '#1E90FF', '#FF4500', '#32CD32', '#FFD700', '#C0C0C0', '#8A2BE2']
let removeProgressListener = null

const state = reactive({
  type: 'color',
  color: '#1E90FF',
  imagePath: '',
  includeSubtitles: true,
  uploading: false,
  previewing: false,
  processing: false,
  previewUrl: '',
  progress: 0,
  progressMessage: ''
})

const currentVideoUrl = computed(() => props.video?.file_path || props.video?.clean_file_path || '')
const hasSubtitles = computed(() => {
  const raw = props.video?.subtitle_style
  let style = raw
  if (typeof raw === 'string') {
    try {
      style = JSON.parse(raw)
    } catch {
      style = null
    }
  }
  return Boolean(style?.enabled && props.video?.text_content?.trim())
})

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      state.previewUrl = ''
      state.progress = 0
      state.progressMessage = ''
      state.includeSubtitles = true
      removeProgressListener = onVideoBackgroundProgress((payload) => {
        if (payload?.videoId !== props.video?.id) return
        state.progress = payload.percent || 0
        state.progressMessage = payload.message || ''
      })
    } else {
      removeProgressListener?.()
      removeProgressListener = null
    }
  }
)

const action = {
  async chooseImage() {
    const filePath = await Client.file.selectImage()
    if (filePath) {
      state.imagePath = filePath
      state.previewUrl = ''
    }
  },
  async chooseVideo() {
    const filePath = await Client.file.selectVideo()
    if (filePath) {
      state.imagePath = filePath
      state.previewUrl = ''
    }
  },
  stylePayload() {
    return {
      enabled: true,
      type: state.type,
      color: state.color,
      imagePath: state.imagePath
    }
  },
  async preview() {
    if (!props.video?.id) return
    if (state.type !== 'color' && !state.imagePath) {
      MessagePlugin.error(t('common.videoList.backgroundReplaceFailed'))
      return
    }
    state.previewing = true
    try {
      const result = await previewVideoBackground(props.video.id, action.stylePayload())
      state.previewUrl = result?.previewPath || ''
    } catch (error) {
      console.error(error)
      MessagePlugin.error(`${t('common.videoList.backgroundReplaceFailed')}: ${error?.message || error}`)
    } finally {
      state.previewing = false
    }
  },
  async replace() {
    if (!props.video?.id) return
    if (state.type !== 'color' && !state.imagePath) {
      MessagePlugin.error(t('common.videoList.backgroundReplaceFailed'))
      return
    }
    state.processing = true
    state.progress = 0
    state.progressMessage = ''
    try {
      await replaceVideoBackground(props.video.id, action.stylePayload(), {
        includeSubtitles: state.includeSubtitles
      })
      MessagePlugin.success(t('common.videoList.backgroundReplaceSuccess'))
      emit('success')
      close()
    } catch (error) {
      console.error(error)
      MessagePlugin.error(`${t('common.videoList.backgroundReplaceFailed')}: ${error?.message || error}`)
    } finally {
      state.processing = false
      state.progress = 0
      state.progressMessage = ''
    }
  }
}

const close = () => {
  removeProgressListener?.()
  removeProgressListener = null
  emit('cancel')
}
</script>

<style lang="less" scoped>
.background-dialog-box {
  --td-bg-color-container: #1d1e20;
  --td-bg-color-secondarycontainer: #161718;
  --td-bg-color-specialcomponent: #1d1e20;
  --td-bg-color-specialcomponent-hover: #2a2c2f;
  --td-bg-color-container-select: #161718;
  --td-component-border: #3d4045;
  --td-text-color-primary: #ffffff;
  --td-text-color-secondary: rgba(255, 255, 255, 0.6);
  --td-brand-color: #309cff;

  :deep(.t-dialog) {
    background: #1d1e20;
    color: #ffffff;
    border: 1px solid #3f4041;
    box-shadow: 0px 4px 16px 0px rgba(0, 0, 0, 0.25);
  }

  :deep(.t-dialog__close) {
    color: rgba(255, 255, 255, 0.85);
  }

  :deep(.t-radio-group--filled .t-radio-button) {
    color: rgba(255, 255, 255, 0.6);
  }

  :deep(.t-radio-group--filled .t-radio-button.t-is-checked) {
    color: #ffffff;
  }
}

.bg-body {
  display: flex;
  gap: 20px;
  min-height: 420px;
}

.bg-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;

  .bg-video-box {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000;
    border-radius: 6px;
    overflow: hidden;
    min-height: 260px;

    video {
      width: 100%;
      max-height: 320px;
      display: block;
    }
  }

  .bg-video-empty {
    color: rgba(255, 255, 255, 0.35);
    font-size: 13px;
  }

  .bg-preview-result {
    display: flex;
    align-items: center;
    gap: 10px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;

    img {
      width: 90px;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.15);
    }
  }
}

.bg-right {
  width: 300px;
  display: flex;
  flex-direction: column;
  gap: 16px;

  .bg-row {
    display: flex;
    align-items: center;
    gap: 12px;

    &-label {
      color: #fff;
      font-size: 13px;
      font-weight: 500;
    }
  }

  .subtitle-row {
    justify-content: space-between;

    .subtitle-row-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .subtitle-row-title {
      color: #fff;
      font-size: 13px;
      font-weight: 500;
    }

    .subtitle-row-desc {
      color: rgba(255, 255, 255, 0.5);
      font-size: 11px;
    }
  }

  .color-picker-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;

    .color-swatch {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, 0.25);
      cursor: pointer;
      padding: 0;

      &.active {
        border-color: #309cff;
        box-shadow: 0 0 0 2px rgba(48, 156, 255, 0.3);
      }
    }

    .color-custom {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      border: 2px dashed rgba(255, 255, 255, 0.4);
      cursor: pointer;
      overflow: hidden;
      display: inline-block;

      input {
        width: 40px;
        height: 40px;
        border: 0;
        cursor: pointer;
        transform: translate(-6px, -6px);
      }
    }
  }

  .image-picker-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;

    .image-thumb {
      position: relative;

      img {
        width: 64px;
        height: 64px;
        object-fit: cover;
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
    }

    .video-thumb {
      position: relative;
      display: flex;
      align-items: center;
      gap: 8px;
      max-width: 180px;
      padding: 6px 18px 6px 8px;
      background: rgba(255, 255, 255, 0.06);
      border-radius: 4px;

      .video-name {
        color: rgba(255, 255, 255, 0.8);
        font-size: 11px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .image-remove {
      position: absolute;
      top: -6px;
      right: -6px;
      width: 16px;
      height: 16px;
      line-height: 14px;
      text-align: center;
      background: #e34d59;
      color: #fff;
      border-radius: 50%;
      font-size: 12px;
      cursor: pointer;
    }

    .video-thumb .image-remove {
      position: static;
      flex: none;
    }
  }

  .bg-tip {
    display: flex;
    gap: 8px;
    padding: 8px 10px;
    background: rgba(255, 147, 47, 0.12);
    border-radius: 4px;
    color: #ff932f;
    font-size: 11px;
    line-height: 16px;

    &-icon {
      width: 12px;
      height: 12px;
      margin-top: 2px;
      flex: none;
    }
  }

  .bg-progress {
    :deep(.t-progress--line) {
      color: #fff;
    }

    :deep(.t-progress__info) {
      color: rgba(255, 255, 255, 0.85);
    }
  }

  .bg-actions {
    display: flex;
    gap: 12px;
    margin-top: auto;

    .bg-btn {
      flex: 1;
      height: 34px;
      font-size: 13px;
      color: #ffffff;
      background: #3d4045;
      border-color: #4a4f57;

      &:hover {
        color: #ffffff;
        background: #4a4f57;
        border-color: #565b64;
      }

      &.primary {
        background: #309cff;
        border-color: #309cff;
        color: #ffffff;

        &:hover {
          background: #2f8ae0;
          border-color: #2f8ae0;
        }
      }
    }
  }
}
</style>
