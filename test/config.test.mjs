import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-config-'))

test('public defaults scan nothing and keep destructive actions off', async () => {
  const home = path.join(temp, 'home')
  fs.mkdirSync(home)
  process.env.DSH_HOME = home
  delete process.env.DSH_WORKBENCH_CONFIG
  const mod = await import(`${pathToFileURL(path.resolve('config.js')).href}?defaults=${Date.now()}`)
  assert.deepEqual(mod.DEFAULT_CONFIG.roots, [])
  assert.equal(mod.DEFAULT_CONFIG.allowDelete, false)
  const config = mod.loadConfig()
  assert.deepEqual(config.roots, [])
  assert.equal(config.allowDelete, false)
  assert.equal(config.dshSessionsDir, path.join(home, 'sessions'))
  assert.equal(config._warnings.length, 0)
})

test('a valid explicit config overrides roots, disables skills and clamps depth', async () => {
  const home = path.join(temp, 'custom-home')
  const configFile = path.join(temp, 'atlas.json')
  fs.mkdirSync(home)
  fs.writeFileSync(configFile, JSON.stringify({
    dshHome: home,
    roots: [{ path: path.join(temp, 'work'), depth: 99 }],
    skillRoots: [],
    allowDelete: true,
  }), 'utf8')
  process.env.DSH_HOME = home
  process.env.DSH_WORKBENCH_CONFIG = configFile
  const mod = await import(`${pathToFileURL(path.resolve('config.js')).href}?valid=${Date.now()}`)
  const config = mod.loadConfig()
  assert.equal(config.roots.length, 1)
  assert.equal(config.roots[0].depth, 12)
  assert.deepEqual(config.skillRoots, [])
  assert.equal(config.allowDelete, true)
  assert.equal(config.dshSessionsDir, path.join(home, 'sessions'))
})

test('an unreadable explicit config does not fall through to another file', async () => {
  const home = path.join(temp, 'invalid-home')
  const bad = path.join(temp, 'bad.json')
  fs.mkdirSync(home)
  fs.writeFileSync(bad, '{ not json', 'utf8')
  process.env.DSH_HOME = home
  process.env.DSH_WORKBENCH_CONFIG = bad
  const mod = await import(`${pathToFileURL(path.resolve('config.js')).href}?invalid=${Date.now()}`)
  const config = mod.loadConfig()
  assert.deepEqual(config.roots, [])
  assert.equal(config._source, bad)
  assert.match(config._warnings[0], /无法读取/)
})

test.after(() => {
  delete process.env.DSH_WORKBENCH_CONFIG
  fs.rmSync(temp, { recursive: true, force: true })
})
