import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { collectCandidates, DEFAULT_CONFIG } from '../scanner.js'

test('a configured scan root is never returned as a project', async () => {
  const root = await fs.mkdtemp(path.join(process.cwd(), '.wb-root-test-'))
  try {
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'workspace-root' }))
    await fs.mkdir(path.join(root, 'alpha'))
    await fs.mkdir(path.join(root, 'beta'))
    await fs.writeFile(path.join(root, 'alpha', 'package.json'), JSON.stringify({ name: 'alpha' }))
    await fs.writeFile(path.join(root, 'beta', 'package.json'), JSON.stringify({ name: 'beta' }))

    const found = await collectCandidates(root, 2, [], { ...DEFAULT_CONFIG, roots: [] })
    const paths = found.map((item) => path.resolve(item.path))
    assert.ok(!paths.includes(path.resolve(root)), 'the scan root must not be a project')
    assert.ok(paths.includes(path.resolve(root, 'alpha')), 'direct child alpha must be found')
    assert.ok(paths.includes(path.resolve(root, 'beta')), 'direct child beta must be found')
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
