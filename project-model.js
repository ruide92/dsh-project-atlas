/**
 * Project-centric view model.
 *
 * The scanner records folders. A user's project is a logical entity: one main
 * folder plus optional linked folders, many sessions and many artifacts. This
 * module turns the folder catalog into that view without mutating the catalog:
 *
 *   - a workspace root that only exists to hold projects is not a project;
 *   - its direct children are promoted to first-class projects;
 *   - temporary/cache folders are marked noise;
 *   - folder links from overrides become part of the project;
 *   - DSH sessions are counted against the deepest matching project folder.
 */

const DEFAULT_WORKSPACE_NAMES = ['Projects', 'Workspace', 'Code', 'Dev', 'Repos']
const NOISE_PARTS = [
  'appdata', 'resources/app', 'microsoft vs code', '_clone_tmp_', '$recycle.bin',
  'cache/uv', 'resources/node-repl',
  'node_modules', 'dist', 'build', 'target', '.venv', '__pycache__',
]

export function normalizePath(value) {
  let s = String(value || '').replace(/\//g, '\\').replace(/\\+$/, '')
  if (/^[A-Za-z]:$/.test(s)) s += '\\'
  return s.toLowerCase()
}

function samePath(a, b) {
  return normalizePath(a) === normalizePath(b)
}

function isInside(child, parent) {
  const c = normalizePath(child)
  const p = normalizePath(parent)
  const prefix = p.endsWith('\\') ? p : p + '\\'
  return Boolean(c && p && c !== p && c.startsWith(prefix))
}

function baseName(value) {
  const parts = String(value || '').split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] || ''
}

function timeValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value) return Date.parse(value) || 0
  return 0
}

function isNoiseProject(p, options = {}) {
  if (p.noise === true) return true
  const value = String(p.path || '').split(String.fromCharCode(92)).join('/').toLowerCase()
  const extra = (options.noisePatterns || []).map((x) => String(x).split(String.fromCharCode(92)).join('/').toLowerCase())
  return [...NOISE_PARTS, ...extra].some((part) => value.includes(part))
}

function directChildren(all) {
  const map = new Map()
  for (const p of all) map.set(p.id, [])
  for (const p of all) {
    if (p.parentId && map.has(p.parentId)) map.get(p.parentId).push(p)
  }
  return map
}

/**
 * @param {Array<object>} rawProjects scanner projects
 * @param {object} overrides persisted per-project overrides, keyed by project id
 * @param {Array<object>} sessions DSH sessions: { id, title, cwd, updatedAt, parentSessionId }
 */
export function buildProjectView(rawProjects, overrides = {}, sessions = [], options = {}) {
  const all = (Array.isArray(rawProjects) ? rawProjects : []).map((p) => ({ ...p }))
  const byId = new Map(all.map((p) => [p.id, p]))

  // Recompute the folder hierarchy from paths so this also works with an old
  // catalog that was produced before the container rules existed.
  const byPath = [...all].sort((a, b) => String(a.path).length - String(b.path).length)
  for (const p of byPath) {
    let parent = null
    for (const q of byPath) {
      if (q === p) continue
      if (!isInside(p.path, q.path)) continue
      if (!parent || String(q.path).length > String(parent.path).length) parent = q
    }
    p.parentId = parent?.id || null
  }

  const childrenOf = directChildren(all)
  for (const p of all) {
    const kids = childrenOf.get(p.id) || []
    const markers = Array.isArray(p.markers) ? p.markers.filter(Boolean) : []
    const names = new Set((options.workspaceNames || DEFAULT_WORKSPACE_NAMES).map((x) => String(x).toLowerCase()))
    const namedWorkspace = names.has(baseName(p.path).toLowerCase())
    // A folder that only carries a .dsh workspace marker and contains several
    // real projects is a workspace, not a project. A real project with a
    // package manifest, git repo or a single child stays a project.
    p.container = Boolean(
      p.assetContainer === true
      || (
        kids.length >= 2
        && !p.hasGit
        && (namedWorkspace || (p.hasDsh && markers.length === 0))
      ),
    )
  }

  for (const p of all) {
    p.noise = isNoiseProject(p, options)
  }

  // Promote direct children of workspace containers. Keep deeper children of a
  // normal project (monorepo) as subprojects.
  for (const container of all.filter((p) => p.container)) {
    for (const child of childrenOf.get(container.id) || []) {
      child.parentId = null
      child.promotedFrom = container.id
    }
  }

  for (const p of all) {
    p.topLevel = !p.container && !p.parentId
    p.displayName = p.displayName || p.name || baseName(p.path)
  }

  let visible = all.filter((p) => !p.container && !p.noise)

  const sessionList = Array.isArray(sessions) ? sessions : []
  for (const p of all) {
    p.sessionCount = 0
    p.sessions = []
    p.lastSessionAt = null
    p.lastSessionTitle = ''
    p.tools = new Set()
    if (p.hasDsh || p.dsh?.sessions) p.tools.add('dsh')
    if (p.openCode || (p.sources || []).includes('opencode')) p.tools.add('opencode')
    if (/comfy/i.test(`${p.name} ${p.path} ${p.summary || ''}`)) p.tools.add('comfyui')

    const linked = Array.isArray(overrides?.[p.id]?.folders) ? overrides[p.id].folders : []
    const folders = [{ path: p.path, role: 'main', primary: true }]
    for (const item of linked) {
      const folderPath = typeof item === 'string' ? item : item?.path
      if (!folderPath) continue
      if (folders.some((f) => samePath(f.path, folderPath))) continue
      folders.push({
        path: folderPath,
        role: typeof item === 'object' && item?.role ? String(item.role) : 'reference',
        primary: false,
      })
    }
    p.folders = folders
    p.folderCount = folders.length
  }

  // A linked folder is part of its owner project, not another project row.
  // This keeps several runs of one production line from being rendered as
  // unrelated projects.
  const linkedOwner = new Map()
  for (const p of visible) {
    for (const folder of p.folders.slice(1)) {
      const key = normalizePath(folder.path)
      if (key && !linkedOwner.has(key)) linkedOwner.set(key, p.id)
    }
  }
  for (const p of all) {
    const owner = linkedOwner.get(normalizePath(p.path))
    if (owner && owner !== p.id) {
      p.mergedInto = owner
      p.topLevel = false
    }
  }
  visible = visible.filter((p) => !p.mergedInto)

  const folderOwners = []
  for (const p of visible) {
    for (const folder of p.folders) folderOwners.push({ project: p, path: folder.path })
  }
  folderOwners.sort((a, b) => String(b.path).length - String(a.path).length)

  // A workspace-root session has no project folder of its own. The user can
  // explicitly link it to a project; this link wins over cwd inference.
  const explicitOwners = new Map()
  for (const p of visible) {
    const links = Array.isArray(overrides?.[p.id]?.sessions) ? overrides[p.id].sessions : []
    for (const item of links) {
      const sessionId = typeof item === 'string' ? item : item?.id
      const source = typeof item === 'object' && item?.source === 'codex' ? 'codex' : 'dsh'
      if (sessionId && !explicitOwners.has(`${source}:${String(sessionId)}`)) {
        explicitOwners.set(`${source}:${String(sessionId)}`, p.id)
      }
    }
  }

  for (const session of sessionList) {
    const cwd = String(session?.cwd || '')
    const source = session?.source === 'codex' ? 'codex' : 'dsh'
    const explicitId = explicitOwners.get(`${source}:${String(session?.id || '')}`)
    // Codex threads are never mapped by cwd. Its generic blender workspace is
    // shared by many projects, so only an explicit user link is trustworthy.
    const explicitOnly = session?.explicitOnly === true || source === 'codex'
    let match = explicitId ? visible.find((p) => p.id === explicitId) || null : null
    const manual = Boolean(match)
    if (!match && !explicitOnly) {
      for (const owner of folderOwners) {
        if (samePath(cwd, owner.path) || isInside(cwd, owner.path)) { match = owner.project; break }
      }
    }
    if (!match) continue
    match.sessionCount += 1
    match.tools.add(source)
    match.sessions.push({
      id: session.id,
      source,
      title: session.title || '',
      cwd,
      updatedAt: session.updatedAt || null,
      parentSessionId: session.parentSessionId || '',
      running: session.running === true,
      manual,
    })
    if (!match.lastSessionAt || timeValue(session.updatedAt) > timeValue(match.lastSessionAt)) {
      match.lastSessionAt = session.updatedAt || null
      match.lastSessionTitle = session.title || ''
    }
  }

  for (const p of all) {
    p.sessions.sort((a, b) => timeValue(b.updatedAt) - timeValue(a.updatedAt))
    p.sessions = p.sessions.slice(0, 50)

    p.tools = [...p.tools]
    if (p.lastSessionAt && timeValue(p.lastSessionAt) > timeValue(p.lastActivity)) {
      p.lastActivity = p.lastSessionAt
    }
  }

  // Keep the full list for the drawer (subprojects) but sort real projects
  // first, then containers/noise for callers that explicitly ask for them.
  const rank = (p) => (p.container ? 2 : p.noise ? 1 : 0)
  return all.sort((a, b) => rank(a) - rank(b) || String(a.path).localeCompare(String(b.path), 'zh-CN'))
}

export function projectStats(projects) {
  const visible = (projects || []).filter((p) => p.topLevel && !p.hidden && !p.noise && !p.container)
  const sum = (list, key) => list.reduce((n, p) => n + (Number(p[key]) || 0), 0)
  return {
    projectCount: visible.length,
    topLevelCount: visible.length,
    active: visible.filter((p) => p.status === 'active').length,
    paused: visible.filter((p) => p.status === 'paused').length,
    archived: visible.filter((p) => p.status === 'archived').length,
    unknown: visible.filter((p) => p.status === 'unknown').length,
    totalBytes: sum(visible, 'sizeBytes'),
    folderCount: visible.reduce((n, p) => n + (p.folderCount || 1), 0),
    sessionCount: visible.reduce((n, p) => n + (p.sessionCount || 0), 0),
  }
}
