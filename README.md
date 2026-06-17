# ChatDock

<p align="center">
  <img src="./icon.png" alt="ChatDock icon" width="128" />
</p>

**把常用 AI 聊天窗口收进一个桌面工作台，在一个窗口里统一提问、并排比较。**

*A Windows desktop workspace for asking multiple AI services the same question and comparing their responses side by side.*

## 项目简介 / Overview

### 中文

ChatDock 是一个基于 `Tauri + WebView2` 的 Windows 桌面应用，用来把多个 AI 对话网站放进同一个工作台里集中查看。你可以在一个窗口中同时打开多个 AI 页面，输入同一个问题，并直接对比不同服务的回答方式与结果差异。

它当前采用真实网页承载和本地会话复用的方式工作，而不是走 API 聚合。这意味着你看到的是各家 AI 的实际网页体验，也意味着首次登录后，后续通常可以继续复用本地登录状态。

### English

ChatDock is a Windows desktop app built with `Tauri + WebView2`. It brings multiple AI chat websites into one workspace so you can view them together, send the same prompt, and compare how different services respond.

The current app works with real embedded web pages and local session reuse instead of an API-based aggregation layer. In practice, that means you interact with each service in its actual web experience, and after the first login the app will usually reuse the local sign-in state.

## 核心亮点 / Highlights

### 中文

- 单窗口并排对比多个 AI 服务
- 每页最多显示 4 个 AI，超过后按选择顺序自动分页
- 底部统一选择 AI，并支持清空当前选择
- 一次输入问题，统一发送到所有已选 AI
- 各站点使用独立会话目录，便于登录状态复用
- 提供明暗主题切换与关闭前二次确认

### English

- Compare multiple AI services side by side in a single window
- Show up to 4 AI panels per page with automatic pagination beyond that
- Select targets from the bottom bar and clear the current selection when needed
- Type one prompt and send it to all selected AI services at once
- Keep separate session directories for each service to reuse login state
- Includes light/dark theme support and a close confirmation flow

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
6. 如果某个站点基础可访问性探测失败，会在选择区以灰化状态提示。

### English

1. Launch ChatDock.
2. Select the AI services you want to display from the bottom target bar.
3. If you choose more than 4 services, ChatDock automatically paginates them and lets you switch pages from the top tabs.
4. On first use, sign in inside each relevant panel.
5. Enter a prompt in the bottom input area and send it once to all selected AI services.
6. If a service fails the basic availability probe, its target pill is shown in a grayed-out state.

## 当前特性 / Current Features

### 中文

- 单窗口多 AI 对比
- 每页最多 4 个 AI，自动分页展示
- 底部 AI 选择、清空与顺序管理
- 统一发送问题到所有已选 AI
- AI 基础可访问性检测与灰化提示
- 明暗主题切换
- 关闭窗口前二次确认
- 独立会话目录与登录复用

### English

- Multi-AI comparison in a single window
- Up to 4 AI panels per page with automatic pagination
- Bottom-bar AI selection, clearing, and ordering controls
- One prompt broadcast to all selected AI services
- Basic AI availability detection with grayed-out target states
- Light and dark themes
- Close confirmation before exiting the app
- Independent session directories with login reuse

## 已知限制 / Limitations

### 中文

- 当前交互依赖嵌入网页与 DOM 适配，不是官方 API 方案；站点结构变化时，发送逻辑可能需要更新。
- “可访问性检测”目前是基础连通性探测，不等同于登录有效、服务可正常回复或页面已完全加载。
- 某些 AI 站点可能因为风控、验证码、地区限制或登录失效而需要人工处理。
- “统一发送”是尽量接近同时触发，并不是严格毫秒级同步。

### English

- The current interaction model depends on embedded web pages and DOM-level adaptation rather than official APIs, so site changes may require selector or send-flow updates.
- The current availability check is only a basic reachability probe. It does not guarantee a valid login, a ready page, or a successful response.
- Some services may still require manual handling because of rate limits, CAPTCHA, geo restrictions, or expired sign-in state.
- Broadcast sending is near-simultaneous in practice, not strict millisecond-level synchronization.

## 路线方向 / Roadmap

### 中文

- 提升各站点输入与发送适配的稳定性
- 完善可访问性与状态反馈
- 打磨 Windows 发布与使用体验
- 继续扩展工作台管理能力与站点支持

### English

- Improve the stability of site-specific input and send adapters
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
