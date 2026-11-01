import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const source = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
function loadScenes() {
  const React = {
    createElement(type, props, ...children) { return { type, props: props || {}, children } },
    Fragment: Symbol('Fragment'), useState: () => [], useEffect: () => {}, useMemo: () => null,
    useRef: () => ({}), useCallback: (fn) => fn,
  }
  const window = { __DSH_WORKBENCH_TEST__: {}, __ModuleLoader__: { load(spec) { spec.factory((name) => name === 'react' ? React : {}) } } }
  const sandbox = { window, console, Date, Map, Set, Number, String, Array, Object, JSON, Math, RegExp, Intl, URLSearchParams, setTimeout, clearTimeout }
  vm.createContext(sandbox)
  vm.runInContext(source, sandbox, { filename: 'client.js' })
  return window.__DSH_WORKBENCH_TEST__.scenes
}
function descendants(node, result = []) {
  if (Array.isArray(node)) { node.forEach((child) => descendants(child, result)); return result }
  if (!node || typeof node !== 'object' || !('type' in node)) return result
  result.push(node)
  descendants(node.children, result)
  return result
}

test('project entry uses only known scene labels and ignores unrecognized values', () => {
  const scenes = loadScenes()
  assert.equal(scenes.workspaceOriginLabel('earth'), 'sceneEarth')
  assert.equal(scenes.workspaceOriginLabel('studio'), 'sceneStudio')
  assert.equal(scenes.workspaceOriginLabel('library'), 'sceneLibrary')
  for (const scene of ['table', 'time', '', '__proto__', undefined]) {
    assert.equal(scenes.workspaceOriginLabel(scene), null)
    assert.equal(scenes.WorkspaceOriginMark({ scene }), null)
  }
})

test('origin marks are decorative, local, non-focusable and honor reduced motion', () => {
  const scenes = loadScenes()
  const kinds = new Set()
  for (const scene of ['earth', 'studio', 'library']) {
    const mark = scenes.WorkspaceOriginMark({ scene })
    assert.equal(mark.type, 'svg')
    assert.equal(mark.props['aria-hidden'], 'true')
    assert.equal(mark.props.focusable, 'false')
    const nodes = descendants(mark)
    for (const node of nodes) {
      assert.equal(node.props.onClick, undefined)
      assert.equal(node.props.href, undefined)
      assert.equal(node.props.tabIndex, undefined)
    }
    kinds.add(nodes.map((node) => node.type).join(','))
  }
  assert.equal(kinds.size, 3)
  assert.match(source, /@media\s*\(prefers-reduced-motion:reduce\)\s*\{\s*\.wb-room\.wb-field\s+\.wb-field-origin\s*\{\s*animation:none!important\s*\}/)
})
