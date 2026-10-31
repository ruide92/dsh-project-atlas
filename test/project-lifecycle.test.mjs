import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeLifecycle,
  lifecycleOf,
  lineageOf,
  cleanupSuggestion,
} from '../project-lifecycle.js'

test('lifecycle prefers manual, then manifest, then conservative inference', () => {
  assert.equal(normalizeLifecycle('长期'), 'persistent')
  assert.equal(lifecycleOf({ name: 'x', hasGit: true, codeFiles: 20 }).value, 'incubating')
  assert.equal(lifecycleOf({ name: 'x', identity: { lifecycle: 'persistent', intent: '长期维护' } }).source, 'manifest')
  assert.equal(lifecycleOf({ name: 'x' }, { lifecycle: 'temporary' }).source, 'manual')
  assert.equal(lifecycleOf({ name: 'tmp-chart', path: 'C:\\tmp-chart', codeFiles: 1, hasGit: false }).value, 'temporary')
  assert.equal(lifecycleOf({ name: 'SceneB_20260101', assetProject: true, codeFiles: 0, hasGit: false, sessions: [] }).value, 'temporary')
  assert.equal(lifecycleOf({ name: 'SceneB_20260101', assetProject: true, codeFiles: 0, hasGit: false, sessions: [{ id: 's1' }, { id: 's2' }] }).value, 'unclassified')
  assert.equal(lifecycleOf({ name: 'ordinary-folder' }).value, 'unclassified')
})

test('lineage marks only a confirmed main session as main', () => {
  const project = {
    sessions: [
      { id: 'old', updatedAt: '2026-01-01T00:00:00Z' },
      { id: 'new', updatedAt: '2026-02-01T00:00:00Z', parentSessionId: 'old' },
      { id: 'side', updatedAt: '2026-03-01T00:00:00Z' },
    ],
  }
  const proposed = lineageOf(project)
  assert.equal(proposed.rootConfirmed, false)
  assert.equal(proposed.items.find((item) => item.id === 'old').role, 'main-candidate')
  assert.equal(proposed.items.find((item) => item.id === 'new').role, 'continuation')
  assert.equal(proposed.items.find((item) => item.id === 'side').role, 'unassigned')

  const confirmed = lineageOf(project, { rootSessionId: 'old', continuations: ['side'] })
  assert.equal(confirmed.rootConfirmed, true)
  assert.equal(confirmed.items.find((item) => item.id === 'old').role, 'main')
  assert.equal(confirmed.items.find((item) => item.id === 'new').role, 'continuation')
  assert.equal(confirmed.items.find((item) => item.id === 'side').role, 'continuation')
})

test('cleanup is a suggestion and never applies to persistent work', () => {
  assert.equal(cleanupSuggestion({ lastActivity: '2020-01-01T00:00:00Z' }, { lifecycle: 'persistent' }), null)
  const temp = cleanupSuggestion({ lastActivity: '2020-01-01T00:00:00Z', created: '2020-01-01T00:00:00Z' }, { lifecycle: 'temporary' })
  assert.equal(temp.reason, 'expired')
})
