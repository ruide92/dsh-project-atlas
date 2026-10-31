import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

test('an empty install renders a safe empty state instead of a 500', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-empty-'))
  const previous = {
    DSH_HOME: process.env.DSH_HOME,
    DSH_WORKBENCH_DATA: process.env.DSH_WORKBENCH_DATA,
    DSH_WORKBENCH_CONFIG: process.env.DSH_WORKBENCH_CONFIG,
  }
  process.env.DSH_HOME = root
  process.env.DSH_WORKBENCH_DATA = path.join(root, 'data')
  delete process.env.DSH_WORKBENCH_CONFIG
  try {
    const mod = await import(`${pathToFileURL(path.resolve('index.js')).href}?empty=${Date.now()}`)
    const routes = new Map()
    const effect = (fn) => {
      const dispose = fn()
      return () => dispose?.()
    }
    const webServer = {
      register({ path: routePath, handler }) {
        routes.set(routePath, handler)
        return () => routes.delete(routePath)
      },
    }
    mod.apply({
      inject(names, callback) {
        if (names.includes('webServer')) callback({ webServer, effect })
        else callback({ sessionQuery: null, effect })
      },
    })
    const handler = routes.get('/dsh-workbench/api/state')
    assert.ok(handler)
    const res = {
      headersSent: false,
      writeHead(status) { this.status = status; this.headersSent = true },
      end(body) { this.body = String(body) },
      setHeader() {},
      destroy() {},
    }
    await handler({ method: 'GET', url: '/dsh-workbench/api/state', headers: { host: '127.0.0.1:1234' } }, res)
    assert.equal(res.status, 200)
    const body = JSON.parse(res.body)
    assert.equal(body.ok, true)
    assert.equal(body.ready, false)
    assert.equal(body.needsConfig, true)
    assert.deepEqual(body.projects, [])
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    await fs.rm(root, { recursive: true, force: true })
  }
})
