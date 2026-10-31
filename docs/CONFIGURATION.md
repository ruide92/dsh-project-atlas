# 配置参考

Project Atlas 的配置是普通 JSON。它只决定“读哪里、怎么读”，不会替你创建项目、移动文件或启动 GPU。

## 配置文件优先级

从高到低：

1. 环境变量 `DSH_WORKBENCH_CONFIG` 指向的 JSON 文件
2. 插件目录下的 `workbench.config.json`（开发和本地覆盖用，已加入 `.gitignore`）
3. `<DSH_HOME>/data/dsh-workbench/config.json`（推荐）
4. 内置安全默认值：`roots: []`

如果显式指定的配置文件存在但 JSON 无效，插件会停止加载配置并在状态里报告错误，不会偷偷回退到扫描整个硬盘。

## 最小示例

```json
{
  "roots": [
    { "path": "D:/work", "depth": 4, "label": "Work" }
  ]
}
```

`roots` 为空时，工作台显示空状态，点击“重新扫描”也不会扫描任何目录。这是有意的安全默认值。

## 字段

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `roots` | `array` | `[]` | 要扫描的根目录；字符串或 `{ path, depth, label }` |
| `excludeGlobs` | `string[]` | 常见依赖/构建目录 | 扫描排除规则 |
| `workspaceNames` | `string[]` | `Projects` 等 | 被视为工作区容器的目录名 |
| `workspaceGroups` | `array` | `[]` | 路径前缀分组，例如 `{ "prefix": "D:/work", "label": "Work" }` |
| `noisePatterns` | `string[]` | `[]` | 额外视为缓存/临时目录的路径片段 |
| `assetContainerMarkers` | `string[]` | `[]` | 含这些文件名的目录被视为素材容器 |
| `skillRoots` | `string[]` | 常见 Agent 目录 | `SKILL.md` 扫描根；设为 `[]` 可完全关闭 |
| `dshHome` | `string` | `~/.dsh` | DSH 数据目录 |
| `dshSessionsDir` | `string` | `<dshHome>/sessions` | DSH 会话目录 |
| `codexDb` | `string` | 自动探测 | Codex `state_5.sqlite`；不存在时跳过 |
| `openCodeDb` | `string` | 空 | OpenCode 数据库 |
| `allowDelete` | `boolean` | `false` | 是否允许删除“已弃用”项目 |
| `protectedPaths` | `string[]` | `[]` | 额外禁止删除的路径 |

## 扫描规则

- 根目录本身不会被当成项目；根目录下的项目标记、Git 仓库和常见项目文件决定项目边界。
- `depth` 限制递归深度，默认值由扫描器决定；过深会增加扫描时间。
- 依赖目录、构建产物、缓存目录和 `.git` 内部对象不会作为项目展示。
- 扫描只读取元数据和文件列表；不会执行项目脚本、Git hook、GPU 任务或 ComfyUI 工作流。
- 项目页的“交给 Agent”是显式操作；打开工作台本身不会向 Agent 发送项目内容。

## 删除边界

`allowDelete` 默认是 `false`。即使开启：

- 只允许删除标记为“已弃用”的顶层项目；
- 必须输入确认短语，并对每个项目提供逐项确认；
- 拒绝符号链接、插件自身、数据目录和受保护路径；
- 删除日志写入本地数据目录，便于审计。

不要为了让删除“更方便”而把 `allowDelete` 打开给不受信任的目录。

## 环境变量

| 变量 | 作用 |
| --- | --- |
| `DSH_HOME` | DSH 数据根目录；影响默认配置和运行数据路径 |
| `DSH_WORKBENCH_CONFIG` | 显式配置文件路径 |
| `DSH_WORKBENCH_DATA` | 运行数据目录覆盖（目录缓存、备注、交接记录等） |
| `DSH_WORKBENCH_CODEX_DB` | Codex 会话数据库覆盖 |

环境变量适合临时验证。长期配置建议放在 `<DSH_HOME>/data/dsh-workbench/config.json`，升级插件不会丢。
