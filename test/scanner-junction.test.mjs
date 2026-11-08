import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { collectCandidates } from '../scanner.js'

test('project scanning does not descend through a Windows junction', async (t) => {
  const base = await fs.mkdtemp(path.join(process.cwd(), '.wb-scan-junction-'))
  const root = path.join(base, 'root')
  const outside = path.join(base, 'outside-project')
  await fs.mkdir(root, { recursive: true })
  await fs.mkdir(outside, { recursive: true })
  await fs.writeFile(path.join(outside, 'package.json'), '{"name":"outside"}', 'utf8')
  await fs.mkdir(path.join(root, 'inside-project'), { recursive: true })
  await fs.writeFile(path.join(root, 'inside-project', 'package.json'), '{"name":"inside"}', 'utf8')
  try {
    await fs.symlink(outside, path.join(root, 'linked-project'), 'junction')
  } catch (error) {
    await fs.rm(base, { recursive: true, force: true })
    t.skip(`directory links are unavailable: ${error.code || error.message}`)
    return
  }
  try {
    const warnings = []
    const found = await collectCandidates(root, 4, warnings, { excludeGlobs: [], assetContainerMarkers: [] })
    const names = found.map((item) => path.basename(item.path).toLowerCase())
    assert.equal(names.includes('inside-project'), true, 'normal child project was not found')
    assert.equal(names.includes('outside-project'), false, 'junction target leaked into the scan')
    assert.equal(found.some((item) => item.path.toLowerCase().includes('linked-project')), false)
  } finally {
    await fs.rm(base, { recursive: true, force: true })
  }
})
