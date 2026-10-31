# 架构与数据流

Project Atlas 是一个本地优先的 DSH Web 插件。它由三部分组成：

1. **DSH bundle patch**：把插件注册进当前 profile，并声明 Web 客户端入口。
2. **Host 端**：扫描项目、读取会话元数据、提供只读 API、处理少量本地写入。
3. **浏览器客户端**：渲染工作室、图书馆、时间庭三个场景，不直接访问文件系统。

## 模块

| 文件 | 职责 |
| --- | --- |
| `index.js` | Cordis 插件入口、HTTP 路由、鉴权边界、生命周期 |
| `scanner.js` | 目录遍历、项目标记识别、排除规则 |
| `project-model.js` | 项目聚合、工作区分组、噪声过滤 |
| `skills.js` | `SKILL.md` 扫描与技能分类 |
| `codex-sessions.js` | 只读读取 Codex 会话数据库 |
| `truth-docs.js` | 读取项目状态、README、交接记录等文本 |
| `digest.js` | 会话摘要与工具调用摘要 |
| `followup.js` | 本地交接记录、备注、后续事项 |
| `runtime.js` | 运行时状态与产出索引 |
| `project-lifecycle.js` | 项目生命周期与删除前检查 |
| `client.js` | Web UI（无构建步骤的浏览器模块） |
| `config.js` | 配置优先级、路径展开、默认值 |

## 请求流程

1. 浏览器请求 `/dsh-workbench/api/state`。
2. `index.js` 先检查请求来源：只接受 loopback / 显式允许的来源，并校验 `Origin`、`Sec-Fetch-Site` 等信号；有 `Origin` 时还要求 host（含端口）完全一致。
3. 配置加载器读取 `DSH_WORKBENCH_CONFIG`、插件目录配置或数据目录配置；没有配置时返回空状态。
4. 扫描器按 `roots` 读取目录元数据，项目模型聚合成项目列表。
5. 客户端渲染项目卡片、场景和详情；项目内容不会自动发给 Agent。
6. 用户显式点击“交给 Agent”时，才由 DSH 的正常会话链路处理。

## 数据目录

运行数据默认位于 `<DSH_HOME>/data/dsh-workbench/`：

- `catalog.json`：扫描缓存
- `overrides.json`：项目备注和显示覆盖
- `handoffs.json`：交接记录
- `deletions.log`：删除审计日志
- `research/`：可选的本地研究材料，不属于发布包

这些文件只在本机。发布包和 Git 仓库不包含运行数据。

## 只读优先

大多数 API 是 GET。只有明确操作（保存备注、交接、重新扫描、删除已弃用项目）才写入。删除默认关闭，并经过路径保护、符号链接检查和逐项确认。

## 客户端边界

- 不使用 `dangerouslySetInnerHTML`、`innerHTML`、`eval` 或 `new Function`。
- 唯一的外部跳转是用户点击产物时 `window.open(url, '_blank', 'noopener,noreferrer')`。
- 产物预览使用 sandbox CSP，不把任意 HTML 注入主页面。
- 不包含遥测、账号系统或云端同步。
