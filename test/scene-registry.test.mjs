import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

// Load the real DSH client factory without mounting or contacting a Host.
function loadScenes() {
  const React = {
    createElement(type, props, ...children) { return { type, props: props || {}, children } },
    Fragment: Symbol('Fragment'),
    useState: () => [], useEffect: () => {}, useMemo: () => null,
    useRef: () => ({}), useCallback: (fn) => fn,
  }
  const window = {
    __DSH_WORKBENCH_TEST__: {},
    __ModuleLoader__: { load(spec) { spec.factory((name) => name === 'react' ? React : {}) } },
  }
  const sandbox = { window, console, Date, Map, Set, Number, String, Array, Object, JSON, Math, RegExp, Intl, URLSearchParams, setTimeout, clearTimeout }
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8'), sandbox, { filename: 'client.js' })
  return window.__DSH_WORKBENCH_TEST__.scenes
}

const scenes = loadScenes()

test('scene preferences validate untrusted JSON and preserve newly registered scenes', () => {
  const value = scenes.normalizeScenePreferences({ order: ['library', 'library', 'missing', 'earth'], hidden: ['earth', 'missing'], start: 'earth', code: 'ignored' })
  assert.deepEqual(Array.from(value.order), ['library', 'earth', 'studio', 'time'])
  assert.deepEqual(Array.from(value.hidden), ['earth'])
  assert.equal(value.start, 'library')
  assert.deepEqual(Object.keys(value).sort(), ['hidden', 'order', 'start'])
  const allHidden = scenes.normalizeScenePreferences({ hidden: ['earth', 'studio', 'library', 'time'] })
  assert.equal(allHidden.hidden.length, 0)
  assert.equal(allHidden.start, 'earth')
})

test('scene preferences survive reload and fail safely when storage is invalid or denied', () => {
  const store = new Map()
  const storage = { setItem(key, value) { store.set(key, value) }, getItem(key) { return store.get(key) } }
  assert.equal(scenes.writeScenePreferences(storage, { order: ['studio'], hidden: ['earth'], start: 'studio' }), true)
  const reloaded = scenes.readScenePreferences(storage)
  assert.equal(reloaded.start, 'studio')
  assert.deepEqual(Array.from(reloaded.order), ['studio', 'earth', 'library', 'time'])
  assert.deepEqual(Array.from(reloaded.hidden), ['earth'])
  const denied = { getItem() { throw new Error('denied') }, setItem() { throw new Error('denied') } }
  assert.equal(scenes.readScenePreferences(denied).start, 'earth')
  assert.equal(scenes.writeScenePreferences(denied, reloaded), false)
  assert.equal(scenes.readScenePreferences({ getItem: () => '{invalid' }).start, 'earth')
})

test('scene editor changes order and visibility without hiding the final scene', () => {
  const value = scenes.normalizeScenePreferences({ hidden: ['earth', 'library', 'time'], start: 'studio' })
  const changes = []
  const tr = (key, params) => key + (params?.name ? `:${params.name}` : '')
  const element = scenes.SceneSettings({ value, onChange: (next) => changes.push(next), tr })
  const panel = element.children[1]
  assert.equal(panel.children[1].children[1].props['aria-label'], 'sceneSettingsStart')
  const list = panel.children[2]
  const rows = list.children[0]
  const studio = rows.find((row) => row.props.key === 'studio')
  assert.equal(studio.children[0].children[0].props.disabled, true)
  assert.equal(studio.children[0].children[0].props['aria-label'], 'sceneSettingsShow:sceneStudio')
  assert.equal(studio.children[1].props['aria-label'], 'sceneSettingsUp:sceneStudio')
  assert.equal(studio.children[2].props['aria-label'], 'sceneSettingsDown:sceneStudio')
  assert.equal(panel.children[3].children[0], 'sceneSettingsReset')
  studio.children[1].props.onClick()
  assert.deepEqual(Array.from(changes[0].order), ['studio', 'earth', 'library', 'time'])
  const earth = rows.find((row) => row.props.key === 'earth')
  earth.children[0].children[0].props.onChange({ target: { checked: true } })
  assert.deepEqual(Array.from(changes[1].hidden), ['library', 'time'])
})

test('every registered scene supplies its real component, navigation and project callbacks', () => {
  const calls = []
  const project = { id: 'p1', name: 'Example' }
  const common = {
    projects: [project], activeId: project.id, tr: (s) => s,
    onActive: (id) => calls.push(['select', id]),
    onOpen: (item) => calls.push(['open', item.id]),
    onOpenPath: () => {}, onRefresh: () => {}, onScene: () => {},
  }
  const ctx = {
    common,
    studio: { query: 'desk', roomId: 'room-2', camera: { scale: 0.8 } },
    library: { query: 'book', shelf: 'persistent' },
    time: { query: 'year', bucket: 'week' },
  }
  const expected = { earth: 'EarthView', studio: 'StudioView', library: 'LibraryView', time: 'TimeView' }
  assert.equal(scenes.registry.length, Object.keys(expected).length)
  for (const [id, componentName] of Object.entries(expected)) {
    const scene = scenes.findScene(id)
    assert.equal(scene.component.name, componentName)
    const element = scenes.renderScene(scene, ctx)
    assert.equal(element.type, scene.component)
    assert.equal(element.props.projects, common.projects)
    assert.equal(element.props.activeId, project.id)
    element.props.onActive(project.id)
    element.props.onOpen(project)
  }
  assert.equal(calls.length, 8)
  assert.equal(scenes.renderScene(scenes.findScene('studio'), ctx).props.roomId, 'room-2')
  assert.equal(scenes.renderScene(scenes.findScene('studio'), ctx).props.camera.scale, 0.8)
  assert.equal(scenes.renderScene(scenes.findScene('library'), ctx).props.shelf, 'persistent')
  assert.equal(scenes.renderScene(scenes.findScene('time'), ctx).props.bucket, 'week')
})

test('navigation and mode use registered ids, including a developer-contributed scene', () => {
  const target = []
  const navigation = scenes.SceneSwitch({ current: 'library', onScene: (id) => target.push(id), tr: (s) => s })
  const buttons = navigation.children[0]
  assert.equal(buttons.length, 4)
  assert.equal(buttons.find((button) => button.props.key === 'library').props['aria-current'], 'page')
  buttons.find((button) => button.props.key === 'studio').props.onClick()
  assert.deepEqual(target, ['studio'])

  const custom = { id: 'example', backLabelKey: 'sceneBackExample', component: () => null, bind: ({ common }) => common }
  assert.equal(scenes.findScene('example'), null)
  assert.equal(scenes.findScene('example', [custom]), custom)
  assert.equal(scenes.sceneModeFor({ name: 'index' }, 'projects', custom), true)
  assert.equal(scenes.sceneModeFor({ name: 'project' }, 'projects', custom), false)
  assert.equal(scenes.sceneModeFor({ name: 'index' }, 'skills', custom), false)
  assert.equal(scenes.renderScene(custom, { common: { activeId: 'p1' } }).props.activeId, 'p1')
  assert.equal(scenes.sceneBackLabel('example', false, [custom]), 'sceneBackExample')
  assert.equal(scenes.sceneBackLabel('earth', true), 'roomBackDetail')
  assert.equal(scenes.sceneBackLabel('studio', false), 'sceneStudioBackStudio')
})
