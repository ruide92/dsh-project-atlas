# 开发与发布

## 环境

- Node.js >= 22.18（使用 `node:sqlite`）
- DSH >= 0.2.0-rc.1
- 以 Windows 上的 DSH 桌面端为主要支持环境；macOS / Linux 可运行 Host 端，但磁盘、回收站、资源管理器等 Windows 专属能力会降级或不可用

## 本地检查

```bash
npm test
npm run check
```

`npm test` 覆盖配置、扫描、项目模型、场景、媒体缓存、会话读取和宿主接口等行为。

## 隔离界面预览

本节适用于完整源码检出；npm 发布包不包含 `dev/` 预览脚本。

`dev/preview.mjs` 通过仅监听 `127.0.0.1` 的临时 HTTP 服务加载真实客户端，展示合成示例项目。它不启动或连接 DSH、不扫描个人目录，不提供真实项目、会话或技能；默认拒绝所有写请求。预览用于观察场景和基本页面交互，不能代替真实宿主集成验收。

本工具需要本机已有 React 19、同版本 React DOM 和对应的 Scheduler。将 `ATLAS_PREVIEW_DEPS` 指向包含这些包的 `node_modules` 的父目录，然后运行：

```powershell
$env:ATLAS_PREVIEW_DEPS = '已有依赖的目录'
node dev/preview.mjs
```

在浏览器打开终端打印的本地地址，结束后在终端按 Ctrl+C。默认使用系统分配的空闲端口；需要指定端口时可设置 `ATLAS_PREVIEW_PORT`。合成数据在 `dev/preview.mjs` 内编辑；场景导航偏好会保存在预览地址对应的浏览器本地存储中，不会写入 DSH 或项目数据。界面使用预览内简化主题，不代表 DSH 的最终主题。

要验证宽桌面窗口中的窄插件栏，可设置 `ATLAS_PREVIEW_PANEL_WIDTH=390`（240–2000，单位为 CSS 像素）；该选项只限制合成预览面板的宽度，不改变浏览器窗口或手机视口。

可以在启动前设置 `ATLAS_PREVIEW_CLIENT_FILE` 为目标 `client.js` 的绝对路径，例如 `$env:ATLAS_PREVIEW_CLIENT_FILE = 'E:\某个插件目录\client.js'`。预览只读取指定客户端和其相邻 `assets/` 内的固定地球纹理，不加载其宿主、配置或项目。预览右下角会标注当前是仓库客户端还是外部指定客户端；它仍然只展示合成数据。

默认 `ATLAS_PREVIEW_SAVE_MODE=readonly`，拒绝所有写操作。设为 `memory` 可模拟对合成项目的备注、标签、状态、生命周期和用途的保存成功；修改只在预览服务进程内存中，结束或重启即丢失。设为 `failure` 模拟保存失败。无论模式如何，打开文件、写入交接文件等其他操作仍被拒绝；这不是对真实项目的保存验证。切换模式需重启预览服务。使用结束后可在当前终端清除上述环境变量。

调试保存期间的并发操作时，可在启动前设置 `ATLAS_PREVIEW_SAVE_DELAY_MS` 为 0–5000 的整数（毫秒），让模拟成功或失败的响应延后；默认是 0，其他请求仍可正常响应。此选项只影响开发预览，不影响 DSH 或项目数据。

设置相同的依赖目录后，运行 `node --test test/preview.test.mjs` 可验证模拟数据、只读边界、内存保存和故障模拟；找不到依赖时该项测试会跳过。

## 临时安装验证

使用 DSH CLI，把公开包安装到一个**独立环境和 profile**，不要直接改正在使用的 profile。仅切换 profile 不足以隔离个人数据：还必须核查 DSH 数据目录、技能目录、会话数据库及扫描根目录均指向专用测试位置，且配置中没有用户真实目录；不能确认时不要启动测试宿主。

```bash
dsh plugin --profile <临时 profile> add github:ruide92/dsh-project-atlas
```

如果 `dsh` 不在 PATH 中，使用桌面端内置的完整 CLI 路径。然后在临时 profile 的 `dsh.profile.bundles` 中加入 `dsh-project-atlas`，启动一个不同端口的临时 Host 验证。验证完成后关闭临时进程；不要重启用户正在使用的 DSH 桌面端。

如果同时安装旧的 `@local/dsh-workbench` 和新的 `dsh-project-atlas`，两者会争用同一个侧边栏 id 和 `/dsh-workbench/api`，只能启用其中一个。

## 发布流程

1. 更新 `package.json` 的 `version`。
2. 确认 `client.js` 标题中的版本号与 `package.json` 一致。
3. 运行 `npm test` 和 `npm run check`。
4. 扫描仓库与 Git 历史，确认没有真实项目、用户名、绝对路径或截图。
5. 核对安装地址指向该版本可复现的包，检查包中素材授权、隐私及配置；使用新版本号创建新的 annotated tag。
6. 推送代码和新 tag，创建 GitHub Release，上传经过检查的安装包，并按新增、优化、修复和已知限制整理更新说明。
7. 核对已有 DSH 插件市场提交及审核状态；有未完成的提交时不要重复提交。

## 包内容

`package.json` 的 `files` 字段控制 npm 打包清单，不控制 GitHub 自动生成的源码归档。源码归档和手动上传的 Release 资产需要分别检查。当前 npm 清单包含 Host 端代码、客户端、locale、图标、NASA 素材、README、更新日志、LICENSE、ASSET-LICENSES 和 `docs/`。

运行数据、`workbench.config.json`、测试 fixture、临时截图和本地 profile 不应进入发布包。

## 版本策略

- `package.json` 是包版本的单一事实来源。
- UI 标题只显示公开包版本，不显示内部迭代号。
- 已公开发布的 tag 和安装包保持不变；发现发布缺陷时使用新的修复版本、tag 和 Release。
