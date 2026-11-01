# 开发场景

场景是同一组项目的不同浏览方式；切换场景不创建项目，也不复制项目数据。当前支持地球、工作室、图书馆和时间庭。

## 用户场景设置

顶部「场景设置」可调整场景显示、导航顺序和启动时显示的场景，也可以恢复默认。设置仅包含场景 ID 等声明式数据，存放在当前设备的浏览器本地存储，不包含项目数据、不执行代码；浏览器本地存储不可用时，界面会提示设置仅在当前会话有效。无效或旧版本数据会回退到安全默认值，未来新增的内置场景会自动补入列表。

## 接入范围

`client.js` 中的 `SCENE_REGISTRY` 是**源码级的可信注册表**。修改源码并重新构建或安装本插件，可以添加场景；它不是运行时扩展市场，也不会扫描用户目录、从配置或项目数据执行 JavaScript。请勿通过项目数据动态加载脚本。

每条记录包含唯一的 `id`、本地化键 `labelKey` 和 `backLabelKey`、已有图标 `icon`、场景组件 `component`、以及从上下文创建组件 props 的 `bind`。导航、场景模式、根节点样式类、组件渲染及项目页返回文案均使用这个注册表。

下面是源码贡献者的接入示意，组件和本地化文案需要自行实现；它不会自动安装第三方场景：

```js
{
  id: 'example',
  labelKey: 'sceneExample',
  backLabelKey: 'sceneBackExample',
  icon: 'grid',
  component: ExampleView,
  bind: ({ common }) => common,
}
```

1. 在 `client.js` 中实现 `ExampleView`，给 `DICT.zh` 和 `DICT.en` 添加标签和返回文案；`id` 用唯一的小写字母、数字和连字符，不与非场景视图冲突。
2. 在 `SCENE_REGISTRY` 添加记录。组件通过 `common` 取得 `projects`、`activeId`、`tr`、`onActive`、`onOpen`、`onOpenPath`、`onRefresh`、`onScene`。用 `onActive` 选择项目，用 `onOpen` 进入已有项目现场；不要另建项目副本。
3. 自有的查询、视角或房间状态应在父工作台中管理，并通过 `bind` 显式传入；返回现场时要恢复可见位置和焦点。根节点会生成 `is-<id>-scene` 类，可据此添加有作用域的样式。需要额外素材时，确认来源和授权，并按 `package.json` 的发布清单与 `ASSET-LICENSES.md` 收录。
4. 使用真实项目记录和可追溯素材；缺图或状态不明时展示空态，不虚构项目、进度或 Agent 活动。支持键盘、不同窗口宽度、减少动态效果和资源加载失败。
5. 扩展 `test/scene-registry.test.mjs` 覆盖选择、项目回调、场景私有状态与返回；运行 `npm test` 和 `npm run check`，再在独立 DSH profile 验证显示和完整往返。

目前项目内现场仍共用 `ProjectWorkspace`；新场景可以设计自己的入口和回程，但注册一个场景不会自动生成该场景专属的项目内部空间。以上场景设置只调整导航，不是场景内容或家具布局编辑器；运行时安装第三方场景、自由布置场景、第三方代码权限隔离及热加载均尚未实现。
