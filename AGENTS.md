# Duix.Avatar（D:\heygem）项目规范

## UI 深色主题配色要求（重要）

整个应用是深色主题，但 t-design 组件（按钮、单选、开关、弹窗、表单等）默认走**浅色主题**。直接放在深色容器里会出现白字白底、文字不可读的问题（本仓库已踩过坑）。

任何新 UI 组件，只要放在深色容器内，必须在该容器的 CSS 上**同时覆盖“文字色”和“背景色”两组变量，缺一不可**：

- 文字色：
  - `--td-text-color-primary: #ffffff`
  - `--td-text-color-secondary: rgba(255, 255, 255, 0.6)`
- 背景色：
  - `--td-bg-color-container: #1d1e20`
  - `--td-bg-color-secondarycontainer: #161718`
  - `--td-bg-color-specialcomponent: #1d1e20`（普通按钮底色）
  - `--td-bg-color-specialcomponent-hover: #2a2c2f`
  - `--td-bg-color-container-select: #161718`（单选/分段控件组底色）
  - `--td-component-border: #3d4045`
- 品牌色：`--td-brand-color: #309cff`

按钮文字必须显式定色，不能只依赖主题变量兜底：

- 普通按钮：白字 + `#3d4045` 底、hover `#4a4f57`
- 主按钮：白字 + `#309cff` 底
- 危险/删除：`#e34d59`（透明底）

弹窗类内容（`t-dialog`）要用 `:deep()` 给 `.t-dialog` 面板显式设置深色背景/边框，并给内部元素（如 `.t-radio-button`）补白字样式。参考已实现的写法：

- `src/renderer/src/views/home/components/BackgroundDialog.vue`
- `src/renderer/src/components/ModalFinished.vue`

验收：涉及配色/布局的改动，必须用真实 Electron 界面（Playwright）或浏览器截图确认文字与背景的对比度，不能只看代码。

## 常用色板

| 用途 | 值 |
| --- | --- |
| 页面/弹窗背景 | `#1d1e20` |
| 次级容器 | `#161718` |
| 普通按钮底 / hover | `#3d4045` / `#4a4f57` |
| 主按钮/强调 | `#309cff` |
| 危险/删除 | `#e34d59` |
| 主文字 | `#ffffff` |
| 次要文字 | `rgba(255, 255, 255, 0.6)` |

## 其他约定

- 输出技术参考、文档或 URL 链接时，必须使用标准 Markdown 行内式链接 `[说明文字](URL)`，禁止尖括号自动链接语法（如 `<http...>`）。
- 动手前先 `git status` 确认工作区状态；不要覆盖或误提交无关的未提交改动。
- 背景替换功能依赖 Docker 容器 `duix-avatar-gen-video` 挂载 `/postprocess`（RVM 脚本与模型，见 `deploy/docker-compose.yml` 和 `tools/background-replace/`）；涉及该链路的改动注意容器路径映射（`D:\duix_avatar_data\face2face` → `/code/data`）和 GPU 依赖。
