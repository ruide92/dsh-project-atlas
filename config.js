/**
 * User configuration for Project Atlas.
 *
 * Resolution order:
 *   1. DSH_WORKBENCH_CONFIG (absolute path to a JSON file)
 *   2. <package>/workbench.config.json (developer/local override, git-ignored)
 *   3. <DSH_HOME>/data/dsh-workbench/config.json (survives package upgrades)
 *   4. built-in, machine-neutral defaults
 *
 * The public package never contains a scan root, username, project name or
 * machine path. Configure your own roots in one of the files above.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
export const DATA_DIR = process.env.DSH_WORKBENCH_DATA || path.join(DSH_HOME, 'data', 'dsh-workbench')

export const DEFAULT_SKILL_ROOTS = [
  { key: 'codex', label: 'Codex', agent: 'Codex', scope: 'user', root: path.join(os.homedir(), '.codex'), depth: 7 },
  { key: 'claude', label: 'Claude Code', agent: 'Claude', scope: 'user', root: path.join(os.homedir(), '.claude'), depth: 6 },
  { key: 'agents', label: 'Shared Agents', agent: 'Agents', scope: 'user', root: path.join(os.homedir(), '.agents'), depth: 6 },
  { key: 'deepseek', label: 'DeepSeek', agent: 'DeepSeek', scope: 'user', root: path.join(os.homedir(), '.deepseek'), depth: 6 },
  { key: 'cursor', label: 'Cursor', agent: 'Cursor', scope: 'user', root: path.join(os.homedir(), '.cursor'), depth: 5 },
  { key: 'dsh', label: 'DSH', agent: 'DSH', scope: 'system', root: DSH_HOME, depth: 7 },
]

function expand(value) {
  if (typeof value !== 'string') return ''
  let v = value.trim()
  if (!v) return ''
  if (v === '~') v = os.homedir()
  else if (v.startsWith('~/') || v.startsWith('~\\')) v = path.join(os.homedir(), v.slice(2))
  return path.resolve(v)
}

export const DEFAULT_CONFIG = {
  // Public default: scan nothing. The workbench never guesses a drive, a
  // username, or a personal folder. Add your own roots in a local config.
  roots: [],
  excludeGlobs: [
    '**/node_modules/**',
    '**/.git/**',
    '**/AppData/**',
    '**/.cache/**',
    '**/dist/**',
    '**/build/**',
  ],
  openCodeDb: process.env.OPENCODE_DB || '',
  dshSessionsDir: path.join(DSH_HOME, 'sessions'),
  dshHome: DSH_HOME,
  codexDb: process.env.DSH_WORKBENCH_CODEX_DB || '',
  maxFilesPerProject: 120000,
  maxSizeMsPerProject: 4000,
  assetContainerMarkers: [],
  noisePatterns: [],
  skillRoots: DEFAULT_SKILL_ROOTS,
  workspaceNames: ['Projects', 'projects', 'Workspace', 'workspace', 'Code', 'code', 'Dev', 'dev', 'Repos', 'repos'],
  // Optional [{ prefix: 'D:\\work', label: 'Work' }] grouping labels.
  workspaceGroups: [],
  // Optional extra protected paths (the package, data dir and OS folders are
  // always protected).
  protectedPaths: [],
  allowDelete: false,
}

function asRoots(value) {
  if (!Array.isArray(value)) return null
  const out = []
  for (const item of value) {
    const raw = typeof item === 'string' ? item : item?.path
    const p = expand(raw)
    if (!p) continue
    const depth = Number(item?.depth)
    out.push({
      path: p,
      depth: Number.isFinite(depth) ? Math.max(0, Math.min(12, Math.floor(depth))) : 4,
      label: String(item?.label || ''),
      container: item?.container === true,
    })
  }
  return out
}

function asSkillRoots(value) {
  if (!Array.isArray(value)) return null
  const out = []
  for (const item of value) {
    const root = expand(typeof item === 'string' ? item : item?.root)
    if (!root) continue
    const key = String(item?.key || path.basename(root) || 'skills').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase()
    out.push({
      key,
      label: String(item?.label || path.basename(root) || key),
      agent: String(item?.agent || 'Local'),
      scope: String(item?.scope || 'user'),
      root,
      depth: Number.isFinite(Number(item?.depth)) ? Math.max(0, Math.min(12, Math.floor(Number(item.depth)))) : 6,
    })
  }
  return out
}

function readJson(file) {
  try {
    const stat = fs.statSync(file)
    if (!stat.isFile() || stat.size > 1024 * 1024) return null
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

export function configCandidates() {
  const explicit = expand(process.env.DSH_WORKBENCH_CONFIG)
  return [
    explicit,
    path.join(HERE, 'workbench.config.json'),
    path.join(DATA_DIR, 'config.json'),
  ].filter(Boolean)
}

export function loadConfig() {
  let raw = null
  let source = ''
  let invalid = false
  for (const candidate of configCandidates()) {
    if (!fs.existsSync(candidate)) continue
    const parsed = readJson(candidate)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      raw = parsed
      source = candidate
      break
    }
    // An explicitly present but unreadable config must not silently fall
    // through to a lower-priority file; keep the path so the UI can warn.
    source = candidate
    invalid = true
    break
  }
  const c = raw || {}
  const roots = asRoots(c.roots)
  const skillRoots = asSkillRoots(c.skillRoots)
  const config = {
    ...DEFAULT_CONFIG,
    ...(c && typeof c === 'object' && !Array.isArray(c) ? c : {}),
    roots: roots || DEFAULT_CONFIG.roots,
    skillRoots: skillRoots || DEFAULT_CONFIG.skillRoots,
    excludeGlobs: Array.isArray(c.excludeGlobs) ? c.excludeGlobs.map(String).filter(Boolean) : DEFAULT_CONFIG.excludeGlobs,
    workspaceNames: Array.isArray(c.workspaceNames) ? c.workspaceNames.map(String).filter(Boolean) : DEFAULT_CONFIG.workspaceNames,
    workspaceGroups: Array.isArray(c.workspaceGroups)
      ? c.workspaceGroups.map((g) => ({ prefix: expand(g?.prefix), label: String(g?.label || '') })).filter((g) => g.prefix && g.label)
      : [],
    protectedPaths: Array.isArray(c.protectedPaths) ? c.protectedPaths.map(expand).filter(Boolean) : [],
    assetContainerMarkers: Array.isArray(c.assetContainerMarkers) ? c.assetContainerMarkers.map(String).filter(Boolean) : [],
    noisePatterns: Array.isArray(c.noisePatterns) ? c.noisePatterns.map(String).filter(Boolean) : [],
    openCodeDb: expand(c.openCodeDb) || DEFAULT_CONFIG.openCodeDb,
    dshHome: expand(c.dshHome) || DEFAULT_CONFIG.dshHome,
    dshSessionsDir: expand(c.dshSessionsDir) || path.join(expand(c.dshHome) || DEFAULT_CONFIG.dshHome, 'sessions'),
    codexDb: expand(c.codexDb) || DEFAULT_CONFIG.codexDb,
    maxFilesPerProject: Math.max(1000, Number(c.maxFilesPerProject) || DEFAULT_CONFIG.maxFilesPerProject),
    maxSizeMsPerProject: Math.max(500, Number(c.maxSizeMsPerProject) || DEFAULT_CONFIG.maxSizeMsPerProject),
    allowDelete: c.allowDelete === true,
  }
  Object.defineProperty(config, '_source', { value: source, enumerable: false })
  Object.defineProperty(config, '_warnings', {
    value: invalid ? [`配置文件无法读取或不是 JSON 对象：${source}`] : [],
    enumerable: false,
  })
  return config
}
