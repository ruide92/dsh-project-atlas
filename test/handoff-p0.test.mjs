import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { readTruthDocs } from '../truth-docs.js'

function loadClientHandoff() {
  const code = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  const React = {
    createElement: () => ({}),
    Fragment: {},
    useState: () => [],
    useEffect: () => {},
    useMemo: () => null,
    useRef: () => ({}),
    useCallback: (fn) => fn,
  }
  const window = {
    __DSH_WORKBENCH_TEST__: {},
    __ModuleLoader__: {
      load(spec) {
        spec.factory((name) => name === 'react' ? React : {})
      },
    },
  }
  const sandbox = {
    window,
    console,
    Date,
    Map,
    Set,
    Number,
    String,
    Array,
    Object,
    JSON,
    Math,
    RegExp,
    Intl,
    URLSearchParams,
    fetch: () => {},
    setTimeout,
    clearTimeout,
    requestAnimationFrame: () => {},
  }
  vm.createContext(sandbox)
  vm.runInContext(code, sandbox, { filename: 'client.js' })
  return window.__DSH_WORKBENCH_TEST__.handoff
}

const api = loadClientHandoff()
const tr = (key) => api.DICT.zh[key] || key
const base = (extra = {}) => ({
  project: { id: 'p1', name: '项目', path: String.raw`C:\Projects\demo` },
  session: { id: 's1', title: '会话', available: true },
  digest: null,
  handoffDoc: '',
  ...extra,
})

test('01 latestUser 绝不成为目标；无明确来源时使用中性默认目标', () => {
  const values = api.buildHandoffValues(base({
    digest: {
      latestUser: '那你是傻逼吗？那你为什么终止？操你妈的，你不是浪费我时间吗',
      latestAssistant: '这次对照尚未返回结果。',
      corrections: [],
    },
  }), tr)
  assert.equal(values.goal, tr('handoffDefaultGoal'))
  assert.equal(values.goalSource, 'default')
  assert.ok(!values.goal.includes('傻逼'))
  assert.ok(!values.goal.includes('操你妈'))
  console.log('PASS 01 latestUser not used as goal')
})

test('02 presetGoal 优先于 fromDoc.goal，fromDoc.goal 优先于默认目标', () => {
  const doc = '## 1. 目标 / 下一步\n文档目标\n\n## 2. 当前进展\n文档进展'
  const preset = api.buildHandoffValues(base({ presetGoal: '用户确认的目标', handoffDoc: doc }), tr)
  assert.equal(preset.goal, '用户确认的目标')
  assert.equal(preset.goalSource, 'preset')
  const fromDoc = api.buildHandoffValues(base({ handoffDoc: doc }), tr)
  assert.equal(fromDoc.goal, '文档目标')
  assert.equal(fromDoc.goalSource, 'doc')
  const staleDoc = api.buildHandoffValues(base({
    session: { id: 's1', updatedAt: '2026-10-30T13:19:09.458Z' },
    handoffDoc: doc,
    handoffDocMtime: '2026-10-29T17:51:00.000Z',
  }), tr)
  assert.equal(staleDoc.goal, tr('handoffDefaultGoal'))
  assert.equal(staleDoc.goalSource, 'default')
  console.log('PASS 02 presetGoal > fromDoc.goal > neutral default')
})

test('03 corrections 不写入 constraints，只作为带免责声明的原话上下文', () => {
  const values = api.buildHandoffValues(base({
    digest: {
      latestUser: '请重新生成并统一修复。',
      latestAssistant: '收到。',
      corrections: [{ text: '请重新生成并统一修复。' }],
    },
  }), tr)
  assert.ok(!values.constraints.includes('重新生成'))
  assert.ok(values.summary.includes(tr('handoffRecentUserContext')))
  assert.ok(values.summary.includes('重新生成并统一修复'))
  console.log('PASS 03 corrections never become constraints')
})

test('04 辱骂原话被过滤，不进入上下文', () => {
  const values = api.buildHandoffValues(base({
    digest: {
      latestUser: '那你是傻逼吗？',
      latestAssistant: '好的。',
      corrections: [{ text: '那你是傻逼吗？' }],
    },
  }), tr)
  assert.ok(!values.summary.includes('傻逼'))
  assert.ok(!values.constraints.includes('傻逼'))
  console.log('PASS 04 abusive words filtered from context')
})

test('05 纯提问被过滤，重复纠正只保留一条', () => {
  const values = api.buildHandoffValues(base({
    digest: {
      latestUser: '请重新生成。',
      latestAssistant: '收到。',
      corrections: [
        { text: '为什么终止？' },
        { text: '请重新生成并统一修复。' },
        { text: '请重新生成并统一修复。' },
      ],
    },
  }), tr)
  assert.ok(!values.summary.includes('为什么终止'))
  assert.equal(values.summary.split('请重新生成并统一修复。').length - 1, 1)
  console.log('PASS 05 questions filtered and corrections deduped')
})

test('06 旧 projectNote / 旧文档进展不会冒充当前进展', () => {
  const values = api.buildHandoffValues(base({
    project: { id: 'p1', name: '项目', path: String.raw`C:\Projects\demo`, note: '旧项目备注：demo path C:\\renders\\DemoRenders_20260101' },
    handoffDoc: '## 1. 目标 / 下一步\n旧目标\n\n## 2. 当前进展\n旧文档进展',
  }), tr)
  assert.ok(!values.progress.includes('旧项目备注'))
  assert.ok(!values.progress.includes('旧文档进展'))
  assert.ok(values.progress.includes(tr('handoffTruthDocsUnread')))
  assert.ok(!values.constraints.includes('旧项目备注'))
  console.log('PASS 06 stale notes do not impersonate progress')
})

test('07 lastTurn 与 lastError 明确进入当前进展', () => {
  const values = api.buildHandoffValues(base({
    digest: {
      latestUser: '继续。',
      latestAssistant: '等待对照结果。',
      lastTurn: { kind: 'error', time: Date.parse('2026-10-30T14:45:23.016+08:00') },
      lastError: { message: 'You have hit your usage limit.', source: 'turn' },
    },
  }), tr)
  assert.ok(values.progress.includes(`${tr('handoffLatestStatus')}：error`))
  assert.ok(values.progress.includes(`${tr('handoffLatestError')}：You have hit your usage limit.`))
  assert.ok(values.progress.includes('2026-10-30 22:45') || values.progress.includes('2026-10-30 14:45'))
  console.log('PASS 07 lastTurn and lastError are explicit')
})

test('08 真值文档缺失时明确写未读取，存在时带真实 mtime', () => {
  const missing = api.buildHandoffValues(base(), tr)
  assert.ok(missing.progress.includes(`${tr('handoffTruthDocs')}：${tr('handoffTruthDocsUnread')}`))

  const present = api.buildHandoffValues(base({
    truthDocs: [{ name: '项目状态.md', path: String.raw`C:\Projects\demo\项目状态.md`, mtime: '2026-10-29T19:43:26.434Z', size: 7725 }],
    truthDocsStatus: 'read',
  }), tr)
  assert.ok(present.progress.includes('项目状态.md'))
  assert.ok(present.progress.includes('2026-10-30 03:43'))
  assert.ok(present.progress.includes(String.raw`C:\Projects\demo\项目状态.md`))
  console.log('PASS 08 truth docs include real mtimes or explicit unread state')
})

test('09 truth-docs 只读取已知真值文件名并返回 mtime', async () => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'wb-truth-'))
  try {
    await fs.promises.mkdir(path.join(root, 'projects', 'DemoProject'), { recursive: true })
    await fs.promises.writeFile(path.join(root, '项目状态.md'), 'state')
    await fs.promises.writeFile(path.join(root, 'projects', 'DemoProject', '制作状态.md'), 'progress')
    await fs.promises.writeFile(path.join(root, 'projects', 'DemoProject', '制作问题清单.md'), 'issues')
    await fs.promises.writeFile(path.join(root, 'projects', 'DemoProject', 'unrelated.md'), 'noise')
    const result = await readTruthDocs([root])
    assert.equal(result.status, 'read')
    const names = result.docs.map((doc) => doc.name)
    assert.equal(names.length, 3)
    for (const name of ['项目状态.md', '制作状态.md', '制作问题清单.md']) assert.ok(names.includes(name))
    for (const doc of result.docs) {
      assert.match(doc.mtime, /^\d{4}-\d{2}-\d{2}T/)
      assert.ok(doc.size > 0)
    }
    console.log('PASS 09 truth-docs scanner returns only named docs with mtime')
  } finally {
    await fs.promises.rm(root, { recursive: true, force: true })
  }
})


test('10 项目页任务框预填固定开场白，并在发送后恢复', () => {
  const code = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  for (const lang of ['zh', 'en']) {
    const starter = api.DICT[lang].wsTaskStarter
    assert.ok(typeof starter === 'string' && starter.length >= 50)
    assert.match(starter, /GPU/)
  }
  assert.match(code, /const taskStarter = tr\('wsTaskStarter'\)/)
  assert.match(code, /useState\(taskStarter\)/)
  assert.match(code, /setTaskDraft\(taskStarter\)/)
  console.log('PASS 10 fixed task opening is prefilled and restorable')
})
