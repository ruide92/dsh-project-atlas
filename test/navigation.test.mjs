import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

function navigation() {
  const React = { createElement() {}, Fragment: Symbol('Fragment'), useState() {}, useEffect() {}, useMemo() {}, useRef() {}, useCallback() {} }
  const window = { __DSH_WORKBENCH_TEST__: {}, __ModuleLoader__: { load(spec) { spec.factory(() => React) } } }
  const context = vm.createContext({ window, console, Date, Map, Set, Number, String, Array, Object, JSON, Math, RegExp, Intl, URLSearchParams, setTimeout, clearTimeout })
  vm.runInContext(fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8'), context)
  return window.__DSH_WORKBENCH_TEST__.scenes
}
const { canNavigateToView, projectHistoryState, workspaceSaveSnapshot, workspaceSaveIsCurrent, attemptWorkspaceLeave, savePendingWorkspaceChanges, guardProjectSwitch, handleWorkspaceEscape, createProjectPopGuard } = navigation()

test('scene exits can open the table, while unknown destinations are rejected', () => {
  assert.equal(canNavigateToView('table'), true)
  assert.equal(canNavigateToView('studio'), true)
  assert.equal(canNavigateToView('library'), true)
  assert.equal(canNavigateToView('nonexistent'), false)
})

test('project history remembers the selected chapter and preserves navigation provenance', () => {
  const fromIndex = projectHistoryState({ other: 3 }, { projectId: 'a', tab: 'sessions' }, { name: 'index' })
  assert.equal(fromIndex.other, 3)
  assert.equal(fromIndex.dshWorkbench.tab, 'sessions')
  assert.equal(fromIndex.dshWorkbench.entry, 'wall')
  const fromProject = projectHistoryState(fromIndex, { projectId: 'b', tab: 'outputs' }, { name: 'project' })
  assert.equal(fromProject.dshWorkbench.projectId, 'b')
  assert.equal(fromProject.dshWorkbench.tab, 'outputs')
  assert.equal(fromProject.dshWorkbench.entry, 'wall')
})

test('Escape uses the same save gate as the back button and stays open on save failure', async () => {
  const ref = { current: false }
  const calls = []
  const doc = { querySelector: () => null }
  let pending
  const event = { key: 'Escape', target: { closest: () => null }, preventDefault: () => calls.push('prevent') }
  const invoke = (save) => handleWorkspaceEscape(event, {
    taskOpen: false, setTaskOpen: () => {}, leave: () => { pending = attemptWorkspaceLeave(ref, true, save, () => calls.push('close')) },
  }, doc)
  assert.equal(invoke(async () => { calls.push('save-fail'); return false }), true)
  assert.equal(await pending, false)
  assert.equal(ref.current, false)
  assert.deepEqual(calls, ['prevent', 'save-fail'])
  assert.equal(invoke(async () => { calls.push('save-ok'); return true }), true)
  assert.equal(await pending, true)
  assert.deepEqual(calls, ['prevent', 'save-fail', 'prevent', 'save-ok', 'close'])
})

test('Escape dismisses task editor first and does not close a modal or interrupt typing', () => {
  const calls = []
  const event = { key: 'Escape', target: { closest: () => null }, preventDefault: () => calls.push('prevent') }
  const actions = { taskOpen: true, setTaskOpen: (value) => calls.push(value), leave: () => calls.push('leave') }
  handleWorkspaceEscape(event, actions, { querySelector: () => null })
  assert.deepEqual(calls, ['prevent', false])
  calls.length = 0
  handleWorkspaceEscape(event, actions, { querySelector: () => ({}) })
  assert.deepEqual(calls, [])
  handleWorkspaceEscape({ ...event, target: { closest: () => ({}) } }, { ...actions, taskOpen: false }, { querySelector: () => null })
  assert.deepEqual(calls, [])
})

test('leaving protects task drafts and saves project intent before navigating', async () => {
  const calls = []
  const options = { taskDirty: true, confirmDiscard: () => false, dirty: true, save: async () => { calls.push('save'); return true }, intentDirty: true, saveLifecycle: async () => { calls.push('intent'); return true } }
  assert.equal(await savePendingWorkspaceChanges(options), false)
  assert.deepEqual(calls, [])
  options.confirmDiscard = () => true
  assert.equal(await savePendingWorkspaceChanges(options), true)
  assert.deepEqual(calls, ['save', 'intent'])
  options.saveLifecycle = async () => false
  assert.equal(await savePendingWorkspaceChanges(options), false)
})

test('new edits made during an asynchronous save keep the project open', async () => {
  let finishSave
  let current = 'first edit'
  const original = current
  const saved = new Promise((resolve) => { finishSave = resolve })
  const result = savePendingWorkspaceChanges({
    taskDirty: false, confirmDiscard: () => true,
    dirty: true, save: () => saved, intentDirty: false, saveLifecycle: async () => true,
    unchanged: () => current === original,
  })
  current = 'new edit while saving'
  finishSave(true)
  assert.equal(await result, false)
})

test('saved indication only applies to the exact fields and project sent to the server', () => {
  const fields = { id: 'p1', note: 'first', tags: 'video', status: 'active', pinned: false, hidden: false }
  const submitted = workspaceSaveSnapshot(fields)
  assert.equal(workspaceSaveIsCurrent(submitted, fields), true)
  assert.equal(workspaceSaveIsCurrent(submitted, { ...fields, note: 'new edit while saving' }), false)
  assert.equal(workspaceSaveIsCurrent(submitted, { ...fields, tags: 'video, animation' }), false)
  assert.equal(workspaceSaveIsCurrent(submitted, { ...fields, id: 'p2' }), false)
  assert.equal(workspaceSaveIsCurrent(null, fields), false)
})

test('a rejected save unlocks the exit so the user can retry', async () => {
  const ref = { current: false }
  let closed = false
  assert.equal(await attemptWorkspaceLeave(ref, true, async () => { throw new Error('network error') }, () => { closed = true }), false)
  assert.equal(ref.current, false)
  assert.equal(closed, false)
  assert.equal(await attemptWorkspaceLeave(ref, true, async () => true, () => { closed = true }), true)
  assert.equal(closed, true)
})

test('switching projects respects cancellation and save failure before opening the destination', async () => {
  const calls = []
  const ref = { current: false }
  const open = () => calls.push('open')
  assert.equal(await guardProjectSwitch(ref, { dirty: true, save: async () => true }, () => false, open), false)
  assert.equal(await guardProjectSwitch(ref, { dirty: true, save: async () => false }, () => true, open), false)
  assert.deepEqual(calls, [])
  assert.equal(await guardProjectSwitch(ref, { dirty: true, save: async () => true }, () => true, open), true)
  assert.deepEqual(calls, ['open'])
  assert.equal(ref.current, false)
})

test('history back restores the project before confirmation, and cancel keeps it open', async () => {
  const origin = { wbAtlasHistory: { session: 'test', index: 2 }, dshWorkbench: { projectId: 'p1' } }
  const destination = { wbAtlasHistory: { session: 'test', index: 1 } }
  const calls = []
  const process = createProjectPopGuard({
    history: { go: (n) => calls.push(['go', n]) },
    getCurrent: () => ({ state: origin, route: { name: 'project', projectId: 'p1' } }),
    getGuard: () => ({ dirty: true, save: async () => { calls.push(['save']); return true } }),
    confirm: () => { calls.push(['confirm']); return false },
    apply: () => calls.push(['apply']),
  })
  await process(destination)
  assert.deepEqual(calls, [['go', 1]])
  await process(origin)
  assert.deepEqual(calls, [['go', 1], ['confirm']])
})

test('history navigation within the same project changes chapter without triggering leave protection', async () => {
  const target = { wbAtlasHistory: { session: 'test', index: 1 }, dshWorkbench: { projectId: 'p1', tab: 'sessions' } }
  const calls = []
  const process = createProjectPopGuard({
    history: { go: (n) => calls.push(['go', n]) },
    getCurrent: () => ({ state: { wbAtlasHistory: { session: 'test', index: 2 } }, route: { name: 'project', projectId: 'p1' } }),
    getGuard: () => ({ dirty: true, save: async () => { calls.push(['save']); return true } }),
    confirm: () => { calls.push(['confirm']); return true },
    apply: (state) => calls.push(['apply', state]),
  })
  await process(target)
  assert.deepEqual(calls, [['apply', target]])
})

test('history save failure remains on the project; success replays the requested jump once', async () => {
  for (const succeeds of [false, true]) {
    const origin = { wbAtlasHistory: { session: 'test', index: 3 }, dshWorkbench: { projectId: 'p1' } }
    const destination = { wbAtlasHistory: { session: 'test', index: 1 } }
    const calls = []
    const process = createProjectPopGuard({
      history: { go: (n) => calls.push(['go', n]) },
      getCurrent: () => ({ state: origin, route: { name: 'project', projectId: 'p1' } }),
      getGuard: () => ({ dirty: true, save: async () => { calls.push(['save']); return succeeds } }),
      confirm: () => true,
      apply: (state) => calls.push(['apply', state]),
    })
    await process(destination)
    await process(origin)
    assert.deepEqual(calls.slice(0, 2), [['go', 2], ['save']])
    if (succeeds) {
      assert.deepEqual(calls[2], ['go', -2])
      await process(destination)
      assert.deepEqual(calls[3], ['apply', destination])
    } else assert.equal(calls.length, 2)
  }
})

test('unknown history entries restore a same-URL project copy and replay only after saving', async () => {
  const origin = { dshWorkbench: { projectId: 'p1' } }
  const calls = []
  const process = createProjectPopGuard({
    history: { pushState: (...args) => calls.push(['push', ...args]), back: () => calls.push(['back']) },
    getCurrent: () => ({ state: origin, url: 'http://localhost/', route: { name: 'project', projectId: 'p1' } }),
    getGuard: () => ({ dirty: true, save: async () => true }), confirm: () => true,
    apply: (state) => calls.push(['apply', state]),
  })
  await process(null)
  assert.deepEqual(calls, [['push', origin, '', 'http://localhost/'], ['back']])
  await process(null)
  assert.deepEqual(calls[2], ['apply', null])
})

test('additional back navigation while a save is pending is restored before replay', async () => {
  const origin = { wbAtlasHistory: { session: 'test', index: 2 }, dshWorkbench: { projectId: 'p1' } }
  const destination = { wbAtlasHistory: { session: 'test', index: 1 } }
  const calls = []
  let finishSave
  const save = new Promise((resolve) => { finishSave = resolve })
  const process = createProjectPopGuard({
    history: { go: (n) => calls.push(['go', n]) },
    getCurrent: () => ({ state: origin, route: { name: 'project', projectId: 'p1' } }),
    getGuard: () => ({ dirty: true, save: () => save }), confirm: () => true,
    apply: (state) => calls.push(['apply', state]),
  })
  await process(destination)
  const saving = process(origin)
  await process(destination)
  await process(origin)
  assert.deepEqual(calls, [['go', 1], ['go', 1]])
  finishSave(true)
  await saving
  assert.deepEqual(calls[2], ['go', -1])
  await process(destination)
  assert.deepEqual(calls[3], ['apply', destination])
})
