import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { configureSkillRoots, scanSkills, getSkillDetail, skillFileInside } from '../skills.js'

test('a SKILL.md replaced by a symlink is never returned as content', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-skill-root-'))
  const outside = path.join(root, 'outside')
  const skillDir = path.join(root, 'demo-skill')
  await fs.mkdir(outside, { recursive: true })
  await fs.mkdir(skillDir, { recursive: true })
  const skillFile = path.join(skillDir, 'SKILL.md')
  const secretFile = path.join(outside, 'secret.txt')
  await fs.writeFile(secretFile, 'TOP-SECRET-CONTENT', 'utf8')
  await fs.writeFile(skillFile, '---\nname: demo-skill\ndescription: demo\n---\nnormal body', 'utf8')
  configureSkillRoots([{ key: 'fixture', label: 'Fixture', root, depth: 3, agent: 'test', scope: 'user' }])
  await scanSkills({ force: true })
  const row = (await scanSkills({ force: true })).skills.find((item) => item.folder === 'demo-skill')
  assert.ok(row, 'fixture skill was not scanned')
  assert.match((await getSkillDetail(row.id)).content, /normal body/)

  try {
    await fs.rm(skillFile)
    await fs.symlink(secretFile, skillFile, 'file')
  } catch (error) {
    await fs.rm(root, { recursive: true, force: true })
    t.skip(`file symlinks are unavailable: ${error.code || error.message}`)
    return
  }
  try {
    const detail = await getSkillDetail(row.id)
    assert.equal(detail.content, '')
    assert.match(detail.error, /技能文件|越界/)
    assert.doesNotMatch(detail.content, /TOP-SECRET/)
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('a real file behind a junction is rejected even when lstat sees a file', async (t) => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-skill-parent-'))
  const root = path.join(base, 'root')
  const outside = path.join(base, 'outside')
  await fs.mkdir(root, { recursive: true })
  await fs.mkdir(outside, { recursive: true })
  const outsideFile = path.join(outside, 'SKILL.md')
  const insideFile = path.join(root, 'SKILL.md')
  await fs.writeFile(outsideFile, 'outside secret', 'utf8')
  await fs.writeFile(insideFile, 'inside skill', 'utf8')
  try {
    await fs.symlink(outside, path.join(root, 'linked'), 'junction')
  } catch (error) {
    await fs.rm(base, { recursive: true, force: true })
    t.skip(`directory links are unavailable: ${error.code || error.message}`)
    return
  }
  try {
    assert.equal(await skillFileInside(insideFile, root), true)
    assert.equal(await skillFileInside(path.join(root, 'linked', 'SKILL.md'), root), false)
  } finally {
    await fs.rm(base, { recursive: true, force: true })
  }
})

test('symlinked skill directories are not traversed', async (t) => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-skill-dir-'))
  const root = path.join(base, 'root')
  const outside = path.join(base, 'outside-skill')
  await fs.mkdir(root, { recursive: true })
  await fs.mkdir(outside, { recursive: true })
  await fs.writeFile(path.join(outside, 'SKILL.md'), '---\nname: outside\n---\nsecret', 'utf8')
  try {
    await fs.symlink(outside, path.join(root, 'linked-skill'), 'junction')
  } catch (error) {
    await fs.rm(base, { recursive: true, force: true })
    t.skip(`directory links are unavailable: ${error.code || error.message}`)
    return
  }
  configureSkillRoots([{ key: 'fixture', label: 'Fixture', root, depth: 3, agent: 'test', scope: 'user' }])
  try {
    const result = await scanSkills({ force: true })
    assert.equal(result.skills.some((item) => item.folder === 'outside-skill'), false)
  } finally {
    await fs.rm(base, { recursive: true, force: true })
  }
})
