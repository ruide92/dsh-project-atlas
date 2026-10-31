# 开发与发布

## 环境

- Node.js >= 22.18（使用 `node:sqlite`）
- DSH >= 0.2.0-rc.1
- Windows / macOS / Linux 均可运行 Host 端；桌面端路径以实际安装为准

## 本地检查

```bash
npm test
npm run check
```

`npm test` 覆盖配置、扫描、项目模型、技能索引、会话读取、空状态和固定开场白等 51 项测试。

## 临时安装验证

使用 DSH 内置 pnpm，把公开包安装到一个**独立 profile**，不要直接改正在使用的 profile：

```bash
node <DSH 内置 pnpm 路径> add github:ruide92/dsh-project-atlas
```

然后在临时 profile 的 `dsh.profile.bundles` 中加入 `dsh-project-atlas`，启动一个不同端口的临时 Host 验证。验证完成后关闭临时进程；不要重启用户正在使用的 DSH 桌面端。

如果同时安装旧的 `@local/dsh-workbench` 和新的 `dsh-project-atlas`，两者会争用同一个侧边栏 id 和 `/dsh-workbench/api`，只能启用其中一个。

## 发布流程

1. 更新 `package.json` 的 `version`。
2. 确认 `client.js` 标题中的版本号与 `package.json` 一致。
3. 运行 `npm test` 和 `npm run check`。
4. 扫描仓库与 Git 历史，确认没有真实项目、用户名、绝对路径或截图。
5. 创建 annotated tag，例如 `v1.0.0`。
6. 推送 `main` 和 tag，创建 GitHub Release。
7. 如要进入 DSH 插件市场，向 `awesome-dsh-plugin` 提交条目；等待仓库年龄门和审核。

## 包内容

`package.json` 的 `files` 字段控制 npm/GitHub 包内容。当前包含 Host 端代码、客户端、locale、图标、NASA 素材、README、LICENSE、ASSET-LICENSES 和 `docs/`。

运行数据、`workbench.config.json`、测试 fixture、临时截图和本地 profile 不应进入发布包。

## 版本策略

- `package.json` 是包版本的单一事实来源。
- UI 标题只显示公开包版本，不显示内部迭代号。
- 修复发布前发现的真实缺陷时，更新 tag/release，让安装包与仓库 HEAD 一致。
