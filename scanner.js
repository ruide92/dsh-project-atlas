/**
 * Local project & AI-software inventory scanner.
 *
 * Pure Node.js (>=24). Used by the DSH Workbench host plugin and runnable
 * standalone for a first catalog:
 *   node scanner.js --out catalog.json
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import os from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'
import { normalizeIdentity } from './project-lifecycle.js'
import { DEFAULT_CONFIG as CONFIG_DEFAULTS, loadConfig } from './config.js'

const execFileAsync = promisify(execFile)

export const SCHEMA_VERSION = 1

export const DEFAULT_CONFIG = CONFIG_DEFAULTS
const SKIP_NAMES = new Set([
  'node_modules', '.git', '.svn', '.hg', '__pycache__', '.venv', 'venv', 'env',
  'site-packages', '.next', '.nuxt', 'dist', 'build', 'target', 'out', 'obj',
  '.gradle', '.cargo', '.rustup', '.pnpm-store', '.cache', '.npm', '.yarn',
  'AppData', 'ProgramData', 'Windows', '$RECYCLE.BIN', 'System Volume Information',
  'Games', 'SteamLibrary', 'steamapps', '.android', '.Cocos', '.cocos',
  '.modelscope', 'models', 'model', 'checkpoints', 'loras', '.bun', '.deno',
  'Caches', 'tmp', 'temp', '.tmp', '.worktrees', '.pnpm', 'pkgs', 'sdk',
  'npm-cache', '_npx', 'go', 'anaconda3', 'miniconda3', 'Library', 'OneDrive',
  '.opencode', '.idea', '.vs', '.vscode-test',
])

const SKIP_PATH_PARTS = [
  '/appdata/', '/anaconda3/', '/go/pkg/', '/npm-cache/',
  '/.vscode/extensions/', '/.vscode/plugins/', '/.trae-cn/extensions/',
  '/.windsurf/extensions/', '/.continue/', '/.cursor/extensions/',
  '/resources/app/', '/microsoft vs code/', '/.codex/worktrees/',
  '/.qoder/', '/.superpowers/', '/_clone_tmp_/', '/dsh-runtimes/',
  '/profiles/desktop/node_modules/', '/comfy-desktop/comfyui-program/custom_nodes/',
  '/comfy-desktop/comfyui-installs/', '/comfyui/custom_nodes/',
  '/_git_removed_/', '/_repo_untracked_backup_/',
  '/dsh/cache/', '/dsh/data/', '/dsh/logs/', '/dsh/maintenance/',
  '/dsh/profiles/', '/dsh/sessions/', '/dsh/storages/', '/dsh/tmp/', '/dsh/venvs/', '/dsh/attachments/',
  '/opencode/cache/', '/opencode/config/', '/opencode/data/',
  '/sdk/build-tools/',
]

const PRIMARY_MANIFESTS = new Set([
  'package.json', 'pyproject.toml', 'go.mod', 'Cargo.toml', 'pom.xml',
  'build.gradle', 'build.gradle.kts', 'pubspec.yaml', 'composer.json',
  'Gemfile', 'mix.exs', 'CMakeLists.txt', 'requirements.txt',
])
const SOLUTION_EXT = ['.sln', '.csproj', '.vcxproj']
const CODE_EXT = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.go', '.rs', '.cs',
  '.java', '.kt', '.c', '.cc', '.cpp', '.h', '.hpp', '.lua', '.swift',
  '.dart', '.php', '.rb', '.sh', '.ps1', '.vue', '.svelte',
])

function norm(p) {
  let s = path.resolve(p).replace(/[\\/]+$/, '')
  // Keep a bare drive root as "C:\"; stripping it would turn it into the
  // drive-relative "F:", which resolves against that drive's current dir.
  if (/^[A-Za-z]:$/.test(s)) s += '\\'
  return s
}

function hashId(p) {
  return crypto.createHash('sha1').update(norm(p).toLowerCase()).digest('hex').slice(0, 12)
}

function shouldSkipPath(full, config = DEFAULT_CONFIG) {
  const s = String(full || '').split(String.fromCharCode(92)).join('/').toLowerCase()
  if (SKIP_PATH_PARTS.some((part) => s.includes(part))) return true
  return (config.excludeGlobs || []).some((pattern) => globMatch(s, pattern))
}

function globMatch(value, pattern) {
  const source = String(pattern || '').split(String.fromCharCode(92)).join('/').trim()
  if (!source) return false
  const specials = new Set(['.', '+', '^', '$', '{', '}', '(', ')', '|', '[', ']'])
  let re = ''
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (ch === '*' && source[i + 1] === '*') { re += '.*'; i += 1; continue }
    if (ch === '*') { re += '[^/]*'; continue }
    if (ch === '?') { re += '[^/]'; continue }
    if (specials.has(ch)) re += String.fromCharCode(92) + ch
    else re += ch
  }
  try { return new RegExp('^' + re + '$', 'i').test(value) } catch { return false }
}

function isReparse(entry) {
  // Dirent exposes no attributes; stat is only needed for symlinks/junctions we
  // are about to descend into. Windows junctions are reported as symlinks.
  return entry.isSymbolicLink()
}

async function safeStat(p) {
  try { return await fs.stat(p) } catch { return null }
}

async function readText(p, max = 8192) {
  try {
    // Project metadata is untrusted input. Never follow a symlink out of the
    // project when reading a README, manifest or Git file.
    const st = await fs.lstat(p)
    if (!st.isFile() || st.isSymbolicLink()) return ''
    const fh = await fs.open(p, 'r')
    try {
      const buf = Buffer.alloc(max)
      const { bytesRead } = await fh.read(buf, 0, max, 0)
      return buf.subarray(0, bytesRead).toString('utf8')
    } finally { await fh.close() }
  } catch { return '' }
}

async function readJson(p) {
  try {
    const st = await fs.lstat(p)
    if (!st.isFile() || st.isSymbolicLink()) return null
    return JSON.parse(await fs.readFile(p, 'utf8'))
  } catch { return null }
}

function detectMarkers(entries) {
  const markers = []
  let hasGit = false
  let hasDsh = false
  let codeFiles = 0
  for (const e of entries) {
    const n = e.name
    if (n === '.git') hasGit = true
    if (n === '.dsh') hasDsh = true
    if (PRIMARY_MANIFESTS.has(n)) markers.push(n)
    if (SOLUTION_EXT.some((x) => n.toLowerCase().endsWith(x))) markers.push(n)
    if (e.isFile() && CODE_EXT.has(path.extname(n).toLowerCase())) codeFiles += 1
  }
  return { markers: [...new Set(markers)], hasGit, hasDsh, codeFiles }
}

/** Recursively collect candidate project directories. */
async function collectCandidates(root, maxDepth, warnings, config = DEFAULT_CONFIG) {
  const out = []
  const rootAbs = norm(root)
  async function visit(dir, depth) {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch (error) {
      if (depth <= 1) warnings.push(`无法读取 ${dir}: ${error.code || error.message}`)
      return
    }
    const dirs = []
    for (const e of entries) {
      if (!e.isDirectory()) continue
      if (SKIP_NAMES.has(e.name)) continue
      if (isReparse(e)) continue
      const full = path.join(dir, e.name)
      if (shouldSkipPath(full, config)) continue
      dirs.push({ name: e.name, full })
    }

    const info = detectMarkers(entries)
    const primary = info.markers.some((m) => PRIMARY_MANIFESTS.has(m) || SOLUTION_EXT.some((x) => m.toLowerCase().endsWith(x)))
    const assetContainer = (config.assetContainerMarkers || []).some((name) => entries.some((e) => e.isFile() && e.name === name))
    if (assetContainer) {
      out.push({
        path: dir,
        depth,
        markers: ['asset-container'],
        hasGit: false,
        hasDsh: false,
        codeFiles: info.codeFiles,
        assetContainer: true,
      })
      // Every dated run is a project; these folders usually contain only
      // workflows, images, logs and generated output, not a manifest.
      for (const d of dirs) {
        out.push({
          path: d.full,
          depth: depth + 1,
          markers: [],
          hasGit: false,
          hasDsh: false,
          codeFiles: 0,
          assetProject: true,
        })
      }
    }
    const isCandidate = info.hasGit || info.hasDsh || primary
    if (isCandidate && !assetContainer) {
      out.push({
        path: dir,
        depth,
        markers: info.markers,
        hasGit: info.hasGit,
        hasDsh: info.hasDsh,
        codeFiles: info.codeFiles,
      })
    }
    if (depth >= maxDepth) return
    for (const d of dirs) {
      await visit(d.full, depth + 1)
    }
  }
  await visit(rootAbs, 0)
  return out
}

function firstParagraph(text) {
  const cleaned = text
    .replace(/^---[\s\S]*?---\s*/m, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^#+\s*$/.test(l) && !/^[-=]{3,}$/.test(l))
  const lines = []
  for (const l of cleaned) {
    if (/^#{1,6}\s/.test(l)) {
      if (lines.length) break
      continue
    }
    lines.push(l.replace(/^[-*]\s+/, ''))
    if (lines.join(' ').length > 280) break
  }
  return lines.join(' ').replace(/\s+/g, ' ').slice(0, 320)
}

async function describeProject(dir, markers) {
  const notes = []
  const pkg = markers.includes('package.json') ? await readJson(path.join(dir, 'package.json')) : null
  if (pkg?.description) notes.push(String(pkg.description))
  const py = markers.includes('pyproject.toml') ? await readText(path.join(dir, 'pyproject.toml'), 12000) : ''
  if (py) {
    const m = py.match(/^\s*description\s*=\s*["']([^"']+)["']/m)
    if (m) notes.push(m[1])
  }
  for (const name of ['README.md', 'README.zh.md', 'README.zh-CN.md', 'readme.md', 'README.txt']) {
    const text = await readText(path.join(dir, name), 16000)
    if (text) {
      const p = firstParagraph(text)
      if (p) { notes.push(p); break }
    }
  }
  const reqPath = path.join(dir, '.dsh', 'CURRENT_REQUIREMENTS.md')
  const req = await readText(reqPath, 12000)
  if (req) {
    const title = (req.match(/^#\s+(.+)$/m) || [])[1]
    const body = firstParagraph(req.replace(/^#.*$/m, ''))
    if (title) notes.push(`[当前要求] ${title}`)
    if (body) notes.push(body.slice(0, 220))
  }
  const unique = []
  for (const n of notes) {
    const v = String(n).replace(/\s+/g, ' ').trim()
    if (v && !unique.some((x) => x.toLowerCase() === v.toLowerCase())) unique.push(v)
  }
  return unique.join(' · ').slice(0, 600)
}

async function projectIdentity(dir) {
  for (const name of ['workbench.project.json', '.dsh/workbench.project.json', '.workbench/project.json']) {
    const file = path.join(dir, name)
    const text = await readText(file, 32768)
    if (!text) continue
    try {
      const parsed = JSON.parse(text)
      if (parsed && typeof parsed === 'object') {
        return { ...normalizeIdentity(parsed), manifest: name }
      }
    } catch {
      // A malformed adapter manifest must not hide the project.
    }
  }
  return null
}

async function projectHandoffInfo(dir) {
  const base = path.join(dir, '.dsh', 'handoff')
  const text = await readText(path.join(base, 'state.json'), 32768)
  const docPath = path.join(base, 'PROJECT_STATE.md')
  const docStat = await safeStat(docPath)
  const docText = docStat ? await readText(docPath, 65536) : ''
  let state = null
  if (text) {
    try { state = JSON.parse(text) } catch { state = null }
  }
  if (!state && !docStat) return null
  // Codex/DSH may only edit PROJECT_STATE.md. The doc mtime is still a
  // truthful "last handoff write" signal; state.json is the richer snapshot.
  const docUpdatedAt = docStat?.mtime ? new Date(docStat.mtime).toISOString() : null
  const stateUpdatedAt = state?.updatedAt || null
  const updatedAt = [stateUpdatedAt, docUpdatedAt].filter(Boolean).sort().pop() || null
  const noteMatch = docText.match(/^<!-- dsh-workbench:note:start -->[ \t]*\r?\n([\s\S]*?)^<!-- dsh-workbench:note:end -->[ \t]*$/m)
  const docNote = noteMatch ? noteMatch[1].replace(/^\s*##\s*工作台备注\s*/m, '').trim() : ''
  return {
    updatedAt,
    targetApp: state?.targetApp || '',
    note: docNote || (typeof state?.note === 'string' ? state.note.trim() : ''),
    doc: '.dsh/handoff/PROJECT_STATE.md',
    goal: String(state?.goal || '').slice(0, 4000),
    progress: String(state?.progress || '').slice(0, 8000),
    lifecycle: state?.lifecycle || state?.identity?.lifecycle || '',
    intent: state?.identity?.intent || state?.intent || '',
    expiresAt: state?.expiresAt || state?.identity?.expiresAt || '',
    sessionPolicy: state?.sessionPolicy || state?.identity?.sessionPolicy || null,
    git: state?.git ? { branch: state.git.branch || '', dirty: Number(state.git.dirty) || 0 } : null,
  }
}

function parseGitConfig(text) {
  const remote = (text.match(/\[remote "origin"\][\s\S]*?url\s*=\s*(.+)/) || [])[1]
  return remote ? remote.trim() : ''
}

async function gitInfo(dir) {
  const dotGit = path.join(dir, '.git')
  let st
  try {
    st = await fs.lstat(dotGit)
    if (st.isSymbolicLink()) return null
  } catch { return null }
  let gitDir = dotGit
  if (!st.isDirectory()) {
    const text = await readText(dotGit, 512)
    const m = text.match(/^gitdir:\s*(.+)$/m)
    if (!m) return { isRepo: true }
    gitDir = path.resolve(dir, m[1].trim())
  }
  const head = (await readText(path.join(gitDir, 'HEAD'), 512)).trim()
  const branch = head.startsWith('ref: refs/heads/') ? head.slice('ref: refs/heads/'.length) : head.slice(0, 12)
  const config = await readText(path.join(gitDir, 'config'), 8192)
  const remote = parseGitConfig(config)
  const logPath = path.join(gitDir, 'logs', 'HEAD')
  const log = await readText(logPath, 512 * 1024)
  let firstCommit = null
  let lastCommit = null
  let commits = 0
  if (log) {
    const lines = log.split(/\r?\n/).filter(Boolean)
    commits = lines.length
    const tsOf = (line) => {
      const m = line.match(/>\s(\d{9,13})\s/)
      if (!m) return null
      let n = Number(m[1])
      if (n > 1e12) n = Math.floor(n / 1000)
      return new Date(n * 1000).toISOString()
    }
    if (lines.length) firstCommit = tsOf(lines[0])
    lastCommit = tsOf(lines[lines.length - 1])
  }
  return { isRepo: true, branch, remote, firstCommit, lastCommit, commits }
}

async function dirStats(dir, config) {
  const started = Date.now()
  let bytes = 0
  let files = 0
  let capped = false
  const stack = [dir]
  while (stack.length) {
    if (files >= config.maxFilesPerProject || Date.now() - started > config.maxSizeMsPerProject) {
      capped = true
      break
    }
    const cur = stack.pop()
    let entries
    try { entries = await fs.readdir(cur, { withFileTypes: true }) } catch { continue }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (SKIP_NAMES.has(e.name)) continue
        if (shouldSkipPath(path.join(cur, e.name), config)) continue
        if (isReparse(e)) continue
        stack.push(path.join(cur, e.name))
      } else if (e.isFile()) {
        try {
          const s = await fs.stat(path.join(cur, e.name))
          bytes += s.size
          files += 1
        } catch { /* ignore */ }
      }
    }
  }
  return { bytes, files, capped }
}

async function latestMtime(dir, names) {
  let latest = 0
  for (const name of names) {
    const s = await safeStat(path.join(dir, name))
    if (s) latest = Math.max(latest, s.mtimeMs)
  }
  return latest ? new Date(latest).toISOString() : null
}

function classifyKind(name, markers, summary) {
  const s = (name + ' ' + summary).toLowerCase()
  if (/plugin|扩展|插件|skill/.test(s)) return 'plugin'
  if (/app|desktop|client|studio|workbench|工具|tool/.test(s)) return 'app'
  if (/lib|sdk|core|framework|engine/.test(s)) return 'library'
  if (/doc|note|文档|手册|研究|report/.test(s)) return 'doc'
  if (/test|demo|sample|example|probe|试验|测试/.test(s)) return 'experiment'
  if (markers.includes('go.mod') || markers.includes('Cargo.toml') || markers.includes('*.sln')) return 'app'
  return 'project'
}

function languageTags(markers) {
  const map = {
    'package.json': 'Node', 'pyproject.toml': 'Python', 'requirements.txt': 'Python',
    'go.mod': 'Go', 'Cargo.toml': 'Rust', 'pom.xml': 'Java', 'build.gradle': 'Java',
    'build.gradle.kts': 'Kotlin', 'pubspec.yaml': 'Dart', 'composer.json': 'PHP',
    'Gemfile': 'Ruby', 'CMakeLists.txt': 'C/C++',
  }
  const out = new Set()
  for (const m of markers) if (map[m]) out.add(map[m])
  for (const m of markers) if (m.endsWith('.sln') || m.endsWith('.csproj')) out.add('C#')
  return [...out]
}

async function scanProjects(config, warnings) {
  const candidates = []
  for (const root of config.roots) {
    const abs = norm(root.path)
    const st = await safeStat(abs)
    if (!st?.isDirectory()) continue
    const found = await collectCandidates(abs, root.depth, warnings, config)
    candidates.push(...found)
  }
  // Deduplicate and drop candidates inside dependency-ish subdirectories of
  // another project unless they are their own repository.
  const byPath = new Map()
  for (const c of candidates) byPath.set(norm(c.path), c)
  const list = [...byPath.values()]
  list.sort((a, b) => a.path.length - b.path.length)
  const kept = []
  for (const c of list) {
    const parent = kept.find((p) => {
      const base = norm(p.path)
      return norm(c.path).startsWith(base.endsWith(path.sep) ? base : base + path.sep)
    })
    const generic = /^(repo|source|src|app|packages|apps|examples|demo|project)$/i.test(path.basename(c.path))
    if (parent && !c.hasGit && generic) continue
    kept.push(c)
  }

  const projects = []
  for (const c of kept) {
    if (shouldSkipPath(c.path, config)) continue
    if (c.path.split(path.sep).some((seg) => seg.toLowerCase() === '.opencode')) continue
    const name = path.basename(c.path)
    const st = await safeStat(c.path)
    if (!st) continue
    const git = await gitInfo(c.path)
    const stats = await dirStats(c.path, config)
    const summary = await describeProject(c.path, c.markers)
    const handoff = await projectHandoffInfo(c.path)
    const identity = await projectIdentity(c.path)
    const rootMtime = st.mtimeMs ? new Date(st.mtimeMs).toISOString() : null
    const latest = await latestMtime(c.path, ['README.md', 'package.json', 'pyproject.toml', 'go.mod', 'Cargo.toml', '.dsh'])
    const birth = st.birthtimeMs && st.birthtimeMs > Date.UTC(2000, 0, 1) ? new Date(st.birthtimeMs).toISOString() : null
    const lastActivity = git?.lastCommit || latest || rootMtime || birth
    // Some copied trees report a 1980 birth time (FAT / archive extraction).
    // Treat that as unknown and fall back to git or the filesystem timestamp.
    const created = birth || git?.firstCommit || rootMtime || null
    projects.push({
      id: hashId(c.path),
      name,
      path: c.path,
      drive: path.parse(c.path).root.replace(/[\/]+$/, '') || c.path.slice(0, 2),
      group: relativeGroup(c.path),
      markers: c.markers,
      hasGit: c.hasGit,
      hasDsh: c.hasDsh,
      codeFiles: c.codeFiles,
      assetContainer: c.assetContainer === true,
      assetProject: c.assetProject === true,
      git,
      handoff,
      identity,
      sizeBytes: stats.bytes,
      sizeCapped: stats.capped,
      fileCount: stats.files,
      created,
      lastActivity,
      summary,
      languages: languageTags(c.markers),
      kind: classifyKind(name, c.markers, summary),
    })
  }
  // Attach hierarchy: a project nested inside another candidate is a
  // sub-project. The UI collapses these by default, but they remain in the
  // catalog so a monorepo or multi-app workspace can be expanded.
  projects.sort((a, b) => a.path.length - b.path.length)
  const genericNames = /^(repo|source|src|app|packages|apps|project|workspace)$/i
  for (const p of projects) {
    const parent = [...projects].reverse().find((q) => {
      if (q === p) return false
      const base = norm(q.path)
      return norm(p.path).startsWith(base.endsWith(path.sep) ? base : base + path.sep)
    })
    p.parentId = parent?.id || null
    p.depth = norm(p.path).split(path.sep).filter(Boolean).length
    p.topLevel = !parent
    p.displayName = genericNames.test(p.name) && parent ? `${parent.name} / ${p.name}` : p.name
  }
  for (const p of projects) {
    p.childrenCount = projects.filter((q) => q.parentId === p.id).length
    p.workspace = workspaceOf(p.path, config)
    const noise = noiseOf(p, config)
    p.noise = noise.noise
    p.noiseReason = noise.reason
  }
  return projects
}

function workspaceOf(p, config = DEFAULT_CONFIG) {
  const s = String(p || '').split(String.fromCharCode(92)).join('/').toLowerCase()
  for (const group of config.workspaceGroups || []) {
    const prefix = String(group.prefix || '').split(String.fromCharCode(92)).join('/').toLowerCase().replace(/\/+$/, '')
    if (prefix && (s === prefix || s.startsWith(prefix + '/'))) return group.label
  }
  return ''
}

function noiseOf(p, config = DEFAULT_CONFIG) {
  const s = (typeof p === 'string' ? p : p.path).split(String.fromCharCode(92)).join('/')
  const parts = [
    '/appdata/', '/resources/app', '/microsoft vs code/', '/_clone_tmp_/',
    '/$recycle.bin/', '/cache/uv/', '/resources/node-repl/',
    ...(config.noisePatterns || []).map((x) => String(x).split(String.fromCharCode(92)).join('/')),
  ]
  if (parts.some((part) => s.toLowerCase().includes(part.toLowerCase()))) {
    return { noise: true, reason: '缓存 / 应用资源 / 临时副本' }
  }
  const deps = new Set(['node_modules', 'dist', 'build', 'target', '.next', '.venv', 'venv', '__pycache__'])
  if (s.split('/').some((part) => deps.has(part.toLowerCase()))) {
    return { noise: true, reason: '依赖或构建产物' }
  }
  return { noise: false, reason: '' }
}

function relativeGroup(p) {
  const parsed = path.parse(p)
  const rel = p.slice(parsed.root.length)
  const parts = rel.split(path.sep).filter(Boolean)
  if (parts.length === 0) return parsed.root
  if (parts.length === 1) return parts[0]
  return parts[0] + path.sep + parts[1]
}

/** Read OpenCode's project + session metadata (read-only). */
async function scanOpenCode(dbPath, warnings) {
  if (!dbPath) return []
  try {
    const { DatabaseSync } = await import('node:sqlite')
    const db = new DatabaseSync(dbPath, { readOnly: true })
    try {
      const rows = db.prepare(`
        SELECT p.id, p.worktree, p.name, p.time_created, p.time_updated, p.time_active, p.time_archived,
               (SELECT COUNT(*) FROM session_v2 s WHERE s.project_id = p.id) AS sessions,
               (SELECT MAX(s.time_updated) FROM session_v2 s WHERE s.project_id = p.id) AS last_session
        FROM project p
      `).all()
      const out = []
      for (const r of rows) {
        const worktree = r.worktree ? norm(String(r.worktree).replace(/\//g, '\\')) : ''
        out.push({
          id: r.id,
          worktree,
          name: r.name || '',
          created: tsToIso(r.time_created),
          active: tsToIso(r.time_active),
          archived: tsToIso(r.time_archived),
          sessions: Number(r.sessions || 0),
          lastSession: tsToIso(r.last_session),
        })
      }
      return out
    } finally { db.close() }
  } catch (error) {
    warnings.push(`OpenCode 数据读取失败: ${error.message}`)
    return []
  }
}

function tsToIso(v) {
  if (!v) return null
  let n = Number(v)
  if (!Number.isFinite(n)) return null
  if (n > 1e12) n = Math.floor(n / 1000)
  return new Date(n * 1000).toISOString()
}

/** DSH session folders encode the project path; count sessions and last use. */
async function scanDshSessions(dir, warnings) {
  const out = []
  let entries
  try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    if (!e.isDirectory()) continue
    const p = decodeDshFolder(e.name)
    if (!p) continue
    let count = 0
    let latest = 0
    try {
      const subs = await fs.readdir(path.join(dir, e.name), { withFileTypes: true })
      for (const s of subs) {
        if (!s.isDirectory()) continue
        count += 1
        const st = await safeStat(path.join(dir, e.name, s.name))
        if (st) latest = Math.max(latest, st.mtimeMs)
      }
    } catch { /* ignore */ }
    if (count) out.push({ path: p, sessions: count, lastActivity: latest ? new Date(latest).toISOString() : null })
  }
  return out
}

function decodeDshFolder(name) {
  const m = name.match(/^--([A-Za-z])-(.*)--$/)
  if (!m) return ''
  const body = m[2]
    .replace(/~([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/-/g, '\\')
  return `${m[1].toUpperCase()}:\\${body}`
}

/** Attach sources and activity from OpenCode/DSH to scanned projects. */
function mergeSources(projects, openCode, dsh) {
  const normPath = (p) => norm(p).toLowerCase()
  for (const p of projects) {
    p.sources = []
    p.openCode = null
    p.dsh = null
    const np = normPath(p.path)
    for (const oc of openCode) {
      if (!oc.worktree) continue
      const nw = normPath(oc.worktree)
      if (np === nw) {
        p.sources.push('opencode')
        if (!p.openCode || (oc.lastSession || '') > (p.openCode.lastSession || '')) p.openCode = oc
      }
    }
    for (const ds of dsh) {
      const nd = normPath(ds.path)
      if (np === nd) {
        p.sources.push('dsh')
        if (!p.dsh || (ds.lastActivity || '') > (p.dsh.lastActivity || '')) p.dsh = ds
      }
    }
    // `.dsh/CURRENT_REQUIREMENTS.md` is a reliable marker of a project that was
    // driven through this Harness, even when the session folder lives at a
    // parent path (for example a tool folder nested under a workspace).
    if (p.hasDsh) p.sources.push('dsh')
    if (!p.sources.length) p.sources.push('codes')
    p.sources = [...new Set(p.sources)]
    const candidates = [p.lastActivity, p.openCode?.lastSession, p.dsh?.lastActivity].filter(Boolean)
    p.lastActivity = candidates.sort().at(-1) || null
    p.activitySources = []
    if (p.git?.lastCommit) p.activitySources.push('git')
    if (p.openCode?.lastSession) p.activitySources.push('opencode')
    if (p.dsh?.lastActivity) p.activitySources.push('dsh')
  }
}

const STATUS_DAYS = { active: 30, paused: 120 }

export function inferStatus(p, now = Date.now()) {
  if (!p.lastActivity) return { status: 'unknown', reason: '没有可用的活动时间' }
  const days = Math.floor((now - Date.parse(p.lastActivity)) / 86400000)
  if (days <= STATUS_DAYS.active) return { status: 'active', reason: `最近 ${days} 天内有活动` }
  if (days <= STATUS_DAYS.paused) return { status: 'paused', reason: `${days} 天没有活动` }
  return { status: 'archived', reason: `${days} 天没有活动` }
}

export function scanDisks() {
  const out = []
  if (process.platform !== 'win32') return out
  // Node has no volume API; PowerShell gives used/free in one call.
  return out
}

async function scanInstalledSoftware() {
  const items = []
  if (process.platform === 'win32') {
    const script = `
$paths = @('HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*')
$items = foreach($p in $paths){ Get-ItemProperty $p -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName } | Select-Object DisplayName, DisplayVersion, InstallLocation, Publisher, DisplayIcon }
$items | Sort-Object DisplayName -Unique | ConvertTo-Json -Depth 3 -Compress
`
    try {
      const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { maxBuffer: 8 * 1024 * 1024, windowsHide: true })
      const parsed = JSON.parse(stdout || '[]')
      const arr = Array.isArray(parsed) ? parsed : [parsed]
      for (const x of arr) {
        const name = String(x.DisplayName || '').trim()
        if (!name) continue
        items.push({
          name,
          version: String(x.DisplayVersion || '').trim(),
          installPath: String(x.InstallLocation || '').trim(),
          publisher: String(x.Publisher || '').trim(),
          icon: String(x.DisplayIcon || '').trim(),
        })
      }
    } catch { /* registry scan is best-effort */ }
  }
  return items
}

const AI_RULES = [
  { re: /deepseek harness|deepseek|深度求索/i, category: 'agent', label: 'Agent 工作台' },
  { re: /opencode/i, category: 'coding', label: 'AI 编程' },
  { re: /codex/i, category: 'coding', label: 'AI 编程' },
  { re: /qoder/i, category: 'coding', label: 'AI 编程' },
  { re: /trae|traecode/i, category: 'coding', label: 'AI 编程' },
  { re: /cursor/i, category: 'coding', label: 'AI 编程' },
  { re: /windsurf/i, category: 'coding', label: 'AI 编程' },
  { re: /lingma|通义灵码/i, category: 'coding', label: 'AI 编程' },
  { re: /copilot/i, category: 'coding', label: 'AI 编程' },
  { re: /codeium/i, category: 'coding', label: 'AI 编程' },
  { re: /continue/i, category: 'coding', label: 'AI 编程' },
  { re: /cherry studio/i, category: 'chat', label: 'AI 对话' },
  { re: /chatbox/i, category: 'chat', label: 'AI 对话' },
  { re: /lm studio/i, category: 'local', label: '本地推理' },
  { re: /ollama/i, category: 'local', label: '本地推理' },
  { re: /comfy/i, category: 'image', label: '图像/视频生成' },
  { re: /aigcpanel|liblib|stable diffusion|fooocus|midjourney/i, category: 'image', label: '图像/视频生成' },
  { re: /minimax|hailuo|海螺/i, category: 'video', label: '视频生成' },
  { re: /剪映|capcut|chatcut/i, category: 'video', label: '视频创作' },
  { re: /豆包|doubao/i, category: 'chat', label: 'AI 对话' },
  { re: /千问|qianwen|qwen/i, category: 'chat', label: 'AI 对话' },
  { re: /kimi/i, category: 'chat', label: 'AI 对话' },
  { re: /hermes/i, category: 'agent', label: 'Agent 工具' },
  { re: /dify|ragflow|openwebui/i, category: 'platform', label: 'AI 应用平台' },
]

function matchAi(name) {
  for (const rule of AI_RULES) if (rule.re.test(name)) return rule
  return null
}

async function scanSoftware(config) {
  const installed = await scanInstalledSoftware()
  const seen = new Map()
  const add = (item) => {
    const key = item.name.toLowerCase().replace(/\s+/g, ' ').trim()
    if (!key) return
    if (!seen.has(key)) seen.set(key, item)
    else {
      const old = seen.get(key)
      if (!old.version && item.version) old.version = item.version
      if (!old.installPath && item.installPath) old.installPath = item.installPath
    }
  }
  for (const x of installed) {
    const m = matchAi(x.name)
    if (!m) continue
    add({
      id: crypto.createHash('sha1').update(x.name.toLowerCase()).digest('hex').slice(0, 10),
      name: x.name,
      version: x.version,
      installPath: x.installPath,
      publisher: x.publisher,
      category: m.category,
      categoryLabel: m.label,
      source: 'registry',
    })
  }

  // Known per-user installs and config roots that do not appear in Add/Remove.
  const user = os.homedir()
  const known = [
    ['千问办公', 'chat', 'AI 对话', path.join(user, '.qwenworkcn'), ''],
    ['Trae CN', 'coding', 'AI 编程', path.join(user, '.trae-cn'), ''],
    ['通义灵码', 'coding', 'AI 编程', path.join(user, '.lingma'), ''],
    ['Codex CLI', 'coding', 'AI 编程', path.join(user, '.codex'), ''],
    ['Claude Code', 'coding', 'AI 编程', path.join(user, '.claude'), ''],
    ['Gemini CLI', 'coding', 'AI 编程', path.join(user, '.gemini'), ''],
    ['DeepSeek', 'chat', 'AI 对话', path.join(user, '.deepseek'), ''],
    ['Cherry Studio', 'chat', 'AI 对话', path.join(user, '.cherrystudio'), ''],
    ['LM Studio', 'local', '本地推理', path.join(user, '.lmstudio'), ''],
    ['Ollama', 'local', '本地推理', path.join(user, '.ollama'), ''],
    ['OpenClaw', 'agent', 'Agent 工具', path.join(user, '.openclaw'), ''],
    ['OpenHuman', 'agent', 'Agent 工具', path.join(user, '.openhuman'), ''],
    ['CodeBuddy', 'coding', 'AI 编程', path.join(user, '.codebuddy'), ''],
    ['QMind', 'agent', 'Agent 工具', path.join(user, '.qmind'), ''],
    ['Marvis', 'agent', 'Agent 工具', path.join(user, '.marvis'), ''],
    ['ComfyUI', 'image', '图像/视频生成', path.join(user, 'ComfyUI'), process.env.COMFYUI_PATH || ''],
    ['OpenCode', 'coding', 'AI 编程', path.join(user, '.opencode'), ''],
    ['DeepSeek Harness', 'agent', 'Agent 工作台', process.env.DSH_HOME || path.join(user, '.dsh'), process.env.DSH_HOME || ''],
  ]
  for (const [name, category, categoryLabel, configPath, installPath] of known) {
    if (!configPath && !installPath) continue
    const exists = configPath ? await safeStat(configPath) : null
    const inst = installPath ? await safeStat(installPath) : null
    if (!exists && !inst) continue
    add({
      id: crypto.createHash('sha1').update(name.toLowerCase()).digest('hex').slice(0, 10),
      name, version: '', installPath: installPath || '', publisher: '',
      category, categoryLabel, source: 'local-scan',
      configPath: configPath || '',
      lastConfigWrite: exists ? new Date(exists.mtimeMs).toISOString() : null,
    })
  }

  const groups = [
    { re: /^deepseek harness/i, name: 'DeepSeek Harness', category: 'agent', categoryLabel: 'Agent 工作台' },
    { re: /^opencode/i, name: 'OpenCode', category: 'coding', categoryLabel: 'AI 编程' },
    { re: /^qoder(?!work)/i, name: 'Qoder', category: 'coding', categoryLabel: 'AI 编程' },
    { re: /^trae/i, name: 'Trae CN', category: 'coding', categoryLabel: 'AI 编程' },
    { re: /^comfy desktop/i, name: 'Comfy Desktop', category: 'image', categoryLabel: '图像/视频生成' },
    { re: /^lm studio/i, name: 'LM Studio', category: 'local', categoryLabel: '本地推理' },
    { re: /^(剪映|capcut)/i, name: '剪映 / CapCut', category: 'video', categoryLabel: '视频创作' },
  ]
  const merged = new Map()
  for (const item of seen.values()) {
    const group = groups.find((g) => g.re.test(item.name))
    const key = group ? `group:${group.name}` : `name:${item.name.toLowerCase()}`
    const old = merged.get(key)
    if (!old) {
      merged.set(key, group ? { ...item, name: group.name, category: group.category, categoryLabel: group.categoryLabel } : item)
      continue
    }
    // Prefer a real version and a real install path from the registry row.
    if ((!old.version && item.version) || (item.version && old.version && item.version.length > old.version.length)) old.version = item.version
    if (!old.installPath && item.installPath) old.installPath = item.installPath
    if (!old.publisher && item.publisher) old.publisher = item.publisher
    if (!old.configPath && item.configPath) old.configPath = item.configPath
    if (item.lastConfigWrite && (!old.lastConfigWrite || item.lastConfigWrite > old.lastConfigWrite)) old.lastConfigWrite = item.lastConfigWrite
  }
  return [...merged.values()]
    .map((s) => ({
      ...s,
      status: s.lastConfigWrite && (Date.now() - Date.parse(s.lastConfigWrite)) < 60 * 86400000 ? 'recent' : 'installed',
    }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
}

async function scanDiskInfo() {
  if (process.platform !== 'win32') return []
  const script = `Get-PSDrive -PSProvider FileSystem | Select-Object Name,Used,Free,Root | ConvertTo-Json -Compress`
  try {
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], { maxBuffer: 1024 * 1024, windowsHide: true })
    const arr = JSON.parse(stdout || '[]')
    return (Array.isArray(arr) ? arr : [arr]).map((d) => ({
      name: d.Name, root: d.Root, used: Number(d.Used || 0), free: Number(d.Free || 0),
      total: Number(d.Used || 0) + Number(d.Free || 0),
    }))
  } catch { return [] }
}

export async function scanAll(config = DEFAULT_CONFIG) {
  const warnings = []
  const started = Date.now()
  const [projectsRaw, openCode, dsh, software, disks] = await Promise.all([
    scanProjects(config, warnings),
    scanOpenCode(config.openCodeDb, warnings),
    scanDshSessions(config.dshSessionsDir, warnings),
    scanSoftware(config),
    scanDiskInfo(),
  ])
  mergeSources(projectsRaw, openCode, dsh)
  const now = Date.now()
  for (const p of projectsRaw) {
    const st = inferStatus(p, now)
    p.status = st.status
    p.statusReason = st.reason
    p.statusSource = 'auto'
  }
  const projects = projectsRaw
    .filter((p) => p.sizeBytes > 0 || p.hasGit || p.hasDsh)
    .sort((a, b) => (b.lastActivity || '').localeCompare(a.lastActivity || ''))

  const openCodeReal = openCode.filter((x) => x.worktree && !/runtime\\|\\tmp\\|Temp\\opencode/i.test(x.worktree))
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    scanMs: Date.now() - started,
    roots: config.roots.map((r) => r.path),
    stats: {
      projectCount: projects.length,
      topLevelCount: projects.filter((p) => p.topLevel).length,
      nestedCount: projects.filter((p) => !p.topLevel).length,
      softwareCount: software.length,
      active: projects.filter((p) => p.topLevel && p.status === 'active').length,
      paused: projects.filter((p) => p.topLevel && p.status === 'paused').length,
      archived: projects.filter((p) => p.topLevel && p.status === 'archived').length,
      unknown: projects.filter((p) => p.topLevel && p.status === 'unknown').length,
      totalBytes: projects.filter((p) => p.topLevel).reduce((a, p) => a + (p.sizeBytes || 0), 0),
      totalBytesAll: projects.reduce((a, p) => a + (p.sizeBytes || 0), 0),
    },
    projects,
    software,
    disks,
    openCode: openCodeReal,
    warnings,
  }
}

// CLI
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const outIdx = process.argv.indexOf('--out')
  const out = outIdx > -1 ? process.argv[outIdx + 1] : 'catalog.json'
  const cfgIdx = process.argv.indexOf('--config')
  if (cfgIdx > -1 && process.argv[cfgIdx + 1]) process.env.DSH_WORKBENCH_CONFIG = process.argv[cfgIdx + 1]
  const cfg = loadConfig()
  if (!cfg.roots.length) {
    console.error('No scan roots configured. Create workbench.config.json or pass --config <file>.')
    process.exitCode = 2
  }
  const data = await scanAll(cfg)
  await fs.writeFile(out, JSON.stringify(data, null, 2), 'utf8')
  console.log(JSON.stringify({ out, projects: data.projects.length, software: data.software.length, ms: data.scanMs, warnings: data.warnings.length }, null, 2))
}


