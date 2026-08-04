<template>
  <div class="video-dialog-box">
    <t-dialog :width="560" :visible="props.showVideoDialog" top="8vh" :on-close="close">
      <template #footer><span></span></template>
      <div v-if="props.subtitledUrl" class="version-switch">
        <t-radio-group v-model="selectedVersion" variant="default-filled">
          <t-radio-button value="subtitled">{{ $t('common.videoList.previewSubtitled') }}</t-radio-button>
          <t-radio-button value="clean">{{ $t('common.videoList.previewClean') }}</t-radio-button>
        </t-radio-group>
      </div>
      <div class="video-box">
        <video ref="videoPlayer" class="video-look" autoplay :src="localUrl.addFileProtocol(currentUrl)" controls></video>
      </div>
    </t-dialog>
  </div>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { localUrl } from '@renderer/utils'
const emit = defineEmits(['cancel'])
const props = defineProps({ showVideoDialog: Boolean, cleanUrl: { type: String, default: '' }, subtitledUrl: { type: String, default: '' } })
const videoPlayer = ref(null)
const selectedVersion = ref('clean')
const currentUrl = computed(() => selectedVersion.value === 'subtitled' && props.subtitledUrl ? props.subtitledUrl : props.cleanUrl)
watch(() => props.showVideoDialog, (visible) => { if (visible) selectedVersion.value = props.subtitledUrl ? 'subtitled' : 'clean' })
watch(currentUrl, () => { videoPlayer.value?.load() })
const close = () => { emit('cancel'); videoPlayer.value?.pause() }
</script>
<style lang="less" scoped>
.version-switch { display: flex; justify-content: center; margin-bottom: 12px; }
.video-box { display: flex; justify-content: center; align-items: center; background: #000; }
.video-look { width: 100%; max-height: 68vh; }
</style>
