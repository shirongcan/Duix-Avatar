/*
 * 通用文本
 */

import { Button } from 'tdesign-vue-next'

// 中文翻译
export const commonZh = {
  menu: {
    text: '首页'
  },
  header: {
    minimizeText: '最小化',
    maximizeText: '最大化',
    restoreText: '还原',
    closeText: '关闭'
  },
  tab: {
    myWorksText: '我的作品',
    myAvatarsText: '我的数字模特'
  },
  input: {
    enterNamePlaceholder: '请输入数字模特名称',
    enterKeywordPlaceholder: '请输入短视频名称/模特名称',
    avatarNamePlaceholder: '请输入模特名称',
    searchAvatarNamePlaceholder: '搜索模特',
    videoContentTextPlaceholder: '请在这里输入您的文本内容，支持中英文'
  },
  banner0: {
    title: '短视频制作',
    subTitle: '极速生产口播视频',
    buttonText: '创建视频'
  },
  banner1: {
    title: '快速定制模特',
    subTitle: '只需一个视频快速定制',
    buttonText: '快速定制'
  },
  videoList: {
    previewTitle: '预览视频',
    downloadTitle: '下载视频',
    makeFailedText: '制作失败',
    draftsText: '草稿',
    underProduction: '正在制作中，请耐心等待',
    queuing: '排队中，请耐心等待',
    emptyText: '您还没有视频作品',
    emptyLinkRouteText: '点击这里',
    emptyRightText: '开始制作视频',
    previewSubtitled: '预览有字幕版',
    previewClean: '预览无字幕版',
    downloadSubtitled: '下载有字幕版',
    downloadClean: '下载无字幕版',
    dualVersionsReady: '有字幕/无字幕双版本可用',
    subtitleFailed: '字幕处理失败',
    retrySubtitle: '重试字幕',
    generateSubtitle: '生成字幕版',
    retryingSubtitle: '正在重试字幕烧录',
    retrySubtitleSuccess: '字幕版已生成',
    retrySubtitleFailed: '字幕重试失败',
    exportSubtitleTitle: '下载 SRT 字幕',
    exportSubtitleSuccess: 'SRT 字幕导出成功',
    exportSubtitleFailed: '字幕导出失败',
    selectPreviewVersion: '选择预览版本',
    editCopy: '编辑文案'
  },
  myModelList: {
    emptyText: '您还没有专属模特',
    emptyLinkRouteText: '点击这里',
    emptyRightText: '开始制作模特',
    inProgressText: '训练中',
    createVideoText: '做视频',
    previewText: '预览',
    voiceCalibrateText: '声音校准'
  },
  referenceTextDialog: {
    headerTitle: '声音校准',
    playText: '试听参考音频',
    stopText: '停止播放',
    tip: '这里的文本是训练视频语音的识别结果，生成声音时它会和参考音频一起作为音色样本。请把它修改为与参考音频完全一致的文字，可提升后续生成声音的准确度。',
    placeholder: '请输入与参考音频一致的文字…',
    segmentLabel: '参考音频片段',
    segmentPlayText: '试听本段',
    cancelText: '取消',
    saveText: '保存'
  },
  deleteDialog: {
    buttonTextLeft: '取消',
    buttonTextRight: '确定',
    titleH1: '提示',
    titleOk: '确认删除？',
    titleText: '删除后将无法恢复哦~'
  },
  message: {
    deleteErrorText: '删除失败',
    deleteSuccessText: '删除成功',
    videoUploadError: '视频上传失败',
    videoLength: '视频时长至少8秒',
    videoContentText: '请输入文本内容',
    selectModelsTextError: '请先定制或选择模特',
    VideoTextError: '请输入视频名称',
    VideoCopywritingTextError: '请输入视频文案',
    videoSynthesisTextError: '合成视频失败，请稍后再试',
    initEditVideoPageFailed: '初始化视频编辑页面失败，请稍后再试'
  },
  modelCreateView: {
    headerTitle: '极速定制',
    submitButtonText: '提交定制',
    avatarNameText: '模特名称',
    isUploading: '正在上传中...',
    tipsText: '点击上传拍摄好的原始视频',
    uploadVideoText: '上传视频',
    guideTitle: '标准示例',
    okRulesLi1: '1.视频时长最少8秒,说话吐字清晰；',
    okRulesLi2: '2.视频前后有且只有同一个人；',
    okRulesLi3: '3.五官清晰不遮挡，头部不倾斜或侧向，手势不要出现在面部、嘴巴、脖子；',
    okRulesLi4: '4.视频分辨率最低720P；',
    okRulesLi5: '5.视频格式为MP4/MOV。',
    guideErrorTitle: '错误示例',
    faceMore: '多张人脸',
    faceBig: '面部过大',
    faceNo: '未检测到人脸',
    faceHalf: '五官遮挡',
    videoName: '视频名称'
  },
  selectView: {
    selectHeaderText: '模特列表',
    generateButtonText: '立即定制',
    modalFinishedObj: {
      text1: '请移至',
      text2: '“首页-我的作品”',
      text3: '中查看制作结果～',
      rightBtnText: '再创建一个',
      progressBtnText: '去看制作进度',
      okBtnText: '知道了',
      videoOKText: '您的视频已提交！',
      prompt: '温馨提示'
    }
  },
  preview: {
    headerText: '画面预览'
  },
  editView: {
    headerText: '视频内容',
    text: '文本合成',
    audio: '音频合成',
    addAudio: '添加音频',
    tip: '单次最多上传1个录音文件；支持mp3、wav、flac、m4a文件，单个录音时长小于30分钟，请上传纯干音文件，背景音、噪音会影响视频合成效果哦～',
    listen: '试听',
    delete: '删除',
    upload: '上传',
    uploadError: '音频上传失败',
    durationError: '音频时长不能超过30分钟',
    myVoice: '我的',
    selectSpeaker: '选择',
    speaker: '音色',
    searchSpeaker: '搜索音色',
    subtitle: '字幕',
    subtitleNeedsText: '请先在“文本合成”中输入文稿，才能启用字幕。',
    subtitleEnable: '启用字幕',
    subtitleDescription: '在画面中预览字幕并保存样式设置',
    subtitleBurn: '烧录到视频',
    subtitleBurnTip: '开启后同时保留有字幕版和无字幕版',
    subtitlePresets: '字幕预设',
    subtitlePresetCount: '已保存 {count}/{max}',
    subtitlePresetSave: '保存当前样式',
    subtitlePresetPlaceholder: '选择字幕预设',
    subtitlePresetOverwrite: '覆盖预设',
    subtitlePresetDelete: '删除',
    subtitlePresetDeleteConfirm: '确认删除这个字幕预设？',
    subtitlePresetNamePlaceholder: '输入预设名称',
    subtitlePresetConfirm: '保存',
    subtitlePresetCancel: '取消',
    subtitlePresetNameRequired: '请输入预设名称',
    subtitlePresetNameDuplicate: '预设名称不能重复',
    subtitlePresetBuiltins: '内置预设',
    subtitlePresetMine: '我的预设',
    subtitlePresetWhite: '白字黑边',
    subtitlePresetYellow: '黄字黑边',
    subtitlePresetTop: '顶部字幕',
    subtitlePosition: '显示位置',
    subtitleTop: '顶部',
    subtitleMiddle: '中部',
    subtitleBottom: '底部',
    subtitleFontSize: '字号',
    subtitleVerticalOffset: '垂直微调',
    subtitleOutlineWidth: '描边粗细',
    subtitleTextColor: '文字颜色',
    subtitleOutlineColor: '描边颜色',
    revisionNameSuffix: '（修改版）',
    audioScriptOptional: '音频文稿（可选）',
    audioScriptPlaceholder: '输入或粘贴这段音频对应的文稿',
    audioScriptTip: '文稿用于保存内容和生成字幕，不会改变上传音频。'
  },
  headerView: {
    headerBackText: '返回',
    createVideoBtnText: '合成视频'
  },
  setting: {
    title: '设置',
    tab: {
      userAgreementText: '用户协议',
      languageSwitchText: '语言切换',
      openLogText: '打开日志'
    },
    languageSwitch: {
      languageEnText: '英文',
      languageZhText: '中文'
    }
  }
}

// 英文翻译
export const commonEn = {
  menu: {
    text: 'Home'
  },
  header: {
    minimizeText: 'Minimize',
    maximizeText: 'Maximize',
    restoreText: 'Restore',
    closeText: 'Close'
  },
  tab: {
    myWorksText: 'My Works',
    myAvatarsText: 'My Avatars'
  },
  input: {
    enterNamePlaceholder: 'Please Enter the Name',
    enterKeywordPlaceholder: 'Please Enter the keyword',
    avatarNamePlaceholder: 'Please Enter Avatar Name',
    searchAvatarNamePlaceholder: 'Search',
    videoContentTextPlaceholder: 'Please enter your text content here'
  },
  banner0: {
    title: 'Create Video',
    subTitle: 'AI Video Generator',
    buttonText: 'Create Video'
  },
  banner1: {
    title: 'Create Avatar',
    subTitle: 'Upload a video to generate your own digital avatar.',
    buttonText: 'Create Avatar'
  },
  videoList: {
    previewTitle: 'Preview',
    downloadTitle: 'Download',
    makeFailedText: 'Failed',
    draftsText: 'Drafts',
    underProduction: 'Generating, please wait for a moment.',
    queuing: 'In the queue, please wait  for a moment.',
    emptyText: "You don't have any video works yet",
    emptyLinkRouteText: 'click here',
    emptyRightText: 'to Create Video.',
    previewSubtitled: 'Preview with subtitles',
    previewClean: 'Preview without subtitles',
    downloadSubtitled: 'Download with subtitles',
    downloadClean: 'Download without subtitles',
    dualVersionsReady: 'Both video versions are ready',
    subtitleFailed: 'Subtitle rendering failed',
    retrySubtitle: 'Retry subtitles',
    generateSubtitle: 'Generate subtitled video',
    retryingSubtitle: 'Retrying subtitle rendering',
    retrySubtitleSuccess: 'Subtitled video is ready',
    retrySubtitleFailed: 'Subtitle retry failed',
    exportSubtitleTitle: 'Download SRT',
    exportSubtitleSuccess: 'SRT exported',
    exportSubtitleFailed: 'Subtitle export failed',
    selectPreviewVersion: 'Select preview version',
    editCopy: 'Edit script'
  },
  myModelList: {
    emptyText: "You don't have a Avatar yet",
    emptyLinkRouteText: 'click here',
    emptyRightText: 'to start making a Avatar.',
    inProgressText: 'In Progress',
    createVideoText: 'Create Video',
    previewText: 'Preview',
    voiceCalibrateText: 'Voice Calibration'
  },
  referenceTextDialog: {
    headerTitle: 'Voice Calibration',
    playText: 'Listen to Reference Audio',
    stopText: 'Stop',
    tip: 'This text is the speech recognition result of your training video. It is used with the reference audio as the voice sample when generating speech. Please correct it to exactly match the reference audio to improve the accuracy of future generated voices.',
    placeholder: 'Enter the exact text of the reference audio…',
    segmentLabel: 'Reference Audio Segment',
    segmentPlayText: 'Listen to this segment',
    cancelText: 'Cancel',
    saveText: 'Save'
  },
  deleteDialog: {
    buttonTextLeft: 'Cancel',
    buttonTextRight: 'OK',
    titleH1: 'Notice',
    titleOk: 'Confirm Delete?',
    titleText: 'It cannot be recovered after deletion~'
  },
  message: {
    deleteErrorText: 'Failed',
    deleteSuccessText: 'Successful',
    videoUploadError: 'Video Upload Failed',
    videoLength: 'Video length ≥ 8s',
    videoContentText: 'Please enter the text content',
    selectModelsTextError: 'Please customize or select a model first',
    VideoTextError: 'Please enter the video name',
    VideoCopywritingTextError: 'Please enter the video copy',
    videoSynthesisTextError: 'Video Create failed, please try again later',
    initEditVideoPageFailed: 'Failed to initialize video editing page, please try again later'
  },
  modelCreateView: {
    headerTitle: 'Rapid customization',
    submitButtonText: 'Submit',
    avatarNameText: 'Avatar Name',
    isUploading: 'Uploading...',
    tipsText: 'Click to Upload the Video',
    uploadVideoText: 'Upload Video',
    guideTitle: 'Example',
    okRulesLi1: '1.Video length ≥ 8s. ',
    okRulesLi2: '2.Only one person should appear in the video.',
    okRulesLi3: '3.Facial features should be visible.',
    okRulesLi4: '4.Resolution ≥ 720p; The video format is MP4/MOV.',
    okRulesLi5: '5.It will clone both your image and voice from the video.',
    guideErrorTitle: 'Incorrect Example',
    faceMore: 'Multiple faces',
    faceBig: 'face too close',
    faceNo: 'No face',
    faceHalf: 'Face is obscured',
    videoName: 'video name'
  },
  selectView: {
    selectHeaderText: 'My Avatars',
    generateButtonText: 'Create Avatar',
    modalFinishedObj: {
      text1: 'Please go to',
      text2: '"Home - My Avatars" ',
      text3: 'to check the results～',
      rightBtnText: 'Create again',
      progressBtnText: 'Go production progress',
      okBtnText: 'Got it',
      videoOKText: 'Your video has been submitted!',
      prompt: 'Reminder'
    }
  },
  preview: {
    headerText: 'Preview'
  },
  editView: {
    headerText: 'Content',
    text: 'Text Synthesis',
    audio: 'Audio Synthesis',
    addAudio: 'Add Audio',
    tip: 'You can upload up to 1 audio file at a time; supports mp3, wav, flac, m4a files, each recording should be less than 30 minutes. Please upload pure dry audio files, as background noise and sounds will affect the video synthesis effect.',
    listen: 'Listen',
    delete: 'Delete',
    upload: 'Upload',
    uploadError: 'Audio Upload Failed',
    durationError: 'Audio duration cannot exceed 30 minutes',
    myVoice: 'My',
    selectSpeaker: 'Select',
    speaker: 'Speaker',
    searchSpeaker: 'Search Speaker',
    subtitle: 'Subtitles',
    subtitleNeedsText: 'Enter a script under Text Synthesis before enabling subtitles.',
    subtitleEnable: 'Enable subtitles',
    subtitleDescription: 'Preview subtitles and save their visual style',
    subtitleBurn: 'Burn into video',
    subtitleBurnTip: 'Keep both subtitled and clean videos when enabled',
    subtitlePresets: 'Subtitle presets',
    subtitlePresetCount: '{count}/{max} saved',
    subtitlePresetSave: 'Save style',
    subtitlePresetPlaceholder: 'Select a preset',
    subtitlePresetOverwrite: 'Overwrite',
    subtitlePresetDelete: 'Delete',
    subtitlePresetDeleteConfirm: 'Delete this subtitle preset?',
    subtitlePresetNamePlaceholder: 'Preset name',
    subtitlePresetConfirm: 'Save',
    subtitlePresetCancel: 'Cancel',
    subtitlePresetNameRequired: 'Enter a preset name',
    subtitlePresetNameDuplicate: 'Preset names must be unique',
    subtitlePresetBuiltins: 'Built-in',
    subtitlePresetMine: 'My presets',
    subtitlePresetWhite: 'White with black outline',
    subtitlePresetYellow: 'Yellow with black outline',
    subtitlePresetTop: 'Top subtitles',
    subtitlePosition: 'Position',
    subtitleTop: 'Top',
    subtitleMiddle: 'Middle',
    subtitleBottom: 'Bottom',
    subtitleFontSize: 'Font size',
    subtitleVerticalOffset: 'Vertical offset',
    subtitleOutlineWidth: 'Outline width',
    subtitleTextColor: 'Text color',
    subtitleOutlineColor: 'Outline color',
    revisionNameSuffix: ' (revision)',
    audioScriptOptional: 'Audio script (optional)',
    audioScriptPlaceholder: 'Enter or paste the script for this audio',
    audioScriptTip: 'The script is saved with the work and can be used for subtitles; it does not change the uploaded audio.'
  },
  headerView: {
    headerBackText: 'Back',
    createVideoBtnText: 'Submit'
  },
  setting: {
    title: 'Setting',
    tab: {
      userAgreementText: 'User Agreement',
      languageSwitchText: 'Language switch',
      openLogText: 'Open Log'
    },
    languageSwitch: {
      languageEnText: 'English',
      languageZhText: 'Chinese'
    }
  }
}
