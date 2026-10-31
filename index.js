/**
 * DSH Workbench — host half.
 *
 * Serves the cached inventory over same-origin HTTP and persists the user's
 * notes / status overrides outside the package checkout.
 */
import { promises as fs, readFileSync, existsSync, statSync, createReadStream } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { execFile, spawn } from 'node:child_process'
import crypto from 'node:crypto'
import { scanAll } from './scanner.js'
import { loadConfig } from './config.js'
import { buildDigest } from './digest.js'
import { readTruthDocs } from './truth-docs.js'
import { buildProjectView, projectStats } from './project-model.js'
import { normalizeFollowups, recordDiscovery, markFollowup, followupInfo, followupSummary } from './followup.js'
import { configureSkillRoots, scanSkills, getSkillDetail, isSkillPath } from './skills.js'
import { configureCodexDb, listCodexSessions, findCodexSession, readCodexDigest, codexSessionOpenUrl } from './codex-sessions.js'
import { normalizeRuntime, guessKind, runtimeIsStale } from './runtime.js'
import {
  normalizeIdentity,
  normalizeLifecycle,
  normalizeSessionPolicy,
  lifecycleOf,
  temporaryExpiry,
  cleanupSuggestion,
  lineageOf,
  lifecycleStats,
} from './project-lifecycle.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const BOOT_CONFIG = loadConfig()
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const DATA_DIR = process.env.DSH_WORKBENCH_DATA
  || path.join(DSH_HOME, 'data', 'dsh-workbench')
const CACHE_PATH = path.join(DATA_DIR, 'catalog.json')
const DELETIONS_PATH = path.join(DATA_DIR, 'deletions.log')
const OVERRIDES_PATH = path.join(DATA_DIR, 'overrides.json')
const HANDOFFS_PATH = path.join(DATA_DIR, 'handoffs.json')
const PROJECT_HANDOFF_DIR = path.join('.dsh', 'handoff')
const PROJECT_HANDOFF_DOC = 'PROJECT_STATE.md'
const PROJECT_HANDOFF_STATE = 'state.json'
const AGENTS_START = '<!-- dsh-workbench:handoff:start -->'
const AGENTS_END = '<!-- dsh-workbench:handoff:end -->'
const HANDOFF_DOC_START = '<!-- dsh-workbench:handoff-doc:start -->'
const HANDOFF_DOC_END = '<!-- dsh-workbench:handoff-doc:end -->'
const MAX_PROJECT_DOC_BYTES = 1024 * 1024
const NOTE_START = '<!-- dsh-workbench:note:start -->'
const NOTE_END = '<!-- dsh-workbench:note:end -->'
const FOLLOWUPS_PATH = path.join(DATA_DIR, 'followups.json')
const RUNTIME_CACHE_PATH = path.join(DATA_DIR, 'runtime-cache.json')
const CURATION_PATH = path.join(DATA_DIR, 'curation.json')
const SESSIONS_DIR = BOOT_CONFIG.dshSessionsDir || path.join(DSH_HOME, 'sessions')
const MAX_DIGEST_LOG_BYTES = 12 * 1024 * 1024
const SESSION_FILE_CACHE_MS = 15000
const RUNTIME_CACHE_MS = 8000
const RUNTIME_MAX_ARTIFACTS = 12
const RUNTIME_MAX_PREVIEW_BYTES = 8000
const RUNTIME_MAX_MEDIA_BYTES = 24 * 1024 * 1024

let appConfig = BOOT_CONFIG
configureSkillRoots(appConfig.skillRoots)
configureCodexDb(appConfig.codexDb)
let catalog = null
let overrides = {}
let handoffs = []
let followups = normalizeFollowups()
let curation = { projects: {} }
let curationMtime = 0
let scanning = false
let scanStartedAt = null
let scanError = null
let scanPromise = null
let sessionFileCache = { at: 0, map: new Map() }
let runtimeCache = new Map()
let runtimeDiskCache = new Map()
let runtimeDiskTimer = null
let runtimeDiskSaving = Promise.resolve()
let sessionQuery = null

function readJsonSafe(file, fallback) {
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return fallback }
}

function normalizeKey(p) {
  let s = path.resolve(String(p || '')).replace(/[\\/]+$/, '')
  if (/^[A-Za-z]:$/.test(s)) s += '\\'
  return s.toLowerCase()
}

function loadCuration(force = false) {
  try {
    const st = statSync(CURATION_PATH)
    if (!force && st.mtimeMs === curationMtime) return
    curation = readJsonSafe(CURATION_PATH, { projects: {} })
    if (!curation.projects) curation.projects = {}
    curationMtime = st.mtimeMs
  } catch {
    if (force) curation = { projects: {} }
  }
}

function loadLocalState() {
  loadCuration(true)
  overrides = readJsonSafe(OVERRIDES_PATH, {})
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) overrides = {}
  const savedHandoffs = readJsonSafe(HANDOFFS_PATH, [])
  handoffs = Array.isArray(savedHandoffs) ? savedHandoffs.filter((item) => item && typeof item === 'object') : []
  followups = normalizeFollowups(readJsonSafe(FOLLOWUPS_PATH, null))
  catalog = readJsonSafe(CACHE_PATH, null)
  if (catalog && !Array.isArray(catalog.projects)) catalog = null
  loadRuntimeDiskCache()
}

function curationFor(p) {
  return curation.projects[normalizeKey(p.path)] || null
}

function overrideFor(p) {
  return overrides[p.id] || null
}

function presentProject(p) {
  const c = curationFor(p)
  const o = overrideFor(p)
  const name = (o && o.name) || (c && c.name) || p.displayName || p.name
  const nativeNote = typeof p.handoff?.note === 'string' ? p.handoff.note.trim() : ''
  // Workbench notes are local annotations. A local note always wins; a
  // project's own handoff note is only shown read-only until the user edits it.
  const note = (o && Object.prototype.hasOwnProperty.call(o, 'note'))
    ? o.note
    : (nativeNote || (c && c.note) || '')
  const status = (o && o.status) || (c && c.status) || p.status
  const tags = [...new Set([
    ...(p.tags || []),
    ...((c && c.tags) || []),
    ...((o && o.tags) || []),
  ])]
  const deleteBlocked = !appConfig.allowDelete ? '删除功能默认关闭，可在配置中显式开启'
    : !p.topLevel ? '只允许处理顶层项目'
    : p.noise ? '缓存项不允许删除'
    : status !== 'archived' ? '只有已弃用项目可以删除'
    : (!p.path || !path.isAbsolute(String(p.path))) ? '项目路径不是绝对路径'
    : protectedReason(path.resolve(String(p.path)))
  const hidden = Boolean((o && o.hidden) || (c && c.hidden))
  const follow = followupInfo(followups, { ...p, hidden }, true)
  const lifecycle = lifecycleOf(p, o || {})
  // A project the user explicitly confirmed as long-term is no longer a
  // "new discovery" to triage, even if the scanner first saw its folder today.
  if (lifecycle.value === 'persistent' && lifecycle.source === 'manual') {
    follow.isNew = false
    follow.needsFollowup = false
    if (follow.followState === 'new') follow.followState = 'seen'
  }
  const sessionPolicy = normalizeSessionPolicy(
    (o && o.sessionPolicy) || p.identity?.sessionPolicy || p.handoff?.sessionPolicy,
  )
  // A representative image is a workbench-local pointer into the project or
  // one of its linked folders. It never copies the image into Workbench data.
  const rawRepresentative = o && o.representativeImage && typeof o.representativeImage === 'object'
    ? o.representativeImage
    : null
  const representativeImage = rawRepresentative && typeof rawRepresentative.path === 'string' && rawRepresentative.path.trim()
    ? {
        path: rawRepresentative.path.trim().slice(0, 1000),
        folder: Number.isInteger(rawRepresentative.folder) ? rawRepresentative.folder : -1,
        title: String(rawRepresentative.title || '').slice(0, 160),
      }
    : null
  const lineage = lineageOf(p, sessionPolicy)
  const cleanup = cleanupSuggestion(p, o || {})
  return {
    ...p,
    ...follow,
    displayName: name,
    name: p.name,
    note,
    noteSource: (o && Object.prototype.hasOwnProperty.call(o, 'note')) ? 'local' : (nativeNote ? 'project' : (c && c.note ? 'curated' : 'none')),
    status,
    statusSource: o && o.status ? 'manual' : c && c.status ? 'curated' : 'auto',
    tags,
    pinned: Boolean((o && o.pinned) || (c && c.pinned)),
    hidden,
    curated: Boolean(c),
    lifecycle: lifecycle.value,
    lifecycleSource: lifecycle.source,
    lifecycleConfidence: lifecycle.confidence,
    lifecycleEvidence: lifecycle.evidence,
    expiresAt: temporaryExpiry(p, o || {}),
    cleanup,
    sessionPolicy,
    representativeImage,
    lineage,
    identity: {
      ...(p.identity || {}),
      lifecycle: lifecycle.value,
      intent: (o && typeof o.intent === 'string') ? o.intent : (p.identity?.intent || ''),
      sessionPolicy,
    },
    deletable: !deleteBlocked,
    deleteBlocked,
  }
}

function presentCatalog(sessions = []) {
  if (!catalog) return null
  loadCuration()
  const projects = buildProjectView(catalog.projects, overrides, sessions, {
    workspaceNames: appConfig.workspaceNames,
    noisePatterns: appConfig.noisePatterns,
  }).map(presentProject)
  const assigned = new Map()
  for (const project of projects) {
    for (const session of project.sessions || []) {
      assigned.set(`${session.source || 'dsh'}:${String(session.id)}`, project.id)
    }
  }
  const allSessions = (Array.isArray(sessions) ? sessions : []).map((session) => ({
    ...session,
    source: session.source === 'codex' ? 'codex' : 'dsh',
    projectId: assigned.get(`${session.source === 'codex' ? 'codex' : 'dsh'}:${String(session.id)}`) || '',
  }))
  const followup = followupSummary(projects, followups)
  const stats = {
    ...catalog.stats,
    ...projectStats(projects),
    lifecycle: lifecycleStats(projects),
    followupPending: followup.pending,
    totalBytesAll: projects.reduce((a, p) => a + (p.sizeBytes || 0), 0),
  }
  return {
    ...catalog,
    projects,
    sessions: allSessions,
    stats,
    followup,
    scanning,
    scanStartedAt,
    scanError,
    dataDir: DATA_DIR,
    generatedAt: catalog.generatedAt,
    roots: catalog.roots || appConfig.roots.map((r) => r.path),
  }
}

const RUNTIME_MANIFESTS = [
  'workbench.project.json',
  '.dsh/workbench.project.json',
  '.workbench/project.json',
]
const RUNTIME_STATUS_FILES = [
  'status.json',
  'runtime/status.json',
  '.dsh/status.json',
  'workbench.status.json',
]
const RUNTIME_OUTPUT_DIRS = ['output', 'outputs', 'renders', 'exports', 'artifacts']
const RUNTIME_MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.avif': 'image/avif', '.bmp': 'image/bmp',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf', '.json': 'application/json', '.md': 'text/markdown',
  '.txt': 'text/plain', '.csv': 'text/csv',
}

function runtimeRoots(project) {
  const values = [project?.path, ...((project?.folders || []).map((folder) => folder.path))]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
  return [...new Set(values.map((value) => path.resolve(value)))]
}

function isInside(root, file) {
  const relative = path.relative(root, file)
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}

function normalizeRelative(file, root) {
  return path.relative(root, file).split(path.sep).join('/')
}

async function readJsonLimited(file, maxBytes = 256 * 1024) {
  const stat = await fs.stat(file)
  if (!stat.isFile() || stat.size > maxBytes) return null
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

async function firstExisting(roots, names) {
  for (const root of roots) {
    for (const name of names) {
      const file = path.resolve(root, name)
      if (!isInside(root, file) && file !== path.resolve(root)) continue
      try {
        if (!(await safeFileInside(root, file))) continue
        return { root, file }
      } catch {
        // keep looking
      }
    }
  }
  return null
}

async function artifactFromFile(project, root, file, meta = {}) {
  try {
    if (!(await safeFileInside(root, file))) return null
    const stat = await fs.lstat(file)
    const relative = normalizeRelative(file, root)
    const kind = guessKind(file)
    let preview = ''
    if ((kind === 'text' || kind === 'data') && stat.size <= 256 * 1024) {
      const content = await fs.readFile(file)
      preview = content.toString('utf8').slice(0, RUNTIME_MAX_PREVIEW_BYTES)
    }
    const url = kind === 'image' && stat.size <= RUNTIME_MAX_MEDIA_BYTES
      ? `/dsh-workbench/api/artifact?id=${encodeURIComponent(project.id)}&path=${encodeURIComponent(relative)}`
      : ''
    return {
      id: crypto.createHash('sha1').update(`${project.id}:${relative}`).digest('hex').slice(0, 12),
      title: String(meta.title || path.basename(file)).slice(0, 180),
      path: relative,
      role: String(meta.role || path.basename(path.dirname(file))).slice(0, 60),
      kind,
      mime: String(meta.mime || RUNTIME_MIME[path.extname(file).toLowerCase()] || '').slice(0, 100),
      sizeBytes: stat.size,
      createdAt: new Date(stat.mtimeMs).toISOString(),
      version: String(meta.version || '').slice(0, 40),
      url,
      preview,
    }
  } catch {
    return null
  }
}

async function resolveArtifacts(project, roots, list) {
  const found = []
  for (const item of Array.isArray(list) ? list : []) {
    const value = String(item?.path || item?.file || '').trim()
    if (!value) continue
    const candidates = []
    for (const root of roots) {
      const file = path.isAbsolute(value) ? path.resolve(value) : path.resolve(root, value)
      if (isInside(root, file)) candidates.push({ root, file })
    }
    for (const candidate of candidates) {
      const artifact = await artifactFromFile(project, candidate.root, candidate.file, item)
      if (artifact) { found.push(artifact); break }
    }
  }
  return found
}

async function recentFiles(dir, depth = 1, bucket = { count: 0, files: [] }) {
  if (bucket.count >= 60) return bucket
  let entries
  try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return bucket }
  for (const entry of entries) {
    if (bucket.count >= 60) break
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.dsh') continue
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (depth > 0) await recentFiles(file, depth - 1, bucket)
      continue
    }
    if (!entry.isFile()) continue
    try {
      const stat = await fs.stat(file)
      bucket.files.push({ file, mtimeMs: stat.mtimeMs })
      bucket.count += 1
    } catch {
      // skip unreadable entries
    }
  }
  return bucket
}

async function collectConventionArtifacts(project, roots) {
  const files = []
  for (const root of roots) {
    for (const name of RUNTIME_OUTPUT_DIRS) {
      const dir = path.resolve(root, name)
      if (!isInside(root, dir)) continue
      try {
        if (!(await fs.stat(dir)).isDirectory()) continue
      } catch { continue }
      const bucket = await recentFiles(dir, 1)
      files.push(...bucket.files)
    }
  }
  const unique = new Map()
  for (const entry of files) unique.set(entry.file, entry)
  const recent = [...unique.values()].sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, RUNTIME_MAX_ARTIFACTS)
  const artifacts = []
  for (const entry of recent) {
    for (const root of roots) {
      if (!isInside(root, entry.file)) continue
      const artifact = await artifactFromFile(project, root, entry.file)
      if (artifact) { artifacts.push(artifact); break }
    }
  }
  return artifacts
}

function mergeRuntime(base, live) {
  if (!base) return live
  if (!live) return base
  return {
    ...base,
    ...live,
    stage: live.stage || base.stage,
    stages: live.stages.length ? live.stages : base.stages,
    artifacts: live.artifacts.length ? live.artifacts : base.artifacts,
    events: [...base.events, ...live.events].slice(-40),
    health: live.health.length ? live.health : base.health,
    actions: live.actions.length ? live.actions : base.actions,
    message: live.message || base.message,
    heartbeatAt: live.heartbeatAt || base.heartbeatAt,
    updatedAt: live.updatedAt || base.updatedAt,
  }
}

async function readRuntimeStatus(roots) {
  const hit = await firstExisting(roots, RUNTIME_STATUS_FILES)
  if (!hit) return null
  try {
    const payload = await readJsonLimited(hit.file)
    return payload && typeof payload === 'object' && payload.runtime && typeof payload.runtime === 'object'
      ? payload.runtime
      : payload
  } catch {
    return null
  }
}

async function buildRuntime(project) {
  const roots = runtimeRoots(project)
  if (!roots.length) return null
  const manifestHit = await firstExisting(roots, RUNTIME_MANIFESTS)
  let base = null
  if (manifestHit) {
    try {
      const manifest = await readJsonLimited(manifestHit.file)
      if (manifest && typeof manifest === 'object') {
        // workbench.project.json carries the portable project identity as well
        // as optional runtime metadata. An identity-only manifest must not be
        // presented as a live "ready" runtime.
        const runtimeKeys = ['state', 'stage', 'stages', 'progress', 'heartbeatAt', 'artifacts', 'events', 'health', 'actions', 'runtime', 'status']
        const hasRuntime = runtimeKeys.some((key) => Object.prototype.hasOwnProperty.call(manifest, key))
        if (hasRuntime) {
          base = normalizeRuntime(manifest, { source: 'manifest' })
          base.manifestPath = normalizeRelative(manifestHit.file, manifestHit.root)
        }
        if (hasRuntime && manifest.status && typeof manifest.status === 'object' && manifest.status.path) {
          const statusFile = path.resolve(manifestHit.root, String(manifest.status.path))
          if (isInside(manifestHit.root, statusFile) && await safeFileInside(manifestHit.root, statusFile)) {
            try {
              const payload = await readJsonLimited(statusFile)
              if (payload) base = mergeRuntime(base, normalizeRuntime(payload, { source: 'status' }))
            } catch { /* optional status file */ }
          }
        }
      }
    } catch { /* malformed manifest is ignored */ }
  }
  const statusPayload = await readRuntimeStatus(roots)
  const live = statusPayload ? normalizeRuntime(statusPayload, { source: 'status' }) : null
  let runtime = mergeRuntime(base, live)
  if (runtime) runtime.artifacts = await resolveArtifacts(project, roots, runtime.artifacts)
  if (!runtime || !runtime.artifacts.length) {
    const convention = await collectConventionArtifacts(project, roots)
    if (convention.length) {
      if (runtime) runtime.artifacts = convention
      else runtime = normalizeRuntime({ state: 'ready', artifacts: convention }, { source: 'convention' })
    }
  }
  if (!runtime) return null
  runtime.artifacts = runtime.artifacts
    .filter((artifact, index, list) => list.findIndex((item) => item.path === artifact.path) === index)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, RUNTIME_MAX_ARTIFACTS)
  if (!runtime.heartbeatAt && runtime.artifacts[0]?.createdAt) runtime.heartbeatAt = runtime.artifacts[0].createdAt
  runtime.stale = runtimeIsStale(runtime)
  return runtime
}

async function mapLimit(items, limit, worker) {
  const list = Array.isArray(items) ? items : []
  const results = new Array(list.length)
  let cursor = 0
  async function run() {
    while (cursor < list.length) {
      const index = cursor
      cursor += 1
      results[index] = await worker(list[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), list.length) }, run))
  return results
}

function runtimeFingerprint(project) {
  return `${project.lastActivity || ''}|${project.sizeBytes || 0}|${project.fileCount || 0}`
}

function loadRuntimeDiskCache() {
  const payload = readJsonSafe(RUNTIME_CACHE_PATH, null)
  if (!payload || payload.version !== 1 || !payload.entries) return
  const now = Date.now()
  for (const [id, entry] of Object.entries(payload.entries)) {
    if (!entry || !entry.fingerprint || !entry.value) continue
    if (now - Number(entry.at || 0) > 15 * 60 * 1000) continue
    runtimeDiskCache.set(id, entry)
  }
}

function scheduleRuntimeDiskSave() {
  if (runtimeDiskTimer) return
  runtimeDiskTimer = setTimeout(() => {
    runtimeDiskTimer = null
    saveRuntimeDiskCache()
  }, 1200)
  runtimeDiskTimer.unref?.()
}

function saveRuntimeDiskCache() {
  const entries = Object.fromEntries([...runtimeDiskCache.entries()]
    .sort((a, b) => Number(b[1].at || 0) - Number(a[1].at || 0))
    .slice(0, 200))
  const payload = { version: 1, savedAt: new Date().toISOString(), entries }
  runtimeDiskSaving = runtimeDiskSaving.then(() => writeAtomic(RUNTIME_CACHE_PATH, JSON.stringify(payload))).catch(() => {})
  return runtimeDiskSaving
}

async function runtimeForProject(project) {
  const now = Date.now()
  const fingerprint = runtimeFingerprint(project)
  const cached = runtimeCache.get(project.id)
  if (cached && now - cached.at < RUNTIME_CACHE_MS) return cached.value
  const disk = runtimeDiskCache.get(project.id)
  if (disk && disk.fingerprint === fingerprint && now - Number(disk.at || 0) < 15 * 60 * 1000) {
    runtimeCache.set(project.id, { at: now, value: disk.value })
    return disk.value
  }
  let value = null
  try {
    value = await buildRuntime(project)
  } catch (error) {
    value = {
      schemaVersion: 1, source: 'error', state: 'unknown',
      stage: null, stages: [], progress: 0, heartbeatAt: '', updatedAt: '',
      message: `读取运行状态失败：${error?.message || error}`,
      health: [], artifacts: [], events: [], actions: [],
    }
  }
  runtimeCache.set(project.id, { at: now, value })
  runtimeDiskCache.set(project.id, { at: now, fingerprint, value })
  scheduleRuntimeDiskSave()
  return value
}

async function attachRuntimes(data) {
  if (!data) return data
  const targets = data.projects.filter((project) => project.topLevel && !project.noise && !project.container)
  const runtimes = await mapLimit(targets, 16, (project) => runtimeForProject(project))
  const byId = new Map()
  targets.forEach((project, index) => byId.set(project.id, runtimes[index]))
  const measured = runtimes.filter(Boolean)
  const runtimeStats = {
    measured: measured.length,
    running: measured.filter((runtime) => runtime.state === 'running').length,
    waiting: measured.filter((runtime) => runtime.state === 'waiting').length,
    blocked: measured.filter((runtime) => runtime.state === 'blocked' || runtime.state === 'failed').length,
    withArtifacts: measured.filter((runtime) => runtime.artifacts?.length).length,
  }
  return {
    ...data,
    stats: { ...data.stats, runtimeMeasured: runtimeStats.measured, runtimeRunning: runtimeStats.running, runtimeAttention: runtimeStats.waiting + runtimeStats.blocked },
    runtime: runtimeStats,
    projects: data.projects.map((project) => byId.has(project.id)
      ? { ...project, runtime: byId.get(project.id) }
      : project),
  }
}

async function renameWithRetry(from, to, attempts = 5) {
  let lastError
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await fs.rename(from, to)
      return
    } catch (error) {
      lastError = error
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(error?.code) || attempt === attempts - 1) throw error
      await new Promise((resolve) => setTimeout(resolve, 30 * (attempt + 1)))
    }
  }
  throw lastError
}

async function saveOverrides() {
  await writeAtomic(OVERRIDES_PATH, JSON.stringify(overrides, null, 2))
}

async function saveHandoffs() {
  await writeAtomic(HANDOFFS_PATH, JSON.stringify(handoffs, null, 2))
}

async function saveFollowups() {
  await writeAtomic(FOLLOWUPS_PATH, JSON.stringify(followups, null, 2))
}

function trimHandoffs() {
  const perProject = new Map()
  handoffs = handoffs
    .filter((item) => item && typeof item === 'object')
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
    .filter((item) => {
      const key = String(item.projectId || item.projectPath || 'manual')
      const count = perProject.get(key) || 0
      if (count >= 20) return false
      perProject.set(key, count + 1)
      return true
    })
    .slice(0, 200)
}

async function handleHandoffs(req, res) {
  if (req.method === 'GET') {
    let projectId = ''
    try { projectId = String(new URL(req.url || '/', 'http://local').searchParams.get('projectId') || '') } catch { /* keep all */ }
    const visible = projectId ? handoffs.filter((item) => item.projectId === projectId) : handoffs
    sendJson(res, 200, { ok: true, handoffs: visible.slice(0, 100) })
    return
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'method not allowed' })
    return
  }
  if (!sameOrigin(req)) { sendJson(res, 403, { ok: false, error: 'origin rejected' }); return }
  let body
  try { body = await readBody(req) } catch (error) {
    sendJson(res, 400, { ok: false, error: error?.message || '请求格式错误' })
    return
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    sendJson(res, 400, { ok: false, error: '请求格式错误' })
    return
  }
  const text = (value, limit) => String(value ?? '').trim().slice(0, limit)
  const sourceKind = ['dsh', 'codex', 'manual'].includes(body.sourceKind) ? body.sourceKind : 'manual'
  const now = new Date().toISOString()
  const previous = body.id ? handoffs.find((item) => item.id === String(body.id)) : null
  if (body.id && body.status && !previous) {
    sendJson(res, 404, { ok: false, error: '交接记录不存在' })
    return
  }
  const status = ['prefilled', 'sent', 'running', 'completed', 'failed'].includes(body.status)
    ? body.status
    : (body.mode && body.mode !== 'prompt-only' ? 'sent' : 'prefilled')
  const record = {
    id: text(body.id, 80) || `handoff-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    status,
    projectId: text(body.projectId, 80),
    projectPath: text(body.projectPath, 1000),
    sourceKind,
    sourceSessionId: text(body.sourceSessionId, 200),
    sourceTitle: text(body.sourceTitle, 300),
    sourceUpdatedAt: text(body.sourceUpdatedAt, 80),
    goal: text(body.goal, 4000),
    progress: text(body.progress, 6000),
    constraints: text(body.constraints, 4000),
    files: text(body.files, 4000),
    summary: text(body.summary, 8000),
    prompt: text(body.prompt, 30000),
    projectDoc: text(body.projectDoc, 1000),
    targetApp: ['dsh', 'opencode', 'codex', 'comfyui', 'other'].includes(body.targetApp) ? body.targetApp : 'dsh',
    targetSessionId: text(body.targetSessionId, 200),
    mode: text(body.mode, 80),
    createdAt: text(body.createdAt, 80) || now,
    updatedAt: now,
  }
  if (!record.projectPath && !record.projectId && !previous) {
    sendJson(res, 400, { ok: false, error: '缺少项目信息' })
    return
  }
  const statusOnly = previous && Object.keys(body).every((key) => key === 'id' || key === 'status')
  const stored = statusOnly ? { ...previous, status, updatedAt: now } : record
  handoffs = [stored, ...handoffs.filter((item) => item.id !== stored.id)]
  trimHandoffs()
  try {
    await saveHandoffs()
  } catch (error) {
    sendJson(res, 500, { ok: false, error: `保存交接记录失败：${error?.message || error}` })
    return
  }
  sendJson(res, 201, { ok: true, handoff: stored })
}

async function runScan() {
  if (scanning) return scanPromise
  scanning = true
  scanStartedAt = new Date().toISOString()
  scanError = null
  runtimeCache = new Map()
  scanPromise = (async () => {
    try {
      const previousIds = (catalog?.projects || []).map((project) => project.id)
      appConfig = loadConfig()
      configureSkillRoots(appConfig.skillRoots)
      configureCodexDb(appConfig.codexDb)
      const next = await scanAll(appConfig)
      followups = recordDiscovery(followups, next.projects, new Date().toISOString(), previousIds)
      await saveFollowups()
      await writeAtomic(CACHE_PATH, JSON.stringify(next, null, 2))
      catalog = next
    } catch (error) {
      scanError = error?.message || String(error)
      throw error
    } finally {
      scanning = false
      scanStartedAt = null
    }
  })()
  return scanPromise
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
    'x-content-type-options': 'nosniff',
  })
  res.end(body)
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])
const EXTRA_ALLOWED_HOSTS = new Set(String(process.env.DSH_WORKBENCH_ALLOWED_HOSTS || '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean))

function hostNameFromHeader(value) {
  try { return new URL(`http://${String(value || '').trim()}`).hostname.toLowerCase() } catch { return '' }
}

function isLoopbackHostname(value) {
  const host = String(value || '').toLowerCase()
  return LOOPBACK_HOSTS.has(host) || /^127\.(?:\d{1,3}\.){2}\d{1,3}$/.test(host) || /^::ffff:127\./.test(host)
}

/**
 * Reject DNS-rebinding Host headers and cross-site browser writes. The
 * default is local-only; DSH_WORKBENCH_ALLOWED_HOSTS is an explicit opt-in
 * for users who really expose the host on a LAN.
 */
function requestGate(req) {
  const hostHeader = String(req.headers.host || '').trim()
  const hostname = hostNameFromHeader(hostHeader)
  if (!hostname) return { ok: false, error: 'missing or invalid host header' }
  if (!isLoopbackHostname(hostname) && !EXTRA_ALLOWED_HOSTS.has(hostname)) {
    return { ok: false, error: 'host is not allowed' }
  }
  const site = String(req.headers['sec-fetch-site'] || '').toLowerCase()
  if (site === 'cross-site') return { ok: false, error: 'cross-site request rejected' }
  const origin = req.headers.origin
  if (origin) {
    try {
      const parsed = new URL(origin)
      const originHost = parsed.hostname.toLowerCase()
      if (!isLoopbackHostname(originHost) && !EXTRA_ALLOWED_HOSTS.has(originHost)) {
        return { ok: false, error: 'origin is not allowed' }
      }
      // Loopback alone is not same-origin: another local service on a
      // different port must not be able to trigger state-changing requests.
      if (parsed.host.toLowerCase() !== hostHeader.toLowerCase()) {
        return { ok: false, error: 'origin is not same-origin' }
      }
    } catch {
      return { ok: false, error: 'invalid origin' }
    }
  }
  return { ok: true }
}

function sameOrigin(req) {
  return requestGate(req).ok
}

async function readBody(req, limit = 1024 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) {
      const error = new Error('request body too large')
      error.statusCode = 413
      throw error
    }
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (!text) return {}
  try {
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      const error = new Error('request body must be a JSON object')
      error.statusCode = 400
      throw error
    }
    return parsed
  } catch (error) {
    if (error?.statusCode) throw error
    const invalid = new Error('request body must be valid JSON')
    invalid.statusCode = 400
    throw invalid
  }
}

function isSameOrInside(child, parent) {
  const c = normalizeKey(child)
  const p = normalizeKey(parent)
  return c === p || c.startsWith(p.endsWith(path.sep) ? p : p + path.sep)
}

async function hasSymlinkComponent(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate))
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return true
  let cursor = path.resolve(root)
  for (const part of relative.split(path.sep)) {
    if (!part) continue
    cursor = path.join(cursor, part)
    try {
      if ((await fs.lstat(cursor)).isSymbolicLink()) return true
    } catch {
      return true
    }
  }
  return false
}

async function assertSafeWritePath(root, file) {
  const absRoot = path.resolve(root)
  const absFile = path.resolve(file)
  if (!isSameOrInside(absFile, absRoot)) throw new Error('写入目标不在项目目录内')
  const relative = path.relative(absRoot, absFile)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('写入目标不在项目目录内')
  let cursor = absRoot
  const parts = relative.split(path.sep).filter(Boolean)
  for (let index = 0; index < parts.length; index += 1) {
    cursor = path.join(cursor, parts[index])
    try {
      const stat = await fs.lstat(cursor)
      if (stat.isSymbolicLink()) throw new Error('写入路径包含符号链接，已拒绝')
      if (index < parts.length - 1 && !stat.isDirectory()) throw new Error('写入路径的上级不是目录')
    } catch (error) {
      if (error?.code === 'ENOENT') break
      throw error
    }
  }
  return absFile
}

async function safeFileInside(root, candidate) {
  try {
    if (!isInside(root, candidate)) return false
    if (await hasSymlinkComponent(root, candidate)) return false
    const stat = await fs.lstat(candidate)
    if (!stat.isFile() || stat.isSymbolicLink()) return false
    return await realPathInside(root, candidate)
  } catch {
    return false
  }
}

async function realPathInside(root, candidate) {
  try {
    const [realRoot, realCandidate] = await Promise.all([fs.realpath(root), fs.realpath(candidate)])
    return isSameOrInside(realCandidate, realRoot)
  } catch { return false }
}

function protectedReason(target) {
  const abs = path.resolve(String(target || ''))
  if (/^\\\\/.test(abs)) return '网络路径受保护'
  const root = path.parse(abs).root
  if (!abs || normalizeKey(abs) === normalizeKey(root)) return '盘符根目录受保护'

  const neverInside = [
    path.join(root, '$Recycle.Bin'),
    path.join(root, 'System Volume Information'),
    path.join(root, 'Recovery'),
    HERE,
    DATA_DIR,
    path.join(DSH_HOME, 'profiles'),
    path.join(DSH_HOME, 'data'),
    path.join(DSH_HOME, 'sessions'),
    path.join(DSH_HOME, 'tools'),
    'C:\\Windows',
    'C:\\Program Files',
    'C:\\Program Files (x86)',
    'C:\\ProgramData',
    path.join(os.homedir(), 'AppData'),
    path.join(os.homedir(), 'Documents'),
    path.join(os.homedir(), 'Desktop'),
    path.join(os.homedir(), 'Downloads'),
    ...(appConfig.protectedPaths || []),
  ]
  for (const guard of neverInside) {
    if (!guard) continue
    if (isSameOrInside(abs, guard)) return `受保护目录：${guard}`
  }

  const neverAncestor = [
    os.homedir(),
    path.join(os.homedir(), 'Documents'),
    path.join(os.homedir(), 'Desktop'),
    path.join(os.homedir(), 'Downloads'),
    DSH_HOME,
    HERE,
    'C:\\Windows',
    'C:\\Program Files',
    'C:\\Program Files (x86)',
    'C:\\ProgramData',
    'C:\\Users',
    ...(appConfig.protectedPaths || []),
  ]
  for (const guard of neverAncestor) {
    if (!guard) continue
    if (isSameOrInside(guard, abs)) return `不能删除受保护目录的上级：${guard}`
  }
  return ''
}

async function inspectDeleteTarget(id) {
  if (!catalog) throw new Error('项目目录尚未加载')
  const raw = catalog.projects.find((p) => p.id === id)
  if (!raw) throw new Error('目录中没有这个项目')
  if (!raw.topLevel) throw new Error('只允许处理顶层项目')
  if (raw.noise) throw new Error('缓存项不允许删除')
  const project = presentProject(raw)
  if (project.status !== 'archived') throw new Error('只有已弃用项目可以删除')
  if (!raw.path || !path.isAbsolute(String(raw.path))) throw new Error('项目路径不是绝对路径')
  const target = path.resolve(String(raw.path))
  const blocked = protectedReason(target)
  if (blocked) throw new Error(blocked)

  let st
  try { st = await fs.lstat(target) } catch { throw new Error('项目目录不存在') }
  if (!st.isDirectory()) throw new Error('目标不是目录')
  if (st.isSymbolicLink()) throw new Error('符号链接 / 目录联接不允许删除')

  let real
  try { real = await fs.realpath(target) } catch { throw new Error('无法解析真实路径') }
  if (normalizeKey(real) !== normalizeKey(target)) throw new Error('路径经过链接跳转，已拒绝')

  return { raw, project, target }
}

function recycleTarget(target) {
  const script = [
    "$ErrorActionPreference = 'Stop'",
    'Add-Type -AssemblyName Microsoft.VisualBasic',
    '$p = $env:WB_DELETE_TARGET',
    "if (-not (Test-Path -LiteralPath $p)) { throw 'target not found' }",
    '$item = Get-Item -LiteralPath $p -Force',
    'if ($item.PSIsContainer) {',
    "  [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($p, 'ThrowException', 'SendToRecycleBin')",
    '} else {',
    "  [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($p, 'ThrowException', 'SendToRecycleBin')",
    '}',
  ].join('\n')
  const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  return new Promise((resolve, reject) => {
    execFile(powershell, [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script,
    ], {
      windowsHide: true,
      timeout: 120000,
      env: { ...process.env, WB_DELETE_TARGET: target },
    }, (error, stdout, stderr) => {
      if (error) {
        const detail = String(stderr || error.message || '').trim().slice(0, 600)
        reject(new Error(detail || '回收站操作失败'))
      } else {
        resolve(String(stdout || '').trim())
      }
    })
  })
}

async function removeTarget(target, mode) {
  if (mode === 'permanent') {
    await fs.rm(target, { recursive: true, force: false, maxRetries: 2, retryDelay: 150 })
    return
  }
  await recycleTarget(target)
}

function removeFromCatalog(ids) {
  if (!catalog) return 0
  const targets = catalog.projects.filter((p) => ids.has(p.id))
  const removed = new Set()
  for (const p of catalog.projects) {
    if (ids.has(p.id) || targets.some((t) => isSameOrInside(p.path, t.path))) removed.add(p.id)
  }
  if (!removed.size) return 0
  catalog.projects = catalog.projects.filter((p) => !removed.has(p.id))
  const projects = catalog.projects
  catalog.stats = {
    ...(catalog.stats || {}),
    projectCount: projects.length,
    topLevelCount: projects.filter((p) => p.topLevel).length,
    nestedCount: projects.filter((p) => !p.topLevel).length,
    totalBytes: projects.reduce((a, p) => a + (p.sizeBytes || 0), 0),
    totalBytesAll: projects.reduce((a, p) => a + (p.sizeBytes || 0), 0),
  }
  return removed.size
}

async function saveCatalogCache() {
  if (!catalog) return
  await writeAtomic(CACHE_PATH, JSON.stringify(catalog, null, 2))
}

async function appendDeletionLog(entry) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true })
    await fs.appendFile(DELETIONS_PATH, JSON.stringify(entry) + '\n', 'utf8')
  } catch {
    // Logging must never turn a successful filesystem operation into a failure.
  }
}

function isKnownPath(target) {
  if (!catalog || !target) return false
  const key = normalizeKey(target)
  if (catalog.projects.some((p) => {
    const base = normalizeKey(p.path)
    const sep = String.fromCharCode(92)
    return key === base || key.startsWith(base.endsWith(sep) ? base : base + sep)
  })) return true
  if (Array.isArray(catalog.software) && catalog.software.some((s) => (s.installPath && normalizeKey(s.installPath) === key))) return true
  return Object.values(overrides).some((item) => Array.isArray(item?.folders)
    && item.folders.some((folder) => normalizeKey(typeof folder === 'string' ? folder : folder?.path) === key))
}

function findCatalogProject(id) {
  return catalog?.projects.find((p) => p.id === String(id || '')) || null
}

const FOLDER_ROLES = new Set(['code', 'assets', 'output', 'data', 'docs', 'reference'])

async function handleProjectFolders(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return }
  if (!sameOrigin(req)) { sendJson(res, 403, { ok: false, error: 'origin rejected' }); return }
  let body
  try { body = await readBody(req) } catch (error) {
    sendJson(res, 400, { ok: false, error: error?.message || '请求格式错误' })
    return
  }
  const project = findCatalogProject(body.id)
  if (!project) { sendJson(res, 404, { ok: false, error: 'unknown project' }); return }
  if (!String(body.path || '').trim()) { sendJson(res, 400, { ok: false, error: '缺少目录路径' }); return }
  const target = path.resolve(String(body.path || ''))
  const current = Array.isArray(overrides[project.id]?.folders) ? overrides[project.id].folders : []
  if (req.method === 'DELETE') {
    const next = current.filter((item) => normalizeKey(typeof item === 'string' ? item : item?.path) !== normalizeKey(target))
    const patch = { ...(overrides[project.id] || {}), folders: next }
    if (!next.length) delete patch.folders
    overrides[project.id] = patch
    await saveOverrides()
    sendJson(res, 200, { ok: true, folders: next })
    return
  }
  if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return }
  if (!target || !path.isAbsolute(target)) { sendJson(res, 400, { ok: false, error: '必须是绝对路径' }); return }
  const winSep = String.fromCharCode(92)
  if (target.startsWith('//') || target.startsWith(winSep + winSep)) {
    sendJson(res, 400, { ok: false, error: '不支持网络路径或设备路径' })
    return
  }
  if (normalizeKey(target) === normalizeKey(project.path)) { sendJson(res, 400, { ok: false, error: '主目录已经在项目里' }); return }
  if (current.some((item) => normalizeKey(typeof item === 'string' ? item : item?.path) === normalizeKey(target))) {
    sendJson(res, 409, { ok: false, error: '这个目录已经关联' })
    return
  }
  if (current.length >= 8) { sendJson(res, 400, { ok: false, error: '单个项目最多关联 8 个目录' }); return }
  const insideProject = isSameOrInside(target, project.path)
  if (!insideProject) {
    const blocked = protectedReason(target)
    if (blocked) { sendJson(res, 403, { ok: false, error: blocked }); return }
  }
  try {
    const linkStat = await fs.lstat(target)
    if (linkStat.isSymbolicLink()) throw new Error('不允许关联符号链接或目录联接')
    if (!linkStat.isDirectory()) throw new Error('不是目录')
  } catch (error) {
    sendJson(res, 404, { ok: false, error: error?.message || '目录不存在' })
    return
  }
  const role = FOLDER_ROLES.has(String(body.role || '')) ? String(body.role) : 'reference'
  const next = [...current, { path: target, role }]
  overrides[project.id] = { ...(overrides[project.id] || {}), folders: next }
  await saveOverrides()
  sendJson(res, 200, { ok: true, folders: next })
}

async function sessionExists(sessionId) {
  if (!sessionQuery || typeof sessionQuery.listSessions !== 'function') return false
  try {
    const records = await withTimeout(sessionQuery.listSessions(), 4000, '读取会话列表超时')
    return (Array.isArray(records) ? records : []).some((record) => String(record?.header?.id || '') === String(sessionId))
  } catch {
    return false
  }
}

async function handleProjectSessions(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return }
  if (!sameOrigin(req)) { sendJson(res, 403, { ok: false, error: 'origin rejected' }); return }
  let body
  try { body = await readBody(req) } catch (error) {
    sendJson(res, 400, { ok: false, error: error?.message || '请求格式错误' })
    return
  }
  const project = findCatalogProject(body.id)
  if (!project) { sendJson(res, 404, { ok: false, error: 'unknown project' }); return }
  if (project.noise || project.container) { sendJson(res, 400, { ok: false, error: '缓存项或工作区容器不能关联会话' }); return }
  const sessionId = String(body.sessionId || '').trim()
  if (!sessionId) { sendJson(res, 400, { ok: false, error: '缺少会话 ID' }); return }
  const source = body.source === 'codex' ? 'codex' : 'dsh'
  const same = (item) => {
    const record = typeof item === 'string' ? { id: item, source: 'dsh' } : (item || {})
    return String(record.id || '') === sessionId && String(record.source || 'dsh') === source
  }
  const current = Array.isArray(overrides[project.id]?.sessions) ? overrides[project.id].sessions : []
  const index = current.findIndex(same)
  if (req.method === 'DELETE') {
    const next = current.filter((item) => !same(item))
    const patch = { ...(overrides[project.id] || {}), sessions: next }
    if (!next.length) delete patch.sessions
    overrides[project.id] = patch
    await saveOverrides()
    sendJson(res, 200, { ok: true, sessions: next })
    return
  }
  if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return }
  if (index >= 0) { sendJson(res, 409, { ok: false, error: '这个会话已经关联' }); return }
  if (current.length >= 200) { sendJson(res, 400, { ok: false, error: '单个项目最多关联 200 个会话' }); return }
  const exists = source === 'codex' ? Boolean(findCodexSession(sessionId)) : await sessionExists(sessionId)
  if (!exists) { sendJson(res, 404, { ok: false, error: source === 'codex' ? 'Codex 会话不存在或索引已过期' : '会话不存在' }); return }
  const next = [...current, { id: sessionId, source, linkedAt: new Date().toISOString() }]
  overrides[project.id] = { ...(overrides[project.id] || {}), sessions: next }
  await saveOverrides()
  sendJson(res, 200, { ok: true, sessions: next })
}

async function findOpenCodeCli() {
  const base = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'ai.opencode.desktop', 'cli')
  try {
    const entries = await fs.readdir(base, { withFileTypes: true })
    const dirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    for (const dir of dirs) {
      const candidate = path.join(base, dir, 'opencode-cli.exe')
      try {
        const st = await fs.stat(candidate)
        if (st.isFile()) return candidate
      } catch { /* try the next installed version */ }
    }
  } catch { /* OpenCode Desktop is optional */ }
  return ''
}

function projectAllowedFolders(project) {
  return [
    project.path,
    ...(Array.isArray(overrides[project.id]?.folders) ? overrides[project.id].folders : [])
      .map((folder) => typeof folder === 'string' ? folder : folder?.path),
  ].filter(Boolean)
}

function projectCwd(project, raw) {
  const cwd = path.resolve(String(raw || project.path || ''))
  if (!path.isAbsolute(cwd)) return ''
  return projectAllowedFolders(project).some((folder) => normalizeKey(folder) === normalizeKey(cwd)) ? cwd : ''
}

function runGit(cwd, args) {
  return new Promise((resolve) => {
    // Never let a repository's own config launch a hook, fsmonitor command or
    // external diff during a read-only snapshot.
    const safeArgs = [
      '-c', 'core.fsmonitor=false',
      '-c', 'core.hooksPath=',
      '-c', 'diff.external=',
      '-C', cwd,
      ...args,
    ]
    const env = {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
      GIT_TERMINAL_PROMPT: '0',
      GIT_OPTIONAL_LOCKS: '0',
    }
    execFile('git', safeArgs, { timeout: 5000, maxBuffer: 1024 * 1024, windowsHide: true, env }, (error, stdout) => {
      resolve(error ? '' : String(stdout || '').trim())
    })
  })
}

async function gitSnapshot(cwd) {
  const inside = await runGit(cwd, ['rev-parse', '--is-inside-work-tree'])
  if (inside !== 'true') return null
  const [branch, status, log] = await Promise.all([
    runGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']),
    runGit(cwd, ['status', '--porcelain=v1']),
    runGit(cwd, ['log', '-5', '--pretty=format:%h%x09%ad%x09%s', '--date=short']),
  ])
  const changed = status.split(/\r?\n/).filter(Boolean).map((line) => line.slice(3).trim()).filter(Boolean).slice(0, 80)
  const recent = log.split(/\r?\n/).filter(Boolean).map((line) => {
    const [hash, date, subject] = line.split('\t')
    return { hash, date, subject }
  })
  return { branch: branch || '(detached)', dirty: changed.length, changed, recent }
}

const fileQueues = new Map()

function withFileLock(file, task) {
  const key = path.resolve(file)
  const previous = fileQueues.get(key) || Promise.resolve()
  const run = previous.catch(() => {}).then(task)
  fileQueues.set(key, run)
  run.finally(() => {
    if (fileQueues.get(key) === run) fileQueues.delete(key)
  }).catch(() => {})
  return run
}

async function writeAtomic(file, content) {
  return withFileLock(file, async () => {
    await fs.mkdir(path.dirname(file), { recursive: true })
    const tmp = `${file}.${process.pid}.${Date.now()}.${crypto.randomBytes(6).toString('hex')}.tmp`
    try {
      await fs.writeFile(tmp, content, 'utf8')
      await renameWithRetry(tmp, file)
    } finally {
      try { await fs.rm(tmp, { force: true }) } catch { /* temp cleanup is best effort */ }
    }
  })
}

function agentsPointer() {
  return `${AGENTS_START}
## 项目交接（可视化工作台维护）

开始工作前先读 [\`.dsh/handoff/PROJECT_STATE.md\`](.dsh/handoff/PROJECT_STATE.md)。它记录当前目标、最近改动、验证结果和下一步。

完成有意义的改动后，更新同一文件：目标、改动文件、验证方式、下一步。不要把工作状态只留在会话里。
${AGENTS_END}`
}

async function upsertAgentsPointer(cwd) {
  const file = path.join(cwd, 'AGENTS.md')
  await assertSafeWritePath(cwd, file)
  let current = ''
  try {
    const st = await fs.stat(file)
    if (st.size > 1024 * 1024) throw new Error('AGENTS.md 超过 1 MiB，已跳过自动写入')
    current = await fs.readFile(file, 'utf8')
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  const block = agentsPointer()
  const range = markerRange(current, AGENTS_START, AGENTS_END, 'AGENTS.md 交接块')
  const next = range
    ? `${current.slice(0, range.start)}${block}${current.slice(range.endEnd)}`
    : `${current.trimEnd()}${current.trim() ? '\n\n' : ''}${block}\n`
  if (next !== current) await writeAtomic(file, next)
  return file
}

async function readProjectHandoff(cwd) {
  const base = path.join(cwd, PROJECT_HANDOFF_DIR)
  let state = null
  try { state = JSON.parse(await fs.readFile(path.join(base, PROJECT_HANDOFF_STATE), 'utf8')) } catch { /* no handoff yet */ }
  let docStat = null
  try { docStat = await fs.stat(path.join(base, PROJECT_HANDOFF_DOC)) } catch { /* doc may not exist yet */ }
  if (!state && !docStat) return null
  // Codex/DSH may only edit PROJECT_STATE.md. Surface the doc mtime so the
  // workbench does not claim the project has no memory after a native edit.
  const docUpdatedAt = docStat?.mtime ? new Date(docStat.mtime).toISOString() : null
  if (!state) return { updatedAt: docUpdatedAt }
  const stateUpdatedAt = state.updatedAt || null
  return docUpdatedAt && (!stateUpdatedAt || docUpdatedAt > stateUpdatedAt)
    ? { ...state, updatedAt: docUpdatedAt }
    : state
}

/**
 * Write the portable half of the identity next to the project, not only in
 * the workbench's private overrides. A future Codex/DSH session opening this
 * directory can read this manifest without knowing anything about the panel.
 */
async function writeProjectIdentityManifest(cwd, identity) {
  const existing = ['workbench.project.json', '.dsh/workbench.project.json', '.workbench/project.json']
  let target = path.join(cwd, '.dsh', 'workbench.project.json')
  let current = {}
  for (const name of existing) {
    const file = path.join(cwd, name)
    try {
      const parsed = JSON.parse(await fs.readFile(file, 'utf8'))
      if (parsed && typeof parsed === 'object') {
        target = file
        current = parsed
        break
      }
    } catch { /* keep looking */ }
  }
  const currentIntegration = current.integration && typeof current.integration === 'object' ? current.integration : {}
  const nextIntegration = identity.integration && typeof identity.integration === 'object' ? identity.integration : {}
  const currentEntry = currentIntegration.entry && typeof currentIntegration.entry === 'object' ? currentIntegration.entry : {}
  const nextEntry = nextIntegration.entry && typeof nextIntegration.entry === 'object' ? nextIntegration.entry : {}
  const keep = (next, fallback) => next === undefined || next === null || next === '' || (Array.isArray(next) && !next.length)
    ? fallback
    : next
  const integration = {
    ...currentIntegration,
    kind: keep(nextIntegration.kind, currentIntegration.kind || ''),
    agent: keep(nextIntegration.agent, currentIntegration.agent || ''),
    apply: keep(nextIntegration.apply, currentIntegration.apply || ''),
    entry: {
      ...currentEntry,
      type: keep(nextEntry.type, currentEntry.type || ''),
      value: keep(nextEntry.value, currentEntry.value || ''),
    },
    state: keep(nextIntegration.state, currentIntegration.state || []),
  }
  await assertSafeWritePath(cwd, target)
  const next = {
    ...current,
    schemaVersion: 1,
    lifecycle: identity.lifecycle || current.lifecycle || 'unclassified',
    intent: identity.intent || current.intent || '',
    ...(identity.expiresAt || current.expiresAt ? { expiresAt: identity.expiresAt || current.expiresAt } : {}),
    sessionPolicy: identity.sessionPolicy || current.sessionPolicy || {},
    integration,
    updatedAt: identity.updatedAt || new Date().toISOString(),
  }
  await writeAtomic(target, JSON.stringify(next, null, 2))
  return { path: target, identity: normalizeIdentity(next) }
}


// Only standalone marker lines delimit a managed note block. A handoff document
// may mention the marker syntax in prose; that must never be treated as a block.
function escapeRegExp(value) {
  const specials = String.fromCharCode(92) + '^$.*+?()[]{}|'
  return [...String(value)].map((ch) => specials.includes(ch) ? String.fromCharCode(92) + ch : ch).join('')
}

function lineMarkerRegex(marker) {
  return new RegExp(`^${escapeRegExp(marker)}[ \t]*\r?$`, 'm')
}

/**
 * Return the exact line-anchored managed block, or null when the document is
 * unmanaged. A half-written block is an error: appending a second opener would
 * corrupt the user's file and make every future merge ambiguous.
 */
function markerRange(doc, startMarker, endMarker, label) {
  const startRe = lineMarkerRegex(startMarker)
  const endRe = lineMarkerRegex(endMarker)
  const starts = [...doc.matchAll(new RegExp(startRe.source, 'gm'))]
  if (!starts.length) return null
  if (starts.length > 1) throw new Error(`${label}存在多个起始标记；已拒绝写入，请先手动合并为一个。`)
  const start = starts[0]
  const from = start.index + start[0].length
  const ends = [...doc.slice(from).matchAll(new RegExp(endRe.source, 'gm'))]
  if (!ends.length) throw new Error(`${label}的起始标记存在但缺少结束标记；已拒绝写入，请先手动补齐或删除该标记。`)
  if (ends.length > 1) throw new Error(`${label}存在多个结束标记；已拒绝写入，请先手动合并为一个。`)
  const end = ends[0]
  return { start: start.index, end: from + end.index, endEnd: from + end.index + end[0].length }
}

const NOTE_START_RE = /^<!-- dsh-workbench:note:start -->[ \t]*\r?$/m
const NOTE_END_RE = /^<!-- dsh-workbench:note:end -->[ \t]*\r?$/m
const IDENTITY_START = '<!-- dsh-workbench:identity:start -->'
const IDENTITY_END = '<!-- dsh-workbench:identity:end -->'
const IDENTITY_START_RE = /^<!-- dsh-workbench:identity:start -->[ \t]*\r?$/m
const IDENTITY_END_RE = /^<!-- dsh-workbench:identity:end -->[ \t]*\r?$/m

function identityRange(doc) {
  return markerRange(doc, IDENTITY_START, IDENTITY_END, '项目身份块')
}

function identityDocBlock(identity = {}) {
  const lines = [IDENTITY_START, '## 项目身份', '', `- 生命周期：${identity.lifecycle || 'unclassified'}`]
  if (identity.intent) lines.push(`- 目的：${identity.intent}`)
  if (identity.integration?.kind) lines.push(`- 接入方式：${identity.integration.kind}`)
  if (identity.integration?.entry?.value) lines.push(`- 入口：${identity.integration.entry.value}`)
  if (identity.sessionPolicy?.rootSessionId) lines.push(`- 项目主线会话：${identity.sessionPolicy.rootSessionId}`)
  lines.push(IDENTITY_END)
  return lines.join('\n')
}

function replaceIdentityBlock(doc, identity) {
  const block = identityDocBlock(identity)
  const range = identityRange(doc)
  if (range) return `${doc.slice(0, range.start)}${block}${doc.slice(range.endEnd)}`
  return `${doc.trimEnd()}${doc.trim() ? '\n\n' : ''}${block}\n`
}

function noteRange(doc) {
  return markerRange(doc, NOTE_START, NOTE_END, '工作台备注块')
}

function projectNoteBlock(note) {
  const safeNote = String(note || '').trim().replace(/<!--\s*dsh-workbench:note:(?:start|end)\s*-->/gi, '[marker removed]')
  return `${NOTE_START}
## 工作台备注

${safeNote || '_(空)_'}
${NOTE_END}`
}

function replaceProjectNote(doc, note) {
  const block = projectNoteBlock(note)
  const range = noteRange(doc)
  if (!String(note || '').trim()) {
    if (range) return `${doc.slice(0, range.start)}${doc.slice(range.endEnd)}`.trimEnd() + '\n'
    return doc
  }
  if (range) return `${doc.slice(0, range.start)}${block}${doc.slice(range.endEnd)}`
  return `${doc.trimEnd()}${doc.trim() ? '\n\n' : ''}${block}\n`
}

function readProjectNote(doc) {
  const range = noteRange(doc)
  if (!range) return ''
  return doc.slice(range.start + NOTE_START.length, range.end)
    .replace(/^\s*##\s*工作台备注\s*/m, '')
    .trim()
}

/**
 * Update only the workbench-managed handoff block. Everything outside the
 * markers is user content and must survive every write. A legacy document
 * without markers is appended to, never replaced.
 */
function mergeHandoffDocument(existing, block) {
  const current = String(existing || '')
  if (Buffer.byteLength(current, 'utf8') > MAX_PROJECT_DOC_BYTES) {
    throw new Error('PROJECT_STATE.md 超过 1 MiB，已拒绝覆盖；请先手动归档')
  }
  const range = markerRange(current, HANDOFF_DOC_START, HANDOFF_DOC_END, '交接单受管块')
  if (range) return `${current.slice(0, range.start)}${block}${current.slice(range.endEnd)}`
  if (!current.trim()) return `${block}
`
  return `${current.trimEnd()}

${block}
`
}

async function handleProjectHandoff(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return }
  if (!sameOrigin(req)) { sendJson(res, 403, { ok: false, error: 'origin rejected' }); return }
  if (req.method === 'GET') {
    const url = new URL(req.url || '/', 'http://local')
    const project = findCatalogProject(url.searchParams.get('projectId'))
    if (!project) { sendJson(res, 404, { ok: false, error: 'unknown project' }); return }
    const state = await readProjectHandoff(project.path)
    const git = await gitSnapshot(project.path)
    let doc = ''
    let docMtime = ''
    try {
      const docPath = path.join(project.path, PROJECT_HANDOFF_DIR, PROJECT_HANDOFF_DOC)
      doc = (await fs.readFile(docPath, 'utf8')).slice(0, 65536)
      docMtime = (await fs.stat(docPath)).mtime.toISOString()
    } catch { /* handoff may be state-only */ }
    const truth = await readTruthDocs(
      projectAllowedFolders(project),
      Array.isArray(overrides[project.id]?.truthDocs) ? overrides[project.id].truthDocs : [],
    )
    sendJson(res, 200, {
      ok: true,
      exists: Boolean(state),
      state,
      doc,
      docMtime,
      truthDocs: truth.docs,
      truthDocsStatus: truth.status,
      git,
      paths: {
        doc: path.join(project.path, PROJECT_HANDOFF_DIR, PROJECT_HANDOFF_DOC),
        state: path.join(project.path, PROJECT_HANDOFF_DIR, PROJECT_HANDOFF_STATE),
        agents: path.join(project.path, 'AGENTS.md'),
      },
    })
    return
  }
  if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return }
  let body
  try { body = await readBody(req, 256 * 1024) } catch (error) {
    sendJson(res, 400, { ok: false, error: error?.message || '请求格式错误' })
    return
  }
  const project = findCatalogProject(body?.projectId)
  if (!project) { sendJson(res, 404, { ok: false, error: 'unknown project' }); return }
  const cwd = projectCwd(project, body?.cwd)
  if (!cwd) { sendJson(res, 403, { ok: false, error: '只能写入项目已关联的目录' }); return }
  const field = (value, limit) => String(value ?? '').trim().slice(0, limit)
  const noteProvided = Object.prototype.hasOwnProperty.call(body || {}, 'note')
  const note = noteProvided ? field(body.note, 8000) : null
  const prompt = String(body?.prompt || '').trim().slice(0, 24000)
  const writeProject = body?.writeProject === true
  const writeAgents = body?.writeAgents === true
  if (!prompt) {
    sendJson(res, 400, { ok: false, error: '交接内容为空；备注、生命周期和会话归属请走工作台本地覆盖接口。' })
    return
  }
  if (!writeProject) {
    sendJson(res, 400, { ok: false, error: '未显式勾选“把交接单写入项目”，项目目录未改动。' })
    return
  }
  if (writeAgents && !writeProject) {
    sendJson(res, 400, { ok: false, error: 'AGENTS.md 只能在同时显式写入交接单时维护。' })
    return
  }
  const lifecycle = normalizeLifecycle(body?.lifecycle)
  const intentProvided = Object.prototype.hasOwnProperty.call(body || {}, 'intent')
  const sessionPolicyProvided = Object.prototype.hasOwnProperty.call(body || {}, 'sessionPolicy')
    || Object.prototype.hasOwnProperty.call(body || {}, 'rootSessionId')
  const identityProvided = Boolean(lifecycle || intentProvided || sessionPolicyProvided)
  const dir = path.join(cwd, PROJECT_HANDOFF_DIR)
  const docPath = path.join(dir, PROJECT_HANDOFF_DOC)
  const statePath = path.join(dir, PROJECT_HANDOFF_STATE)
  await assertSafeWritePath(cwd, docPath)
  await assertSafeWritePath(cwd, statePath)
  const updatedAt = new Date().toISOString()
  let priorState = null
  try { priorState = JSON.parse(await fs.readFile(statePath, 'utf8')) } catch { /* first handoff */ }
  const stateIdentity = normalizeIdentity(priorState?.identity || {})
  const catalogIdentity = normalizeIdentity(project.identity || {})
  const priorIdentity = normalizeIdentity({
    ...catalogIdentity,
    ...stateIdentity,
    lifecycle: stateIdentity.lifecycle || catalogIdentity.lifecycle,
    intent: stateIdentity.intent || catalogIdentity.intent,
    integration: stateIdentity.integration?.kind ? stateIdentity.integration : catalogIdentity.integration,
    sessionPolicy: (stateIdentity.sessionPolicy?.rootSessionId || stateIdentity.sessionPolicy?.continuations?.length || stateIdentity.sessionPolicy?.side?.length)
      ? stateIdentity.sessionPolicy
      : catalogIdentity.sessionPolicy,
  })
  const priorPolicy = normalizeSessionPolicy(priorState?.sessionPolicy || priorIdentity.sessionPolicy)
  const policyPatch = {
    ...(body?.sessionPolicy && typeof body.sessionPolicy === 'object' ? body.sessionPolicy : {}),
    ...(Object.prototype.hasOwnProperty.call(body || {}, 'rootSessionId') ? { rootSessionId: body.rootSessionId } : {}),
    ...(Array.isArray(body?.continuations) ? { continuations: body.continuations } : {}),
    ...(Array.isArray(body?.side) ? { side: body.side } : {}),
  }
  const nextPolicy = sessionPolicyProvided
    ? normalizeSessionPolicy({ ...priorPolicy, ...policyPatch, updatedAt })
    : priorPolicy
  const nextLifecycle = lifecycle || priorIdentity.lifecycle || normalizeLifecycle(priorState?.lifecycle) || ''
  const nextIntent = intentProvided ? field(body.intent, 2000) : priorIdentity.intent
  const nextIdentity = normalizeIdentity({
    ...priorIdentity,
    lifecycle: nextLifecycle,
    intent: nextIntent,
    sessionPolicy: nextPolicy,
    updatedAt,
  })
  let existingDoc = ''
  try { existingDoc = await fs.readFile(docPath, 'utf8') } catch { /* first handoff */ }
  if (!prompt) {
    if (!noteProvided && !identityProvided) { sendJson(res, 400, { ok: false, error: '交接内容为空' }); return }
    const state = {
      ...(priorState && typeof priorState === 'object' ? priorState : {}),
      version: 1,
      projectId: project.id,
      projectName: project.displayName || project.name,
      cwd,
      note: noteProvided ? note : (priorState?.note || ''),
      lifecycle: nextLifecycle,
      identity: nextIdentity,
      sessionPolicy: nextPolicy,
      updatedAt,
    }
    let agentsPath = ''
    let manifestPath = ''
    try {
      if (identityProvided) {
        const manifest = await writeProjectIdentityManifest(cwd, nextIdentity)
        manifestPath = manifest.path
        Object.assign(nextIdentity, manifest.identity)
      }
      let doc = replaceIdentityBlock(existingDoc.trim() ? existingDoc : '# 项目交接\n', nextIdentity)
      if (noteProvided) doc = replaceProjectNote(doc, note)
      await writeAtomic(docPath, doc)
      await writeAtomic(statePath, JSON.stringify(state, null, 2))
      if (body?.writeAgents === true || identityProvided) agentsPath = await upsertAgentsPointer(cwd)
    } catch (error) {
      sendJson(res, 500, { ok: false, error: `写入项目备注失败：${error?.message || error}` })
      return
    }
    project.identity = nextIdentity
    project.handoff = {
      ...(project.handoff || {}),
      note: noteProvided ? String(note || '').trim() : String(priorState?.note || '').trim(),
      lifecycle: nextLifecycle,
      sessionPolicy: nextPolicy,
      updatedAt,
    }
    sendJson(res, 200, {
      ok: true,
      noteOnly: !identityProvided,
      identityOnly: !noteProvided,
      docPath,
      statePath,
      manifestPath,
      agentsPath,
      lifecycle: nextLifecycle,
      sessionPolicy: nextPolicy,
      updatedAt,
      git: state.git || null,
    })
    return
  }
  const git = await gitSnapshot(cwd)
  const existingNote = noteProvided ? note : readProjectNote(existingDoc)
  const state = {
    version: 1,
    projectId: project.id,
    projectName: project.displayName || project.name,
    cwd,
    targetApp: field(body?.targetApp, 40),
    goal: field(body?.goal, 4000),
    progress: field(body?.progress, 8000),
    constraints: field(body?.constraints, 8000),
    summary: field(body?.summary, 4000),
    note: existingNote,
    sourceSessionId: field(body?.sourceSessionId, 120),
    lifecycle: nextLifecycle,
    identity: nextIdentity,
    sessionPolicy: nextPolicy,
    updatedAt,
    git,
  }
  const gitLines = git
    ? [
        `- 分支：${git.branch}`,
        `- 未提交改动：${git.dirty} 个文件`,
        ...(git.changed.length ? ['', '```text', ...git.changed.slice(0, 40), '```'] : []),
        ...(git.recent.length ? ['', '最近提交：', ...git.recent.map((item) => `- ${item.hash} ${item.date} ${item.subject}`)] : []),
      ].join('\n')
    : '- 当前目录不是 git 仓库；改动只存在于文件系统。'
  const safePrompt = prompt.replace(/<!--\s*dsh-workbench:handoff-doc:(?:start|end)\s*-->/gi, '[marker removed]')
  const docBody = `${safePrompt}

---

## 项目现状（${updatedAt}）

${gitLines}
`
  const managedBlock = `${HANDOFF_DOC_START}\n${docBody.trim()}\n${HANDOFF_DOC_END}`
  let doc = ''
  try {
    doc = mergeHandoffDocument(existingDoc, managedBlock)
  } catch (error) {
    sendJson(res, 413, { ok: false, error: error?.message || String(error) })
    return
  }
  let agentsPath = ''
  let docWritten = false
  let stateWritten = false
  try {
    await writeAtomic(docPath, doc)
    docWritten = true
    await writeAtomic(statePath, JSON.stringify(state, null, 2))
    stateWritten = true
    if (writeAgents) agentsPath = await upsertAgentsPointer(cwd)
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: `写入项目交接失败：${error?.message || error}`,
      partial: docWritten,
      docPath: docWritten ? docPath : '',
      statePath: stateWritten ? statePath : '',
    })
    return
  }
  project.identity = nextIdentity
  project.handoff = {
    ...(project.handoff || {}),
    note: String(existingNote || '').trim(),
    lifecycle: nextLifecycle,
    sessionPolicy: nextPolicy,
    updatedAt,
  }
  sendJson(res, 200, {
    ok: true,
    docPath,
    statePath,
    agentsPath,
    wroteProject: true,
    wroteAgents: Boolean(agentsPath),
    updatedAt,
    git,
  })
}

async function handleInherit(req, res) {
  if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return }
  if (!sameOrigin(req)) { sendJson(res, 403, { ok: false, error: 'origin rejected' }); return }
  let body
  try { body = await readBody(req, 512 * 1024) } catch (error) {
    sendJson(res, 400, { ok: false, error: error?.message || '请求格式错误' })
    return
  }
  const project = findCatalogProject(body.projectId)
  if (!project) { sendJson(res, 404, { ok: false, error: 'unknown project' }); return }
  const targetApp = String(body.targetApp || '')
  const prompt = String(body.prompt || '').trim().slice(0, 24000)
  if (!prompt) { sendJson(res, 400, { ok: false, error: '交接单为空' }); return }
  const cwd = path.resolve(String(body.cwd || project.path || ''))
  if (!cwd || !path.isAbsolute(cwd)) { sendJson(res, 400, { ok: false, error: '项目路径无效' }); return }
  const allowedFolders = [
    project.path,
    ...(Array.isArray(overrides[project.id]?.folders) ? overrides[project.id].folders : [])
      .map((folder) => typeof folder === 'string' ? folder : folder?.path),
  ].filter(Boolean)
  if (!allowedFolders.some((folder) => normalizeKey(folder) === normalizeKey(cwd))) {
    sendJson(res, 403, { ok: false, error: '只能从项目已关联的目录接手' })
    return
  }
  try {
    const st = await fs.stat(cwd)
    if (!st.isDirectory()) throw new Error('不是目录')
  } catch {
    sendJson(res, 404, { ok: false, error: '项目目录不存在' })
    return
  }

  if (targetApp === 'opencode') {
    const cli = await findOpenCodeCli()
    if (!cli) { sendJson(res, 503, { ok: false, error: '未找到 OpenCode CLI，请确认 OpenCode Desktop 已安装。' }); return }
    const sessionId = crypto.randomUUID()
    const title = `接手：${String(body.projectName || project.displayName || project.name || '').slice(0, 60)}`
    try {
      await new Promise((resolve, reject) => {
        const child = spawn(cli, ['run', '--session', sessionId, '--title', title, prompt], {
          cwd,
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
        })
        let settled = false
        child.once('error', (error) => {
          if (settled) return
          settled = true
          reject(error)
        })
        child.once('spawn', () => {
          if (settled) return
          settled = true
          child.unref()
          resolve()
        })
      })
      sendJson(res, 200, { ok: true, targetApp, mode: 'native-new-session', targetSessionId: sessionId, command: 'opencode run' })
    } catch (error) {
      sendJson(res, 500, { ok: false, error: `启动 OpenCode 失败：${error?.message || error}` })
    }
    return
  }

  if (targetApp === 'codex' || targetApp === 'comfyui' || targetApp === 'other') {
    execFile('explorer.exe', [cwd], { windowsHide: true }, () => {})
    sendJson(res, 200, { ok: true, targetApp, mode: 'prompt-only', targetSessionId: '', command: '' })
    return
  }

  sendJson(res, 400, { ok: false, error: '不支持的目标应用' })
}

async function handleDelete(req, res) {
  if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return }
  if (!appConfig.allowDelete) { sendJson(res, 403, { ok: false, error: '删除功能默认关闭' }); return }
  if (!sameOrigin(req)) { sendJson(res, 403, { ok: false, error: 'origin rejected' }); return }
  if (!catalog) { sendJson(res, 503, { ok: false, error: '项目目录尚未加载' }); return }
  if (scanning) { sendJson(res, 409, { ok: false, error: '扫描进行中，请稍后再处理' }); return }

  let body
  try { body = await readBody(req) } catch (error) {
    sendJson(res, 400, { ok: false, error: error?.message || '请求格式错误' })
    return
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    sendJson(res, 400, { ok: false, error: '请求格式错误' })
    return
  }
  const mode = body.mode === 'permanent' ? 'permanent' : body.mode === 'recycle' ? 'recycle' : ''
  if (!mode) { sendJson(res, 400, { ok: false, error: '未知的删除方式' }); return }
  if (mode === 'permanent' && body.acknowledge !== true) {
    sendJson(res, 400, { ok: false, error: '永久删除需要明确确认' })
    return
  }
  const expectedConfirm = mode === 'permanent' ? 'PERMANENT_DELETE' : 'MOVE_TO_RECYCLE_BIN'
  if (body.confirm !== expectedConfirm) {
    sendJson(res, 400, { ok: false, error: '确认口令不匹配' })
    return
  }

  const rawItems = Array.isArray(body.items) ? body.items : []
  if (!rawItems.length) { sendJson(res, 400, { ok: false, error: '没有选择项目' }); return }
  if (rawItems.length > 50) { sendJson(res, 400, { ok: false, error: '单次最多处理 50 项' }); return }
  const seen = new Set()
  const items = []
  for (const item of rawItems) {
    const id = String(item?.id || '')
    if (!id || item?.confirmed !== true) {
      sendJson(res, 400, { ok: false, error: '每一项都必须单独确认' })
      return
    }
    if (!seen.has(id)) { seen.add(id); items.push(id) }
  }

  const candidates = []
  const invalid = []
  for (const id of items) {
    try { candidates.push(await inspectDeleteTarget(id)) } catch (error) {
      invalid.push({ id, ok: false, error: error?.message || String(error) })
    }
  }
  if (invalid.length) {
    sendJson(res, 400, { ok: false, error: '有项目未通过安全检查，整批未执行', results: invalid })
    return
  }

  const results = []
  const succeeded = []
  for (const candidate of candidates) {
    const { raw, project, target } = candidate
    try {
      await removeTarget(target, mode)
      const entry = {
        at: new Date().toISOString(),
        mode,
        id: raw.id,
        name: project.displayName || raw.name,
        path: target,
        sizeBytes: raw.sizeBytes || 0,
      }
      await appendDeletionLog(entry)
      succeeded.push(raw.id)
      results.push({ id: raw.id, ok: true, mode, ...entry })
    } catch (error) {
      results.push({
        id: raw.id,
        ok: false,
        name: project.displayName || raw.name,
        path: target,
        error: error?.message || String(error),
      })
    }
  }

  let cacheUpdated = true
  let cacheError = ''
  if (succeeded.length) {
    removeFromCatalog(new Set(succeeded))
    try { await saveCatalogCache() } catch (error) {
      cacheUpdated = false
      cacheError = error?.message || String(error)
    }
  }

  sendJson(res, 200, {
    ok: results.every((r) => r.ok),
    mode,
    deletedCount: succeeded.length,
    failedCount: results.length - succeeded.length,
    results,
    cacheUpdated,
    cacheError,
  })
}

async function sessionsForProjects() {
  const dsh = []
  const sources = {
    dsh: { available: Boolean(sessionQuery), error: sessionQuery ? '' : 'DSH sessionQuery 尚未就绪' },
    codex: { available: false, error: '' },
  }
  if (sessionQuery && typeof sessionQuery.listSessions === 'function') {
    try {
      const records = await withTimeout(sessionQuery.listSessions(), 4000, '读取会话列表超时')
      if (Array.isArray(records)) {
        const files = await sessionFiles()
        for (const record of records) {
          const header = record?.header || {}
          const id = String(header.id || record?.id || '')
          if (!id || header.origin === 'subagent' || Number(header.delegationDepth) > 0) continue
          const file = files.get(id)
          dsh.push({
            id,
            source: 'dsh',
            title: String(header.title || header.displayTitle || ''),
            cwd: typeof header.cwd === 'string' ? header.cwd : '',
            updatedAt: sessionTime(file?.mtimeMs) || sessionTime(header.createdAt),
            parentSessionId: String(header.parentSession || header.parentSessionId || header.parentId || record?.parentSessionId || ''),
            running: record?.live === true,
          })
        }
      }
      sources.dsh.available = true
    } catch (error) {
      sources.dsh.error = error?.message || '读取 DSH 会话失败'
    }
  }
  let codex = []
  try {
    const inventory = listCodexSessions()
    codex = inventory.sessions || []
    sources.codex = { available: inventory.ok === true, error: inventory.error || '' }
  } catch (error) {
    sources.codex.error = error?.message || '读取 Codex 会话失败'
  }
  return { sessions: [...dsh, ...codex], sources }
}

async function handleState(req, res) {
  if (req.method !== 'GET') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return }
  let data = null
  let inventory = { sessions: [], sources: [] }
  try {
    inventory = await sessionsForProjects()
    data = presentCatalog(inventory.sessions)
    if (data) {
      data.sessionSources = inventory.sources
      data = await attachRuntimes(data)
    }
  } catch (error) {
    sendJson(res, 500, { ok: false, error: `生成项目视图失败：${error?.message || error}` })
    return
  }
  if (!data) {
    const roots = Array.isArray(appConfig.roots) ? appConfig.roots : []
    sendJson(res, 200, {
      ok: true, ready: false, scanning, scanError, needsConfig: roots.length === 0,
      message: roots.length
        ? '尚未生成项目目录，请点击“重新扫描”。'
        : '尚未配置项目目录。请在 ~/.dsh/data/dsh-workbench/config.json 中设置 roots，然后重新扫描。',
      projects: [], software: [], disks: [], stats: {}, sessionSources: inventory.sources,
    })
    return
  }
  sendJson(res, 200, { ok: true, ready: true, ...data })
}

async function handleRescan(req, res) {
  if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return }
  if (!sameOrigin(req)) { sendJson(res, 403, { ok: false, error: 'origin rejected' }); return }
  if (scanning) { sendJson(res, 202, { ok: true, scanning: true, startedAt: scanStartedAt }); return }
  runScan().catch(() => {})
  sendJson(res, 202, { ok: true, scanning: true, startedAt: scanStartedAt })
}

async function handleOverride(req, res) {
  if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return }
  if (!sameOrigin(req)) { sendJson(res, 403, { ok: false, error: 'origin rejected' }); return }
  const body = await readBody(req)
  const id = String(body.id || '')
  if (!catalog || !catalog.projects.some((p) => p.id === id)) {
    sendJson(res, 404, { ok: false, error: 'unknown project' })
    return
  }
  const patch = body.patch && typeof body.patch === 'object' ? body.patch : {}
  const allowed = ['name', 'note', 'status', 'tags', 'hidden', 'pinned', 'lifecycle', 'intent', 'sessionPolicy', 'representativeImage']
  const next = { ...(overrides[id] || {}) }
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) continue
    if (key === 'status' && !['active', 'paused', 'archived', 'unknown'].includes(patch.status)) continue
    if (key === 'lifecycle') {
      const value = normalizeLifecycle(patch.lifecycle)
      if (value) next.lifecycle = value
      continue
    }
    if (key === 'intent') {
      next.intent = String(patch.intent ?? '').slice(0, 2000)
      continue
    }
    if (key === 'sessionPolicy') {
      next.sessionPolicy = normalizeSessionPolicy(patch.sessionPolicy)
      continue
    }
    if (key === 'representativeImage') {
      const raw = patch.representativeImage
      if (raw === null) { delete next.representativeImage; continue }
      if (!raw || typeof raw !== 'object' || typeof raw.path !== 'string' || !raw.path.trim()) continue
      const relative = String(raw.path).replace(/\\/g, '/').trim()
      if (!relative || path.isAbsolute(relative) || relative.split('/').includes('..')) continue
      const folder = Number.isInteger(raw.folder) ? raw.folder : -1
      next.representativeImage = {
        path: relative.slice(0, 1000),
        folder: folder >= 0 ? folder : -1,
        title: String(raw.title || '').slice(0, 160),
      }
      continue
    }
    if (key === 'tags') {
      next.tags = Array.isArray(patch.tags)
        ? patch.tags.map((x) => String(x).trim()).filter(Boolean).slice(0, 12)
        : []
      continue
    }
    if (key === 'hidden' || key === 'pinned') next[key] = Boolean(patch[key])
    else next[key] = String(patch[key] ?? '').slice(0, key === 'note' ? 4000 : 120)
  }
  overrides[id] = next
  await saveOverrides()
  const project = presentProject(catalog.projects.find((p) => p.id === id))
  sendJson(res, 200, { ok: true, project })
}

async function handleFollowup(req, res) {
  if (!sameOrigin(req)) { sendJson(res, 403, { ok: false, error: 'origin rejected' }); return }
  if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return }
  let body
  try { body = await readBody(req) } catch (error) {
    sendJson(res, 400, { ok: false, error: error?.message || '请求格式错误' })
    return
  }
  const id = String(body?.id || '')
  const nextState = String(body?.state || 'done')
  if (!['new', 'reset', 'done', 'muted'].includes(nextState)) {
    sendJson(res, 400, { ok: false, error: 'unknown follow-up state' })
    return
  }
  const project = findCatalogProject(id)
  if (!project) { sendJson(res, 404, { ok: false, error: 'unknown project' }); return }
  followups = markFollowup(followups, id, nextState, new Date().toISOString())
  await saveFollowups()
  const presented = presentProject(project)
  sendJson(res, 200, {
    ok: true,
    project: presented,
    followup: followupSummary((catalog?.projects || []).map(presentProject), followups),
  })
}

const EARTH_ASSETS = {
  '/dsh-workbench/assets/earth-blue-marble.jpg': ['earth-blue-marble.jpg', 'image/jpeg'],
  '/dsh-workbench/assets/earth-night.jpg': ['earth-night.jpg', 'image/jpeg'],
}

async function handleEarthAsset(req, res) {
  if (req.method !== 'GET') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return }
  let pathname = ''
  try { pathname = new URL(req.url || '/', 'http://local').pathname } catch { sendJson(res, 400, { ok: false, error: 'bad url' }); return }
  const meta = EARTH_ASSETS[pathname]
  if (!meta) { sendJson(res, 404, { ok: false, error: 'earth asset not found' }); return }
  const file = path.join(HERE, 'assets', meta[0])
  try {
    const stat = await fs.stat(file)
    if (!stat.isFile()) throw new Error('not a file')
    res.writeHead(200, {
      'content-type': meta[1],
      'content-length': stat.size,
      'cache-control': 'public, max-age=86400',
      'x-content-type-options': 'nosniff',
    })
    const stream = createReadStream(file)
    stream.on('error', () => { if (!res.headersSent) sendJson(res, 404, { ok: false, error: 'artifact unavailable' }); else res.destroy() })
    stream.pipe(res)
  } catch (error) {
    sendJson(res, 404, { ok: false, error: error?.message || 'earth asset unavailable' })
  }
}

const MEDIA_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.bmp'])
const MEDIA_SKIP_DIRS = new Set(['node_modules', '.git', '.dsh', '.cache', 'cache', '__pycache__', '.venv', 'venv', 'dist', 'build', 'coverage'])
const MEDIA_BOOST_DIRS = new Set(['output', 'outputs', 'renders', 'render', 'exports', 'export', 'artifacts', 'artifact', 'images', 'image', 'screenshots', 'screenshot', 'stills', 'frames', 'previews', 'preview', 'covers', 'cover', 'posters', 'poster', 'final', 'finals', 'deliverables', 'results', 'review', 'qa'])
const MEDIA_SKIP_NAMES = /(^|[\/_.-])(icon|avatar|logo|sprite|placeholder|favicon|loading|spinner)([\/_.-]|$)/i
const MEDIA_GOOD_NAMES = /(cover|poster|thumbnail|thumb|preview|keyframe|still|final|result|frame|contact[-_ ]?sheet|compare|qa)/i

function mediaRootsFor(project) {
  const linked = Array.isArray(overrides[project.id]?.folders) ? overrides[project.id].folders : []
  return runtimeRoots({
    path: project.path,
    folders: linked.map((folder) => ({ path: typeof folder === 'string' ? folder : folder?.path })),
  })
}

function mediaRoleFor(project, index) {
  if (index === 0) return 'main'
  const linked = Array.isArray(overrides[project.id]?.folders) ? overrides[project.id].folders : []
  return String(linked[index - 1]?.role || 'linked')
}

function mediaCandidateScore(item) {
  const rel = String(item.path || '').toLowerCase()
  const base = path.basename(rel)
  let score = item.source === 'runtime' ? 500 : 0
  if (MEDIA_GOOD_NAMES.test(base)) score += 170
  if (MEDIA_GOOD_NAMES.test(rel)) score += 45
  const dirs = rel.split('/').slice(0, -1)
  if (dirs.some((dir) => MEDIA_BOOST_DIRS.has(dir))) score += 120
  if (dirs.some((dir) => ['input', 'inputs', 'reference', 'references', 'source', 'sources', 'raw', 'tmp', 'temp', 'debug', 'cache', 'test', 'tests'].includes(dir))) score -= 170
  if (item.role === 'output') score += 90
  if (item.role === 'reference') score -= 35
  if (item.role === 'code') score -= 80
  if (MEDIA_SKIP_NAMES.test(base)) score -= 400
  const age = Date.now() - (Date.parse(item.mtime || '') || 0)
  if (Number.isFinite(age) && age >= 0) score += Math.max(0, 80 - Math.floor(age / 86400000) * 3)
  return score
}

async function scanProjectMedia(project) {
  const roots = mediaRootsFor(project)
  const items = []
  const seen = new Set()
  let scannedDirs = 0
  let scannedFiles = 0
  let truncated = false
  const maxEntries = 4500
  const maxItems = 90
  for (let folder = 0; folder < roots.length; folder++) {
    const root = roots[folder]
    const role = mediaRoleFor(project, folder)
    const stack = [{ dir: root, depth: 0 }]
    let entries = 0
    while (stack.length && entries < maxEntries && items.length < maxItems) {
      const current = stack.pop()
      scannedDirs += 1
      let list = []
      try { list = await fs.readdir(current.dir, { withFileTypes: true }) } catch { continue }
      list.sort((a, b) => {
        const ad = a.isDirectory() ? 0 : 1
        const bd = b.isDirectory() ? 0 : 1
        return ad - bd || a.name.localeCompare(b.name)
      })
      for (const entry of list) {
        entries += 1
        scannedFiles += 1
        if (entries > maxEntries) { truncated = true; break }
        if (entry.isSymbolicLink()) continue
        const name = String(entry.name || '')
        if (!name || name.startsWith('.')) continue
        if (entry.isDirectory()) {
          if (current.depth >= 4 || MEDIA_SKIP_DIRS.has(name.toLowerCase())) continue
          stack.push({ dir: path.join(current.dir, name), depth: current.depth + 1 })
          continue
        }
        if (!entry.isFile()) continue
        const extension = path.extname(name).toLowerCase()
        if (!MEDIA_EXTENSIONS.has(extension)) continue
        if (MEDIA_SKIP_NAMES.test(name)) continue
        const file = path.join(current.dir, name)
        let stat
        try { stat = await fs.stat(file) } catch { continue }
        if (!stat.isFile() || stat.size <= 0 || stat.size > RUNTIME_MAX_MEDIA_BYTES) continue
        const relative = normalizeRelative(file, root)
        const key = path.resolve(file).toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        items.push({
          abs: file,
          path: relative,
          folder,
          role,
          rootLabel: path.basename(root) || root,
          title: name.slice(0, 180),
          kind: 'image',
          sizeBytes: stat.size,
          mtime: stat.mtime.toISOString(),
          source: '目录扫描',
          url: '/dsh-workbench/api/artifact?id=' + encodeURIComponent(project.id) + '&path=' + encodeURIComponent(relative) + '&folder=' + folder,
        })
      }
    }
    if (entries >= maxEntries) truncated = true
  }
  try {
    const runtime = await runtimeForProject(project)
    for (const artifact of runtime?.artifacts || []) {
      if (artifact.kind !== 'image' || !artifact.url) continue
      const key = path.resolve(String(artifact.path || '')).toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      items.push({
        abs: '',
        path: String(artifact.path || ''),
        folder: -1,
        role: 'runtime',
        rootLabel: '运行时清单',
        title: String(artifact.title || path.basename(String(artifact.path || ''))).slice(0, 180),
        kind: 'image',
        sizeBytes: Number(artifact.sizeBytes) || 0,
        mtime: artifact.mtime || artifact.createdAt || '',
        source: '运行时清单',
        url: String(artifact.url),
      })
    }
  } catch { /* runtime metadata is optional */ }
  for (const item of items) item.score = mediaCandidateScore(item)
  items.sort((a, b) => (b.score - a.score) || (Date.parse(b.mtime || '') || 0) - (Date.parse(a.mtime || '') || 0))
  const limited = items.slice(0, 24)
  const pinned = project.representativeImage
  let representative = null
  let pinnedMissing = false
  if (pinned && pinned.path) {
    representative = limited.find((item) => item.path === pinned.path && (pinned.folder < 0 || item.folder === pinned.folder))
      || items.find((item) => item.path === pinned.path)
      || null
    if (!representative) pinnedMissing = true
  }
  if (!representative) representative = limited[0] || null
  return {
    roots: roots.map((root, index) => ({ index, label: path.basename(root) || root, role: mediaRoleFor(project, index) })),
    items: limited.map(({ abs, ...item }) => item),
    representative: representative ? (({ abs, ...item }) => item)(representative) : null,
    pinnedMissing,
    scan: { roots: roots.length, scannedDirs, scannedFiles, images: items.length, shown: limited.length, truncated, at: new Date().toISOString() },
  }
}

async function handleProjectMedia(req, res) {
  if (req.method !== 'GET') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return }
  if (!sameOrigin(req)) { sendJson(res, 403, { ok: false, error: 'origin rejected' }); return }
  const url = new URL(req.url || '/', 'http://local')
  const id = String(url.searchParams.get('id') || '')
  const project = findCatalogProject(id)
  if (!project) { sendJson(res, 404, { ok: false, error: 'unknown project' }); return }
  const probe = String(url.searchParams.get('path') || '').replace(/\\/g, '/').trim()
  if (probe) {
    if (path.isAbsolute(probe) || probe.split('/').includes('..')) { sendJson(res, 400, { ok: false, error: 'bad relative path' }); return }
    const roots = mediaRootsFor(project)
    const folder = Number(url.searchParams.get('folder'))
    const search = Number.isInteger(folder) && folder >= 0 && folder < roots.length ? [roots[folder]] : roots
    for (let index = 0; index < search.length; index++) {
      const root = search[index]
      const file = path.resolve(root, probe)
      if (!(await safeFileInside(root, file))) continue
      try {
        const stat = await fs.lstat(file)
        const extension = path.extname(file).toLowerCase()
        if (!stat.isFile() || !MEDIA_EXTENSIONS.has(extension) || stat.size <= 0 || stat.size > RUNTIME_MAX_MEDIA_BYTES) continue
        const actualFolder = Number.isInteger(folder) && folder >= 0 ? folder : roots.indexOf(root)
        sendJson(res, 200, { ok: true, projectId: id, item: {
          path: normalizeRelative(file, root), folder: actualFolder, role: mediaRoleFor(project, actualFolder),
          rootLabel: path.basename(root) || root, title: path.basename(file).slice(0, 180), kind: 'image',
          sizeBytes: stat.size, mtime: stat.mtime.toISOString(), source: '手动关联',
          url: '/dsh-workbench/api/artifact?id=' + encodeURIComponent(id) + '&path=' + encodeURIComponent(normalizeRelative(file, root)) + '&folder=' + actualFolder,
        } })
        return
      } catch { /* try next root */ }
    }
    sendJson(res, 404, { ok: false, error: 'image not found in project roots' })
    return
  }
  try {
    const result = await scanProjectMedia(presentProject(project))
    sendJson(res, 200, { ok: true, projectId: id, ...result })
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error?.message || 'media scan failed' })
  }
}

async function handleArtifact(req, res) {
  if (req.method !== 'GET') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return }
  if (!catalog) { sendJson(res, 404, { ok: false, error: 'catalog not ready' }); return }
  let url
  try { url = new URL(req.url, 'http://localhost') } catch { sendJson(res, 400, { ok: false, error: 'bad url' }); return }
  const id = String(url.searchParams.get('id') || '')
  const relative = String(url.searchParams.get('path') || '')
  if (!id || !relative || path.isAbsolute(relative)) { sendJson(res, 400, { ok: false, error: 'bad artifact path' }); return }
  const project = catalog.projects.find((item) => item.id === id)
  if (!project) { sendJson(res, 404, { ok: false, error: 'unknown project' }); return }
  const folders = Array.isArray(overrides[id]?.folders) ? overrides[id].folders : []
  const roots = runtimeRoots({
    path: project.path,
    folders: folders.map((folder) => ({ path: typeof folder === 'string' ? folder : folder?.path })),
  })
  const folderParam = Number(url.searchParams.get('folder'))
  const searchRoots = Number.isInteger(folderParam) && folderParam >= 0 && folderParam < roots.length ? [roots[folderParam]] : roots
  let file = ''
  for (const root of searchRoots) {
    const candidate = path.resolve(root, relative)
    if (!(await safeFileInside(root, candidate))) continue
    try {
      if ((await fs.lstat(candidate)).isFile()) { file = candidate; break }
    } catch { /* try next linked folder */ }
  }
  if (!file) { sendJson(res, 404, { ok: false, error: 'artifact not found' }); return }
  const extension = path.extname(file).toLowerCase()
  const mime = RUNTIME_MIME[extension]
  if (!mime || !mime.startsWith('image/')) { sendJson(res, 415, { ok: false, error: 'unsupported artifact type' }); return }
  try {
    const stat = await fs.lstat(file)
    if (stat.size > RUNTIME_MAX_MEDIA_BYTES) { sendJson(res, 413, { ok: false, error: 'artifact too large' }); return }
    res.writeHead(200, {
      'content-type': mime,
      'content-length': stat.size,
      'cache-control': 'private, max-age=30',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "sandbox; default-src 'none'",
    })
    const stream = createReadStream(file)
    stream.on('error', () => { if (!res.headersSent) sendJson(res, 404, { ok: false, error: 'artifact unavailable' }); else res.destroy() })
    stream.pipe(res)
  } catch (error) {
    sendJson(res, 404, { ok: false, error: error?.message || 'artifact unavailable' })
  }
}

async function handleOpen(req, res) {
  if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return }
  if (!sameOrigin(req)) { sendJson(res, 403, { ok: false, error: 'origin rejected' }); return }
  let body
  try { body = await readBody(req) } catch (error) { sendJson(res, 400, { ok: false, error: error?.message || '请求格式错误' }); return }
  const target = path.resolve(String(body?.path || ''))
  if (!isKnownPath(target)) { sendJson(res, 403, { ok: false, error: 'path is not in the catalog' }); return }
  let st
  try {
    st = await fs.lstat(target)
    if (st.isSymbolicLink()) throw new Error('symbolic link')
    if (!st.isDirectory() && !st.isFile()) throw new Error('unsupported path')
  } catch {
    sendJson(res, 404, { ok: false, error: 'path not found' })
    return
  }
  if (st.isFile()) {
    const key = normalizeKey(target)
    const software = Array.isArray(catalog?.software)
      ? catalog.software.find((item) => item?.installPath && normalizeKey(item.installPath) === key)
      : null
    if (!software) { sendJson(res, 403, { ok: false, error: '只能打开目录或目录中登记的应用' }); return }
  }
  execFile('explorer.exe', [target], { windowsHide: true }, () => {})
  sendJson(res, 200, { ok: true })
}

async function handleOpenData(req, res) {
  if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return }
  if (!sameOrigin(req)) { sendJson(res, 403, { ok: false, error: 'origin rejected' }); return }
  await fs.mkdir(DATA_DIR, { recursive: true })
  execFile('explorer.exe', [DATA_DIR], { windowsHide: true }, () => {})
  sendJson(res, 200, { ok: true, path: DATA_DIR })
}

async function handlePathStatus(req, res) {
  if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return }
  if (!sameOrigin(req)) { sendJson(res, 403, { ok: false, error: 'origin rejected' }); return }
  let body
  try { body = await readBody(req) } catch (error) {
    sendJson(res, 400, { ok: false, error: error?.message || '请求格式错误' })
    return
  }
  const target = path.resolve(String(body?.path || ''))
  if (!isKnownPath(target)) { sendJson(res, 403, { ok: false, error: 'path is not in the catalog' }); return }
  try {
    const st = await fs.stat(target)
    sendJson(res, 200, { ok: true, exists: true, isDirectory: st.isDirectory() })
  } catch {
    sendJson(res, 200, { ok: true, exists: false, isDirectory: false })
  }
}

function withTimeout(promise, timeoutMs, message) {
  let timer = null
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(message)
      error.code = 'ETIMEDOUT'
      reject(error)
    }, timeoutMs)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

export function sessionFileKeys(folderName) {
  const name = String(folderName || '')
  if (!name) return []
  // DSH session ids normally keep the `session-` prefix, while some older
  // storage folders use the bare UUID. Register both spellings so the size
  // guard is keyed by whichever spelling sessionQuery returns.
  const alias = name.startsWith('session-') ? name.slice('session-'.length) : `session-${name}`
  return [name, alias]
}

async function sessionFiles(force = false) {
  if (!force && Date.now() - sessionFileCache.at < SESSION_FILE_CACHE_MS) return sessionFileCache.map
  const map = new Map()
  const add = async (sessionId, file) => {
    try {
      const st = await fs.stat(file)
      if (!st.isFile()) return
      const info = { path: file, size: st.size, mtimeMs: st.mtimeMs }
      for (const key of sessionFileKeys(sessionId)) map.set(key, info)
    } catch { /* session has no persisted log yet */ }
  }
  let workspaces = []
  try {
    workspaces = await fs.readdir(SESSIONS_DIR, { withFileTypes: true })
  } catch {
    sessionFileCache = { at: Date.now(), map }
    return map
  }
  await Promise.all(workspaces.filter((entry) => entry.isDirectory()).map(async (workspace) => {
    const workspacePath = path.join(SESSIONS_DIR, workspace.name)
    // Be tolerant of both <workspace>/<session>/log and <workspace>/log layouts.
    await add(workspace.name, path.join(workspacePath, 'session.v4.jsonl.zstd'))
    let sessions = []
    try {
      sessions = await fs.readdir(workspacePath, { withFileTypes: true })
    } catch { return }
    await Promise.all(sessions.filter((entry) => entry.isDirectory()).map((session) => (
      add(session.name, path.join(workspacePath, session.name, 'session.v4.jsonl.zstd'))
    )))
  }))
  sessionFileCache = { at: Date.now(), map }
  return map
}



function sessionTime(value) {
  return Number.isFinite(value) ? value : null
}

async function readSessionSnapshot(id) {
  if (!sessionQuery) throw new Error('sessionQuery is not available')
  // readSurface only contains model-surface messages (no tool/call, todo/write,
  // turn/end or title events), so the digest uses the raw log for small sessions.
  if (typeof sessionQuery.readSession === 'function') {
    return withTimeout(sessionQuery.readSession(id), 12000, '读取会话摘要超时')
  }
  if (typeof sessionQuery.readSurface === 'function') {
    return withTimeout(sessionQuery.readSurface(id), 12000, '读取会话摘要超时')
  }
  throw new Error('sessionQuery has no readable session method')
}

async function handleSessionDigest(req, res) {
  if (req.method !== 'GET') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return }
  if (!sameOrigin(req)) { sendJson(res, 403, { ok: false, error: 'origin rejected' }); return }
  const url = new URL(req.url || '/', 'http://workbench.local')
  const id = String(url.searchParams.get('id') || '').trim()
  if (!/^[A-Za-z0-9._-]{1,200}$/.test(id)) {
    sendJson(res, 400, { ok: false, error: 'invalid session id' })
    return
  }
  const requestedSource = String(url.searchParams.get('source') || '')
  if (requestedSource === 'codex' || (!requestedSource && findCodexSession(id))) {
    try {
      const result = await withTimeout(readCodexDigest(id), 12000, '读取 Codex 会话摘要超时')
      sendJson(res, 200, { ok: true, ...result })
    } catch (error) {
      const status = error?.code === 'ETIMEDOUT' ? 504 : 404
      sendJson(res, status, {
        ok: false,
        id,
        source: 'codex',
        error: error?.code === 'ETIMEDOUT'
          ? '读取 Codex 会话摘要超时；日志较大，请直接在 Codex 中打开。'
          : `读取 Codex 会话摘要失败：${error?.message || error}`,
      })
    }
    return
  }
  if (!sessionQuery) {
    sendJson(res, 503, { ok: false, error: '会话查询服务尚未加载，请重启桌面端后重试。' })
    return
  }
  const titleHint = String(url.searchParams.get('title') || '').slice(0, 200)
  let record = null
  try {
    const records = await sessionQuery.listSessions()
    record = records.find((item) => item?.header?.id === id) || null
  } catch (error) {
    sendJson(res, 500, { ok: false, error: `读取会话列表失败：${error?.message || error}` })
    return
  }
  if (!record) {
    sendJson(res, 404, { ok: false, error: 'session not found' })
    return
  }
  const header = record.header || {}
  const file = (await sessionFiles()).get(id) || null
  let title = titleHint
  if (!title && typeof sessionQuery.readTitle === 'function') {
    try {
      const observed = await withTimeout(sessionQuery.readTitle(id), 3000, '读取会话标题超时')
      title = String(observed?.title || '')
    } catch { /* title is optional */ }
  }
  const base = {
    title,
    cwd: typeof header.cwd === 'string' ? header.cwd : '',
    createdAt: sessionTime(header.createdAt),
    live: record.live === true,
    persisted: record.persisted === true,
    logSizeBytes: file?.size ?? null,
    updatedAt: sessionTime(file?.mtimeMs),
    eventCount: 0,
  }
  if (file && file.size > MAX_DIGEST_LOG_BYTES) {
    sendJson(res, 200, {
      ok: true,
      id,
      ...base,
      summary: '',
      messages: [],
      tools: [],
      todos: null,
      counts: { user: 0, assistant: 0, tool: 0 },
      truncated: true,
      notice: `会话日志约 ${(file.size / 1024 / 1024).toFixed(1)} MiB，超过安全读取上限。为保护宿主，未加载全文；仍可直接打开会话继续。`,
    })
    return
  }
  try {
    const snapshot = await readSessionSnapshot(id)
    const rawEvents = Array.isArray(snapshot?.events)
      ? snapshot.events
      : (Array.isArray(snapshot) ? snapshot : [])
    const inherited = Number(snapshot?.inheritedEventCount) || 0
    const events = inherited > 0 && inherited < rawEvents.length ? rawEvents.slice(inherited) : rawEvents
    const digest = buildDigest(events, { ...base, eventCount: events.length })
    sendJson(res, 200, { ok: true, id, ...digest })
  } catch (error) {
    const status = error?.code === 'ETIMEDOUT' ? 504 : 500
    sendJson(res, status, {
      ok: false,
      id,
      error: error?.code === 'ETIMEDOUT'
        ? '读取会话摘要超时；会话可能过大，请直接在 DSH 中打开。'
        : `读取会话摘要失败：${error?.message || error}`,
    })
  }
}

async function handleSkills(req, res) {
  if (req.method !== 'GET') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return }
  if (!sameOrigin(req)) { sendJson(res, 403, { ok: false, error: 'origin rejected' }); return }
  try {
    const url = new URL(req.url || '/', 'http://localhost')
    const result = await scanSkills({ force: url.searchParams.get('refresh') === '1' })
    sendJson(res, 200, result)
  } catch (error) {
    sendJson(res, 500, { ok: false, error: `扫描技能失败：${error?.message || error}` })
  }
}

async function handleSkill(req, res) {
  if (req.method !== 'GET') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return }
  if (!sameOrigin(req)) { sendJson(res, 403, { ok: false, error: 'origin rejected' }); return }
  try {
    const url = new URL(req.url || '/', 'http://localhost')
    const detail = await getSkillDetail(url.searchParams.get('id'))
    if (!detail) { sendJson(res, 404, { ok: false, error: '技能不存在或索引已过期，请刷新技能库' }); return }
    sendJson(res, 200, { ok: true, skill: detail })
  } catch (error) {
    sendJson(res, 500, { ok: false, error: `读取技能失败：${error?.message || error}` })
  }
}

async function handleSkillOpen(req, res) {
  if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return }
  if (!sameOrigin(req)) { sendJson(res, 403, { ok: false, error: 'origin rejected' }); return }
  try {
    const body = await readBody(req)
    // Only an indexed skill id is accepted. Never let the client choose an
    // arbitrary path, otherwise an unknown id resolves to the host process CWD.
    const detail = await getSkillDetail(body?.id)
    if (!detail) { sendJson(res, 404, { ok: false, error: '技能不存在或索引已过期，请刷新技能库' }); return }
    const target = path.resolve(detail.dir || path.dirname(detail.path))
    if (!isSkillPath(target)) { sendJson(res, 403, { ok: false, error: 'path is not a scanned skill root' }); return }
    const st = await fs.stat(target)
    if (!st.isDirectory() && !st.isFile()) throw new Error('unsupported path')
    execFile('explorer.exe', [target], { windowsHide: true }, () => {})
    sendJson(res, 200, { ok: true, path: target })
  } catch (error) {
    sendJson(res, 404, { ok: false, error: error?.message || '技能目录不可用' })
  }
}

async function handleCodexSessionOpen(req, res) {
  if (!sameOrigin(req)) { sendJson(res, 403, { ok: false, error: 'origin rejected' }); return }
  if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return }
  let body
  try { body = await readBody(req) } catch (error) {
    sendJson(res, 400, { ok: false, error: error?.message || '请求格式错误' })
    return
  }
  const session = findCodexSession(body?.id)
  if (!session) { sendJson(res, 404, { ok: false, error: 'Codex 会话不存在或索引已过期' }); return }
  const url = codexSessionOpenUrl(session.id)
  if (!url) { sendJson(res, 400, { ok: false, error: '无效的 Codex 会话 ID' }); return }
  execFile('rundll32.exe', ['url.dll,FileProtocolHandler', url], { windowsHide: true }, () => {})
  sendJson(res, 200, { ok: true, id: session.id, title: session.title })
}

async function handleCodexSessions(req, res) {
  if (req.method !== 'GET') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return }
  if (!sameOrigin(req)) { sendJson(res, 403, { ok: false, error: 'origin rejected' }); return }
  const result = listCodexSessions({ force: new URL(req.url || '/', 'http://local').searchParams.get('refresh') === '1' })
  sendJson(res, result.ok ? 200 : 503, result)
}

export const inject = ['webServer']

export function apply(ctx) {
  loadLocalState()
  ctx.inject(['sessionQuery'], (queryCtx) => {
    const service = queryCtx.sessionQuery
    sessionQuery = service
    queryCtx.effect(() => () => {
      if (sessionQuery === service) sessionQuery = null
    }, 'dsh-workbench: sessionQuery binding')
  })
  ctx.inject(['webServer'], (webCtx) => {
    webCtx.effect(() => {
      const dispose = []
      let routeCount = 0
      const server = webCtx.webServer
      const safe = (handler) => (req, res) => Promise.resolve()
        .then(() => {
          const gate = requestGate(req)
          if (!gate.ok) {
            sendJson(res, 403, { ok: false, error: gate.error })
            return
          }
          return handler(req, res)
        })
        .catch((error) => {
          if (!res.headersSent) sendJson(res, Number(error?.statusCode) || 500, { ok: false, error: error?.message || 'internal error' })
          else res.destroy()
        })
      const route = (p, handler) => {
        routeCount += 1
        dispose.push(server.register({ kind: 'exact', path: p, handler: safe(handler) }))
      }
      route('/dsh-workbench/assets/earth-blue-marble.jpg', handleEarthAsset)
      route('/dsh-workbench/assets/earth-night.jpg', handleEarthAsset)
      route('/dsh-workbench/api/state', handleState)
      route('/dsh-workbench/api/skills', handleSkills)
      route('/dsh-workbench/api/skill', handleSkill)
      route('/dsh-workbench/api/skill-open', handleSkillOpen)
      route('/dsh-workbench/api/rescan', handleRescan)
      route('/dsh-workbench/api/override', handleOverride)
      route('/dsh-workbench/api/followup', handleFollowup)
      route('/dsh-workbench/api/artifact', handleArtifact)
      route('/dsh-workbench/api/project-media', handleProjectMedia)
      route('/dsh-workbench/api/delete', handleDelete)
      route('/dsh-workbench/api/open', handleOpen)
      route('/dsh-workbench/api/open-data', handleOpenData)
      route('/dsh-workbench/api/path-status', handlePathStatus)
      route('/dsh-workbench/api/project-folders', handleProjectFolders)
      route('/dsh-workbench/api/project-sessions', handleProjectSessions)
      route('/dsh-workbench/api/project-handoff', handleProjectHandoff)
      route('/dsh-workbench/api/inherit', handleInherit)
      route('/dsh-workbench/api/session-digest', handleSessionDigest)
      route('/dsh-workbench/api/codex-sessions', handleCodexSessions)
      route('/dsh-workbench/api/codex-session-open', handleCodexSessionOpen)
      route('/dsh-workbench/api/handoffs', handleHandoffs)
      route('/dsh-workbench/api/health', (req, res) => sendJson(res, 200, {
        ok: true, version: 12, routes: routeCount, hasCatalog: Boolean(catalog), scanning, hasSessionQuery: Boolean(sessionQuery), hasCodexSessions: true, sessionSources: true, handoffCount: handoffs.length, lastScanNew: followups.scans[0]?.newIds?.length || 0,
      }))
      return () => { for (const d of dispose) d() }
    }, 'dsh-workbench: HTTP routes')
  })
}
