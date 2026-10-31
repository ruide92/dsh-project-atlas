/**
 * Project identity, lifecycle and session lineage.
 *
 * A folder is not automatically a long-lived project. This module keeps three
 * separate questions apart:
 *
 *   1. What kind of work is this?  persistent / incubating / temporary / unknown
 *   2. Which conversation is the project's main line, which are continuations,
 *      and which are unrelated side work?
 *   3. When should the workbench merely *suggest* cleanup, never delete?
 *
 * The result is deliberately conservative. A manifest or a user decision wins;
 * otherwise the workbench only offers a low-confidence suggestion.
 */

export const LIFECYCLES = Object.freeze(['persistent', 'incubating', 'temporary', 'unclassified'])
export const LIFECYCLE_SOURCES = Object.freeze(['manual', 'manifest', 'handoff', 'inferred'])
export const SESSION_ROLES = Object.freeze(['main', 'main-candidate', 'continuation', 'side', 'unassigned'])

const LIFE_ALIASES = new Map([
  ['long', 'persistent'],
  ['long-term', 'persistent'],
  ['longterm', 'persistent'],
  ['permanent', 'persistent'],
  ['持久', 'persistent'],
  ['长期', 'persistent'],
  ['长期项目', 'persistent'],
  ['incubating', 'incubating'],
  ['incubate', 'incubating'],
  ['孵化', 'incubating'],
  ['孵化中', 'incubating'],
  ['temporary', 'temporary'],
  ['temp', 'temporary'],
  ['oneoff', 'temporary'],
  ['one-off', 'temporary'],
  ['scratch', 'temporary'],
  ['临时', 'temporary'],
  ['临时工作', 'temporary'],
  ['unclassified', 'unclassified'],
  ['unknown', 'unclassified'],
  ['inbox', 'unclassified'],
  ['待归类', 'unclassified'],
])

const TEMP_NAME_RE = /(^|[\\/_\-\s])(temp|tmp|scratch|one[-_ ]?off|playground|draft|throwaway|untitled|新建文件夹|未命名|临时|草稿|测试)([\\/_\-\s]|$)/i
const ARTIFACT_NAME_RE = /(^|[\\/_\-\s])(chart|charts|plot|graph|image|images|img|render|renders|output|outputs|export|exports|图表|图片|生成图|渲染|产出)([\\/_\-\s]|$)/i

function text(value, max = 200) {
  return String(value ?? '').trim().slice(0, max)
}

function dateValue(value) {
  if (!value) return 0
  const n = typeof value === 'number' ? value : Date.parse(String(value))
  return Number.isFinite(n) ? n : 0
}

function uniqueIds(values) {
  const out = []
  const seen = new Set()
  for (const value of Array.isArray(values) ? values : []) {
    const id = text(typeof value === 'string' ? value : value?.id, 200)
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
    if (out.length >= 200) break
  }
  return out
}

export function normalizeLifecycle(value) {
  const key = text(value, 60).toLowerCase()
  return LIFE_ALIASES.get(key) || (LIFECYCLES.includes(key) ? key : '')
}

export function normalizeSessionPolicy(value) {
  const source = value && typeof value === 'object' ? value : {}
  return {
    rootSessionId: text(source.rootSessionId, 200),
    continuations: uniqueIds(source.continuations),
    side: uniqueIds(source.side),
    updatedAt: text(source.updatedAt, 40),
  }
}

export function normalizeIdentity(value) {
  const source = value && typeof value === 'object' ? value : {}
  const integration = source.integration && typeof source.integration === 'object' ? source.integration : {}
  const entry = integration.entry && typeof integration.entry === 'object' ? integration.entry : {}
  return {
    schemaVersion: 1,
    lifecycle: normalizeLifecycle(source.lifecycle),
    intent: text(source.intent, 2000),
    expiresAt: text(source.expiresAt, 40),
    integration: {
      kind: text(integration.kind, 40),
      agent: text(integration.agent, 40),
      apply: text(integration.apply, 40),
      entry: {
        type: text(entry.type, 20),
        value: text(entry.value, 2000),
      },
      state: Array.isArray(integration.state)
        ? integration.state.map((item) => text(item, 500)).filter(Boolean).slice(0, 20)
        : integration.state ? [text(integration.state, 500)].filter(Boolean) : [],
    },
    sessionPolicy: normalizeSessionPolicy(source.sessionPolicy),
    updatedAt: text(source.updatedAt, 40),
  }
}

function oneOffEvidence(project) {
  const haystack = `${project?.name || ''} ${project?.path || ''}`
  const sessions = Array.isArray(project?.sessions) ? project.sessions.length : Number(project?.sessionCount) || 0
  const codeFiles = Number(project?.codeFiles) || 0
  const hasGit = project?.hasGit === true
  const assetRun = project?.assetProject === true
  return Boolean((assetRun || TEMP_NAME_RE.test(haystack) || (!hasGit && ARTIFACT_NAME_RE.test(haystack) && codeFiles < 3)) && !hasGit && codeFiles < 5 && sessions <= 1)
}

function persistentEvidence(project) {
  const sessions = Array.isArray(project?.sessions) ? project.sessions.length : Number(project?.sessionCount) || 0
  const codeFiles = Number(project?.codeFiles) || 0
  const evidence = []
  if (project?.handoff?.goal || project?.handoff?.progress) evidence.push('handoff')
  if (project?.identity?.intent) evidence.push('intent')
  if (project?.identity?.sessionPolicy?.rootSessionId || project?.handoff?.sessionPolicy?.rootSessionId) evidence.push('main-session')
  if (hasGit(project) && codeFiles >= 5 && sessions >= 2) evidence.push('repeated-code-work')
  if (sessions >= 3) evidence.push('repeated-sessions')
  return evidence
}

function hasGit(project) {
  return project?.hasGit === true || Boolean(project?.git)
}

export function inferLifecycle(project) {
  const sessions = Array.isArray(project?.sessions) ? project.sessions.length : Number(project?.sessionCount) || 0
  const evidence = persistentEvidence(project)
  if (project?.handoff?.goal || project?.handoff?.progress) {
    return { value: 'persistent', source: 'inferred', confidence: 'high', evidence }
  }
  if (evidence.includes('main-session') || evidence.includes('intent')) {
    return { value: 'persistent', source: 'inferred', confidence: 'medium', evidence }
  }
  if (hasGit(project) || (Number(project?.codeFiles) || 0) >= 5 || sessions >= 3) {
    return { value: 'incubating', source: 'inferred', confidence: 'medium', evidence }
  }
  if (oneOffEvidence(project)) {
    return { value: 'temporary', source: 'inferred', confidence: 'low', evidence: [project?.assetProject ? 'asset-run' : 'one-off-pattern'] }
  }
  return { value: 'unclassified', source: 'inferred', confidence: 'low', evidence }
}

/**
 * Manual override > project manifest > project handoff snapshot > inference.
 * The returned object is intentionally explicit about its source so the UI
 * never presents a guess as a confirmed long-term project.
 */
export function lifecycleOf(project, override = {}) {
  const manual = normalizeLifecycle(override?.lifecycle)
  if (manual) return { value: manual, source: 'manual', confidence: 'high', evidence: ['user'] }
  const manifest = normalizeLifecycle(project?.identity?.lifecycle)
  if (manifest) return { value: manifest, source: 'manifest', confidence: 'high', evidence: ['workbench.project.json'] }
  const handoff = normalizeLifecycle(project?.handoff?.lifecycle)
  if (handoff) return { value: handoff, source: 'handoff', confidence: 'high', evidence: ['.dsh/handoff/state.json'] }
  return inferLifecycle(project)
}

export function temporaryExpiry(project, override = {}) {
  const explicit = text(override?.expiresAt || project?.identity?.expiresAt || project?.handoff?.expiresAt, 40)
  if (explicit && dateValue(explicit)) return new Date(explicit).toISOString()
  if (lifecycleOf(project, override).value !== 'temporary') return ''
  const base = dateValue(project?.created) || dateValue(project?.lastActivity) || Date.now()
  return new Date(base + 14 * 24 * 60 * 60 * 1000).toISOString()
}

export function cleanupSuggestion(project, override = {}) {
  const life = lifecycleOf(project, override)
  if (life.value === 'persistent' || life.value === 'incubating') return null
  const expiry = temporaryExpiry(project, override)
  const last = dateValue(project?.lastActivity)
  const expired = Boolean(expiry && dateValue(expiry) <= Date.now())
  const stale = Boolean(last && Date.now() - last > 30 * 24 * 60 * 60 * 1000)
  if (life.value !== 'temporary' && !stale) return null
  if (!expired && !stale) return null
  return {
    reason: expired ? 'expired' : 'stale',
    expiresAt: expiry || '',
    // A suggestion only. Deletion is always a separate, item-by-item action.
    deletable: project?.deletable !== false,
  }
}

/**
 * Build a lineage without pretending that every conversation in a folder is
 * part of the same project. `main` requires a user/manifest decision. Before
 * that decision the oldest session is shown as a *candidate*, never as truth.
 */
export function lineageOf(project, policyInput) {
  const sessions = (Array.isArray(project?.sessions) ? project.sessions : [])
    .filter((session) => session && session.id)
    .slice()
    .sort((a, b) => dateValue(b.updatedAt) - dateValue(a.updatedAt))
  const ids = new Set(sessions.map((session) => String(session.id)))
  const policy = normalizeSessionPolicy(
    policyInput || project?.sessionPolicy || project?.identity?.sessionPolicy || project?.handoff?.sessionPolicy,
  )
  const rootSessionId = ids.has(policy.rootSessionId) ? policy.rootSessionId : ''
  const suggestedRootId = rootSessionId || (sessions.length ? String(sessions[sessions.length - 1].id) : '')
  const continuationSet = new Set(policy.continuations.filter((id) => ids.has(id)))
  const sideSet = new Set(policy.side.filter((id) => ids.has(id)))
  const byId = new Map(sessions.map((session) => [String(session.id), session]))
  const items = sessions.map((session) => {
    const id = String(session.id)
    const parentId = String(session.parentSessionId || '')
    let role = 'unassigned'
    if (sideSet.has(id)) role = 'side'
    else if (rootSessionId && id === rootSessionId) role = 'main'
    else if (parentId && byId.has(parentId)) role = 'continuation'
    else if (rootSessionId && continuationSet.has(id)) role = 'continuation'
    else if (!rootSessionId && id === suggestedRootId) role = 'main-candidate'
    return {
      ...session,
      id,
      parentId,
      role,
      brokenParent: Boolean(parentId && !byId.has(parentId)),
    }
  })
  const counts = { main: 0, 'main-candidate': 0, continuation: 0, side: 0, unassigned: 0 }
  for (const item of items) counts[item.role] += 1
  return {
    rootSessionId,
    suggestedRootId,
    rootConfirmed: Boolean(rootSessionId),
    mainSessionId: rootSessionId || suggestedRootId,
    policy,
    items,
    counts,
    total: items.length,
  }
}

export function lifecycleStats(projects = []) {
  const list = (Array.isArray(projects) ? projects : []).filter((p) => p && p.topLevel && !p.hidden && !p.noise && !p.container)
  const out = { persistent: 0, incubating: 0, temporary: 0, unclassified: 0, cleanup: 0 }
  for (const project of list) {
    const life = project.lifecycle || lifecycleOf(project).value
    if (Object.prototype.hasOwnProperty.call(out, life)) out[life] += 1
    if (project.cleanup?.deletable) out.cleanup += 1
  }
  return out
}
