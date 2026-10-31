/**
 * Discovery / follow-up state for the workbench.
 *
 * A project is "new" only when it appears in a rescan that has a previous
 * catalog to compare against. New projects stay in the follow-up queue until
 * the user explicitly marks them as handled. Pure functions only: the host
 * owns persistence and the client owns presentation.
 */

const MAX_SCANS = 30
const FOLLOW_STATES = new Set(['done', 'muted'])

function text(value, limit = 500) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}

function uniqueStrings(value) {
  return [...new Set((Array.isArray(value) ? value : []).map((item) => text(item, 120)).filter(Boolean))]
}

export function normalizeFollowups(input) {
  const raw = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const map = (value) => {
    const out = {}
    if (!value || typeof value !== 'object' || Array.isArray(value)) return out
    for (const [key, at] of Object.entries(value)) {
      const id = text(key, 120)
      const stamp = text(at, 80)
      if (id && stamp) out[id] = stamp
    }
    return out
  }
  const items = {}
  if (raw.items && typeof raw.items === 'object' && !Array.isArray(raw.items)) {
    for (const [key, item] of Object.entries(raw.items)) {
      const id = text(key, 120)
      if (!id || !item || typeof item !== 'object') continue
      const state = FOLLOW_STATES.has(item.state) ? item.state : ''
      if (!state) continue
      items[id] = { state, at: text(item.at, 80) }
    }
  }
  const scans = (Array.isArray(raw.scans) ? raw.scans : [])
    .filter((scan) => scan && typeof scan === 'object' && text(scan.at, 80))
    .map((scan) => ({
      at: text(scan.at, 80),
      projectCount: Number.isFinite(scan.projectCount) ? Math.max(0, Math.trunc(scan.projectCount)) : 0,
      newIds: uniqueStrings(scan.newIds),
      removedIds: uniqueStrings(scan.removedIds),
    }))
    .slice(0, MAX_SCANS)
  return {
    schemaVersion: 1,
    firstSeen: map(raw.firstSeen),
    lastSeen: map(raw.lastSeen),
    items,
    newIds: uniqueStrings(raw.newIds),
    scans,
  }
}

/**
 * Record one successful scan.
 * `previousIds` is the project set from the catalog that was visible before
 * this scan. An empty set means "first ever scan" and is treated as a
 * baseline, so a fresh install does not flag every existing project as new.
 */
export function recordDiscovery(input, projects, at, previousIds = []) {
  const state = normalizeFollowups(input)
  const stamp = text(at, 80)
  const list = Array.isArray(projects) ? projects : []
  const previous = new Set(uniqueStrings(previousIds))
  const current = new Set()
  const foundIds = []
  for (const project of list) {
    const id = text(project?.id, 120)
    if (!id) continue
    current.add(id)
    if (!state.firstSeen[id]) state.firstSeen[id] = stamp
    state.lastSeen[id] = stamp
    if (previous.size > 0 && !previous.has(id)) foundIds.push(id)
  }
  const carried = state.newIds.filter((id) => current.has(id) && !['done', 'muted'].includes(state.items[id]?.state))
  state.newIds = [...new Set([...carried, ...foundIds])]
  state.scans = [{
    at: stamp,
    projectCount: current.size,
    newIds: [...new Set(foundIds)],
    removedIds: [...previous].filter((id) => !current.has(id)),
  }, ...state.scans].slice(0, MAX_SCANS)
  return state
}

export function markFollowup(input, projectId, nextState, at) {
  const state = normalizeFollowups(input)
  const id = text(projectId, 120)
  if (!id) return state
  if (nextState === 'new' || nextState === 'reset') {
    delete state.items[id]
    state.newIds = [...new Set([...state.newIds, id])]
    return state
  }
  if (!FOLLOW_STATES.has(nextState)) return state
  state.items[id] = { state: nextState, at: text(at, 80) }
  state.newIds = state.newIds.filter((item) => item !== id)
  return state
}

export function followupInfo(input, project, normalized = false) {
  const state = normalized ? input : normalizeFollowups(input)
  const id = text(project?.id, 120)
  const item = id ? state.items[id] : null
  const settled = Boolean(item && FOLLOW_STATES.has(item.state))
  const isNew = Boolean(id && state.newIds.includes(id) && !settled)
  const hidden = Boolean(project?.hidden)
  const needsFollowup = Boolean(isNew && !hidden && !project?.noise && project?.topLevel !== false)
  return {
    discoveredAt: id ? state.firstSeen[id] || '' : '',
    lastSeenAt: id ? state.lastSeen[id] || '' : '',
    followState: item?.state || (isNew ? 'new' : 'seen'),
    isNew,
    needsFollowup,
  }
}

export function followupSummary(projects, state) {
  const list = Array.isArray(projects) ? projects : []
  const normalized = normalizeFollowups(state)
  return {
    pending: list.filter((project) => project?.needsFollowup).length,
    newCount: list.filter((project) => project?.isNew && !project?.hidden).length,
    handled: list.filter((project) => project?.followState === 'done').length,
    lastScan: normalized.scans[0] || null,
    scanCount: normalized.scans.length,
  }
}
