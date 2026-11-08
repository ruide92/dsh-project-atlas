import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const source = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
const start = source.indexOf('    function mergeProjectFolders')
const end = source.indexOf('    function useProjectMedia', start)
assert.ok(start >= 0 && end > start, 'project state helpers were not found')
const helpers = vm.runInNewContext(`(() => {
  ${source.slice(start, end)}
  return { mergeProjectFolders, recountProjectStats }
})()`, {})
const { mergeProjectFolders, recountProjectStats } = helpers

test('linking a folder keeps the main folder and removes duplicate links', () => {
  const project = {
    id: 'p1', path: 'C:\\work\\demo', folders: [{ path: 'C:\\work\\demo', role: 'main', primary: true }], folderCount: 1,
  }
  const linked = [
    { path: 'C:\\work\\demo', role: 'code' },
    { path: 'C:\\work\\renders', role: 'output' },
    { path: 'c:/work/renders/', role: 'reference' },
  ]
  const next = mergeProjectFolders(project, linked)
  assert.equal(next.folderCount, 2)
  assert.equal(JSON.stringify(next.folders.map((folder) => [folder.path, folder.role, folder.primary])), JSON.stringify([
    ['C:\\work\\demo', 'main', true],
    ['C:\\work\\renders', 'output', false],
  ]))
  assert.equal(project.folderCount, 1, 'the input project must not be mutated')
})

test('project counters follow status and visibility changes without losing server stats', () => {
  const projects = [
    { id: 'a', topLevel: true, status: 'active', sizeBytes: 100, sessionCount: 2, folderCount: 1 },
    { id: 'b', topLevel: true, status: 'archived', sizeBytes: 50, sessionCount: 0, folderCount: 3 },
    { id: 'hidden', topLevel: true, hidden: true, status: 'active', sizeBytes: 999 },
    { id: 'noise', topLevel: true, noise: true, status: 'active', sizeBytes: 999 },
    { id: 'container', topLevel: true, container: true, status: 'active', sizeBytes: 999 },
    { id: 'child', topLevel: false, status: 'active', sizeBytes: 999 },
  ]
  const stats = recountProjectStats(projects, { diskFree: 123, totalBytesAll: 999 })
  assert.equal(stats.projectCount, 2)
  assert.equal(stats.active, 1)
  assert.equal(stats.archived, 1)
  assert.equal(stats.totalBytes, 150)
  assert.equal(stats.folderCount, 4)
  assert.equal(stats.sessionCount, 2)
  assert.equal(stats.diskFree, 123, 'unrelated server stats must survive')
  assert.equal(stats.totalBytesAll, 999)
})
