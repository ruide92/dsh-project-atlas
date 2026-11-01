import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeRuntime, normalizeRuntimeState, guessKind, runtimeIsStale,
} from '../runtime.js'

test('normalizes a project runtime into one shared vocabulary', () => {
  const runtime = normalizeRuntime({
    status: 'running',
    stage: { label: '第 3 集分镜', progress: 65 },
    stages: [
      { id: 'outline', label: '大纲', status: 'done' },
      { id: 'episode', label: '分集', status: 'running', progress: 0.65 },
      { id: 'review', label: '审稿', status: 'pending' },
    ],
    heartbeatAt: '2026-10-29T05:00:00Z',
    artifacts: [{ title: '第3集大纲', path: 'output/episode-03.md', kind: 'text' }],
    events: [{ at: '2026-10-29T05:00:00Z', type: 'artifact', title: '生成大纲' }],
  }, { source: 'manifest' })

  assert.equal(runtime.source, 'manifest')
  assert.equal(runtime.state, 'running')
  assert.equal(runtime.stage.label, '第 3 集分镜')
  assert.equal(runtime.progress, 0.65)
  assert.equal(runtime.stages.length, 3)
  assert.equal(runtime.artifacts[0].path, 'output/episode-03.md')
  assert.equal(runtime.artifacts[0].kind, 'text')
  assert.equal(runtime.events[0].title, '生成大纲')
})

test('maps common state aliases and rejects unknown values', () => {
  assert.equal(normalizeRuntimeState('进行中'), 'running')
  assert.equal(normalizeRuntimeState('needs_review'), 'waiting')
  assert.equal(normalizeRuntimeState('succeeded'), 'done')
  assert.equal(normalizeRuntimeState('not-a-state', 'unknown'), 'unknown')
})

test('does not infer runtime readiness from source or discovered artifacts', () => {
  const artifact = { path: 'output/example.png', kind: 'image' }
  for (const source of ['none', 'manifest', 'status', 'convention']) {
    const missing = normalizeRuntime({ artifacts: [artifact] }, { source })
    assert.equal(missing.state, 'unknown', `${source} without a state`)
    assert.equal(missing.artifacts[0].path, artifact.path)
    assert.equal(normalizeRuntime({ state: 'not-a-state' }, { source }).state, 'unknown', `${source} with an invalid state`)
  }

  // An explicit state remains an explicit state; callers must not synthesize
  // readiness based only on discovered files.
  assert.equal(normalizeRuntime({ state: 'ready', artifacts: [artifact] }, { source: 'convention' }).state, 'ready')
  assert.equal(normalizeRuntime({ state: 'running' }, { source: 'convention' }).state, 'running')
})

test('preserves explicitly reported runtime states from manifests and status files', () => {
  for (const source of ['manifest', 'status']) {
    for (const state of ['unknown', 'ready', 'running', 'waiting', 'blocked', 'failed', 'done']) {
      assert.equal(normalizeRuntime({ state }, { source }).state, state, `${source}: ${state}`)
    }
    assert.equal(normalizeRuntime({ status: 'idle' }, { source }).state, 'ready')
  }
})

test('understands percentage progress and percentage stage progress', () => {
  const runtime = normalizeRuntime({ state: 'running', progress: 42, stage: { progress: 0.7 } })
  assert.equal(runtime.progress, 0.7)
  assert.equal(runtime.stage.progress, 0.7)
  assert.equal(runtime.stage.status, 'running')
})

test('classifies artifact kinds by extension', () => {
  assert.equal(guessKind('a/b/cover.PNG'), 'image')
  assert.equal(guessKind('render.mp4'), 'video')
  assert.equal(guessKind('script.md'), 'text')
  assert.equal(guessKind('result.json'), 'data')
  assert.equal(guessKind('unknown.bin'), 'file')
})

test('keeps only safe artifact link schemes', () => {
  const runtime = normalizeRuntime({
    artifacts: [
      { path: 'a.md', url: 'javascript:alert(1)' },
      { path: 'b.md', url: 'data:text/html,<script>alert(1)</script>' },
      { path: 'c.md', url: 'https://example.com/artifact.png' },
      { path: 'd.md', url: '/dsh-workbench/api/artifact?id=x&path=y' },
    ],
  })
  assert.deepEqual(runtime.artifacts.map((artifact) => artifact.url), [
    '', '', 'https://example.com/artifact.png', '/dsh-workbench/api/artifact?id=x&path=y',
  ])
})

test('marks old heartbeats as stale but keeps unknown/ready quiet', () => {
  const old = normalizeRuntime({ state: 'running', heartbeatAt: '2020-01-01T00:00:00Z' })
  assert.equal(runtimeIsStale(old, Date.parse('2026-10-29T00:00:00Z')), true)
  const ready = normalizeRuntime({ state: 'ready' })
  assert.equal(runtimeIsStale(ready, Date.parse('2026-10-29T00:00:00Z')), false)
  const done = normalizeRuntime({ state: 'done', heartbeatAt: '2020-01-01T00:00:00Z' })
  assert.equal(runtimeIsStale(done, Date.parse('2026-10-29T00:00:00Z')), false)
})
