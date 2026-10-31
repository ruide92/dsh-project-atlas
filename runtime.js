/**
 * Generic project runtime protocol.
 *
 * A project does not have to be a particular kind of app. It only has to
 * describe what it is doing now, which stage it reached, what it produced and
 * when it last reported a heartbeat. The workbench renders that description
 * with one shared vocabulary instead of a custom page per project.
 */

export const RUNTIME_SCHEMA_VERSION = 1

export const RUNTIME_STATES = [
  'unknown', 'ready', 'running', 'waiting', 'blocked', 'failed', 'done',
]

const STATE_ALIASES = new Map([
  ['unknown', 'unknown'],
  ['idle', 'ready'],
  ['ready', 'ready'],
  ['ok', 'ready'],
  ['online', 'ready'],
  ['active', 'ready'],
  ['空闲', 'ready'],
  ['running', 'running'],
  ['in_progress', 'running'],
  ['in-progress', 'running'],
  ['processing', 'running'],
  ['generating', 'running'],
  ['rendering', 'running'],
  ['busy', 'running'],
  ['运行中', 'running'],
  ['进行中', 'running'],
  ['waiting', 'waiting'],
  ['pending', 'waiting'],
  ['needs_review', 'waiting'],
  ['needs-review', 'waiting'],
  ['review', 'waiting'],
  ['等待', 'waiting'],
  ['待审', 'waiting'],
  ['blocked', 'blocked'],
  ['stuck', 'blocked'],
  ['阻塞', 'blocked'],
  ['failed', 'failed'],
  ['failure', 'failed'],
  ['error', 'failed'],
  ['crashed', 'failed'],
  ['失败', 'failed'],
  ['done', 'done'],
  ['complete', 'done'],
  ['completed', 'done'],
  ['success', 'done'],
  ['succeeded', 'done'],
  ['完成', 'done'],
])

const STEP_STATES = new Set(['pending', 'running', 'waiting', 'done', 'failed', 'blocked', 'skipped'])
const MAX_STAGES = 24
const MAX_ARTIFACTS = 24
const MAX_EVENTS = 40
const MAX_HEALTH = 12
const MAX_ACTIONS = 12

function text(value, max = 500) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function iso(value) {
  if (!value) return ''
  const parsed = typeof value === 'number' ? value : Date.parse(String(value))
  if (!Number.isFinite(parsed)) return ''
  const date = new Date(parsed)
  return Number.isFinite(date.getTime()) ? date.toISOString() : ''
}

function number(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function normalizeRuntimeState(value, fallback = 'unknown') {
  const key = text(value, 40).toLowerCase().replace(/\s+/g, '_')
  return STATE_ALIASES.get(key) || fallback
}

function normalizeStepStatus(value) {
  const key = text(value, 40).toLowerCase().replace(/\s+/g, '_')
  return STEP_STATES.has(key) ? key : (key === 'active' ? 'running' : 'pending')
}

function normalizeStage(value, index = 0) {
  if (!value || typeof value !== 'object') return null
  const id = text(value.id || value.key || `stage-${index + 1}`, 80)
  const rawProgress = number(value.progress ?? (value.done ? 1 : 0), 0)
  const progress = clamp(rawProgress > 1 ? rawProgress / 100 : rawProgress, 0, 1)
  const explicitStatus = value.status || (value.done ? 'done' : '')
  const status = explicitStatus
    ? normalizeStepStatus(explicitStatus)
    : (progress >= 1 ? 'done' : progress > 0 ? 'running' : 'pending')
  return {
    id,
    label: text(value.label || value.title || value.name || id, 120),
    status,
    progress,
    detail: text(value.detail || value.message, 400),
  }
}

function normalizeStages(raw) {
  const source = Array.isArray(raw) ? raw : []
  return source.slice(0, MAX_STAGES).map(normalizeStage).filter(Boolean)
}

function normalizeArtifact(value, index = 0) {
  if (!value || typeof value !== 'object') return null
  const pathValue = text(value.path || value.file || value.href, 1000)
  const title = text(value.title || value.name || pathValue.split(/[\\/]/).pop() || `artifact-${index + 1}`, 180)
  if (!pathValue && !value.url) return null
  return {
    id: text(value.id || `artifact-${index + 1}`, 100),
    title,
    path: pathValue,
    role: text(value.role || value.kind || 'output', 40),
    kind: text(value.kind || value.type || guessKind(pathValue), 40).toLowerCase(),
    mime: text(value.mime || value.contentType, 100),
    sizeBytes: Math.max(0, Math.round(number(value.sizeBytes ?? value.size, 0))),
    createdAt: iso(value.createdAt || value.mtime || value.updatedAt),
    version: text(value.version, 40),
    url: text(value.url, 2000),
    preview: text(value.preview, 2000),
  }
}

function normalizeArtifacts(raw) {
  const source = Array.isArray(raw) ? raw : []
  return source.slice(0, MAX_ARTIFACTS).map(normalizeArtifact).filter(Boolean)
}

function normalizeEvent(value, index = 0) {
  if (!value || typeof value !== 'object') return null
  const title = text(value.title || value.message || value.type || `event-${index + 1}`, 220)
  return {
    at: iso(value.at || value.time || value.createdAt),
    type: text(value.type || 'info', 40).toLowerCase(),
    level: ['info', 'success', 'warn', 'error'].includes(text(value.level, 20).toLowerCase())
      ? text(value.level, 20).toLowerCase() : 'info',
    title,
    detail: text(value.detail, 500),
  }
}

function normalizeEvents(raw) {
  const source = Array.isArray(raw) ? raw : []
  return source.slice(-MAX_EVENTS).map(normalizeEvent).filter(Boolean)
}

function normalizeHealth(raw) {
  const source = Array.isArray(raw)
    ? raw
    : (raw && typeof raw === 'object' ? Object.entries(raw).map(([name, value]) => (
      typeof value === 'object' ? { name, ...value } : { name, status: value }
    )) : [])
  return source.slice(0, MAX_HEALTH).map((item) => {
    if (!item || typeof item !== 'object') return null
    const status = normalizeRuntimeState(item.status || item.state, 'unknown')
    return {
      name: text(item.name || item.label, 100),
      status,
      detail: text(item.detail || item.message, 300),
    }
  }).filter((item) => item && item.name)
}

function normalizeActions(raw) {
  const source = Array.isArray(raw) ? raw : []
  return source.slice(0, MAX_ACTIONS).map((item) => {
    if (!item || typeof item !== 'object') return null
    const id = text(item.id, 60)
    if (!id) return null
    return {
      id,
      label: text(item.label || item.title || id, 100),
      type: text(item.type || 'openPath', 40),
      target: text(item.target || item.path || item.url, 2000),
      confirm: Boolean(item.confirm),
    }
  }).filter(Boolean)
}

export function guessKind(filePath) {
  const ext = String(filePath || '').toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || ''
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg', '.avif'].includes(ext)) return 'image'
  if (['.mp4', '.webm', '.mov', '.mkv', '.avi', '.m4v'].includes(ext)) return 'video'
  if (['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg'].includes(ext)) return 'audio'
  if (['.md', '.markdown', '.txt', '.log'].includes(ext)) return 'text'
  if (['.json', '.jsonl', '.yaml', '.yml', '.csv', '.tsv'].includes(ext)) return 'data'
  if (['.pdf'].includes(ext)) return 'pdf'
  if (['.html', '.htm'].includes(ext)) return 'html'
  return 'file'
}

export function normalizeRuntime(input, options = {}) {
  const raw = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const source = text(options.source || raw.source || 'none', 40) || 'none'
  const stages = normalizeStages(raw.stages || raw.steps || raw.pipeline)
  const rawStage = raw.stage && typeof raw.stage === 'object'
    ? normalizeStage(raw.stage, 0)
    : null
  const stageLabel = text(raw.stageLabel || (typeof raw.stage === 'string' ? raw.stage : ''), 120)
  const stage = rawStage || (stageLabel ? { id: 'current', label: stageLabel, status: 'running', progress: 0, detail: '' } : null)
  const rawProgress = raw.progress ?? raw.percent ?? stage?.progress ?? 0
  const progress = clamp(number(rawProgress, 0) > 1 ? number(rawProgress, 0) / 100 : number(rawProgress, 0), 0, 1)
  const state = normalizeRuntimeState(raw.state ?? raw.status ?? raw.phase ?? raw.runState, source === 'none' ? 'unknown' : 'ready')
  return {
    schemaVersion: RUNTIME_SCHEMA_VERSION,
    source,
    state,
    stage,
    stages,
    progress: stage?.progress ? Math.max(progress, stage.progress) : progress,
    heartbeatAt: iso(raw.heartbeatAt || raw.lastHeartbeatAt || raw.updatedAt || raw.at),
    updatedAt: iso(raw.updatedAt || raw.heartbeatAt || raw.at),
    message: text(raw.message || raw.detail || raw.summary, 600),
    health: normalizeHealth(raw.health),
    artifacts: normalizeArtifacts(raw.artifacts || raw.outputs),
    events: normalizeEvents(raw.events || raw.activity),
    actions: normalizeActions(raw.actions),
  }
}

export function runtimeIsStale(runtime, now = Date.now(), maxAgeMs = 5 * 60 * 1000) {
  if (!runtime || runtime.state === 'unknown' || runtime.state === 'ready' || runtime.state === 'done') return false
  const at = Date.parse(runtime?.heartbeatAt || runtime?.updatedAt || '')
  if (!Number.isFinite(at)) return true
  return now - at > maxAgeMs
}

export function runtimeSummary(runtime) {
  if (!runtime) return { state: 'unknown', label: '未接入', progress: 0, stage: null }
  return {
    state: runtime.state,
    label: runtime.stage?.label || runtime.message || '',
    progress: runtime.progress,
    stage: runtime.stage,
  }
}
