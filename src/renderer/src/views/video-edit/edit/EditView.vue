<template>
  <div class="edit">
    <div class="edit-header">{{ $t('common.editView.headerText') }}</div>
    <div class="edit-tabs">
      <button type="button" :class="{ active: state.activeTab === EDIT_TABS.TEXT }" @click="action.onChangeTab(EDIT_TABS.TEXT)">{{ $t('common.editView.text') }}</button>
      <button type="button" :class="{ active: state.activeTab === EDIT_TABS.AUDIO }" @click="action.onChangeTab(EDIT_TABS.AUDIO)">{{ $t('common.editView.audio') }}</button>
      <button type="button" :class="{ active: state.activeTab === EDIT_TABS.SUBTITLE }" @click="action.onChangeTab(EDIT_TABS.SUBTITLE)">{{ $t('common.editView.subtitle') }}</button>
    </div>
    <div class="edit-body edit-body-text" v-show="getter.isTextTab.value">
      <EditText v-model="select" class="content" :listener="listener" />
    </div>
    <div class="edit-body" v-show="getter.isAudioTab.value">
      <EditUpload v-model="select" class="content" :listener="listener" />
    </div>
    <div class="edit-body edit-body-subtitle" v-show="getter.isSubtitleTab.value">
      <SubtitlePanel v-model="select.subtitle" :has-text="Boolean(select.text?.trim())" class="content" />
    </div>
    <EditListener ref="listener" />
  </div>
</template>
<script setup>
import { computed, reactive, ref } from 'vue'
import EditListener from './EditListener.vue'
import EditUpload from './EditUpload.vue';
import EditText from './EditText.vue';
import SubtitlePanel from './SubtitlePanel.vue'

const select = defineModel({})


const EDIT_TABS = {
  TEXT: '1',
  AUDIO: '2',
  SUBTITLE: '3'
}

const state = reactive({
  activeTab: EDIT_TABS.TEXT,
  textToAudioLoading: false,
})

const listener = ref()

const getter = {
  isTextTab: computed(() => {
    return state.activeTab === EDIT_TABS.TEXT
  }),
  isAudioTab: computed(() => {
    return state.activeTab === EDIT_TABS.AUDIO
  }),
  isSubtitleTab: computed(() => {
    return state.activeTab === EDIT_TABS.SUBTITLE
  })
}

const action = {
  onChangeTab(tab) {
    state.activeTab = tab
    listener.value?.pause()
  }
}

</script>
<style lang="less" scoped>
.edit {
  display: flex;
  height: 100%;
  flex-direction: column;

  &-header {
    font-weight: 500;
    padding: 18px;
    font-size: 14px;
    color: #ffffff;
    line-height: 22px;
    text-align: center;
    border-bottom: 1px solid #000000;
  }

  &-tabs {
    margin: 12px 20px 0;
    display: flex;
    width: auto;
    padding: 6px;
    border-radius: 4px;
    background-color: #161718;
    gap: 4px;

    button {
      flex: 1;
      height: 36px;
      border: 0;
      border-radius: 4px;
      color: #fff;
      background: transparent;
      cursor: pointer;
      font-size: 14px;

      &.active { background: #2b3b52; }
    }
  }

  &-body {
    flex: 1;
    width: 100%;
    height: 100%;
    padding: 12px 20px;
    display: flex;
    justify-content: center;
    align-items: start;
    position: relative;

    .content {
      border-radius: 8px 8px 8px 8px;
      width: 100%;
      --td-bg-color-specialcomponent: #161718;
      --td-brand-color-focus: #161718;
    }

    &-text {
      padding-bottom: 91px;

      .content {
        background-color: #161718;
      }
    }

    &-subtitle {
      overflow-y: auto;
      justify-content: stretch;
    }

  }
}
</style>
