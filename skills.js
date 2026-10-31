/**
 * Skill atlas — read-only inventory of SKILL.md files scattered across the
 * local agent installations. Projects stay projects; skills stay skills.
 *
 * The scanner intentionally avoids node_modules/build/cache trees and only
 * reads SKILL.md frontmatter plus a short body preview. It never writes to a
 * skill directory.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'

const HOME = os.homedir()
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg', '.next', '.nuxt', 'dist', 'build',
  'release', 'coverage', '.venv', 'venv', '__pycache__', '.cache', '.npm',
  '.pnpm-store', 'AppData', '.tmp', '.chatgpt-projects', 'site-packages',
])

let configuredRoots = null
const ROOT_DEFS = [
  { key: 'codex', label: 'Codex', agent: 'Codex', scope: 'user', root: path.join(HOME, '.codex'), depth: 7 },
  { key: 'deepseek', label: 'DeepSeek', agent: 'DeepSeek', scope: 'user', root: path.join(HOME, '.deepseek'), depth: 6 },
  { key: 'hub', label: 'Hub Global', agent: 'Hub', scope: 'user', root: path.join(HOME, '.hub-global'), depth: 5 },
  { key: 'qoderwork', label: 'QoderWork', agent: 'Qoder', scope: 'user', root: path.join(HOME, '.qoderwork'), depth: 5 },
  { key: 'qoderworkcn', label: 'QoderWork CN', agent: 'Qoder', scope: 'user', root: path.join(HOME, '.qoderworkcn'), depth: 5 },
  { key: 'qwenwork', label: 'QwenWork CN', agent: 'Qwen', scope: 'user', root: path.join(HOME, '.qwenworkcn'), depth: 6 },
  { key: 'cursor', label: 'Cursor', agent: 'Cursor', scope: 'user', root: path.join(HOME, '.cursor'), depth: 5 },
  { key: 'trae', label: 'Trae CN', agent: 'Trae', scope: 'system', root: path.join(HOME, '.trae-cn'), depth: 5 },
  { key: 'agents', label: 'Shared Agents', agent: 'Agents', scope: 'user', root: path.join(HOME, '.agents'), depth: 6 },
  { key: 'lingma', label: 'Lingma', agent: 'Lingma', scope: 'user', root: path.join(HOME, '.lingma'), depth: 5 },
  { key: 'openhuman', label: 'OpenHuman', agent: 'OpenHuman', scope: 'user', root: path.join(HOME, '.openhuman'), depth: 6 },
  { key: 'ccswitch', label: 'CC Switch', agent: 'CC Switch', scope: 'user', root: path.join(HOME, '.cc-switch'), depth: 5 },
  { key: 'claude', label: 'Claude Code', agent: 'Claude', scope: 'user', root: path.join(HOME, '.claude'), depth: 6 },
]

const CATEGORY_RULES = [
  ['办公数据', /(^|[-_/ ])(docx|pdf|pptx|xlsx|office|spreadsheet|excel|slides?|documents?)([-_/ ]|$)/i],
  ['视频图像', /(video|comfy|image|img|motion|animation|h3|shot|film|cinema|storyboard|voice|audio|music|whisper|tts|nano[-_ ]?banana|chatcut|blender|render|avatar|visual)/i],
  ['内容写作', /(wechat|article|content|prose|write|writer|news|blog|copy|publish|feishu|notion|summar|translat|script|story|editor|human[-_ ]?voice)/i],
  ['自动化系统', /(computer|browser|automation|windows|shell|cli|nas|hermes|openclaw|network|proxy|tunnel|server|monitor|health|system|desktop|install|maintenance)/i],
  ['研究分析', /(research|audit|security|reverse|analysis|analy|diagnos|inspect|oracle|review)/i],
  ['开发工程', /(code|dev|git|test|debug|refactor|frontend|backend|api|plugin|deploy|ci|typescript|python|react|database|sql|schema|build|engineering)/i],
]

const INSTALLED_HINTS = [
  '/plugins/', '/connectors-marketplace/', '/marketplaces/', '/cache/',
  '/.system/', '/builtin_skills/', '/office-skills/', '/superpowers/',
  '/node_modules/', '/skill-registry/',
]

const cache = { at: 0, result: null, byId: new Map() }

function realish(value) {
  return path.resolve(String(value || ''))
}

function underRoot(value, root) {
  const base = realish(root)
  const prefix = base.endsWith(path.sep) ? base : base + path.sep
  return value === base || value.startsWith(prefix)
}

function safeText(value, max = 400) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function categoryFor(name, description, fullPath) {
  // Classify by what the skill says it does, not by its source path: every
  // SKILL.md path contains "skill" and many live under .codex/.claude, which
  // would otherwise make the whole atlas look like development work.
  const hay = `${name} ${description}`
  for (const [label, re] of CATEGORY_RULES) if (re.test(hay)) return label
  return '其他'
}

export function classifyOrigin(fullPath) {
  const normalized = String(fullPath || '').replace(/\\/g, '/').toLowerCase()
  return INSTALLED_HINTS.some((hint) => normalized.includes(hint)) ? 'installed' : 'authored'
}

function cleanValue(value) {
  return String(value || '').trim().replace(/^['"]|['"]$/g, '')
}

export function parseFrontmatter(text) {
  const source = String(text || '').replace(/^\uFEFF/, '')
  if (!source.startsWith('---')) return { meta: {}, body: source }
  const end = source.indexOf('\n---', 3)
  if (end < 0) return { meta: {}, body: source }
  const head = source.slice(3, end).split(/\r?\n/)
  const meta = {}
  let lastKey = ''
  for (const raw of head) {
    if (!raw.trim()) continue
    const match = raw.match(/^([A-Za-z0-9_.-]+):\s*(.*)$/)
    if (match) {
      lastKey = match[1]
      const value = match[2]
      meta[lastKey] = /^[>|][+-]?$/.test(value) ? '' : cleanValue(value)
      continue
    }
    if (lastKey && /^\s+/.test(raw)) {
      const piece = raw.trim()
      meta[lastKey] = `${meta[lastKey] || ''}${meta[lastKey] ? ' ' : ''}${piece}`
    }
  }
  const body = source.slice(end + 4).replace(/^\s+/, '')
  return { meta, body }
}

function descriptionFrom(body) {
  const lines = String(body || '').split(/\r?\n/)
  const parts = []
  for (const line of lines) {
    const text = line.trim()
    if (!text) { if (parts.length) break; continue }
    if (text.startsWith('#')) continue
    if (text.startsWith('```')) break
    parts.push(text.replace(/^[-*]\s+/, ''))
    if (parts.join(' ').length > 260) break
  }
  return safeText(parts.join(' '), 320)
}

function parseTags(meta) {
  const raw = meta.tags || meta.tag || meta.keywords
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map((x) => safeText(x, 40)).filter(Boolean).slice(0, 6)
  return String(raw).replace(/^\[|\]$/g, '').split(/[,，;；]/).map((x) => safeText(x, 40)).filter(Boolean).slice(0, 6)
}

async function walk(root, maxDepth, out, seen) {
  let st
  try { st = await fs.stat(root) } catch { return }
  if (!st.isDirectory()) return
  const resolved = path.resolve(root)
  if (seen.has(resolved)) return
  seen.add(resolved)
  const stack = [{ dir: resolved, depth: 0 }]
  while (stack.length) {
    const { dir, depth } = stack.pop()
    let entries
    try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { continue }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (depth >= maxDepth || SKIP_DIRS.has(entry.name)) continue
        stack.push({ dir: full, depth: depth + 1 })
      } else if (entry.isFile() && /^skill\.md$/i.test(entry.name)) {
        out.push(full)
      }
    }
  }
}

async function readSkill(file, def) {
  let text = ''
  let st
  try {
    st = await fs.stat(file)
    if (st.size > 512 * 1024) return null
    text = await fs.readFile(file, 'utf8')
  } catch { return null }
  const { meta, body } = parseFrontmatter(text)
  const dir = path.dirname(file)
  const folder = path.basename(dir)
  const name = safeText(meta.name || meta.title || folder, 120) || folder
  const description = safeText(meta.description || descriptionFrom(body), 360)
  const rel = path.relative(def.root, file)
  const id = crypto.createHash('sha1').update(path.resolve(file)).digest('hex').slice(0, 14)
  const contentHash = crypto.createHash('sha1').update(text).digest('hex').slice(0, 16)
  return {
    id,
    name,
    folder,
    slug: slugify(name || folder),
    description,
    category: categoryFor(name, description, file),
    origin: classifyOrigin(file),
    source: def.label,
    sourceKey: def.key,
    agent: def.agent,
    scope: def.scope,
    root: def.root,
    path: path.resolve(file),
    dir,
    rel: rel.split(path.sep).join('/'),
    size: st.size,
    mtime: st.mtimeMs,
    hash: contentHash,
    version: safeText(meta.version, 32),
    license: safeText(meta.license, 40),
    tags: parseTags(meta),
    contentPreview: safeText(body, 700),
  }
}

export function configureSkillRoots(defs) {
  configuredRoots = Array.isArray(defs)
    ? defs.map((def) => ({ ...def, root: realish(def.root) }))
    : null
  cache.at = 0
  cache.result = null
  cache.byId = new Map()
}

function rootDefs() {
  return (configuredRoots || ROOT_DEFS).map((def) => ({ ...def, root: realish(def.root) }))
}

export async function scanSkills({ force = false } = {}) {
  const now = Date.now()
  if (!force && cache.result && now - cache.at < 45_000) return cache.result
  const files = []
  const seen = new Set()
  const defs = rootDefs()
  await Promise.all(defs.map((def) => walk(def.root, def.depth, files, seen)))
  const uniq = [...new Set(files.map((f) => path.resolve(f)))]
  const rows = []
  for (const file of uniq) {
    const def = defs.find((item) => underRoot(file, item.root)) || defs[defs.length - 1]
    if (!def) continue
    const row = await readSkill(file, def)
    if (row) rows.push(row)
  }
  const bySlug = new Map()
  for (const row of rows) {
    if (!bySlug.has(row.slug)) bySlug.set(row.slug, [])
    bySlug.get(row.slug).push(row)
  }
  for (const row of rows) {
    const peers = bySlug.get(row.slug) || [row]
    row.duplicateCount = peers.length
    row.duplicates = peers
      .filter((p) => p.id !== row.id)
      .sort((a, b) => a.path.length - b.path.length)
      .slice(0, 8)
      .map((p) => ({ id: p.id, name: p.name, source: p.source, path: p.path }))
    row.isDuplicate = peers.length > 1
  }
  rows.sort((a, b) => a.source.localeCompare(b.source, 'zh-CN') || a.name.localeCompare(b.name, 'zh-CN'))
  const sourceCounts = {}
  const categoryCounts = {}
  const scopeCounts = {}
  const originCounts = {}
  for (const row of rows) {
    sourceCounts[row.source] = (sourceCounts[row.source] || 0) + 1
    categoryCounts[row.category] = (categoryCounts[row.category] || 0) + 1
    scopeCounts[row.scope] = (scopeCounts[row.scope] || 0) + 1
    originCounts[row.origin] = (originCounts[row.origin] || 0) + 1
  }
  const duplicateGroups = [...bySlug.values()].filter((list) => list.length > 1).length
  const result = {
    ok: true,
    scannedAt: new Date().toISOString(),
    roots: defs.map(({ key, label, root }) => ({ key, label, root })),
    skills: rows.map((row) => ({ ...row, duplicatePaths: row.duplicates })),
    stats: {
      total: rows.length,
      uniqueNames: bySlug.size,
      duplicateGroups,
      sourceCounts,
      categoryCounts,
      scopeCounts,
      originCounts,
    },
  }
  cache.at = now
  cache.result = result
  cache.byId = new Map(rows.map((row) => [row.id, row]))
  return result
}

export async function getSkillDetail(id) {
  if (!cache.byId.size) await scanSkills({ force: true })
  const row = cache.byId.get(String(id || ''))
  if (!row) return null
  try {
    const text = await fs.readFile(row.path, 'utf8')
    return { ...row, content: text.slice(0, 120_000), truncated: text.length > 120_000 }
  } catch (error) {
    return { ...row, content: '', error: error?.message || '读取失败' }
  }
}

export function isSkillPath(target) {
  const value = realish(target)
  return rootDefs().some((def) => underRoot(value, def.root))
}

export function skillRoots() {
  return rootDefs()
}
