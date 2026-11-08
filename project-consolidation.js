/**
 * Project consolidation: turn folder-shaped scan results into human-shaped
 * projects without guessing too much.
 *
 * This module is deliberately pure. It never merges or deletes anything; it
 * only explains why two folders might be the same logical project and lets the
 * user make the final decision in the UI.
 */

const DAY_MS = 24 * 60 * 60 * 1000

const COPY_WORDS = '(?:copy|backup|bak|old|new|final|latest|test|tmp|temp|副本|备份|拷贝|复制|旧版|新版|旧|新|最终版|最终|最新版|最新|测试版|测试|临时|v\\d+(?:[._-]\\d+)*|version[._-]?\\d+(?:[._-]\\d+)*|\\d{8}|\\d{4}[-_.]\\d{1,2}[-_.]\\d{1,2})'
const COPY_SUFFIX = new RegExp(`(?:[\\s._-]+${COPY_WORDS}|[（(]\\s*(?:${COPY_WORDS}|\\d+)\\s*[）)]|(?:副本|备份|拷贝|复制|旧版|新版|最终版|最新版|测试版|旧|新|最终|最新|测试|临时))+$`, 'gi')

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'app', 'application', 'by', 'code', 'demo', 'for', 'from',
  'in', 'of', 'on', 'project', 'repo', 'repository', 'the', 'this', 'to', 'with',
  'work', 'workspace',
])

function text(value, max = 400) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function normPath(value) {
  return String(value || '')
    .replace(/\//g, '\\')
    .replace(/\\+/g, '\\')
    .replace(/\\$/, '')
    .toLowerCase()
}

function isInside(parent, child) {
  const base = normPath(parent)
  const target = normPath(child)
  if (!base || !target || base === target) return false
  return target.startsWith(base.endsWith('\\') ? base : `${base}\\`)
}

/** Normalize a git remote so https/ssh forms of the same repo compare equal. */
export function remoteKey(value) {
  let remote = text(value, 500).toLowerCase()
  if (!remote) return ''
  remote = remote.replace(/^[a-z+]+:\/\//, '')
  remote = remote.replace(/^[^@/\s]+@([^:/\s]+):/, '$1/')
  remote = remote.replace(/^[^@/\s]+@/, '')
  remote = remote.replace(/[?#].*$/, '')
  remote = remote.replace(/\.git$/, '')
  remote = remote.replace(/\/+$/, '')
  return remote
}

/**
 * A conservative folder-name stem. It removes copy/version/date suffixes but
 * keeps the meaningful words, including Chinese characters.
 */
export function projectNameStem(value) {
  let name = text(value, 200)
  if (!name) return ''
  name = name.replace(/\.[a-z0-9]{1,8}$/i, '')
  let previous = ''
  while (previous !== name) {
    previous = name
    name = name.replace(COPY_SUFFIX, '').trim()
  }
  return name
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function tokens(value) {
  const stem = projectNameStem(value)
  if (!stem) return new Set()
  const output = new Set()
  for (const part of stem.split(/\s+/)) {
    if (!part || STOP_WORDS.has(part)) continue
    if (/^[\u3400-\u9fff]+$/.test(part) && part.length > 2) {
      // Chinese has no spaces. Bigrams make "彩票程序" and "彩票工具" related
      // without making every Chinese sentence look identical.
      for (let i = 0; i < part.length - 1; i++) output.add(part.slice(i, i + 2))
      if (part.length <= 4) output.add(part)
    } else {
      output.add(part)
    }
  }
  return output
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0
  let intersection = 0
  for (const value of a) if (b.has(value)) intersection += 1
  return intersection / (a.size + b.size - intersection)
}

function normalizedMarkerSet(project) {
  const markers = Array.isArray(project?.markers) ? project.markers : []
  return markers
    .map((marker) => String(marker || '').toLowerCase().replace(/^.*[\\/]/, ''))
    .filter(Boolean)
    .sort()
    .join('|')
}

/**
 * Compare two presented projects. The threshold is intentionally high: a
 * false merge is much more expensive than an unsuggested duplicate.
 */
export function projectSimilarity(a, b) {
  if (!a?.id || !b?.id || a.id === b.id) return null
  if (a.topLevel === false || b.topLevel === false) return null
  if (isInside(a.path, b.path) || isInside(b.path, a.path)) return null

  const reasons = []
  let score = 0
  const remoteA = remoteKey(a.git?.remote)
  const remoteB = remoteKey(b.git?.remote)
  if (remoteA && remoteA === remoteB) {
    score += 0.8
    reasons.push('sameRemote')
  }

  const packageA = text(a.packageName, 200).toLowerCase()
  const packageB = text(b.packageName, 200).toLowerCase()
  if (packageA && packageA === packageB) {
    score += 0.4
    reasons.push('samePackage')
  }

  const stemA = projectNameStem(a.name || a.displayName)
  const stemB = projectNameStem(b.name || b.displayName)
  if (stemA && stemA === stemB) {
    score += 0.3
    reasons.push('sameName')
  } else if (stemA && stemB) {
    const short = stemA.length <= stemB.length ? stemA : stemB
    const long = short === stemA ? stemB : stemA
    if (short.length >= 4 && long.includes(short) && long.length - short.length <= 24) {
      score += 0.16
      reasons.push('similarName')
    }
  }

  const summaryScore = jaccard(tokens(a.summary || a.note), tokens(b.summary || b.note))
  if (summaryScore >= 0.5) {
    score += 0.3
    reasons.push('sameSummary')
  } else if (summaryScore >= 0.25) {
    score += 0.12
    reasons.push('similarSummary')
  }

  const displayScore = jaccard(tokens(a.displayName), tokens(b.displayName))
  if (displayScore >= 0.6) {
    score += 0.1
    reasons.push('sameDisplayName')
  }

  if (normalizedMarkerSet(a) && normalizedMarkerSet(a) === normalizedMarkerSet(b)) score += 0.04

  score = Math.min(1, Number(score.toFixed(3)))
  if (score < 0.5) return null
  return {
    score,
    reasons: [...new Set(reasons)],
    strong: score >= 0.7,
  }
}

/** Return up to `limit` possible duplicates for one project. */
export function duplicateCandidates(project, projects, limit = 5) {
  const rows = []
  for (const other of Array.isArray(projects) ? projects : []) {
    const match = projectSimilarity(project, other)
    if (!match) continue
    rows.push({
      id: other.id,
      displayName: other.displayName || other.name || other.id,
      name: other.name || '',
      path: other.path || '',
      lastActivity: other.lastActivity || '',
      created: other.created || '',
      lifecycle: other.lifecycle || '',
      score: match.score,
      reasons: match.reasons,
      strong: match.strong,
    })
  }
  return rows
    .sort((a, b) => b.score - a.score || (Date.parse(b.lastActivity) || 0) - (Date.parse(a.lastActivity) || 0))
    .slice(0, limit)
}

/** Activity is explanatory, never a reason to delete or auto-archive. */
export function activityOf(project, now = Date.now()) {
  const last = Date.parse(project?.lastActivity || '') || 0
  const created = Date.parse(project?.created || '') || 0
  const idleDays = last ? Math.max(0, Math.floor((now - last) / DAY_MS)) : null
  const ageDays = created ? Math.max(0, Math.floor((now - created) / DAY_MS)) : null
  const band = idleDays == null ? 'unknown'
    : idleDays <= 7 ? 'fresh'
    : idleDays <= 30 ? 'warm'
    : idleDays <= 90 ? 'stale'
    : 'dormant'
  return {
    idleDays,
    ageDays,
    activityBand: band,
    dormant: band === 'dormant',
  }
}

/** Attach activity and duplicate hints to a project list without mutating it. */
export function annotateProjects(projects, options = {}) {
  const list = Array.isArray(projects) ? projects : []
  const now = options.now || Date.now()
  const top = list.filter((project) => project && project.topLevel !== false && !project.noise && !project.container && !project.hidden)
  return list.map((project) => {
    if (!project) return project
    const candidates = project.topLevel === false || project.noise || project.container || project.hidden
      ? []
      : duplicateCandidates(project, top, options.limit || 5)
    return {
      ...project,
      ...activityOf(project, now),
      duplicateCandidates: candidates,
      duplicateCount: candidates.length,
    }
  })
}

function connectedDuplicateGroups(projects) {
  const top = (Array.isArray(projects) ? projects : []).filter((project) => project && project.topLevel !== false && !project.noise && !project.container && !project.hidden)
  const byId = new Map(top.map((project) => [project.id, project]))
  const parent = new Map(top.map((project) => [project.id, project.id]))
  const find = (id) => {
    let value = id
    while (parent.get(value) !== value) value = parent.get(value)
    return value
  }
  const union = (a, b) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(rb, ra)
  }
  let pairs = 0
  for (let i = 0; i < top.length; i++) {
    for (let j = i + 1; j < top.length; j++) {
      if (!projectSimilarity(top[i], top[j])) continue
      pairs += 1
      union(top[i].id, top[j].id)
    }
  }
  const groups = new Map()
  for (const project of top) {
    const root = find(project.id)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root).push(byId.get(project.id))
  }
  return [...groups.values()].filter((items) => items.length > 1)
}

/** Counts used by the “整理” entry point. */
export function tidySummary(projects, now = Date.now()) {
  const list = (Array.isArray(projects) ? projects : []).filter((project) => project && project.topLevel !== false && !project.noise && !project.container && !project.hidden)
  const groups = connectedDuplicateGroups(list)
  const duplicateIds = new Set(groups.flat().map((project) => project.id))
  const dormant = list.filter((project) => {
    if (duplicateIds.has(project.id)) return false
    const activity = project.activityBand ? project : activityOf(project, now)
    return activity.activityBand === 'dormant' && project.status !== 'archived'
  })
  const dormantIds = new Set(dormant.map((project) => project.id))
  // A project can be both dormant and missing intent. Show it in the first
  // section only, so the tidy dialog never presents one folder as two issues.
  const missingIntent = list.filter((project) => {
    if (project.status === 'archived' || duplicateIds.has(project.id) || dormantIds.has(project.id)) return false
    const intent = text(project.identity?.intent || project.note, 200)
    if (intent) return false
    const name = text(project.displayName || project.name, 200)
    return Boolean(name) && !/[\u3400-\u9fff]/.test(name)
  })
  return {
    duplicateGroups: groups.length,
    duplicateProjects: duplicateIds.size,
    dormantProjects: dormant.length,
    missingIntent: missingIntent.length,
    total: groups.length + dormant.length + missingIntent.length,
  }
}
