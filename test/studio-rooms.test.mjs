import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

function loadScenes() {
  const React = {
    createElement(type, props, ...children) { return { type, props: props || {}, children } },
    Fragment: Symbol('Fragment'),
    useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
    useEffect: () => {}, useMemo: (fn) => fn(), useRef: (value) => ({ current: value }), useCallback: (fn) => fn,
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
const tr = (key) => key
const makeProjects = (count, lifecycle) => Array.from({ length: count }, (_, i) => ({
  id: `${lifecycle}-${String(i).padStart(4, '0')}`, name: `Project ${i}`, lifecycle, tags: [],
}))
function descendants(node, result = []) {
  if (Array.isArray(node)) { node.forEach((child) => descendants(child, result)); return result }
  if (!node || typeof node !== 'object' || !('type' in node)) return result
  result.push(node)
  descendants(node.children, result)
  return result
}
function render(projects, roomId, callbacks = {}, query = '') {
  return scenes.findScene('studio').component({
    projects, roomId, query, activeId: callbacks.activeId || '', camera: { x: 0, y: 0, z: 1 }, tr,
    onActive: callbacks.onActive || (() => {}), onOpen: callbacks.onOpen || (() => {}),
    setRoomId: callbacks.setRoomId || (() => {}), setCamera: () => {}, setQuery: () => {},
    onOpenPath: () => {}, onRefresh: () => {}, onScene: () => {},
  })
}
const hasClass = (node, name) => String(node.props.className || '').split(/\s+/).includes(name)

test('empty and large collections partition every lifecycle once into fixed-capacity rooms', () => {
  assert.equal(scenes.studioRooms([], [], tr).length, 0)
  const projects = ['persistent', 'incubating', 'temporary', 'unclassified'].flatMap((kind) => makeProjects(257, kind))
  const rooms = scenes.studioRooms(projects, projects, tr)
  assert.equal(rooms.length, 44)
  assert.equal(new Set(rooms.map((room) => room.id)).size, rooms.length)
  assert.ok(rooms.every((room) => room.projects.length > 0 && room.projects.length <= scenes.STUDIO_ROOM_CAPACITY))
  const ids = rooms.flatMap((room) => room.projects.map((project) => project.id))
  assert.equal(ids.length, projects.length)
  assert.equal(new Set(ids).size, projects.length)
  assert.deepEqual([...ids].sort(), projects.map((project) => project.id).sort())
  for (const room of rooms) {
    const { deskW, deskH } = scenes.studioDeskLayout(room.projects.length)
    assert.ok(deskW > 0 && deskH > 0, room.id)
  }
})

test('room IDs and project assignments survive reordering and filtering', () => {
  const projects = makeProjects(75, 'persistent').concat(makeProjects(53, 'incubating'))
  const rooms = scenes.studioRooms(projects, projects, tr)
  const assignments = new Map(rooms.flatMap((room) => room.projects.map((project) => [project.id, room.id])))
  const filtered = projects.filter((_, i) => i % 7 === 0)
  const filteredRooms = scenes.studioRooms([...projects].reverse(), filtered, tr)
  for (const room of filteredRooms) for (const project of room.projects) assert.equal(assignments.get(project.id), room.id)
  assert.equal(filteredRooms.flatMap((room) => room.projects).length, filtered.length)
  assert.equal(scenes.studioRooms(projects, [], tr).length, 0)
})

test('desk clusters stay compact for small rooms and within the floor for every capacity', () => {
  const small = scenes.studioDeskLayout(4)
  assert.ok(small.width <= 300 && small.height <= 184)
  for (let count = 1; count <= scenes.STUDIO_ROOM_CAPACITY; count++) {
    const layout = scenes.studioDeskLayout(count)
    assert.ok(layout.left >= 44 && layout.left + layout.width <= 734)
    assert.ok(layout.top >= 124 && layout.top + layout.height <= 522)
    assert.ok(layout.cellW > layout.deskW && layout.cellH > layout.deskH)
  }
})

test('all rooms are reachable through overview and labeled keyboard-focusable tabs, with positive SVG desk dimensions', () => {
  const projects = ['persistent', 'incubating', 'temporary', 'unclassified'].flatMap((kind) => makeProjects(53, kind))
  const rooms = scenes.studioRooms(projects, projects, tr)
  const navigation = []
  const overview = descendants(render(projects, 'overview', { setRoomId: (id) => navigation.push(id) }))
  const wings = overview.filter((node) => hasClass(node, 'wb-atelier-wing'))
  assert.equal(wings.length, 4)
  for (const wing of wings) {
    assert.equal(wing.props.tabIndex, 0)
    wing.props.onKeyDown({ key: 'Enter', preventDefault() {} })
  }
  assert.equal(navigation.length, 4)
  for (const room of rooms) {
    const nodes = descendants(render(projects, room.id, { setRoomId: (id) => navigation.push(id) }))
    const tabs = nodes.filter((node) => node.props.role === 'tab')
    assert.equal(tabs.length, rooms.filter((item) => item.kind === room.kind).length)
    const tab = tabs.find((node) => node.props['aria-selected'])
    assert.equal(tab.props['aria-label'], room.label)
    const desks = nodes.filter((node) => hasClass(node, 'wb-atelier-desk'))
    assert.equal(desks.length, room.projects.length)
    for (const desk of desks) {
      assert.equal(desk.props.tabIndex, 0)
      const top = descendants(desk).find((node) => hasClass(node, 'wb-atelier-desk-top'))
      assert.ok(top.props.width > 0 && top.props.height > 0)
    }
    for (const item of tabs) item.props.onClick()
    assert.ok(navigation.includes(room.id))
  }
})

test('room selection and returning to overview preserve existing project actions', () => {
  const projects = makeProjects(25, 'persistent')
  const calls = []
  const nodes = descendants(render(projects, 'persistent-1', {
    onActive: (id) => calls.push(['active', id]), setRoomId: (id) => calls.push(['room', id]),
  }))
  const desk = nodes.find((node) => hasClass(node, 'wb-atelier-desk'))
  desk.props.onKeyDown({ key: ' ', preventDefault() {} })
  assert.equal(calls[0][1], projects[24].id)
  nodes.find((node) => hasClass(node, 'wb-atelier-back')).props.onClick()
  assert.deepEqual(calls[1], ['room', 'overview'])
})
