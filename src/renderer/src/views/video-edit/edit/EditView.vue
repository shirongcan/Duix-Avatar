<template>
  <div class="edit">
    <div class="edit-header">{{ $t('common.editView.headerText') }}</div>
    <div class="edit-tabs" role="tablist">
      <button
        v-for="tab in EDIT_TAB_OPTIONS"
        :key="tab.value"
        class="edit-tab"
        :class="{ 'is-active': state.activeTab === tab.value }"
        type="button"
        role="tab"
        :aria-selected="state.activeTab === tab.value"
        @click="action.onChangeTab(tab.value)"
      >
        {{ $t(tab.label) }}
      </button>
    </div>
    <div class="edit-body edit-body-text" v-show="getter.isTextTab.value">
      <EditText v-model="select" class="content" :listener="listener" />
    </div>
    <div class="edit-body" v-show="getter.isAudioTab.value">
      <EditUpload v-model="select" class="content" :listener="listener" />
    </div>
    <div class="edit-body" v-show="getter.isBeautyTab.value">
      <BeautyPanel v-model="select.beauty" class="content" />
    </div>
    <div class="edit-body edit-body-subtitle" v-show="getter.isSubtitleTab.value">
      <SubtitlePanel v-model="select.subtitle" class="content" />
    </div>
    <div class="edit-body" v-show="getter.isCoverTab.value">
      <CoverPanel v-model="select.cover" class="content" />
    </div>
    <EditListener ref="listener" />
  </div>
</template>
<script setup>
import { computed, reactive, ref } from 'vue'
import EditListener from './EditListener.vue'
import EditUpload from './EditUpload.vue';
import EditText from './EditText.vue';
import BeautyPanel from './BeautyPanel.vue'
import SubtitlePanel from './SubtitlePanel.vue'
import CoverPanel from './CoverPanel.vue'

const select = defineModel({})


const EDIT_TABS = {
  TEXT: '1',
  AUDIO: '2',
  BEAUTY: '3',
  SUBTITLE: '4',
  COVER: '5'
}

const EDIT_TAB_OPTIONS = [
  { value: EDIT_TABS.TEXT, label: 'common.editView.text' },
  { value: EDIT_TABS.AUDIO, label: 'common.editView.audio' },
  { value: EDIT_TABS.BEAUTY, label: 'common.editView.beauty' },
  { value: EDIT_TABS.SUBTITLE, label: 'common.editView.subtitle' },
  { value: EDIT_TABS.COVER, label: 'common.editView.cover' }
]

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
  isBeautyTab: computed(() => {
    return state.activeTab === EDIT_TABS.BEAUTY
  }),
  isSubtitleTab: computed(() => {
    return state.activeTab === EDIT_TABS.SUBTITLE
  }),
  isCoverTab: computed(() => {
    return state.activeTab === EDIT_TABS.COVER
  })
}

const action = {
  onChangeTab(tab) {
    state.activeTab = tab
    listener.value?.pause()
    if (select.value.cover) {
      select.value.cover.previewing = state.activeTab === EDIT_TABS.COVER
    }
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
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 2px;
    width: auto;
    padding: 6px;
    border-radius: 4px;
    background-color: #161718;
  }

  &-tab {
    min-width: 0;
    height: 36px;
    padding: 0 4px;
    overflow: hidden;
    border: 0;
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.82);
    font-size: 13px;
    line-height: 20px;
    text-overflow: ellipsis;
    white-space: nowrap;
    background: transparent;
    cursor: pointer;

    &:hover {
      background: rgba(43, 59, 82, 0.55);
    }

    &.is-active {
      color: #ffffff;
      background: #2b3b52;
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
      height: 0;
      min-height: 0;
      overflow: hidden;

      .content {
        box-sizing: border-box;
        height: 100%;
        min-height: 0;
      }
    }

  }
}
</style>
