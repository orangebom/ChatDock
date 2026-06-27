# ChatDock 代理开发约束

本文档面向后续参与本项目的 AI 编码代理和工程维护者。它不是普通 README，而是项目工程化、可维护性和安全修改边界的约束文件。

## 项目定位

ChatDock 是一个基于 Tauri v2 的桌面端多 AI 对比工具。用户可以在一个工作台中同时打开多个 AI 网站，统一发送问题、对比回答，并管理布局、附件、站点可访问性和本地工作区状态。

当前前端处于渐进式工程化重构阶段：从大型 `src/main.ts` 逐步迁移到 TypeScript 模块化、Vue 3、Pinia 和清晰的功能分层。重构必须保持现有界面样式和功能行为不变。

## 技术栈

- 桌面壳：Tauri v2
- 后端：Rust command
- 前端构建：Vite
- 前端语言：TypeScript
- UI 方向：Vue 3 + Pinia
- 样式：Tailwind CSS + 现有 `styles.css`
- 测试：Node test + Rust cargo test

## 目录职责

后续新增代码必须优先放入清晰的目录边界中，不要继续堆进 `src/main.ts`。

```text
src/
  main.ts                 # 启动与编排入口，只保留初始化和模块连接
  app/                    # Vue / Pinia 入口、桥接层和后续 Vue 组件
  features/               # 用户功能模块
    composer/             # 输入框、附件、粘贴、拖拽、发送相关逻辑
    layout-presets/       # 布局预设、另存、编辑、切换
    dialogs/              # 关于、关闭确认等弹窗
    onboarding/           # 引导教程
    site-manager/         # AI 站点显示、隐藏、排序、管理
    panels/               # 面板布局、拖拽分栏、最大化等
  state/                  # 纯状态逻辑，不访问 DOM，不调用 Tauri
  storage/                # localStorage 等本地存储封装
  tauri/                  # Tauri window、webview、overlay、command helper
  types/                  # 共享类型定义
  vendor/                 # 第三方静态依赖，不做业务修改
tests/                    # 合约测试和纯逻辑测试
src-tauri/                # Rust 后端、Tauri 配置和 command
```

## `main.ts` 重构目标

`src/main.ts` 的最终目标是小于 1000 行。

`main.ts` 只允许保留以下职责：

- 初始化 Tauri API
- 初始化应用状态
- 加载站点、工作区、布局和主题
- 挂载 Vue / Pinia 桥接层
- 调用各模块的 `init` / `wire` / `render` 编排函数
- 注册顶层全局事件

禁止继续向 `main.ts` 添加新的业务细节。新功能如果不是启动或编排逻辑，应放入 `features/`、`state/`、`storage/`、`tauri/` 或 `types/`。

## 推荐拆分顺序

拆分 `main.ts` 时必须小步推进，禁止一次性大重写。

优先顺序：

1. 抽纯函数：不依赖 DOM、Tauri、全局状态的逻辑先进入 `state/` 或对应 `features/`。
2. 抽 DOM 渲染：把创建节点、设置 class、dataset、aria 的逻辑放到功能模块。
3. 抽事件绑定：把 click、paste、drag、keyboard 等监听放到对应功能模块。
4. 抽 Tauri / Webview 编排：最后处理 window、webview、overlay、权限、command。
5. 迁移 Vue 组件：在模块边界稳定后，再逐步把 UI 迁到 Vue。

每次只拆一个明确模块，例如 composer、layout presets、dialogs、site manager 或 panels。不要在同一次修改中混合多个无关模块。

## 防幻觉规则

AI 代理修改代码前必须先验证真实代码结构，禁止凭记忆或猜测修改。

必须遵守：

- 使用 `rg` 搜索真实调用点后再改函数、常量、事件名和 storage key。
- 不允许发明不存在的 Tauri command、权限、事件名、DOM id 或 CSS class。
- 不允许假设某个函数存在；必须先搜索或读取文件确认。
- 不允许只看文件名猜职责；必须阅读相关代码。
- 不允许删除旧函数，除非确认没有调用点，或已保留兼容代理。
- 不允许改 Rust command 名称，除非同步更新前端调用、权限配置和测试。
- 不允许把 Tauri Webview 控制逻辑塞进 Vue 组件。
- 不允许因为 `main.ts` 有 `@ts-nocheck` 就跳过运行时常量、导入和调用链检查。

特别注意：共享常量迁移后，必须同步更新所有运行时引用。例如 `MAX_SITES_PER_PAGE` 必须从 `state/workspace` 显式导入，不能依赖旧的全局常量。

## 防连锁异常规则

修改共享状态前，必须检查相关调用链。

工作区和布局相关修改至少检查：

- `state.workspace`
- `selectedSiteLabels`
- `visibleSiteLabels`
- `siteOrder`
- `activePageIndex`
- `maximizedLabel`
- `pageLayouts`
- layout preset 自动保存

Webview 相关修改至少检查：

- AI 面板 webview 创建、显示、隐藏和 relayout
- toolbar webview 创建、显示、隐藏和状态同步
- overlay webview 的置顶和定位
- 文件拖拽命中面板后的注入路径
- 关于弹窗、关闭确认弹窗是否会被 AI 页面遮挡

附件和发送相关修改至少检查：

- 粘贴图片和文件
- 拖拽图片和文件
- 去重逻辑
- 文件转 base64
- `broadcast_prompt`
- `inject_attachments`
- 上传等待、发送按钮等待和超时控制

站点相关修改至少检查：

- 底部 AI 选择项
- 右键菜单
- 可访问性缓存
- 自定义添加、移除、排序
- 当前布局中的可见站点

## 测试要求

每次修改后必须运行与变更相关的最小测试集。

前端 TypeScript 或 UI 逻辑修改至少运行：

```bash
npm run typecheck
npm run build
node --test tests/相关测试文件.test.js
```

涉及 Rust command、Tauri 后端、站点探测、文件读取时运行：

```bash
npm run test:rust
```

大范围重构后运行：

```bash
npm test
npm run test:rust
npm run typecheck
npm run build
```

当前已知：`npm test` 中 `release workflow publishes version tags` 是既有失败。如果除了这个测试之外出现新失败，必须修复后才能声称完成。

## 新模块要求

新增模块应满足：

- 文件职责单一。
- 导出 API 明确，避免默认导出大量杂项。
- 纯逻辑模块不得访问 DOM、`window.__TAURI__` 或全局 `state`。
- DOM 模块只负责渲染和事件绑定，不做复杂业务决策。
- Tauri 模块只负责 window、webview、command、overlay 等平台交互。
- 新增核心函数必须配套测试。
- 新增共享类型放入 `src/types/`。

## Vue / Pinia 使用约束

Vue 3 和 Pinia 是后续 UI 工程化方向，但迁移必须渐进。

- Vue 组件只负责 UI 表达和轻量交互。
- Pinia 管理 UI 状态和派生状态。
- Tauri command、webview 创建、文件注入、窗口置顶等逻辑必须留在 service/helper 层。
- 不要为了迁移 Vue 一次性重写现有页面。
- 可以先使用 Vue bridge 与旧 DOM 代码并存，再逐步替换低风险组件。

## 不要做

- 不要一次性重写整个 `main.ts`。
- 不要在没有测试保护的情况下移动 Webview 编排逻辑。
- 不要把无关格式化、文案修改、样式重写混进重构提交。
- 不要提交未确认用途的 `doc/`、临时文件、渲染产物或缓存。
- 不要修改用户已有的无关改动。
- 不要在用户未要求时自动提交代码。

## 推荐后续里程碑

建议按以下顺序继续降低 `main.ts` 行数：

1. `features/layout-presets/`：拆布局下拉、更多菜单、另存、编辑布局。
2. `tauri/overlay-webviews.ts`：拆 overlay webview 的创建、定位、显示、隐藏。
3. `features/dialogs/`：拆关于弹窗和关闭确认弹窗。
4. `features/onboarding/`：拆引导教程定位、步骤和事件。
5. `features/site-manager/`：拆 AI 管理弹窗、排序和显示隐藏。
6. `features/panels/`：拆面板布局计算、拖拽分栏和最大化逻辑。
7. `tauri/webview-panels.ts`：继续收敛 AI webview 和 toolbar webview 编排。

每完成一个里程碑，都应让 `main.ts` 明显变薄，并保持构建和相关测试通过。
