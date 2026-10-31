import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-codex-sessions-'))
const dbPath = path.join(tmp, 'state.sqlite')
const logPath = path.join(tmp, 'rollout.jsonl')
const missingLog = path.join(tmp, 'missing.jsonl')
const threadId = '0123456789abcdef0123456789abcdef'
const archivedId = 'fedcba9876543210fedcba9876543210'
const subagentId = '11111111111111111111111111111111'
const noLogId = '22222222222222222222222222222222'

await fs.writeFile(logPath, [
  JSON.stringify({ timestamp: '2026-10-29T18:00:00.000Z', type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: '<INSTRUCTIONS>\n# 用户长期偏好\n- 不要暴露密钥\n</INSTRUCTIONS>' }] } }),
  JSON.stringify({ timestamp: '2026-10-29T18:00:01.000Z', type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Fix the render seam，不要新建会话。' }] } }),
  JSON.stringify({ timestamp: '2026-10-29T18:00:02.000Z', type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '先核对上一段成片，再继续采样。' }] } }),
  JSON.stringify({ timestamp: '2026-10-29T18:00:03.000Z', type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '第二段仍在采样，暂未导出。' }] } }),
  JSON.stringify({ timestamp: '2026-10-29T18:00:04.000Z', type: 'event_msg', payload: { type: 'task_complete', last_agent_message: '第二段仍在采样，暂未导出。' } }),
  JSON.stringify({ timestamp: '2026-10-29T18:00:05.000Z', type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: '不对，先别继续，回到接缝问题。' }] } }),
].join('\n') + '\n', 'utf8')

const db = new DatabaseSync(dbPath)
db.exec(`CREATE TABLE threads (
  id TEXT PRIMARY KEY, title TEXT, cwd TEXT, created_at_ms INTEGER, updated_at_ms INTEGER,
  archived INTEGER, thread_source TEXT, originator TEXT, rollout_path TEXT, first_user_message TEXT
)`)
const insert = db.prepare('INSERT INTO threads VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
insert.run(threadId, 'Fix render seam', 'C:\\renders\\DemoRenders_20260101', 1793298000000, 1793298125744, 0, 'user', 'Codex Desktop', logPath, 'Fix the render seam')
insert.run(archivedId, '旧归档', 'C:\\old', 1793200000000, 1793200000000, 1, 'user', 'Codex Desktop', logPath, '旧')
insert.run(subagentId, '子代理', 'C:\\sub', 1793298000000, 1793298125744, 0, 'subagent', 'Codex Desktop', logPath, '子代理')
insert.run(noLogId, '无日志', 'C:\\nolog', 1793298000000, 1793298125744, 0, 'user', 'Codex Desktop', missingLog, '无日志')
db.close()

process.env.DSH_WORKBENCH_CODEX_DB = dbPath
const mod = await import('../codex-sessions.js')

try {
  const listed = mod.listCodexSessions({ force: true })
  if (!listed.ok) throw new Error(`list failed: ${listed.error}`)
  const ids = listed.sessions.map((session) => session.id)
  if (!ids.includes(threadId) || ids.includes(archivedId) || ids.includes(subagentId)) {
    throw new Error(`inventory filters failed: ${JSON.stringify(ids)}`)
  }
  const session = listed.sessions.find((item) => item.id === threadId)
  if (session.source !== 'codex' || session.explicitOnly !== true || session.running !== false) throw new Error('session source contract wrong')
  if (session.title !== 'Fix render seam' || !session.cwd.includes('DemoRenders')) throw new Error('session metadata wrong')

  const digest = await mod.readCodexDigest(threadId)
  if (digest.read.source !== 'codex' || digest.read.totalBytes <= 0 || digest.read.truncated !== false) throw new Error(`read boundary wrong: ${JSON.stringify(digest.read)}`)
  if (digest.firstUser?.text?.includes('INSTRUCTIONS') || !digest.firstUser?.text?.includes('seam')) throw new Error(`injected envelope leaked into first user: ${JSON.stringify(digest.firstUser)}`)
  if (digest.latestUser?.text !== '不对，先别继续，回到接缝问题。') throw new Error(`latest user wrong: ${JSON.stringify(digest.latestUser)}`)
  if (digest.latestAssistant?.text !== '第二段仍在采样，暂未导出。') throw new Error(`latest assistant wrong: ${JSON.stringify(digest.latestAssistant)}`)
  if (!digest.corrections?.some((item) => item.text.includes('不对'))) throw new Error('correction not surfaced')

  const noLog = await mod.readCodexDigest(noLogId)
  if (noLog.available !== false || noLog.read.totalBytes !== 0) throw new Error('missing log should stay explicit')
  const missing = await mod.readCodexDigest('99999999999999999999999999999999').then(() => null).catch((error) => error)
  if (!missing || !String(missing.message).includes('不存在')) throw new Error('unknown thread should reject')

  if (mod.codexSessionOpenUrl(threadId) !== `codex://threads/${threadId}`) throw new Error('valid deep link wrong')
  if (mod.codexSessionOpenUrl('../../evil') !== '') throw new Error('invalid deep link accepted')
  console.log('codex sessions ok', { listed: listed.sessions.length, lines: digest.read.lines, userMessages: digest.userMessages.length })
} finally {
  await fs.rm(tmp, { recursive: true, force: true })
}
