<template>
  <t-layout class="layout">
    <t-header class="layout-header">
      <Header :on-submit="action.submit" :on-save="action.save" v-model="state.video" />
    </t-header>
    <t-loading text="加载中..." :loading="state.initLoading" :showOverlay="false">
      <t-layout class="layout-body">
        <!-- <t-aside width="50px">Aside</t-aside> -->
        <t-content class="layout-content">
          <t-row class="content-row">
            <t-col :flex="2.7">
              <Select class="content-left" v-model="state.select" @query="action.queryModelList" />
            </t-col>
            <t-col :flex="4.5">
              <Preview
                class="content-center"
                :model="state.select.model"
                :subtitle="state.select.subtitle"
                :text="state.select.text"
              />
            </t-col>
            <t-col :flex="5.0">
              <Edit class="content-right" v-model="state.select" />
            </t-col>
          </t-row>
        </t-content>
      </t-layout>
    </t-loading>
  </t-layout>
  <ModalFinished ref="modalFinished" :right-btn-text="$t('common.selectView.modalFinishedObj.rightBtnText')">
    {{ $t('common.selectView.modalFinishedObj.text1')
    }}<span style="color: #434af9"> {{ $t('common.selectView.modalFinishedObj.text2') }}</span>
    {{ $t('common.selectView.modalFinishedObj.text3') }}
  </ModalFinished>
</template>
<script setup>
import { ref, reactive, watch } from "vue";
import Header from './header/HeaderView.vue'
import Select from './select/SelectView.vue'
import Preview from './preview/PreviewView.vue'
import Edit from './edit/EditView.vue'
import ModalFinished from '@renderer/components/ModalFinished.vue'
import { saveVideo, makeVideo, findModel, findVideo, modelPage } from '@renderer/api'
import { useRoute, useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'
import { Client } from '@renderer/client'
import { millisecondsToTime } from '@renderer/utils'
import { inheritRevisionSubtitleStyle } from '@renderer/utils/video-revision.js'
const { t } = useI18n()

const route = useRoute()
const router = useRouter()

const modalFinished = ref()

const state = reactive({
  initLoading: false,
  sourceVideoId: '',
  sourceVoiceId: '',
  video: {
    id: '',
    name: `${t('common.modelCreateView.videoName')}${new Date().toLocaleString().replace(/\/|:| /g, '')}`
  },
  select: {
    model: {},
    speaker: {},
    text: '',
    speed: 1,
    modelList: [],
    uploaded: null,
    subtitle: {
      enabled: false,
      burnEnabled: false,
      fontSize: 42,
      textColor: '#FFFFFF',
      outlineColor: '#000000',
      outlineWidth: 3,
      position: 'bottom',
      verticalOffset: 0
    }
  }
})

const action = {
  async init() {
    state.initLoading = true
    try {
      const { videoId, sourceVideoId, modelId } = route.query
      state.sourceVideoId = sourceVideoId || ''

      action.initWatchs()

      // 初始化视频详情
      if (videoId || sourceVideoId) {
        await action.initVideoDetail(videoId || sourceVideoId, Boolean(sourceVideoId))
      }

      // 初始化模特列表
      await action.queryModelList()

      // 初始化模特详情
      if (modelId) {
        state.select.model.id = modelId
      }

      if (!state.select.model.id) {
        // 如果未选中模特，则默认选中第一个模特
        state.select.model.id = state.select.modelList[0]?.id
      }

      if (state.select.model.id) {
        await action.initModelDetail(state.select.model.id)
      }

      if (state.sourceVoiceId) {
        const sourceSpeaker = state.select.modelList.find((item) => item.voice_id == state.sourceVoiceId)
        if (sourceSpeaker) state.select.speaker = sourceSpeaker
      }

      // 选中的模特滚动到中间
      setTimeout(action.scrollToSelectModel)
    } catch (error) {
      console.error('初始化视频编辑页面失败', error)
      const { videoId, modelId } = route.query
      if (videoId || modelId) {
        MessagePlugin.error(t('common.message.initEditVideoPageFailed'))
      }
    } finally {
      state.initLoading = false
    }
  },

  //变更模特时，音色跟随变更
  initWatchs() {
    watch(
      () => state.select.model,
      async (model) => {
        if (model?.voice_id) {
          state.select.speaker = model
        }
      }
    )
  },
  async queryModelList(name = '') {
    try {
      const result = await modelPage({
        name,
        page: 1,
        pageSize: 100
      })

      state.select.modelList = result.list || []
    } catch (error) {
      console.error('查询模特列表失败', error)
      state.select.modelList = []
    }
  },
  // 选中的模特滚动到中间
  scrollToSelectModel() {
    const target = document.querySelector(`div[model-id="${state.select.model.id}"]`)
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  },
  async initVideoDetail(videoId, isRevision = false) {
    const videoDetail = await findVideo(videoId)
    if (videoDetail) {
      state.video.id = isRevision ? '' : videoDetail.id
      state.video.name = isRevision
        ? `${videoDetail.name}${t('common.editView.revisionNameSuffix')}`
        : videoDetail.name
      state.select.text = videoDetail.text_content || ''
      state.select.speed = Number(videoDetail.speed) || 1
      state.select.model.id = videoDetail.model_id
      state.sourceVoiceId = videoDetail.voice_id || ''
      if (videoDetail.audio_source === 'upload' && videoDetail.audio_path) {
        const info = await Client.file.getAudioInfo(videoDetail.audio_path)
        state.select.uploaded = {
          name: info?.name || videoDetail.audio_path.split(/[\\/]/).pop(),
          audioUrl: videoDetail.audio_path,
          duration: info?.duration ? millisecondsToTime(info.duration * 1000) : '--:--'
        }
      }
      try {
        let subtitleStyle = typeof videoDetail.subtitle_style === 'string'
          ? JSON.parse(videoDetail.subtitle_style)
          : videoDetail.subtitle_style
        if (isRevision) subtitleStyle = inheritRevisionSubtitleStyle(subtitleStyle)
        if (subtitleStyle) Object.assign(state.select.subtitle, subtitleStyle)
      } catch (error) {
        console.warn('字幕设置读取失败', error)
      }
    }
  },
  async initModelDetail(modelId) {
    const modelDetail = await findModel(modelId)
    state.select.model = modelDetail
  },
  check() {
    const { select, video } = state
    if (!select.model.id) {
      MessagePlugin.error(t('common.message.selectModelsTextError'))
      return false
    }
    if (!video.name) {
      MessagePlugin.error(t('common.message.VideoTextError'))
      return false
    }
    if (!select.text && !select.uploaded?.audioUrl) {
      MessagePlugin.error(t('common.message.VideoCopywritingTextError'))
      return false
    }
    return true
  },
  async submit() {
    if (state.initLoading || !action.check()) return
    try {
      state.video.id = await action.save()
      const isOK = await action.make(state.video.id)
      if (isOK) {
        const isToSee = await modalFinished.value.show()
        isToSee ? router.push('/home') : window.location.reload()
      } else {
        throw new Error('合成视频失败')
      }
    } catch (error) {
      console.error(error)
      MessagePlugin.error(t('common.message.videoSynthesisTextError'))
    }
  },
  async save() {
    if (state.initLoading) return
    // model_id, name, text_content
    const { select, video } = state

    const sumitAudio = {}
    if (select.uploaded?.audioUrl) {
      sumitAudio.audio_path = select.uploaded.audioUrl
    } else {
      sumitAudio.voice_id = select.speaker.voice_id
    }

    const saveId = await saveVideo({
      id: video.id,
      source_video_id: state.sourceVideoId || undefined,
      audio_source: select.uploaded ? 'upload' : 'tts',
      model_id: select.model.id,
      name: video.name,
      text_content: select.text,
      speed: Number(select.speed) || 1,
      subtitle_style: {
        enabled: Boolean((select.subtitle.enabled || select.subtitle.burnEnabled) && select.text?.trim()),
        burnEnabled: Boolean(select.subtitle.burnEnabled && select.text?.trim()),
        fontSize: Number(select.subtitle.fontSize),
        textColor: String(select.subtitle.textColor),
        outlineColor: String(select.subtitle.outlineColor),
        outlineWidth: Number(select.subtitle.outlineWidth),
        position: String(select.subtitle.position),
        verticalOffset: Number(select.subtitle.verticalOffset || 0)
      },
      ...sumitAudio
    })
    return video.id || saveId
  },
  async make(videoId) {
    const makeId = await makeVideo(videoId)
    return makeId == videoId
  }
}

action.init()
</script>
<style lang="less" scoped>
.layout {
  width: 100%;
  height: 100vh;
  --td-bg-color-container: #1d1e20;
  --td-bg-color-page: #1d1e20;
  color: #ffffff;

  :deep(.t-loading__text) {
    color: #ffffff;
  }

  :deep(.t-loading__gradient-conic) {
    background: conic-gradient(from 90deg at 50% 50%,
        rgba(67, 74, 249, 0) 0deg,
        rgb(255, 255, 255) 360deg) !important;
  }

  &-header {
    height: 60px;
    flex: none;
    border-bottom: 1px solid #000000;
  }

  &-body {
    height: calc(100vh - 60px);
    overflow: hidden;
  }

  &-content {
    height: 100%;
  }

  .content-row {
    height: 100%;
    align-items: unset;

    &>* {
      height: 100%;
    }
  }
}
</style>
