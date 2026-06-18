# ChatDock

<p align="center">
  <img src="./icon.png" alt="ChatDock icon" width="128" />
</p>

**把常用 AI 聊天窗口收进一个桌面工作台，在一个窗口里统一提问、并排比较。**

*A Windows desktop workspace for asking multiple AI services the same question and comparing their responses side by side.*

## 项目简介 / Overview

### 中文

ChatDock 是一个基于 `Tauri + WebView2` 的 Windows 桌面应用，用来把多个 AI 对话网站放进同一个工作台里集中查看。你可以在一个窗口中同时打开多个 AI 页面，输入同一个问题，并直接对比不同服务的回答方式与结果差异。

它当前采用真实网页承载和本地会话复用的方式工作，而不是 API 聚合。也就是说，你看到的是各家 AI 的实际网页体验；首次登录后，后续通常可以继续复用本地登录状态。

### English

ChatDock is a Windows desktop app built with `Tauri + WebView2`. It brings multiple AI chat websites into one workspace so you can view them together, send the same prompt, and compare how different services respond.

The current app works with real embedded web pages and local session reuse instead of an API-based aggregation layer. In practice, that means you interact with each service in its actual web experience, and after the first login the app will usually reuse the local sign-in state.

## 核心亮点 / Highlights

### 中文

- 单窗口并排对比多个 AI 服务
- 每页最多显示 4 个 AI，超出后按选择顺序自动分页
- 底部统一选择 AI，并支持清空当前选择
- 一次输入问题，统一发送到所有已选 AI
- 支持图片与文件的粘贴、拖拽、注入发送
- AI 可访问性检测、灰化提示与状态持久化
- AI 选择项支持右键快捷操作

### English

- Compare multiple AI services side by side in a single window
- Show up to 4 AI panels per page with automatic pagination beyond that
- Select targets from the bottom bar and clear the current selection when needed
- Type one prompt and send it to all selected AI services at once
- Supports pasting, dragging, and sending images and files
- AI availability probing with grayed-out states and persisted status
- Right-click quick actions on AI target pills
- Includes onboarding, an about dialog, light/dark themes, and a close confirmation flow

## 支持的 AI 站点 / Supported AI Services

### 中文

当前注册并接入的 AI 站点共 12 个：

- ChatGPT
- Claude
- Gemini
- Copilot
- Perplexity
- Grok
- DeepSeek
- Kimi
- Qwen
- 豆包
- 元宝
- 智谱清言

### English

The current site registry includes 12 supported AI services:

- ChatGPT
- Claude
- Gemini
- Copilot
- Perplexity
- Grok
- DeepSeek
- Kimi
- Qwen
- Doubao
- Yuanbao
- Zhipu Qingyan

## 安装与运行 / Getting Started

### 中文

当前项目以源码运行方式为主，适合在 Windows 环境下本地启动。

建议准备：

- Windows
- Node.js
- Rust / Tauri 开发环境
- Microsoft Edge WebView2 Runtime

启动命令：

```bash
npm install
npm run dev
```

首次启动后，按需在各个 AI 面板里完成登录即可。

### English

At the moment, the project is intended to be run from source on Windows.

Recommended environment:

- Windows
- Node.js
- Rust / Tauri toolchain
- Microsoft Edge WebView2 Runtime

Run it with:

```bash
npm install
npm run dev
```

After launch, sign in inside the AI panels you want to use.

## 使用方式 / How It Works

### 中文

1. 启动 ChatDock。
2. 在底部 AI 选择区勾选要显示的服务。
3. 如果选择超过 4 个，应用会自动分页，你可以在顶部页签之间切换。
4. 第一次使用时，在对应面板中分别完成登录。
5. 在底部输入框输入问题后发送，ChatDock 会尝试把同一个问题统一发送到所有已选 AI。
6. 如果附带图片或文件，可以直接粘贴到输入区，或者拖拽到输入区。
7. 如果你把文件拖到某个 AI 面板上，ChatDock 会优先把文件注入到该面板对应的 WebView。
8. 如果某个站点基础可访问性探测失败，会在底部选择区以灰化状态提示，并保留最近一次探测结果。

### English

1. Launch ChatDock.
2. Select the AI services you want to display from the bottom target bar.
3. If you choose more than 4 services, ChatDock automatically paginates them and lets you switch pages from the top tabs.
4. On first use, sign in inside each relevant panel.
5. Enter a prompt in the bottom input area and send it once to all selected AI services.
6. If you want to include images or files, paste them into the composer or drag them onto the input area.
7. If you drag a file onto a specific AI panel, ChatDock routes the attachment to that panel's WebView first.
8. If a service fails the basic availability probe, its target pill is shown in a grayed-out state and the latest known status is remembered.

## 当前功能 / Current Features

### 中文

- 单窗口多 AI 对比
- 每页最多 4 个 AI，自动分页展示
- 底部 AI 选择、清空与顺序管理
- AI 选择项右键菜单，支持移除与测试连通
- 统一发送问题到所有已选 AI
- 输入框支持图片和文件的粘贴、拖拽与列表管理
- 支持将文件按面板命中路由到指定 AI WebView
- AI 基础可访问性检测、灰化提示与状态持久化
- 顶部“引导”按钮，可随时重新打开使用教程
- 顶部“关于”弹窗，展示软件信息与仓库链接
- 明暗主题切换
- 自定义关闭确认弹窗
- 独立会话目录与登录复用

### English

- Multi-AI comparison in a single window
- Up to 4 AI panels per page with automatic pagination
- Bottom-bar AI selection, clearing, and ordering controls
- Right-click context actions on AI target pills for removal and connectivity testing
- One prompt broadcast to all selected AI services
- Composer support for image and file paste, drag-and-drop, and attachment management
- Panel-aware file routing to a specific AI WebView
- Basic AI availability detection with grayed-out target states and persisted status
- A top-bar onboarding button to reopen the guided tutorial at any time
- A top-bar about dialog with product info and repository link
- Light and dark themes
- Custom close confirmation dialog before exiting the app
- Independent session directories with login reuse

## 新增交互能力 / Recent UX Additions

### 中文

- **引导系统**：首次打开可查看教程，之后也能通过顶部“引导”按钮重新查看
- **关于弹窗**：提供软件 Logo、名称、简介与 GitHub 仓库入口
- **关闭确认弹窗**：替换原生关闭确认，风格与应用保持一致
- **可访问性状态记忆**：上次探测到不可访问的 AI，下次启动时会先保留该状态，再在后续检测中刷新
- **右键菜单**：对底部 AI 选择项右键，可快速移除或手动测试连通
- **附件支持**：输入框支持粘贴图片、粘贴文件、拖拽图片、拖拽文件
- **按面板命中路由**：文件拖到哪个 AI 面板，就优先注入到哪个面板对应的 WebView

### English

- **Onboarding flow**: shown on first launch and can be reopened later from the top-bar guide button
- **About dialog**: includes the product logo, name, brief intro, and GitHub repository link
- **Custom close confirmation**: replaces the native close prompt with a dialog that matches the app style
- **Persisted availability state**: unavailable AI targets keep their last known status across launches until a new probe updates them
- **Right-click menu**: AI target pills support quick removal and manual connectivity testing
- **Attachment support**: the composer accepts pasted images, pasted files, dragged images, and dragged files
- **Panel-aware routing**: attachments dropped onto an AI panel are injected into that panel's WebView first

## 已知限制 / Limitations

### 中文

- 当前交互依赖嵌入网页与 DOM 适配，不是官方 API 方案；站点结构变化时，发送逻辑可能需要更新。
- “可访问性检测”目前是基础连通性探测，不等同于登录有效、服务可正常回复或页面已完全加载。
- 某些 AI 站点可能因为风控、验证码、地区限制或登录失效而需要人工处理。
- “统一发送”是尽量接近同时触发，并不是严格毫秒级同步。
- 文件上传最终仍受各家网页自身上传控件、限制规则和加载状态影响。

### English

- The current interaction model depends on embedded web pages and DOM-level adaptation rather than official APIs, so site changes may require selector or send-flow updates.
- The current availability check is only a basic reachability probe. It does not guarantee a valid login, a ready page, or a successful response.
- Some services may still require manual handling because of rate limits, CAPTCHA, geo restrictions, or expired sign-in state.
- Broadcast sending is near-simultaneous in practice, not strict millisecond-level synchronization.
- Final file upload behavior still depends on each site's own upload controls, restrictions, and loading state.

## 路线方向 / Roadmap

### 中文

- 提升各站点输入、附件注入与发送适配的稳定性
- 完善可访问性与状态反馈
- 打磨 Windows 发布与使用体验
- 继续扩展工作台管理能力与站点支持

### English

- Improve the stability of site-specific input, attachment injection, and send adapters
- Expand availability checks and status feedback
- Polish the Windows release and usage experience
- Continue extending workspace controls and supported services

## 仓库地址 / Repository

### 中文

- GitHub 仓库：[orangebom/ChatDock](https://github.com/orangebom/ChatDock)
- 克隆地址：`git clone https://github.com/orangebom/ChatDock.git`
- 问题反馈：[Issues](https://github.com/orangebom/ChatDock/issues)
- 贡献入口：[Pull Requests](https://github.com/orangebom/ChatDock/pulls)

### English

- GitHub repository: [orangebom/ChatDock](https://github.com/orangebom/ChatDock)
- Clone URL: `git clone https://github.com/orangebom/ChatDock.git`
- Report issues: [Issues](https://github.com/orangebom/ChatDock/issues)
- Contribution entry: [Pull Requests](https://github.com/orangebom/ChatDock/pulls)
