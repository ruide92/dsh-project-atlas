import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(path.join(path.resolve(process.env.ATLAS_PREVIEW_DEPS || '.'), 'package.json'))
let hasDependencies = true
try { for (const name of ['react/package.json', 'react-dom/package.json', 'scheduler/package.json']) require.resolve(name) } catch { hasDependencies = false }

test('preview serves the real client and synthetic data only, and rejects mutations', { skip: !hasDependencies, timeout: 10000 }, async () => {
  const child = spawn(process.execPath, ['dev/preview.mjs'], { cwd: path.resolve('.'), env: { ...process.env, ATLAS_PREVIEW_PORT: '0', ATLAS_PREVIEW_SAVE_MODE: 'readonly', ATLAS_PREVIEW_SAVE_DELAY_MS: '0', ATLAS_PREVIEW_CLIENT_FILE: '' }, stdio: ['ignore', 'pipe', 'pipe'] })
  try {
    const [chunk] = await once(child.stdout, 'data')
    const url = String(chunk).match(/http:\/\/127\.0\.0\.1:\d+\//)?.[0]
    assert.ok(url, 'server must report its local URL')
    const request = (p, options) => fetch(new URL(p, url), options)
    assert.equal((await request('/')).status, 200)
    assert.match(await (await request('/client.js')).text(), /window\.__ModuleLoader__/)
    const state = await (await request('/dsh-workbench/api/state')).json()
    assert.equal(state.ready, true)
    assert.equal(state.projects.length, 12)
    assert.ok(state.projects.every((p) => p.id.startsWith('example-')))
    assert.equal((await request('/dsh-workbench/api/open', { method: 'POST' })).status, 405)
    assert.equal((await request('/package.json')).status, 404)
  } finally { child.kill() }
})

test('opt-in memory saves touch synthetic projects only and reset on restart', { skip: !hasDependencies, timeout: 10000 }, async () => {
  async function start() {
    const child = spawn(process.execPath, ['dev/preview.mjs'], { cwd: path.resolve('.'), env: { ...process.env, ATLAS_PREVIEW_PORT: '0', ATLAS_PREVIEW_SAVE_MODE: 'memory', ATLAS_PREVIEW_SAVE_DELAY_MS: '0', ATLAS_PREVIEW_CLIENT_FILE: path.resolve('client.js') }, stdio: ['ignore', 'pipe', 'pipe'] })
    const [chunk] = await once(child.stdout, 'data')
    const url = String(chunk).match(/http:\/\/127\.0\.0\.1:\d+\//)?.[0]
    assert.ok(url)
    return { child, request: (p, options) => fetch(new URL(p, url), options) }
  }
  let instance = await start()
  try {
    assert.match(await (await instance.request('/')).text(), /外部指定客户端.*仅内存/)
    const post = (payload) => instance.request('/dsh-workbench/api/override', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
    assert.equal((await post({ id: 'real-project', patch: { note: 'should not save' } })).status, 400)
    assert.equal((await post({ id: 'example-1', patch: { path: 'C:/test' } })).status, 400)
    assert.equal((await instance.request('/dsh-workbench/api/open', { method: 'POST' })).status, 405)
    assert.equal((await instance.request('/dsh-workbench/api/override', { method: 'POST', body: 'not json' })).status, 415)
    const result = await post({ id: 'example-1', patch: { note: 'temporary', intent: 'synthetic intent', lifecycle: 'incubating' } })
    assert.equal(result.status, 200)
    const state = await (await instance.request('/dsh-workbench/api/state')).json()
    assert.equal(state.projects[0].note, 'temporary')
    assert.equal(state.projects[0].identity.intent, 'synthetic intent')
    assert.equal(state.projects[0].lifecycle, 'incubating')
    instance.child.kill()
    instance = await start()
    const reset = await (await instance.request('/dsh-workbench/api/state')).json()
    assert.equal(reset.projects[0].note, undefined)
  } finally { instance.child.kill() }
})

test('failure mode simulates a rejected save without mutating data', { skip: !hasDependencies, timeout: 10000 }, async () => {
  const child = spawn(process.execPath, ['dev/preview.mjs'], { cwd: path.resolve('.'), env: { ...process.env, ATLAS_PREVIEW_PORT: '0', ATLAS_PREVIEW_SAVE_MODE: 'failure', ATLAS_PREVIEW_SAVE_DELAY_MS: '0', ATLAS_PREVIEW_CLIENT_FILE: '' }, stdio: ['ignore', 'pipe', 'pipe'] })
  try {
    const [chunk] = await once(child.stdout, 'data')
    const url = String(chunk).match(/http:\/\/127\.0\.0\.1:\d+\//)?.[0]
    assert.ok(url)
    const res = await fetch(new URL('/dsh-workbench/api/override', url), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'example-1', patch: { note: 'test' } }) })
    assert.equal(res.status, 503)
    const state = await (await fetch(new URL('/dsh-workbench/api/state', url))).json()
    assert.equal(state.projects[0].note, undefined)
  } finally { child.kill() }
})

test('optional save delay keeps a synthetic save pending without blocking reads', { skip: !hasDependencies, timeout: 10000 }, async () => {
  const child = spawn(process.execPath, ['dev/preview.mjs'], { cwd: path.resolve('.'), env: { ...process.env, ATLAS_PREVIEW_PORT: '0', ATLAS_PREVIEW_SAVE_MODE: 'memory', ATLAS_PREVIEW_SAVE_DELAY_MS: '400', ATLAS_PREVIEW_CLIENT_FILE: '' }, stdio: ['ignore', 'pipe', 'pipe'] })
  try {
    const [chunk] = await once(child.stdout, 'data')
    const url = String(chunk).match(/http:\/\/127\.0\.0\.1:\d+\//)?.[0]
    assert.ok(url)
    const pending = fetch(new URL('/dsh-workbench/api/override', url), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'example-1', patch: { note: 'delayed' } }) })
    const before = await (await fetch(new URL('/dsh-workbench/api/state', url))).json()
    assert.equal(before.projects[0].note, undefined)
    assert.equal((await pending).status, 200)
    const after = await (await fetch(new URL('/dsh-workbench/api/state', url))).json()
    assert.equal(after.projects[0].note, 'delayed')
  } finally { child.kill() }
})

test('save delay rejects negative, fractional, non-numeric and over-limit values', { skip: !hasDependencies, timeout: 10000 }, () => {
  for (const value of ['-1', '0.5', 'NaN', '5001']) {
    const result = spawnSync(process.execPath, ['dev/preview.mjs'], { cwd: path.resolve('.'), env: { ...process.env, ATLAS_PREVIEW_SAVE_MODE: 'memory', ATLAS_PREVIEW_SAVE_DELAY_MS: value, ATLAS_PREVIEW_CLIENT_FILE: '' }, encoding: 'utf8', timeout: 3000 })
    assert.notEqual(result.status, 0, `must reject ${value}`)
    assert.match(result.stderr, /integer between 0 and 5000/)
  }
})

test('the upper delay bound is accepted', { skip: !hasDependencies, timeout: 10000 }, async () => {
  const child = spawn(process.execPath, ['dev/preview.mjs'], { cwd: path.resolve('.'), env: { ...process.env, ATLAS_PREVIEW_PORT: '0', ATLAS_PREVIEW_SAVE_MODE: 'memory', ATLAS_PREVIEW_SAVE_DELAY_MS: '5000', ATLAS_PREVIEW_CLIENT_FILE: '' }, stdio: ['ignore', 'pipe', 'pipe'] })
  try {
    const [chunk] = await once(child.stdout, 'data')
    assert.match(String(chunk), /http:\/\/127\.0\.0\.1:\d+\//)
  } finally { child.kill() }
})
