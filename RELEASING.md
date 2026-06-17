# 发布说明

本文档对应当前仓库的 GitHub 自动发布流程，适用于以下工作流：

- `.github/workflows/release.yml`

当前发布方式为：

- 通过 Git tag 触发 GitHub Actions
- 自动构建 Windows / Linux / macOS 安装包
- 自动创建或更新 GitHub Release
- 当前阶段不做正式签名与 notarization

## 1. 当前发布规则

当前 workflow 的触发条件是：

```yml
on:
  push:
    tags:
      - "v*"
```

也就是说，只要向远程仓库推送一个以 `v` 开头的 tag，就会触发发布流程。

例如：

- `v0.1.0`
- `v0.1.1`
- `v0.2.0`

不建议当前阶段使用下面这类 tag：

- `0.1.0`：不带 `v`，不会触发
- `release-0.1.0`：不匹配 `v*`
- `v0.1.0-beta.1`：虽然会触发，但当前 workflow 把它当正式 release，而不是 GitHub prerelease

## 2. 版本号规则

建议统一采用 SemVer：

- `主版本.次版本.修订号`
- 例如：`0.1.0`、`0.1.1`、`0.2.0`、`1.0.0`

当前仓库里，至少要同步这 3 处版本号：

1. `package.json`
2. `src-tauri/Cargo.toml`
3. `src-tauri/tauri.conf.json`

规则是：

- 文件内版本号写 `0.1.0`
- Git tag 写 `v0.1.0`

也就是：

- 配置文件版本：`0.1.0`
- 发布 tag：`v0.1.0`

建议不要出现以下情况：

- `package.json` 是 `0.1.0`，但 `Cargo.toml` 是 `0.1.1`
- 文件里已经改到 `0.2.0`，结果还打 `v0.1.0`
- 只改了一个文件版本，另两个忘了同步

虽然 workflow 仍然可能运行，但最终 release、安装包元数据和仓库状态会很混乱。

## 3. 发布前检查

正式打 tag 之前，建议至少检查下面几项：

1. 当前代码已经提交并推送到远程
2. 版本号已经在 3 个文件中同步
3. `.github/workflows/release.yml` 已经存在于远程默认分支
4. `package-lock.json` 与 `package.json` 保持一致
5. 本地至少做过一次基本运行验证

建议执行：

```bash
git status
git pull --rebase
```

确认工作区干净，避免把错误版本打到 tag 上。

## 4. 标准发布流程

下面是推荐的正式流程。

### 第一步：更新版本号

同步修改：

- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

例如统一改为：

- `0.1.1`

### 第二步：提交版本变更

```bash
git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
git commit -m "Bump version to 0.1.1"
git push origin main
```

如果这次还包含 README、workflow 或其他发布相关改动，可以一并提交，但要确保 tag 最终指向的是你真正要发布的那个提交。

### 第三步：创建 tag

推荐使用附注 tag：

```bash
git tag -a v0.1.1 -m "Release v0.1.1"
```

也可以先用下面的命令检查：

```bash
git tag
```

### 第四步：推送 tag

```bash
git push origin v0.1.1
```

推送后，GitHub Actions 会自动开始执行发布任务。

### 第五步：查看 Actions

到 GitHub 仓库的 `Actions` 页面确认 `Release` workflow 是否开始运行。

当前 workflow 会构建这些目标：

- `windows-latest`
- `ubuntu-22.04`
- `macos-latest` / `x86_64-apple-darwin`
- `macos-latest` / `aarch64-apple-darwin`

### 第六步：检查 GitHub Release

成功后，在 GitHub 仓库的 `Releases` 页面会出现：

- Tag：`v0.1.1`
- Release 名称：`ChatDock v0.1.1`

然后检查上传的构建产物是否完整。

## 5. 推荐命令示例

假设你要发布 `0.1.1`，常用命令如下：

```bash
git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
git commit -m "Bump version to 0.1.1"
git push origin main
git tag -a v0.1.1 -m "Release v0.1.1"
git push origin v0.1.1
```

如果版本文件之外还有其他本次发布必须带上的改动，请先一起提交，再打 tag。

## 6. 发布失败时先看哪里

发布失败时，优先按下面顺序排查：

1. GitHub 仓库 `Actions` 页的失败 job
2. 具体失败平台的日志
3. 当前 tag 是否打在正确提交上
4. 版本号是否同步
5. Release 是否已存在且状态异常

## 7. 常见失败点

### 7.1 tag 没触发 workflow

常见原因：

- tag 名称不是 `v*`
- 只在本地打了 tag，没有推送到远程
- tag 打在了旧提交上
- workflow 文件还没进远程默认分支

排查方式：

```bash
git show v0.1.1
git push origin v0.1.1
```

## 7.2 版本号没有同步

常见现象：

- Release tag 是 `v0.1.1`
- 但包里显示还是 `0.1.0`

排查文件：

- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

## 7.3 `npm ci` 失败

常见原因：

- `package.json` 和 `package-lock.json` 不一致
- lock 文件落后于依赖声明

处理方式：

```bash
npm install
git add package-lock.json package.json
git commit -m "Sync npm lockfile"
git push origin main
```

然后重新打新 tag 发布。

## 7.4 GitHub Release 已存在，状态不匹配

当前 workflow 使用 `tauri-apps/tauri-action` 自动创建或上传 release。

如果同名 tag 对应的 release 已经存在，且状态与 workflow 配置不匹配，可能会失败。尤其是：

- 已存在的是 draft release
- 当前 workflow 里 `releaseDraft: false`

这种情况下，通常做法是：

1. 到 GitHub 上删除错误 release
2. 删除错误 tag
3. 修正后重新打 tag

## 7.5 GitHub Token 权限不足

当前 workflow 已声明：

```yml
permissions:
  contents: write
```

但如果仓库或组织层面对 Actions 权限做了更严格限制，仍可能导致 release 创建失败。

重点检查：

- 仓库 Settings
- Actions
- Workflow permissions

确保 `GITHUB_TOKEN` 对当前仓库至少有可写 release 内容的权限。

## 7.6 Linux 构建依赖问题

Ubuntu runner 需要系统依赖才能构建 Tauri。

当前 workflow 已安装：

- `libwebkit2gtk-4.1-dev`
- `libappindicator3-dev`
- `librsvg2-dev`
- `patchelf`

如果未来升级 Tauri 或系统镜像，Linux 构建失败要优先看这里。

## 7.7 macOS 包可构建，但分发体验受限

当前阶段没有做：

- Apple Developer 签名
- notarization

所以即使 macOS 构建成功，最终用户下载后仍可能遇到系统安全提示。这不是当前 workflow 的 bug，而是未签名分发的正常现象。

## 7.8 一次推多个 tag

虽然可以 `git push --tags`，但不建议把很多旧 tag 一次性全推上去。

原因很简单：

- 会同时触发多个 release workflow
- 容易把历史版本和当前版本一起重新跑出来
- 排查日志会变得很乱

建议一次只推一个 tag：

```bash
git push origin v0.1.1
```

## 8. 打错 tag 怎么回滚

如果 tag 还没推送到远程：

```bash
git tag -d v0.1.1
```

如果 tag 已经推送到远程：

```bash
git tag -d v0.1.1
git push origin :refs/tags/v0.1.1
```

如果 GitHub Release 也已经生成，建议再到 GitHub 页面把对应 release 删除。

修正代码后，重新创建正确的 tag。

## 9. 当前仓库的建议发版习惯

建议采用下面这套简单节奏：

- 功能小修：`0.1.1`、`0.1.2`
- 功能增加：`0.2.0`
- 不兼容调整：`1.0.0`

并且坚持这 3 条：

1. 先改版本号，再提交
2. 先推代码，再打 tag
3. 一次只发一个 tag

## 10. 后续可选优化

当前流程已经能满足“自动构建 + 自动发 GitHub Release”，后续还可以继续补：

- PR / push 的单独 CI 校验工作流
- 自动生成 changelog
- prerelease 专用 workflow
- macOS 签名与 notarization
- Windows 签名
- Release body 模板化

如果要继续扩展，优先建议先补一个“只做构建检查、不发 release”的 CI workflow。
