import test from 'node:test'
import assert from 'node:assert/strict'
import {
  activityOf,
  annotateProjects,
  duplicateCandidates,
  projectNameStem,
  projectSimilarity,
  remoteKey,
  tidySummary,
} from '../project-consolidation.js'

const base = (id, name, extra = {}) => ({
  id,
  name,
  displayName: name,
  path: `C:\\work\\${name}`,
  topLevel: true,
  markers: ['package.json'],
  git: null,
  summary: '',
  lastActivity: '2026-01-10T00:00:00.000Z',
  created: '2026-01-01T00:00:00.000Z',
  status: 'active',
  ...extra,
})

test('remoteKey normalizes https, ssh and .git forms', () => {
  assert.equal(remoteKey('https://github.com/Owner/Repo.git'), 'github.com/owner/repo')
  assert.equal(remoteKey('git@github.com:Owner/Repo.git'), 'github.com/owner/repo')
  assert.equal(remoteKey('ssh://git@github.com/Owner/Repo'), 'github.com/owner/repo')
})

test('projectNameStem removes copy, version and date suffixes conservatively', () => {
  assert.equal(projectNameStem('lottery_copy'), 'lottery')
  assert.equal(projectNameStem('lottery - 副本'), 'lottery')
  assert.equal(projectNameStem('彩票程序（副本）'), '彩票程序')
  assert.equal(projectNameStem('atlas-v1.3.0'), 'atlas')
  assert.equal(projectNameStem('atlas-2026-01-01'), 'atlas')
  assert.equal(projectNameStem('renew'), 'renew')
})

test('same git remote is a strong duplicate signal for differently named folders', () => {
  const a = base('a', 'atlas-main', { git: { remote: 'git@github.com:ruide92/dsh-project-atlas.git' } })
  const b = base('b', 'atlas-copy', { git: { remote: 'https://github.com/ruide92/dsh-project-atlas.git' } })
  const match = projectSimilarity(a, b)
  assert.ok(match)
  assert.ok(match.score >= 0.75)
  assert.ok(match.reasons.includes('sameRemote'))
})

test('same package name and same summary also suggest a duplicate', () => {
  const a = base('a', 'lottery-a', { packageName: 'lottery', summary: '一个用于统计和开奖提醒的彩票程序' })
  const b = base('b', 'lottery-b', { packageName: 'lottery', summary: '一个用于统计和开奖提醒的彩票程序' })
  const match = projectSimilarity(a, b)
  assert.ok(match)
  assert.ok(match.score >= 0.7)
  assert.ok(match.reasons.includes('samePackage'))
})

test('unrelated projects are not suggested', () => {
  const a = base('a', 'lottery', { summary: '彩票统计' })
  const b = base('b', 'photo-editor', { summary: '照片编辑器', markers: ['Cargo.toml'] })
  assert.equal(projectSimilarity(a, b), null)
})

test('nested folders are not duplicate candidates', () => {
  const a = base('a', 'app', { path: 'C:\\work\\app' })
  const b = base('b', 'module', { path: 'C:\\work\\app\\module', topLevel: false })
  assert.equal(projectSimilarity(a, b), null)
})

test('duplicate candidates are sorted by score and capped', () => {
  const a = base('a', 'lottery')
  const b = base('b', 'lottery-copy', { git: { remote: 'https://github.com/u/lottery.git' } })
  const c = base('c', 'lottery-old', { git: { remote: 'https://github.com/u/lottery.git' } })
  a.git = { remote: 'https://github.com/u/lottery.git' }
  const rows = duplicateCandidates(a, [a, b, c], 1)
  assert.equal(rows.length, 1)
  assert.ok(rows[0].score >= 0.8)
})

test('activity bands never turn old activity into a deletion decision', () => {
  const now = Date.parse('2026-04-01T00:00:00.000Z')
  assert.equal(activityOf({ lastActivity: '2026-03-30T00:00:00.000Z' }, now).activityBand, 'fresh')
  assert.equal(activityOf({ lastActivity: '2026-03-10T00:00:00.000Z' }, now).activityBand, 'warm')
  assert.equal(activityOf({ lastActivity: '2026-02-01T00:00:00.000Z' }, now).activityBand, 'stale')
  const old = activityOf({ lastActivity: '2025-12-01T00:00:00.000Z' }, now)
  assert.equal(old.activityBand, 'dormant')
  assert.equal(old.dormant, true)
})

test('annotateProjects adds duplicate hints without mutating input', () => {
  const a = base('a', 'lottery')
  const b = base('b', 'lottery-copy')
  a.git = { remote: 'https://github.com/u/lottery.git' }
  b.git = { remote: 'https://github.com/u/lottery.git' }
  const list = [a, b]
  const annotated = annotateProjects(list, { now: Date.parse('2026-01-11T00:00:00.000Z') })
  assert.equal(annotated[0].duplicateCount, 1)
  assert.equal(annotated[1].duplicateCount, 1)
  assert.equal(list[0].duplicateCount, undefined)
})

test('tidySummary groups duplicates and counts dormant projects once', () => {
  const a = base('a', 'lottery', { lastActivity: '2026-01-10T00:00:00.000Z' })
  const b = base('b', 'lottery-copy', { lastActivity: '2026-01-10T00:00:00.000Z' })
  const c = base('c', 'photo-editor', { lastActivity: '2025-01-01T00:00:00.000Z' })
  a.git = { remote: 'https://github.com/u/lottery.git' }
  b.git = { remote: 'https://github.com/u/lottery.git' }
  const hidden = base('d', 'lottery-hidden', { lastActivity: '2025-01-01T00:00:00.000Z', hidden: true })
  hidden.git = { remote: 'https://github.com/u/lottery.git' }
  const annotated = annotateProjects([a, b, c, hidden], { now: Date.parse('2026-04-01T00:00:00.000Z') })
  const summary = tidySummary(annotated, Date.parse('2026-04-01T00:00:00.000Z'))
  assert.equal(summary.duplicateGroups, 1)
  assert.equal(summary.duplicateProjects, 2)
  assert.equal(summary.dormantProjects, 1)
  assert.equal(summary.missingIntent, 0)
  assert.deepEqual(annotated.find((project) => project.id === 'd').duplicateCandidates, [])
  assert.equal(summary.total, 2)
})
