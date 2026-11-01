import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const source = await readFile(new URL('../client.js', import.meta.url), 'utf8')
const start = source.indexOf('    const PROJECT_MEDIA_TTL')
const end = source.indexOf('    async function copyText', start)
assert.ok(start >= 0 && end > start, 'project media cache code was not found')

function harness() {
  const requests = []
  const fetch = (url) => new Promise((resolve, reject) => requests.push({ url, resolve, reject }))
  const create = vm.runInNewContext(`(() => { const API = '/dsh-workbench/api'; ${source.slice(start, end)}; return { loadProjectMedia, invalidateProjectMedia } })`, { fetch })
  return { ...create(), requests }
}

function ok(request, data) {
  request.resolve({ ok: true, json: async () => data })
}

test('a slower older forced request never overwrites the newer cache', async () => {
  const h = harness()
  const old = h.loadProjectMedia('A', true)
  const latest = h.loadProjectMedia('A', true)
  ok(h.requests[1], { project: 'A', version: 2 })
  await latest
  ok(h.requests[0], { project: 'A', version: 1 })
  await old
  assert.equal((await h.loadProjectMedia('A')).version, 2)
  assert.equal(h.requests.length, 2)
})

test('invalidation prevents a delayed response from repopulating the cache', async () => {
  const h = harness()
  const old = h.loadProjectMedia('A')
  h.invalidateProjectMedia('A')
  ok(h.requests[0], { version: 1 })
  await old
  const fresh = h.loadProjectMedia('A')
  assert.equal(h.requests.length, 2)
  ok(h.requests[1], { version: 2 })
  assert.equal((await fresh).version, 2)
})

test('failed requests use only a current cache, never the invalidated snapshot', async () => {
  const h = harness()
  const prime = h.loadProjectMedia('A')
  ok(h.requests[0], { version: 1 })
  await prime
  const retry = h.loadProjectMedia('A', true)
  h.requests[1].reject(new Error('network unavailable'))
  const stale = await retry
  assert.equal(stale.version, 1)
  assert.equal(stale.stale, true)
  const after = h.loadProjectMedia('A', true)
  const rejected = assert.rejects(after, /network unavailable/)
  h.invalidateProjectMedia('A')
  h.requests[2].reject(new Error('network unavailable'))
  await rejected
  const httpFailure = h.loadProjectMedia('A')
  const httpRejected = assert.rejects(httpFailure, /denied/)
  h.requests[3].resolve({ ok: false, status: 403, json: async () => ({ error: 'denied' }) })
  await httpRejected
  const retryAfterHttp = h.loadProjectMedia('A')
  assert.equal(h.requests.length, 5)
  ok(h.requests[4], { version: 3 })
  assert.equal((await retryAfterHttp).version, 3)
})

test('invalidating one project leaves another project and its pending request intact', async () => {
  const h = harness()
  const a = h.loadProjectMedia('A')
  const b = h.loadProjectMedia('B')
  h.invalidateProjectMedia('A')
  ok(h.requests[1], { project: 'B' })
  await b
  ok(h.requests[0], { project: 'A' })
  await a
  assert.equal((await h.loadProjectMedia('B')).project, 'B')
  const nextA = h.loadProjectMedia('A')
  assert.equal(h.requests.length, 3)
  ok(h.requests[2], { project: 'A2' })
  assert.equal((await nextA).project, 'A2')
})
