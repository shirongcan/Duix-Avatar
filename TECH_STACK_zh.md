# HeyGem 本地数字人系统技术说明

本文档说明当前 `D:\heygem` 系统实际使用的技术、运行结构和我们已经增加的功能。

## 1. 系统定位

当前系统是一套完全在本机运行的数字人口播视频生产工具，主要流程为：

1. 上传一段真人视频，建立数字人模板并提取参考声音。
2. 输入文字或上传音频。
3. 合成语音，并驱动模板视频中的人物生成口型同步视频。
4. 对生成视频进行人像抠像和背景替换。
5. 根据原始口播文案导出 SRT 字幕。

它不是从零生成身体、服装、镜头和动作的全生成式数字人。人物姿态、服装、构图和基础动作主要来自上传的模板视频。

## 2. 桌面客户端

### Electron

- Electron 33
- Windows 桌面应用外壳
- 主进程负责数据库、文件、FFmpeg、Docker后处理任务和本地服务调用
- 渲染进程负责Vue界面
- Preload脚本通过Context Bridge向界面暴露受控能力
- 主进程与渲染进程通过Electron IPC通信

### Vue前端

- Vue 3.5
- Vite 5
- electron-vite 2
- Vue Router 4：页面路由
- Pinia 2：客户端状态管理
- Vue I18n 10：中英文界面
- TDesign Vue Next 1.10：按钮、弹窗、输入框、分页等界面组件
- TDesign Icons：界面图标
- Less：界面样式
- Lodash ES：数据合并和工具函数
- Day.js：日期和文件名时间处理

## 3. 本地数据与桌面后端

### SQLite

- SQLite本地数据库
- Node.js绑定：better-sqlite3 11.5
- 数据库位置：`C:\Users\shiro\AppData\Roaming\Duix.Avatar\biz.db`
- 保存数字人模板、参考音色、视频任务、原始文案、视频时长、生成状态和输出路径

### 本地文件处理

- Node.js `fs`、`path`、`crypto`
- Electron原生打开文件和另存为对话框
- UUID用于生成任务编号和临时文件名
- 作品及语音数据主要保存在 `D:\duix_avatar_data`

## 4. 容器与显卡运行环境

### Docker

- Docker Desktop
- Docker Compose
- Docker Desktop数据位置：`D:\DOCKER_IMAGES\DockerDesktopWSL`
- NVIDIA Container Runtime
- CUDA显卡计算
- 当前显卡：NVIDIA GeForce RTX 4070 Ti，12GB显存

### 当前容器

| 容器 | 镜像 | 端口 | 用途 |
| --- | --- | --- | --- |
| `duix-avatar-asr` | `guiji2025/fun-asr` | `10095` | 语音识别和参考音频文本提取 |
| `duix-avatar-tts` | `guiji2025/fish-speech-ziming` | `18180` | 参考音色处理和文字转语音 |
| `duix-avatar-gen-video` | `guiji2025/duix.avatar` | `8383` | 数字人口型同步和视频合成 |

三个容器通过Docker Compose自定义网络 `ai_network` 通信，并使用NVIDIA GPU。

## 5. 官方HeyGem音视频处理链

### 语音识别

- FunASR
- Paraformer中文语音识别模型
- FSMN VAD语音活动检测
- CT-Transformer中英文标点恢复
- N-gram语言模型
- ITN逆文本标准化

用途包括从真人模板视频的声音中识别参考文本，辅助建立参考音色。

### 文字转语音与音色复刻

- 本地TTS HTTP服务
- 当前Docker镜像名表明其服务基于Fish Speech相关实现
- 使用参考音频和参考文本复刻说话音色
- 支持温度、Top-P、重复惩罚、文本分块等生成参数
- 输出WAV语音文件

镜像内部可能包含厂商修改，不能只根据镜像名称认定其内部代码与公开版Fish Speech完全一致。

### 数字人视频合成

- 本地Face-to-Face HTTP服务
- 输入模板视频和新语音
- 生成与语音同步的口型及面部视频
- 客户端轮询任务进度并保存合成结果

该Docker镜像包含已编译组件，仓库没有公开完整模型结构。因此不能从当前源码严谨确认其具体神经网络名称，也不应直接将其称为Wav2Lip或其他特定模型。

## 6. FFmpeg音视频技术

- FFmpeg 4.4
- FFprobe
- Node.js封装：fluent-ffmpeg 2.1
- 从模板视频分离音频
- 将上传视频转换为H.264
- 获取视频编码、分辨率和时长
- 合并后处理视频与原始音频
- 导出MP4作品
- 音频轨主要使用WAV或AAC
- 视频输入和数字人结果通常使用H.264/MP4

Windows版FFmpeg位于：

`D:\heygem\resources\ffmpeg\win-amd64\bin`

## 7. 我们新增的人物抠像与背景替换

### Robust Video Matting

- Robust Video Matting（RVM）
- MobileNetV3轻量骨干网络
- FP16 TorchScript模型
- 递归状态保存前后帧信息，减少逐帧抠像闪烁
- 模型文件约7.6MB
- 使用GPL-3.0许可证

### 推理和图像处理

- PyTorch 2.2.2
- CUDA 11.8
- OpenCV 4.9
- NumPy
- FP16 GPU推理
- 根据视频分辨率自动设置推理下采样比例
- 保持头发、人物轮廓、衣服和手臂的Alpha透明度

### 背景合成

- 支持JPG、JPEG、PNG和WebP图片背景
- 支持MP4和MOV视频背景
- 背景使用Cover方式等比缩放并居中裁剪
- 背景视频不足时自动循环
- 合成公式：`人物前景 × Alpha + 新背景 × (1 - Alpha)`
- 最后通过FFmpeg重新加入原视频声音
- 原始数字人作品不会被覆盖

背景替换脚本：

`D:\heygem\tools\background-replace\replace_background.py`

模型和脚本以只读目录挂载到数字人视频容器，复用现有PyTorch和CUDA环境，没有增加大型Docker镜像。

## 8. 我们新增的SRT字幕技术

- 使用作品数据库中保存的原始口播文案
- 根据中文和英文句号、问号、感叹号、分号切句
- 过长字幕根据逗号、顿号、冒号或空格继续拆分
- 根据文字长度和标点停顿计算每条字幕权重
- 按实际成片时长分配时间轴
- 最后一条字幕结束时间与视频时长一致
- 输出标准SRT时间格式：`HH:MM:SS,mmm`
- 输出编码：带BOM的UTF-8，兼容剪映和常见Windows软件
- 输出为独立SRT文件，不修改原视频

字幕生成器：

`D:\heygem\src\main\util\subtitle.js`

目前文字合成视频可以直接使用原文生成字幕。纯音频驱动且没有原始文案的视频，需要下一阶段接入FunASR时间戳或强制对齐，才能生成更准确的字幕。

## 9. 启动与运行脚本

- Windows PowerShell
- 自动检测Docker Engine是否可用
- Docker未启动时自动启动Docker Desktop
- 自动执行 `docker compose up -d`
- 防止重复启动Electron客户端
- 将启动日志和客户端日志写入D盘
- 桌面快捷方式调用启动脚本

启动脚本：

`D:\heygem\start-heygem.ps1`

桌面快捷方式：

`C:\Users\shiro\Desktop\启动 HeyGem.lnk`

## 10. 系统调用流程

```text
Vue界面
  ↓ Electron IPC
Electron主进程
  ├─ SQLite数据库
  ├─ 本地文件系统
  ├─ FFmpeg / FFprobe
  ├─ HTTP → TTS容器（18180）
  ├─ HTTP → 数字人视频容器（8383）
  └─ Docker Exec → RVM背景替换脚本

模板视频
  ↓ 提取声音、参考文本和音色
文字或上传音频
  ↓ TTS或直接使用音频
口型同步数字人视频
  ↓ 可选RVM人物抠像
图片或视频新背景
  ↓ FFmpeg合并原声音
新背景MP4

原始文案 + 成片时长
  ↓ 切句和时间分配
UTF-8 SRT字幕
```

## 11. 当前没有使用的技术

为避免误解，当前处理流程没有依赖以下能力：

- 不需要把本人视频上传到云端
- 没有使用在线HeyGen服务
- 没有使用浏览器端云渲染
- 没有使用大语言模型自动写文案
- 没有实现服装、身体动作或镜头的自由生成
- 没有实现实时直播数字人
- 没有把字幕直接烧录进视频画面

## 12. 许可证注意事项

- HeyGem/Duix Avatar仓库使用DUIX.COM Community License，并包含商业使用人数条件。
- RVM使用GPL-3.0许可证。
- FFmpeg具体许可证取决于当前构建时启用的组件。
- FunASR、Fish Speech及相关模型各自有独立许可证和模型使用条款。

如果将修改后的系统公开发布、商业部署或提供多人服务，应逐项复核代码许可证、模型许可证、署名要求和DUIX.COM商业条款。
