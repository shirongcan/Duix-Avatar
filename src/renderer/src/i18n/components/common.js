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
    exportSubtitleTitle: '导出字幕',
    exportSubtitleSuccess: 'SRT 字幕导出成功',
    exportSubtitleFailed: '字幕导出失败',
    replaceBackgroundTitle: '编辑成片',
    replaceBackgroundDialogTitle: '编辑成片背景',
    selectBackground: '选择图片或视频背景',
    backgroundTip: '视频背景较短时将自动循环播放，系统会保留原声音。',
    keepSubtitles: '保留当前字幕',
    keepSubtitlesTip: '背景替换完成后重新添加字幕，避免字幕残缺。',
    noSubtitlesTip: '当前作品没有启用字幕。',
    startReplace: '生成并导出',
    processingBackground: '正在用显卡抠像并合成背景，请勿关闭软件…',
    processingAudio: '正在恢复视频声音…',
    processingSubtitles: '正在重新添加完整字幕…',
    processingCover: '正在添加视频封面…',
    processingComplete: '成片生成完成',
    replaceBackgroundSuccess: '成片生成完成',
    replaceBackgroundFailed: '成片处理失败',
    makeFailedText: '制作失败',
    draftsText: '草稿',
    underProduction: '正在制作中，请耐心等待',
    queuing: '排队中，请耐心等待',
    emptyText: '您还没有视频作品',
    emptyLinkRouteText: '点击这里',
    emptyRightText: '开始制作视频'
  },
  myModelList: {
    emptyText: '您还没有专属模特',
    emptyLinkRouteText: '点击这里',
    emptyRightText: '开始制作模特',
    inProgressText: '训练中',
    createVideoText: '做视频',
    previewText: '预览'
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
    headerText: '画面预览',
    beautyPreview: '美颜效果',
    original: '原图',
    holdForOriginal: '按住看原图',
    originalViewing: '松开看美颜'
  },
  editView: {
    headerText: '视频内容',
    text: '文本合成',
    audio: '音频合成',
    beauty: '美颜',
    beautyEnable: '开启美颜',
    beautyDescription: '对最终合成视频进行自然肤质优化',
    smoothing: '磨皮',
    brighten: '提亮',
    rosy: '红润',
    beautyTip: '预览会展示亮度与色彩变化；磨皮效果将在合成完成后应用到成片。',
    subtitle: '字幕',
    cover: '封面',
    coverEnable: '使用视频封面',
    coverDescription: '封面将显示在成片开头 1.5 秒，并用于作品列表缩略图',
    coverSelect: '选择封面图片',
    coverChange: '更换图片',
    coverRemove: '移除封面',
    coverTip: '支持 JPG、PNG；建议使用与视频相同比例的高清图片，系统会自动居中裁切。',
    subtitleEnable: '成片添加字幕',
    subtitleDescription: '字幕将在美颜、背景替换等画面处理完成后添加',
    subtitlePosition: '字幕位置',
    subtitleTop: '顶部',
    subtitleMiddle: '居中',
    subtitleBottom: '底部',
    subtitleFontSize: '字号',
    subtitleVerticalOffset: '上下微调',
    subtitleVerticalOffsetTip: '负值向上，正值向下',
    subtitleOutlineWidth: '描边粗细',
    subtitleTextColor: '文字颜色',
    subtitleOutlineColor: '描边颜色',
    subtitleLivePreview: '实时样式预览',
    subtitleSample: '这是字幕样式预览',
    subtitlePresets: '样式预设',
    subtitlePresetCount: '已保存 {count}/{max}，另含 3 款内置样式',
    subtitlePresetSave: '保存当前',
    subtitlePresetPlaceholder: '选择预设并立即应用',
    subtitlePresetBuiltins: '内置样式',
    subtitlePresetMine: '我的预设',
    subtitlePresetBuiltinWhite: '白字黑边',
    subtitlePresetBuiltinYellow: '醒目黄字',
    subtitlePresetBuiltinTop: '顶部标题',
    subtitlePresetOverwrite: '用当前设置覆盖',
    subtitlePresetDelete: '删除',
    subtitlePresetDeleteConfirm: '确认删除这个字幕预设？',
    subtitlePresetNamePlaceholder: '输入预设名称',
    subtitlePresetConfirm: '保存',
    subtitlePresetCancel: '取消',
    subtitlePresetDefaultName: '我的预设 {number}',
    subtitlePresetNameRequired: '请输入预设名称',
    subtitlePresetNameDuplicate: '已有同名预设，请换一个名称',
    subtitlePresetLimitReached: '最多保存 {max} 个字幕预设',
    subtitlePresetSaved: '字幕预设已保存',
    subtitlePresetUpdated: '字幕预设已更新',
    subtitlePresetDeleted: '字幕预设已删除',
    subtitlePresetLoadFailed: '字幕预设读取失败，将显示内置样式',
    subtitlePresetSaveFailed: '字幕预设保存失败',
    subtitlePresetDeleteFailed: '字幕预设删除失败',
    subtitleTip: '字幕会根据文案长度和视频时长自动分段；烧录后无需播放器支持即可显示。',
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
    searchSpeaker: '搜索音色'
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
    exportSubtitleTitle: 'Export SRT',
    exportSubtitleSuccess: 'SRT exported',
    exportSubtitleFailed: 'Subtitle export failed',
    replaceBackgroundTitle: 'Edit video',
    replaceBackgroundDialogTitle: 'Edit video background',
    selectBackground: 'Select an image or video background',
    backgroundTip: 'Short background videos will loop. The original audio is preserved.',
    keepSubtitles: 'Keep current subtitles',
    keepSubtitlesTip: 'Subtitles are rendered again after background replacement to keep them intact.',
    noSubtitlesTip: 'Subtitles are not enabled for this video.',
    startReplace: 'Generate and export',
    processingBackground: 'Removing the background with GPU. Please keep the app open…',
    processingAudio: 'Restoring the original audio…',
    processingSubtitles: 'Rendering complete subtitles…',
    processingCover: 'Adding the video cover…',
    processingComplete: 'Video ready',
    replaceBackgroundSuccess: 'Video ready',
    replaceBackgroundFailed: 'Video processing failed',
    makeFailedText: 'Failed',
    draftsText: 'Drafts',
    underProduction: 'Generating, please wait for a moment.',
    queuing: 'In the queue, please wait  for a moment.',
    emptyText: "You don't have any video works yet",
    emptyLinkRouteText: 'click here',
    emptyRightText: 'to Create Video.'
  },
  myModelList: {
    emptyText: "You don't have a Avatar yet",
    emptyLinkRouteText: 'click here',
    emptyRightText: 'to start making a Avatar.',
    inProgressText: 'In Progress',
    createVideoText: 'Create Video',
    previewText: 'Preview'
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
    headerText: 'Preview',
    beautyPreview: 'Beauty effect',
    original: 'Original',
    holdForOriginal: 'Hold for original',
    originalViewing: 'Release for beauty'
  },
  editView: {
    headerText: 'Content',
    text: 'Text Synthesis',
    audio: 'Audio Synthesis',
    beauty: 'Beauty',
    beautyEnable: 'Enable beauty',
    beautyDescription: 'Apply natural skin enhancement to the final video',
    smoothing: 'Smoothing',
    brighten: 'Brighten',
    rosy: 'Rosy tone',
    beautyTip:
      'Brightness and color are approximated in preview. Smoothing is applied to the final rendered video.',
    subtitle: 'Subtitles',
    cover: 'Cover',
    coverEnable: 'Use video cover',
    coverDescription: 'Shown for the first 1.5 seconds and used as the work thumbnail',
    coverSelect: 'Select cover image',
    coverChange: 'Change image',
    coverRemove: 'Remove cover',
    coverTip: 'Supports JPG and PNG. Use a high-resolution image matching the video aspect ratio.',
    subtitleEnable: 'Add subtitles to final video',
    subtitleDescription: 'Subtitles are rendered after beauty and background processing',
    subtitlePosition: 'Position',
    subtitleTop: 'Top',
    subtitleMiddle: 'Middle',
    subtitleBottom: 'Bottom',
    subtitleFontSize: 'Font size',
    subtitleVerticalOffset: 'Vertical offset',
    subtitleVerticalOffsetTip: 'Negative moves up; positive moves down',
    subtitleOutlineWidth: 'Outline width',
    subtitleTextColor: 'Text color',
    subtitleOutlineColor: 'Outline color',
    subtitleLivePreview: 'Live style preview',
    subtitleSample: 'Subtitle style preview',
    subtitlePresets: 'Style presets',
    subtitlePresetCount: '{count}/{max} saved, plus 3 built-in styles',
    subtitlePresetSave: 'Save current',
    subtitlePresetPlaceholder: 'Select a preset to apply it',
    subtitlePresetBuiltins: 'Built-in styles',
    subtitlePresetMine: 'My presets',
    subtitlePresetBuiltinWhite: 'White with outline',
    subtitlePresetBuiltinYellow: 'Bold yellow',
    subtitlePresetBuiltinTop: 'Top title',
    subtitlePresetOverwrite: 'Overwrite with current',
    subtitlePresetDelete: 'Delete',
    subtitlePresetDeleteConfirm: 'Delete this subtitle preset?',
    subtitlePresetNamePlaceholder: 'Preset name',
    subtitlePresetConfirm: 'Save',
    subtitlePresetCancel: 'Cancel',
    subtitlePresetDefaultName: 'My preset {number}',
    subtitlePresetNameRequired: 'Enter a preset name',
    subtitlePresetNameDuplicate: 'A preset with this name already exists',
    subtitlePresetLimitReached: 'You can save up to {max} subtitle presets',
    subtitlePresetSaved: 'Subtitle preset saved',
    subtitlePresetUpdated: 'Subtitle preset updated',
    subtitlePresetDeleted: 'Subtitle preset deleted',
    subtitlePresetLoadFailed: 'Could not load saved presets; built-in styles are still available',
    subtitlePresetSaveFailed: 'Could not save subtitle preset',
    subtitlePresetDeleteFailed: 'Could not delete subtitle preset',
    subtitleTip:
      'Subtitles are automatically segmented by script length and video duration, then embedded into the video.',
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
    searchSpeaker: 'Search Speaker'
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
