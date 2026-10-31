/**
 * Read-only Codex session inventory and bounded raw-log digest.
 *
 * Codex stores thread metadata in state_5.sqlite, while the full chat text
 * lives in a rollout-*.jsonl file. The workbench only reads both. It never
 * writes into ~/.codex and never uses cwd as a project identity: the same
 * blender cwd can contain several unrelated projects and chats.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import { DatabaseSync } from 'node:sqlite'
import { buildDigest, cleanText, clamp } from './digest.js'

const CACHE_MS = 15_000
const MAX_DIGEST_BYTES = 16 * 1024 * 1024
const MAX_EVENT_RECORDS = 6000
const MAX_LINE_CHARS = 1_000_000
const MAX_SPEAKERS = 600
const VISIBLE_SOURCES = new Set(['user', 'voice_chat', 'chatgpt_handoff', 'agent_created_thread'])

let cache = { at: 0, key: '', value: null }
let configuredDb = ''

export function configureCodexDb(value) {
  configuredDb = String(value || '').trim() ? path.resolve(String(value).trim()) : ''
  cache = { at: 0, key: '', value: null }
}

function dbPath() {
  return configuredDb || (process.env.DSH_WORKBENCH_CODEX_DB
    ? path.resolve(process.env.DSH_WORKBENCH_CODEX_DB)
    : path.join(os.homedir(), '.codex', 'state_5.sqlite'))
}

function normalizePath(value) {
  return String(value || '').replace(/^\\\\\?\\/, '')
}

function iso(ms) {
  const n = Number(ms)
  return Number.isFinite(n) && n > 0 ? new Date(n).toISOString() : ''
}

function titleOf(row) {
  const explicit = String(row.title || '').trim()
  if (explicit) return clamp(explicit.replace(/\s+/g, ' '), 160)
  const first = cleanUserText(row.first_user_message || '')
  return first ? clamp(first.replace(/\s+/g, ' '), 120) : '未命名会话'
}

function publicSession(row) {
  const rolloutPath = normalizePath(row.rollout_path)
  const available = Boolean(rolloutPath) && fs.existsSync(rolloutPath)
  return {
    id: String(row.id || ''),
    source: 'codex',
    app: 'Codex',
    title: titleOf(row),
    cwd: normalizePath(row.cwd),
    createdAt: iso(row.created_at_ms ?? row.created_at),
    updatedAt: iso(row.updated_at_ms ?? row.updated_at),
    archived: Boolean(row.archived),
    threadSource: String(row.thread_source || ''),
    originator: String(row.originator || ''),
    available,
    explicitOnly: true,
    running: false,
  }
}

function readThreads() {
  const file = dbPath()
  let stat
  try { stat = fs.statSync(file) } catch {
    return { ok: false, error: 'Codex 会话数据库不存在', sessions: [], total: 0, archived: 0 }
  }
  const key = `${file}:${stat.size}:${stat.mtimeMs}`
  if (cache.value && cache.key === key && Date.now() - cache.at < CACHE_MS) return cache.value
  let db
  try {
    db = new DatabaseSync(file, { readOnly: true })
    const rows = db.prepare(`
      SELECT id, title, cwd, created_at_ms, updated_at_ms, archived,
             thread_source, originator, rollout_path, first_user_message
      FROM threads
      WHERE thread_source IS NOT NULL AND thread_source != 'subagent'
      ORDER BY updated_at_ms DESC
    `).all()
    const visible = rows.filter((row) => VISIBLE_SOURCES.has(String(row.thread_source || '')))
    const sessions = visible.map(publicSession).filter((item) => item.id && !item.archived)
    const archived = visible.filter((item) => item.archived).length
    const value = {
      ok: true,
      sessions,
      total: visible.length,
      archived,
      dbPath: file,
      updatedAt: iso(stat.mtimeMs),
    }
    cache = { at: Date.now(), key, value }
    return value
  } catch (error) {
    return { ok: false, error: `读取 Codex 会话索引失败：${error?.message || error}`, sessions: [], total: 0, archived: 0 }
  } finally {
    try { db?.close() } catch { /* read-only close */ }
  }
}

export function listCodexSessions({ force = false } = {}) {
  if (force) cache = { at: 0, key: '', value: null }
  return readThreads()
}

export function findCodexSession(id) {
  const wanted = String(id || '').trim()
  if (!wanted) return null
  const result = readThreads()
  return (result.sessions || []).find((session) => session.id === wanted) || null
}

/** Remove Codex's injected AGENTS/environment envelope before judging a turn. */
function cleanUserText(value) {
  let text = cleanText(value)
  if (!text) return ''
  text = text
    .replace(/^# AGENTS\.md instructions\s*/i, '')
    .replace(/<INSTRUCTIONS>[\s\S]*?<\/INSTRUCTIONS>/gi, '')
    .replace(/<environment_context>[\s\S]*?<\/environment_context>/gi, '')
    .replace(/<user_instructions>[\s\S]*?<\/user_instructions>/gi, '')
    .replace(/<INSTRUCTIONS>[\s\S]*$/i, '')
  return text.trim()
}

function codexContentText(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  const parts = []
  for (const block of content) {
    if (!block || typeof block !== 'object') continue
    if (['text', 'input_text', 'output_text'].includes(block.type) && typeof block.text === 'string') {
      parts.push(block.text)
    }
  }
  return parts.filter(Boolean).join('\n')
}

function eventTime(record) {
  const value = Date.parse(record?.timestamp || record?.payload?.timestamp || '')
  return Number.isFinite(value) ? value : null
}

/**
 * Build the small event vocabulary expected by digest.js. We deliberately do
 * not retain tool arguments or tool output: raw Codex commands may contain
 * credentials and are not needed for a takeover brief.
 */
function eventsFromRecord(record, state) {
  if (!record || typeof record !== 'object') return
  if (state.events.length >= MAX_EVENT_RECORDS) return
  const payload = record.payload && typeof record.payload === 'object' ? record.payload : {}
  const time = eventTime(record)
  if (record.type === 'compacted' || payload.type === 'compacted') {
    const summary = payload.summary || payload.message || record.summary
    if (summary) state.events.push({ type: 'compaction/summary', time, data: { summary } })
    return
  }
  if (record.type === 'response_item' && payload.type === 'message') {
    const role = String(payload.role || '')
    const text = codexContentText(payload.content)
    if (role === 'user') {
      const cleaned = cleanUserText(text)
      if (!cleaned) return
      if (state.users.length < MAX_SPEAKERS) state.users.push({ text: clamp(cleaned, 1200), time })
      state.events.push({ type: 'user/message', time, data: { content: clamp(cleaned, 4000) } })
      return
    }
    if (role === 'assistant') {
      const cleaned = cleanText(text)
      if (!cleaned) return
      if (state.assistants.length < MAX_SPEAKERS) state.assistants.push({ text: clamp(cleaned, 1600), time })
      state.events.push({ type: 'assistant/message', time, data: { content: clamp(cleaned, 4000) } })
    }
    return
  }
  if (record.type === 'event_msg' && payload.type === 'task_complete') {
    const message = payload.last_agent_message
    if (typeof message === 'string' && message.trim() && !state.assistants.length) {
      state.events.push({ type: 'assistant/message', time, data: { content: message } })
    }
    state.events.push({ type: 'turn/end', time, data: { reason: { kind: payload.error ? 'error' : 'completed', error: payload.error } } })
    return
  }
  if (record.type === 'event_msg' && payload.type === 'turn_aborted') {
    state.events.push({ type: 'turn/end', time, data: { reason: { kind: 'error', error: payload.reason || 'turn aborted' } } })
  }
}

async function scanCodexLog(file) {
  const stat = await fs.promises.stat(file)
  const totalBytes = stat.size
  // Read the newest slice, not the oldest 16 MiB. When a rollout is larger
  // than the cap, the latest turns are what a takeover brief needs.
  const start = Math.max(0, totalBytes - MAX_DIGEST_BYTES)
  const state = { events: [], users: [], assistants: [] }
  let scannedBytes = 0
  let lines = 0
  let parseErrors = 0
  let firstLine = start > 0
  const stream = fs.createReadStream(file, { encoding: 'utf8', start })
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })
  for await (const line of rl) {
    if (firstLine) {
      // The first chunk starts mid-record; discard the partial line.
      firstLine = false
      continue
    }
    lines += 1
    if (line.length > MAX_LINE_CHARS) {
      parseErrors += 1
      continue
    }
    if (scannedBytes + Buffer.byteLength(line, 'utf8') + 1 > MAX_DIGEST_BYTES) break
    scannedBytes += Buffer.byteLength(line, 'utf8') + 1
    if (!line.trim()) continue
    try {
      eventsFromRecord(JSON.parse(line), state)
    } catch {
      parseErrors += 1
    }
  }
  rl.close()
  stream.destroy()
  const skippedBytes = Math.max(0, totalBytes - Math.min(totalBytes, start + scannedBytes))
  return {
    state,
    read: {
      source: 'codex',
      totalBytes,
      scannedBytes,
      skippedBytes,
      lines,
      parseErrors,
      truncated: skippedBytes > 0,
      limitBytes: MAX_DIGEST_BYTES,
      readAt: new Date().toISOString(),
    },
  }
}

function correctionOf(text) {
  return /(?:不是|不对|错了|纠正|改成|而不是|别这样|不要|重新|重来|停|应该|记住)/.test(String(text || ''))
}

const CORRECTION_ABUSE = /(?:傻逼|操你妈|操你|妈的|狗娘|婊子|fuck|shit|bitch|asshole|motherfucker)/i
const CORRECTION_DIRECTIVE = /(?:请|麻烦|帮我|把|改|重新|重来|不要|别|必须|应该|需要|统一|修复|生成|检查|保留|使用|删除|停止|记住|先|换|补|移除|增加|减少|只|按)/i
const CORRECTION_QUESTION = /^(?:为什么|为何|怎么|如何|是否|你是|你不是|那你是|你为什么|能不能|可以吗)/i

export function sanitizeCorrections(items) {
  const result = []
  const seen = new Set()
  for (const item of Array.isArray(items) ? items : []) {
    const text = String(item?.text || '').replace(/\s+/g, ' ').trim()
    if (!text || text.length > 500) continue
    if (CORRECTION_ABUSE.test(text)) continue
    if (CORRECTION_QUESTION.test(text) && !/^(?:请|麻烦|帮我|把|需要|必须|应该|不要|别|先|重新|统一|修复)/i.test(text)) continue
    if (!CORRECTION_DIRECTIVE.test(text)) continue
    const key = text.toLowerCase().replace(/[\s，。！？、；：,.!?;:]/g, '')
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push({ text, time: item?.time })
  }
  return result.slice(-3)
}

export async function readCodexDigest(id) {
  const session = findCodexSession(id)
  if (!session) throw new Error('Codex 会话不存在或索引已过期')
  const result = readThreads()
  const dbFile = result.dbPath
  if (!dbFile) throw new Error('Codex 会话数据库不可用')
  let db
  let row
  try {
    db = new DatabaseSync(dbFile, { readOnly: true })
    row = db.prepare('SELECT rollout_path FROM threads WHERE id = ?').get(session.id)
  } finally {
    try { db?.close() } catch { /* read-only close */ }
  }
  const rolloutPath = normalizePath(row?.rollout_path)
  if (!rolloutPath || !fs.existsSync(rolloutPath)) {
    return {
      ...session,
      available: false,
      error: 'Codex 原始会话日志不可用；线程元数据仍在，但不能读取完整正文。',
      read: {
        source: 'codex', totalBytes: 0, scannedBytes: 0, skippedBytes: 0,
        lines: 0, parseErrors: 0, truncated: false, readAt: new Date().toISOString(),
      },
      summary: '',
      latestUser: null,
      latestAssistant: null,
      messages: [],
      userMessages: [],
      corrections: [],
    }
  }
  const { state, read } = await scanCodexLog(rolloutPath)
  const digest = buildDigest(state.events, {
    title: session.title,
    cwd: session.cwd,
    createdAt: Date.parse(session.createdAt) || null,
    persisted: true,
    logSizeBytes: read.totalBytes,
    updatedAt: Date.parse(session.updatedAt) || null,
    eventCount: state.events.length,
  })
  const userMessages = state.users.slice(-24).map((item) => ({
    text: clamp(item.text, 500),
    time: item.time,
  }))
  const corrections = sanitizeCorrections(state.users
    .filter((item) => correctionOf(item.text))
    .slice(-8)
    .map((item) => ({ text: clamp(item.text, 480), time: item.time })))
  const firstUser = state.users[0] ? { text: clamp(state.users[0].text, 700), time: state.users[0].time } : null
  return {
    ...session,
    ...digest,
    title: session.title || digest.title,
    cwd: session.cwd || digest.cwd,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    source: 'codex',
    sourceId: session.id,
    sessionId: session.id,
    available: true,
    read,
    firstUser,
    userMessages,
    corrections,
    notice: read.truncated
      ? `日志超过 ${Math.round(MAX_DIGEST_BYTES / 1024 / 1024)} MiB，只读取了最近一段。`
      : '',
  }
}

export function codexSessionOpenUrl(id) {
  const value = String(id || '')
  if (!/^[0-9a-f-]{20,80}$/i.test(value)) return ''
  return `codex://threads/${value}`
}

export const CODEX_MAX_DIGEST_BYTES = MAX_DIGEST_BYTES
