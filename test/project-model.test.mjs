import test from 'node:test'
import assert from 'node:assert/strict'
import { buildProjectView, projectStats } from '../project-model.js'

const project = (id, p, extra = {}) => ({
  id,
  name: p.split('\\').pop(),
  path: p,
  displayName: p.split('\\').pop(),
  markers: [],
  hasGit: false,
  hasDsh: false,
  sizeBytes: 10,
  lastActivity: '2026-01-02T00:00:00.000Z',
  ...extra,
})

test('workspace root is not a project and its direct children are promoted', () => {
  const raw = [
    project('root', 'C:\\Projects', { hasDsh: true }),
    project('a', 'C:\\Projects\\alpha', { hasGit: true, markers: ['package.json'] }),
    project('b', 'C:\\Projects\\beta', { hasGit: true }),
  ]
  const view = buildProjectView(raw)
  const root = view.find((p) => p.id === 'root')
  assert.equal(root.container, true)
  assert.equal(root.topLevel, false)
  assert.equal(view.find((p) => p.id === 'a').topLevel, true)
  assert.equal(view.find((p) => p.id === 'b').topLevel, true)
  assert.equal(view.find((p) => p.id === 'a').promotedFrom, 'root')
})

test('an asset collection is a container and its dated runs are projects', () => {
  const raw = [
    project('comfy', 'C:\\renders', { assetContainer: true }),
    project('run1', 'C:\\renders\\SceneA_20260101', { assetProject: true }),
    project('run2', 'C:\\renders\\SceneB_20260101', { assetProject: true }),
  ]
  const view = buildProjectView(raw)
  assert.equal(view.find((p) => p.id === 'comfy').container, true)
  assert.equal(view.find((p) => p.id === 'run1').topLevel, true)
  assert.equal(view.find((p) => p.id === 'run1').promotedFrom, 'comfy')
})

test('a real project with a manifest stays a project even with subfolders', () => {
  const raw = [
    project('app', 'C:\\apps\\demo', { markers: ['package.json'] }),
    project('one', 'C:\\apps\\demo\\packages\\one'),
    project('two', 'C:\\apps\\demo\\packages\\two'),
  ]
  const view = buildProjectView(raw)
  assert.equal(view.find((p) => p.id === 'app').container, false)
  assert.equal(view.find((p) => p.id === 'one').topLevel, false)
})

test('temporary folder names are noise', () => {
  const view = buildProjectView([project('n', 'C:\\node_modules\pkg', { hasDsh: true })])
  assert.equal(view[0].noise, true)
})

test('folder links are deduplicated and counted', () => {
  const raw = [project('a', 'C:\\apps\\a', { markers: ['package.json'] })]
  const view = buildProjectView(raw, {
    a: { folders: [{ path: 'C:\\outputs\\a', role: 'output' }, { path: 'C:\\apps\\a', role: 'main' }] },
  })
  assert.equal(view[0].folderCount, 2)
  assert.deepEqual(view[0].folders.map((f) => f.role), ['main', 'output'])
})

test('a linked folder is part of one project, not a separate project row', () => {
  const raw = [
    project('demo', 'C:\\\\renders\\\\DemoRenders_20260101', { markers: ['package.json'] }),
    project('run-a', 'C:\\\\renders\\\\DemoRenders_20260101\\\\run-a', { assetProject: true }),
    project('run-b', 'C:\\\\renders\\\\DemoRenders_20260101\\\\run-b', { assetProject: true }),
  ]
  const view = buildProjectView(raw, {
    demo: {
      folders: [
        { path: 'C:\\\\renders\\\\DemoRenders_20260101\\\\run-a', role: 'reference' },
        { path: 'C:\\\\renders\\\\DemoRenders_20260101\\\\run-b', role: 'reference' },
      ],
    },
  })
  assert.equal(view.find((p) => p.id === 'demo').topLevel, true)
  assert.equal(view.find((p) => p.id === 'demo').folderCount, 3)
  assert.equal(view.find((p) => p.id === 'run-a').topLevel, false)
  assert.equal(view.find((p) => p.id === 'run-a').mergedInto, 'demo')
  assert.equal(view.find((p) => p.id === 'run-b').mergedInto, 'demo')
  assert.equal(projectStats(view).projectCount, 1)
})

test('sessions attach to the deepest matching project folder', () => {
  const raw = [
    project('root', 'C:\\Projects', { hasDsh: true }),
    project('a', 'C:\\Projects\\alpha', { hasGit: true }),
    project('b', 'C:\\Projects\\alpha\\sub', { hasGit: true }),
  ]
  const view = buildProjectView(raw, {}, [
    { id: 's1', title: 'first', cwd: 'C:\\Projects\\alpha', updatedAt: '2026-02-01T00:00:00Z' },
    { id: 's2', title: 'second', cwd: 'C:\\Projects\\alpha\\sub', updatedAt: '2026-03-01T00:00:00Z' },
  ])
  assert.equal(view.find((p) => p.id === 'a').sessionCount, 1)
  assert.equal(view.find((p) => p.id === 'b').sessionCount, 1)
  assert.equal(view.find((p) => p.id === 'b').lastSessionTitle, 'second')
})

test('sessions in a linked folder belong to the linked project', () => {
  const raw = [project('draw', 'C:\\draw\\workflow', { markers: ['package.json'] })]
  const view = buildProjectView(raw, {
    draw: { folders: [{ path: 'C:\\draw\\outputs', role: 'output' }] },
  }, [
    { id: 's1', title: 'render', cwd: 'C:\\draw\\outputs\\2026-01', updatedAt: 1767225600000 },
  ])
  assert.equal(view[0].sessionCount, 1)
  assert.equal(view[0].lastSessionAt, 1767225600000)
})

test('an explicit session link attaches a workspace-root session to a project', () => {
  const raw = [
    project('root', 'C:\\Projects', { hasDsh: true }),
    project('a', 'C:\\Projects\\alpha', { hasGit: true }),
  ]
  const view = buildProjectView(raw, { a: { sessions: [{ id: 's1' }] } }, [
    { id: 's1', title: 'root chat', cwd: 'C:\\Projects', updatedAt: 1767225600000 },
  ])
  const alpha = view.find((p) => p.id === 'a')
  assert.equal(alpha.sessionCount, 1)
  assert.equal(alpha.sessions[0].manual, true)
  assert.equal(view.find((p) => p.id === 'root').sessionCount, 0)
})

test('stats use only visible real projects', () => {
  const view = buildProjectView([
    project('root', 'C:\\Projects', { hasDsh: true, status: 'active' }),
    project('a', 'C:\\Projects\\alpha', { hasGit: true, status: 'active' }),
    project('b', 'C:\\Projects\\beta', { hasGit: true, status: 'archived' }),
  ])
  const stats = projectStats(view)
  assert.equal(stats.projectCount, 2)
  assert.equal(stats.active, 1)
  assert.equal(stats.archived, 1)
})
