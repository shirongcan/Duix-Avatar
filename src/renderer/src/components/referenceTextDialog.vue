<template>
  <div class="reference-text-dialog-box">
    <t-dialog
      :width="640"
      v-model:visible="showDialog"
      top="10vh"
      placement="center"
      :closeOnOverlayClick="false"
      :on-close="close"
      :header="$t('common.referenceTextDialog.headerTitle')"
    >
      <div class="content">
        <div class="model-info">
          <span class="model-name">{{ current?.name || '' }}</span>
        </div>
        <div class="tip">{{ $t('common.referenceTextDialog.tip') }}</div>
        <div v-for="(segment, index) in segments" :key="index" class="segment">
          <div class="segment-label">
            <span v-if="segments.length > 1">{{ $t('common.referenceTextDialog.segmentLabel') }} {{ index + 1 }}</span>
            <span
              class="segment-play"
              :class="{ '--disabled': !parts[index]?.available }"
              @click="togglePlay(index)"
            >
              {{ playingIndex === index ? $t('common.referenceTextDialog.stopText') : $t('common.referenceTextDialog.segmentPlayText') }}
            </span>
          </div>
          <t-textarea
            v-model="segments[index]"
            :autosize="{ minRows: 3, maxRows: 10 }"
            :maxlength="500"
            :placeholder="$t('common.referenceTextDialog.placeholder')"
          />
        </div>
      </div>
      <template #footer>
        <div class="btn-box">
          <t-button variant="outline" theme="default" @click="close">{{
            $t('common.referenceTextDialog.cancelText')
          }}</t-button>
          <t-button theme="primary" :loading="loading" :disabled="!current?.voice_id" @click="save">{{
            $t('common.referenceTextDialog.saveText')
          }}</t-button>
        </div>
      </template>
    </t-dialog>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { findModel, updateVoiceReferenceText, getVoiceReferenceAudioParts } from '@renderer/api'
import { localUrl } from '@renderer/utils'

const emit = defineEmits(['saved'])

const showDialog = ref(false)
const current = ref(null)
const segments = ref([])
const parts = ref([])
const loading = ref(false)
const playingIndex = ref(-1)

const audio = new Audio()
audio.addEventListener('ended', () => {
  playingIndex.value = -1
})

const close = () => {
  audio.pause()
  audio.currentTime = 0
  playingIndex.value = -1
  showDialog.value = false
}

const togglePlay = (index) => {
  if (playingIndex.value === index) {
    audio.pause()
    audio.currentTime = 0
    playingIndex.value = -1
    return
  }
  const part = parts.value[index]
  if (!part?.available || !part.path) {
    MessagePlugin.warning('该段音频暂不可用，请确认 Docker TTS 容器已启动')
    return
  }
  audio.src = localUrl.addFileProtocol(part.path)
  audio.play().then(() => {
    playingIndex.value = index
  }).catch(() => {
    MessagePlugin.error('音频播放失败')
  })
}

const open = async (model) => {
  current.value = model || null
  const raw = model?.reference_audio_text || ''
  segments.value = raw ? raw.split('|||') : ['']
  parts.value = []
  try {
    const fresh = await findModel(model.id)
    if (fresh) {
      current.value = fresh
      const rawText = fresh.reference_audio_text || ''
      segments.value = rawText ? rawText.split('|||') : ['']
    }
  } catch (error) {
    console.error('获取模特信息失败', error)
  }
  try {
    if (current.value?.voice_id) {
      const result = await getVoiceReferenceAudioParts(current.value.voice_id)
      parts.value = result?.parts || []
    }
  } catch (error) {
    console.error('获取参考音频分片失败', error)
    parts.value = []
  }
  showDialog.value = true
}

const save = async () => {
  const voiceId = current.value?.voice_id
  if (!voiceId) {
    MessagePlugin.error('该模特没有关联的音色，无法校准')
    return
  }
  loading.value = true
  try {
    const normalized = segments.value
      .map((segment) => (segment || '').trim())
      .join('|||')
    const ok = await updateVoiceReferenceText(voiceId, normalized)
    if (ok) {
      if (current.value) current.value.reference_audio_text = normalized
      MessagePlugin.success('参考文本已保存，之后生成的声音会使用修改后的文本')
      emit('saved')
      close()
    } else {
      MessagePlugin.error('保存失败，请稍后再试')
    }
  } catch (error) {
    console.error('保存参考文本失败', error)
    MessagePlugin.error('保存失败，请稍后再试')
  } finally {
    loading.value = false
  }
}

onUnmounted(() => {
  audio.pause()
})

defineExpose({
  open
})
</script>

<style lang="less" scoped>
.content {
  .model-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;

    .model-name {
      font-size: 14px;
      font-weight: 600;
      color: #252525;
    }

  }

  .tip {
    font-size: 12px;
    color: #9097a5;
    line-height: 18px;
    margin-bottom: 10px;
  }

  .segment {
    margin-bottom: 10px;

    .segment-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;

      span {
        font-size: 12px;
        color: #696f7a;
      }

      .segment-play {
        padding: 2px 10px;
        border: 1px solid #434af9;
        border-radius: 4px;
        color: #434af9;
        cursor: pointer;
        font-size: 12px;

        &.--disabled {
          border-color: #c5c8cf;
          color: #c5c8cf;
          cursor: not-allowed;
        }
      }
    }
  }
}

.btn-box {
  display: flex;
  justify-content: flex-end;

  button {
    margin-left: 12px;
  }
}
</style>
