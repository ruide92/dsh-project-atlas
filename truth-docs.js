/**
 * Read the small set of human-authored project truth documents.
 *
 * The workbench must not treat a stale project note or a cached summary as
 * current progress. This module only discovers explicitly named documents
 * below the project's already-linked folders and reports their real mtimes.
 * It never writes to a project.
 */
import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_NAMES = new Set(['项目状态.md', '制作状态.md', '制作问题清单.md'])
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'cache', 'tmp', 'temp'])
const MAX_DEPTH = 5
const MAX_ENTRIES = 4000
const MAX_DOCS = 12

function normalizePath(value) {
  return String(value || '').replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase()
}

async function addDocument(file, docs, seen) {
  const resolved = path.resolve(file)
  const key = normalizePath(resolved)
  if (!key || seen.has(key)) return
  try {
    const stat = await fs.promises.lstat(resolved)
    if (!stat.isFile() || stat.isSymbolicLink()) return
    seen.add(key)
    docs.push({
      name: path.basename(resolved),
      path: resolved,
      size: stat.size,
      mtime: stat.mtime.toISOString(),
    })
  } catch {
    // A file can disappear between readdir and lstat; omit it rather than
    // presenting a stale entry as current truth. Symlinks are not followed.
  }
}

async function walk(root, names, docs, seen, budget) {
  const stack = [{ dir: root, depth: 0 }]
  while (stack.length && budget.entries < MAX_ENTRIES) {
    const { dir, depth } = stack.pop()
    budget.entries += 1
    let entries
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (budget.entries >= MAX_ENTRIES) break
      const full = path.join(dir, entry.name)
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) {
        if (depth >= MAX_DEPTH || SKIP_DIRS.has(entry.name.toLowerCase()) || entry.name.startsWith('.')) continue
        stack.push({ dir: full, depth: depth + 1 })
        continue
      }
      if (entry.isFile() && names.has(entry.name)) await addDocument(full, docs, seen)
    }
  }
}

/**
 * @param {string[]} roots Linked project folders.
 * @param {string[]} extraPaths Explicitly configured documents (optional).
 * @param {{names?: string[]}} [options]
 * @returns {Promise<{status: 'read'|'none', docs: Array<{name:string,path:string,size:number,mtime:string}>}>}
 */
export async function readTruthDocs(roots = [], extraPaths = [], options = {}) {
  const names = new Set(Array.isArray(options.names) && options.names.length ? options.names : DEFAULT_NAMES)
  const docs = []
  const seen = new Set()

  for (const raw of extraPaths) {
    const file = String(raw || '').trim()
    if (file) await addDocument(file, docs, seen)
  }

  for (const raw of roots) {
    const root = path.resolve(String(raw || ''))
    if (!raw) continue
    let stat
    try {
      stat = await fs.promises.stat(root)
    } catch {
      continue
    }
    if (stat.isFile()) {
      if (names.has(path.basename(root))) await addDocument(root, docs, seen)
      continue
    }
    if (stat.isDirectory()) await walk(root, names, docs, seen, { entries: 0 })
  }

  docs.sort((a, b) => (Date.parse(b.mtime) || 0) - (Date.parse(a.mtime) || 0))
  return { status: docs.length ? 'read' : 'none', docs: docs.slice(0, MAX_DOCS) }
}
