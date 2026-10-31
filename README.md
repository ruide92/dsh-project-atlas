# Project Atlas — 可视化项目工作台

Project Atlas 是一个 DeepSeek Harness（DSH）插件：把本机的 AI 项目、技能、Codex / DSH 会话、运行状态与产出，收进一个可缩放的项目工作台。它默认只读，不会替你改写项目；是否把项目交给 Agent，由你在项目页里明确操作。

- 三个场景：工作室、图书馆、时间庭
- 项目总览、生命周期与本地备注
- SKILL.md 图谱、DSH / Codex 会话索引
- 运行状态、产物预览、磁盘与 AI 软件概览
- 本地优先：没有账号、没有云端同步、没有遥测

## 安装

### 从 DSH 插件市场安装

在 DSH 的插件市场搜索 **Project Atlas** 或 **可视化工作台**，安装后按桌面端提示重启。

### 手动安装

```bash
node <DSH 内置 pnpm 路径> add github:ruide92/dsh-project-atlas
```

然后在 `~/.dsh/profiles/<profile>/package.json` 的 `dsh.profile.bundles` 中加入 `dsh-project-atlas`，重启桌面端。具体路径以你的 DSH 安装为准。也可以直接使用 GitHub 仓库的 tarball 地址安装。

## 第一次使用

插件**不会**猜测你的硬盘、用户名或项目目录。首次打开是空状态，这是有意的安全默认值。

在下面任一位置创建配置：

1. 环境变量 `DSH_WORKBENCH_CONFIG` 指向的 JSON 文件（最高优先级）
2. 插件目录下的 `workbench.config.json`（开发时使用）
3. `~/.dsh/data/dsh-workbench/config.json`（推荐，升级插件不会丢）

最小示例：

```json
{
  "roots": [
    { "path": "D:/work", "depth": 4, "label": "Work" }
  ]
}
```

保存后回到工作台，点击“重新扫描”。

### 配置项

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `roots` | `[]` | 要扫描的根目录。每项可以是字符串，或 `{ path, depth, label }`。为空时不会扫描任何目录。 |
| `excludeGlobs` | 常见依赖/构建目录 | 扫描时排除的 glob。 |
| `workspaceNames` | `Projects` / `Workspace` / `Code` / `Dev` / `Repos` | 被视为“工作区容器”的目录名；容器本身不显示为项目，直接子项会被提升。 |
| `workspaceGroups` | `[]` | 可选的路径前缀分组，例如 `{ "prefix": "D:/work", "label": "Work" }`。 |
| `noisePatterns` | `[]` | 额外视为缓存/临时目录的路径片段。 |
| `assetContainerMarkers` | `[]` | 目录中出现这些文件名时，把该目录当作素材容器，其子目录作为项目。 |
| `skillRoots` | 常见 Agent 目录 | SKILL.md 扫描根。设为 `[]` 可完全关闭技能扫描。 |
| `dshHome` | `~/.dsh` | DSH 数据目录。 |
| `dshSessionsDir` | `<dshHome>/sessions` | DSH 会话目录。 |
| `codexDb` | 自动探测 `~/.codex/state_5.sqlite` | Codex 会话数据库；不存在时静默跳过。 |
| `openCodeDb` | 空 | OpenCode 数据库路径。 |
| `allowDelete` | `false` | 是否允许在界面里删除**已弃用**项目。默认关闭；开启后删除仍会走回收站并要求二次确认。 |
| `protectedPaths` | `[]` | 额外禁止删除的路径。插件自身、数据目录、用户主目录及常见个人目录始终受保护。 |

## 数据与隐私

- 项目内容只在本机读取；插件不发起上传，也不包含遥测。
- 运行数据写在 `~/.dsh/data/dsh-workbench/`：目录缓存、备注、交接记录、删除日志。它们不会被打进 npm 包或 Git 仓库。
- 删除默认关闭。即使开启，也只允许删除标记为“已弃用”的顶层项目，并且会拒绝符号链接、插件自身和数据目录。
- 仓库与发布包不包含任何真实项目、用户名、机器路径、会话 ID 或项目截图；内置地球纹理是 NASA 公共领域素材。

## 文档

- [配置参考](docs/CONFIGURATION.md)：完整字段、优先级、扫描与删除边界
- [架构与数据流](docs/ARCHITECTURE.md)：模块、请求流程、数据目录
- [隐私与安全](docs/PRIVACY.md)：读取范围、写入范围、公开仓库清洁规则
- [开发与发布](docs/DEVELOPMENT.md)：本地检查、临时安装、发布流程
- [故障排查](docs/TROUBLESHOOTING.md)：空状态、配置、会话、端口与双工作台冲突

## 开发

```bash
npm test        # 51 项测试
npm run check   # 语法检查
```

要求 Node.js >= 22.18（使用 `node:sqlite` 读取 Codex 会话）与 DSH >= 0.2.0-rc.1。

## 资产许可

地球纹理来自 NASA Earth Observatory / Visible Earth，属于 NASA 公共领域素材；详细来源、处理方式和校验和见 [ASSET-LICENSES.md](ASSET-LICENSES.md)。

## License

MIT，见 [LICENSE](LICENSE)。
