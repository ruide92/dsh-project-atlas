/**
 * Pure, deterministic digest extraction for DSH session logs.
 *
 * The workbench does not call a model here: it extracts the latest human
 * request, assistant reply, tool activity and todo list from the session
 * surface. Keeping this module pure makes the output testable without DSH.
 */

const MAX_MESSAGES = 14
const MAX_TOOLS = 10

export function clamp(value, limit) {
  const text = String(value ?? '')
  if (!limit || text.length <= limit) return text
  return text.slice(0, Math.max(0, limit - 1)).trimEnd() + '…'
}

export function contentText(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  const parts = []
  for (const block of content) {
    if (!block || typeof block !== 'object') continue
    if (block.type === 'text' && typeof block.text === 'string') parts.push(block.text)
  }
  return parts.filter(Boolean).join('\n')
}

/**
 * Remove host-injected context from a user turn. System reminders and skill
 * catalogs are part of the raw log but are not the user's request.
 */
export function cleanText(value) {
  let text = String(value ?? '').replace(/\r\n?/g, '\n')
  if (!text.trim()) return ''
  if (/^Current runtime context\./i.test(text.trim())) return ''
  if (/^<system-reminder>/i.test(text.trim()) && !/<\/system-reminder>/i.test(text)) return ''
  text = text
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, '\n')
    .replace(/<available_skills>[\s\S]*?<\/available_skills>/gi, '\n')
    .replace(/<skill_content[^>]*>[\s\S]*?<\/skill_content>/gi, '\n')
  const lines = text.split('\n').filter((line) => {
    const trimmed = line.trim()
    if (!trimmed) return true
    return !/^The available skill catalog changed/i.test(trimmed)
      && !/^<\/?available_skills>/i.test(trimmed)
      && !/^<\/?skill_content/i.test(trimmed)
  })
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function toolSummary(raw) {
  let args = raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return ''
    try { args = JSON.parse(trimmed) } catch { return clamp(trimmed.replace(/\s+/g, ' '), 180) }
  }
  if (!args || typeof args !== 'object') return clamp(String(args ?? '').replace(/\s+/g, ' '), 180)
  const parts = []
  for (const key of ['description', 'command', 'query', 'path', 'file_path', 'url', 'pattern', 'prompt', 'message']) {
    const value = args[key]
    if (typeof value === 'string' && value.trim()) parts.push(`${key}: ${value.trim()}`)
    if (parts.length >= 2) break
  }
  if (!parts.length) return clamp(JSON.stringify(args).replace(/\s+/g, ' '), 180)
  return clamp(parts.join(' · '), 180)
}

function errorText(error) {
  if (!error) return ''
  if (typeof error === 'string') return error
  if (typeof error.message === 'string') return error.message
  if (typeof error.code === 'string') return error.code
  try { return JSON.stringify(error) } catch { return String(error) }
}

/**
 * @param {Array<{type?: string, time?: number, data?: Record<string, unknown>}>} events
 * @param {{title?: string, cwd?: string, createdAt?: number, live?: boolean, persisted?: boolean, eventCount?: number, logSizeBytes?: number, updatedAt?: number}} meta
 */
export function buildDigest(events, meta = {}) {
  const all = Array.isArray(events) ? events : []
  // A surface can contain a very long tool transcript. Keep extraction bounded;
  // the newest events are the ones that answer "where did this task stop?".
  const sample = all.length > 6000 ? all.slice(-6000) : all
  const messages = []
  const tools = []
  let title = String(meta.title || '')
  let latestUser = null
  let latestAssistant = null
  let compaction = null
  let todos = null
  let lastTurn = null
  let lastError = null
  let lastEventAt = null
  let lastEventType = ''
  let userCount = 0
  let assistantCount = 0
  let toolCount = 0

  for (const event of sample) {
    if (!event || typeof event !== 'object') continue
    const type = String(event.type || '')
    const time = Number.isFinite(event.time) ? event.time : null
    if (time !== null) {
      lastEventAt = time
      lastEventType = type
    }
    const data = event.data && typeof event.data === 'object' ? event.data : {}

    if (type === 'session/title') {
      if (typeof data.title === 'string' && data.title.trim()) title = data.title.trim()
      continue
    }

    if (type === 'user/message') {
      const text = cleanText(contentText(data.content))
      if (!text) continue
      userCount += 1
      const item = { role: 'user', text: clamp(text, 1200), time }
      messages.push(item)
      latestUser = item
      continue
    }

    if (type === 'assistant/message') {
      const message = data.message && typeof data.message === 'object' ? data.message : data
      const text = cleanText(contentText(message.content))
      if (!text) continue
      assistantCount += 1
      const item = { role: 'assistant', text: clamp(text, 1600), time }
      messages.push(item)
      latestAssistant = item
      continue
    }

    if (type === 'tool/call') {
      toolCount += 1
      tools.push({
        name: String(data.name || 'tool'),
        detail: toolSummary(data.arguments),
        time,
      })
      continue
    }

    if (type === 'tool/result') {
      const message = data.message && typeof data.message === 'object' ? data.message : null
      const error = data.error || data.meta?.error || (message?.isError ? message : null)
      if (error) lastError = { message: clamp(errorText(error), 500), time, source: 'tool' }
      continue
    }

    if (type === 'todo/write') {
      const list = Array.isArray(data.todos) ? data.todos : []
      todos = list
        .map((todo) => ({
          content: clamp(String(todo?.content || ''), 220),
          status: String(todo?.status || 'pending'),
        }))
        .filter((todo) => todo.content)
      continue
    }

    if (type === 'turn/end') {
      const reason = data.reason && typeof data.reason === 'object' ? data.reason : {}
      lastTurn = { kind: String(reason.kind || 'unknown'), time }
      if (reason.kind === 'error') {
        lastError = { message: clamp(errorText(reason.error) || 'turn failed', 500), time, source: 'turn' }
      }
      continue
    }

    if (type === 'compaction/summary') {
      const text = cleanText(contentText(data.summary))
      if (text) compaction = { text: clamp(text, 2000), time }
    }
  }

  if (messages.length > MAX_MESSAGES) messages.splice(0, messages.length - MAX_MESSAGES)
  if (tools.length > MAX_TOOLS) tools.splice(0, tools.length - MAX_TOOLS)

  // Tail messages are the current state. A compaction summary can be older
  // than the last turn, so it is only a fallback when no readable turn remains.
  const parts = []
  if (latestUser) parts.push(`最近请求：${clamp(latestUser.text, 700)}`)
  if (latestAssistant) parts.push(`最近回复：${clamp(latestAssistant.text, 900)}`)
  const summary = parts.length ? parts.join('\n\n') : (compaction?.text || '')

  return {
    title,
    cwd: typeof meta.cwd === 'string' ? meta.cwd : '',
    createdAt: Number.isFinite(meta.createdAt) ? meta.createdAt : null,
    live: meta.live === true,
    persisted: meta.persisted === true,
    logSizeBytes: Number.isFinite(meta.logSizeBytes) ? meta.logSizeBytes : null,
    updatedAt: Number.isFinite(meta.updatedAt) ? meta.updatedAt : lastEventAt,
    eventCount: Number.isFinite(meta.eventCount) ? meta.eventCount : all.length,
    lastEventAt,
    lastEventType,
    counts: { user: userCount, assistant: assistantCount, tool: toolCount },
    summary,
    latestUser,
    latestAssistant,
    compaction,
    messages,
    tools,
    todos,
    lastTurn,
    lastError,
    truncated: all.length > sample.length,
  }
}
