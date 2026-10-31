# 故障排查

## 首次打开是空的

这是安全默认值。`roots` 默认是 `[]`，插件不会猜测目录。

在 `<DSH_HOME>/data/dsh-workbench/config.json` 写入最小配置：

```json
{
  "roots": [{ "path": "D:/work", "depth": 4, "label": "Work" }]
}
```

然后点击“重新扫描”。

## 配置没有生效

按优先级检查：

1. `DSH_WORKBENCH_CONFIG` 是否指向了另一个文件；
2. 插件目录下是否有 `workbench.config.json` 覆盖；
3. `<DSH_HOME>/data/dsh-workbench/config.json` 是否是有效 JSON；
4. 路径是否存在、是否有读取权限；
5. 修改后是否点击了“重新扫描”。

JSON 无效时不要期待静默回退；状态里会报告配置错误。

## 看不到 Codex 会话

插件只读读取 Codex 的 `state_5.sqlite`。如果数据库不存在、没有权限或 schema 不匹配，会跳过而不是报错。可以用 `DSH_WORKBENCH_CODEX_DB` 指向实际数据库。

## 看不到 DSH 会话

检查 `dshHome` / `dshSessionsDir` 是否指向当前 DSH 数据目录。不同 profile 的会话目录可能不同。

## 端口或登录问题

DSH Web 默认只监听 loopback，并要求启动时打印的 token URL。不要用 `0.0.0.0` 暴露到局域网；不要绕过来自 `dsh web` 的认证。

## 侧边栏出现两个工作台

旧 `@local/dsh-workbench` 和新 `dsh-project-atlas` 使用相同的侧边栏 id 与 API 前缀。停用/移除旧插件，只保留一个，然后由用户重启桌面端。

## 删除按钮不可用

`allowDelete` 默认 `false`。这是有意的。开启后仍然只允许删除已弃用项目，并要求确认短语和逐项确认。不要为了省事关闭路径保护。

## 页面版本号与包版本不一致

这是发布缺陷。检查 `client.js` 中 `wb-version` 是否与 `package.json` 的 `version` 一致，修复后重新打 tag/release。

## 仍然无法解决

请提供：

- DSH 版本、插件版本、操作系统；
- 复现步骤；
- 脱敏后的错误信息。

不要粘贴真实项目路径、用户名、会话内容或含个人信息的截图。
