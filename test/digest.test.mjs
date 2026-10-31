import assert from 'node:assert/strict'
import test from 'node:test'
import { buildDigest, cleanText, contentText, toolSummary } from '../digest.js'

const event = (type, data, time = 1000) => ({ type, time, data })

test('contentText keeps text blocks and ignores reasoning/tool blocks', () => {
  assert.equal(contentText([
    { type: 'reasoning', text: 'hidden' },
    { type: 'text', text: 'hello' },
    { type: 'tool-call', name: 'pwsh' },
    { type: 'text', text: 'world' },
  ]), 'hello\nworld')
})

test('cleanText removes injected reminders without losing the user request', () => {
  const raw = '<system-reminder>\nold context\n</system-reminder>\n请继续完成工作台。'
  assert.equal(cleanText(raw), '请继续完成工作台。')
  assert.equal(cleanText('<system-reminder>truncated...'), '')
  assert.equal(cleanText('<available_skills>\n- a\n</available_skills>'), '')
  assert.equal(cleanText('Current runtime context. This snapshot supersedes earlier ones.'), '')
})

test('toolSummary extracts useful argument fields', () => {
  assert.equal(toolSummary('{"description":"Run tests","command":"node --test"}'), 'description: Run tests · command: node --test')
  assert.equal(toolSummary('not json'), 'not json')
  assert.equal(toolSummary({ path: 'C:\\workbench' }), 'path: C:\\workbench')
})

test('buildDigest extracts latest request, reply, tools and todos', () => {
  const digest = buildDigest([
    event('session/title', { title: '工作台 Agent 页' }),
    event('user/message', { content: [{ type: 'text', text: '<system-reminder>x</system-reminder>\n请实现会话摘要。' }] }, 1100),
    event('assistant/message', { message: { content: [{ type: 'text', text: '先读取会话服务，再写接口。' }] } }, 1200),
    event('tool/call', { name: 'pwsh', arguments: '{"description":"Read files","command":"Get-Content index.js"}' }, 1300),
    event('todo/write', { todos: [{ content: '实现摘要', status: 'completed' }, { content: '验证接口', status: 'pending' }] }, 1400),
    event('turn/end', { reason: { kind: 'completed' } }, 1500),
  ], { title: 'fallback', cwd: 'C:\\Projects', createdAt: 900, live: true, persisted: true, logSizeBytes: 1234 })

  assert.equal(digest.title, '工作台 Agent 页')
  assert.equal(digest.cwd, 'C:\\Projects')
  assert.equal(digest.live, true)
  assert.equal(digest.createdAt, 900)
  assert.equal(digest.counts.user, 1)
  assert.equal(digest.counts.assistant, 1)
  assert.equal(digest.counts.tool, 1)
  assert.equal(digest.latestUser.text, '请实现会话摘要。')
  assert.equal(digest.latestAssistant.text, '先读取会话服务，再写接口。')
  assert.equal(digest.tools[0].name, 'pwsh')
  assert.match(digest.tools[0].detail, /Read files/)
  assert.equal(digest.todos.length, 2)
  assert.equal(digest.lastTurn.kind, 'completed')
  assert.match(digest.summary, /最近请求/)
  assert.match(digest.summary, /最近回复/)
})

test('tail messages win over an older compaction summary', () => {
  const digest = buildDigest([
    event('user/message', { content: [{ type: 'text', text: '旧请求' }] }, 1000),
    event('compaction/summary', { summary: [{ type: 'text', text: '## 已完成\n- 先做了 A\n- 再做 B' }] }, 1100),
    event('assistant/message', { message: { content: [{ type: 'text', text: '最新回复' }] } }, 1200),
  ])
  assert.equal(digest.compaction.text, '## 已完成\n- 先做了 A\n- 再做 B')
  assert.match(digest.summary, /最近请求：旧请求/)
  assert.match(digest.summary, /最近回复：最新回复/)
  assert.ok(!digest.summary.includes('先做了 A'))
})

test('compaction summary is only a fallback when no turn remains', () => {
  const digest = buildDigest([
    event('compaction/summary', { summary: [{ type: 'text', text: '## 已完成\n- 只留下压缩摘要' }] }, 1100),
  ])
  assert.equal(digest.summary, '## 已完成\n- 只留下压缩摘要')
})

test('buildDigest bounds recent messages and keeps the newest', () => {
  const events = []
  for (let i = 0; i < 20; i += 1) {
    events.push(event('user/message', { content: [{ type: 'text', text: `请求 ${i}` }] }, 1000 + i))
  }
  const digest = buildDigest(events)
  assert.equal(digest.messages.length, 14)
  assert.equal(digest.messages.at(-1).text, '请求 19')
  assert.equal(digest.latestUser.text, '请求 19')
})
