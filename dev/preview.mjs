// Local preview with synthetic data only. Optional writes affect memory, never disk.
import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const selectedClient = process.env.ATLAS_PREVIEW_CLIENT_FILE
if (selectedClient && (!path.isAbsolute(selectedClient) || path.basename(selectedClient).toLowerCase() !== 'client.js')) {
  throw new Error('ATLAS_PREVIEW_CLIENT_FILE must be an absolute path ending in client.js')
}
const clientPath = selectedClient ? path.resolve(selectedClient) : path.join(root, 'client.js')
const assetRoot = selectedClient ? path.join(path.dirname(clientPath), 'assets') : path.join(root, 'assets')
const saveMode = process.env.ATLAS_PREVIEW_SAVE_MODE || 'readonly'
if (!['readonly', 'memory', 'failure'].includes(saveMode)) throw new Error('ATLAS_PREVIEW_SAVE_MODE must be readonly, memory or failure')
const panelWidthInput = process.env.ATLAS_PREVIEW_PANEL_WIDTH || ''
if (panelWidthInput && (!/^\d+$/.test(panelWidthInput) || Number(panelWidthInput) < 240 || Number(panelWidthInput) > 2000)) {
  throw new Error('ATLAS_PREVIEW_PANEL_WIDTH must be an integer between 240 and 2000')
}
const panelStyle = panelWidthInput ? `#root{width:${Number(panelWidthInput)}px;max-width:100%;}` : ''
const delayInput = process.env.ATLAS_PREVIEW_SAVE_DELAY_MS || '0'
const saveDelayMs = Number(delayInput)
if (!/^\d+$/.test(delayInput) || !Number.isSafeInteger(saveDelayMs) || saveDelayMs > 5000) throw new Error('ATLAS_PREVIEW_SAVE_DELAY_MS must be an integer between 0 and 5000')
const sourceLabel = selectedClient ? '外部指定客户端' : '仓库客户端'
const dependencyRoot = process.env.ATLAS_PREVIEW_DEPS || root
const require = createRequire(path.join(path.resolve(dependencyRoot), 'package.json'))
function dependency(pkg, file) {
  return path.join(path.dirname(require.resolve(`${pkg}/package.json`)), file)
}
const modules = {
  react: dependency('react', 'cjs/react.production.js'),
  scheduler: dependency('scheduler', 'cjs/scheduler.production.js'),
  'react-dom': dependency('react-dom', 'cjs/react-dom.production.js'),
  'react-dom/client': dependency('react-dom', 'cjs/react-dom-client.production.js'),
}
const mock = Array.from({ length: 12 }, (_, i) => ({
  id: `example-${i + 1}`, name: ['影像实验', '创意档案', '素材工具', '研究笔记', '设计原型', '影像工作流'][i % 6] + ` ${i + 1}`,
  displayName: ['影像实验', '创意档案', '素材工具', '研究笔记', '设计原型', '影像工作流'][i % 6] + ` ${i + 1}`,
  lifecycle: ['persistent', 'incubating', 'temporary'][i % 3], status: 'active', tags: [],
  lastActivity: '2026-10-29T10:00:00Z', created: '2026-01-01T00:00:00Z', sources: [], topLevel: true,
}))
const state = { ok: true, ready: true, projects: mock, software: [], stats: {}, generatedAt: '2026-10-29T10:00:00Z', warnings: [], scanning: false }
const files = new Map([
  ['/preview.js', [path.join(root, 'dev', 'preview-client.js'), 'text/javascript; charset=utf-8']],
  ['/client.js', [clientPath, 'text/javascript; charset=utf-8']],
  ['/dsh-workbench/assets/earth-blue-marble.jpg', [path.join(assetRoot, 'earth-blue-marble.jpg'), 'image/jpeg']],
  ['/dsh-workbench/assets/earth-night.jpg', [path.join(assetRoot, 'earth-night.jpg'), 'image/jpeg']],
  ['/dsh-workbench/assets/earth-topology.png', [path.join(assetRoot, 'earth-topology.png'), 'image/png']],
])
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Project Atlas · 合成数据预览</title><style>:root{--dsw-alias-bg-base:#10131a;--dsw-alias-bg-layer-1:#191e28;--dsw-alias-bg-layer-2:#202734;--dsw-alias-bg-layer-3:#2a3341;--dsw-alias-bg-overlay:#000b;--dsw-alias-border-l1:#ffffff18;--dsw-alias-border-l2:#ffffff28;--dsw-alias-border-l3:#ffffff45;--dsw-alias-brand-primary:#90aefc;--dsw-alias-button-primary-fill:#7599ef;--dsw-alias-interactive-bg-hover:#ffffff12;--dsw-alias-label-primary:#f1f3f8;--dsw-alias-label-primary-foreground:#10131a;--dsw-alias-label-secondary:#b2bccb;--dsw-alias-label-tertiary:#8490a3;--dsw-alias-label-dimmed:#697588;--dsw-alias-link:#9cb6ff;--dsw-alias-state-error-primary:#ee8990;--dsw-alias-state-success-primary:#84caa9;--dsw-alias-state-warn-primary:#e6c276}html,body,#root{margin:0;height:100%;background:#10131a;color:#eef0f6;font-family:system-ui,sans-serif}#notice{position:fixed;right:8px;bottom:8px;z-index:9999;background:#253b56;color:white;padding:4px 8px;border-radius:5px;font-size:11px;pointer-events:none}</style></head><body><div id="root"></div><div id="notice">开发预览 · 合成数据 · 场景设置保存在浏览器</div><script src="/modules.js"></script><script src="/preview.js"></script><script src="/client.js"></script></body></html>`
const bundle = ['window.__previewModules = {};', ...await Promise.all(Object.entries(modules).map(async ([id, file]) => {
  const source = await fs.readFile(file, 'utf8')
  return `{const module={exports:{}};const exports=module.exports;const require=id=>window.__previewModules[id];\n${source}\nwindow.__previewModules[${JSON.stringify(id)}]=module.exports;}`
}))].join('\n')
const saveLabel = saveMode === 'memory' ? '模拟保存：仅内存，停止即清空' : saveMode === 'failure' ? '模拟保存失败' : '只读'
const previewHtml = html.replace('开发预览 · 合成数据 · 场景设置保存在浏览器', `开发预览 · ${sourceLabel} · 合成数据 · ${saveLabel} · 场景设置保存在浏览器`).replace('</style>', `${panelStyle}</style>`)
async function readJson(req) {
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > 32768) return null
    chunks.push(chunk)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { return null }
}
function syntheticPatch(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const allowed = new Set(['note', 'tags', 'status', 'pinned', 'hidden', 'lifecycle', 'intent'])
  if (Object.keys(value).some((key) => !allowed.has(key))) return null
  const patch = {}
  for (const [key, val] of Object.entries(value)) {
    if (['note', 'status', 'lifecycle', 'intent'].includes(key) && typeof val === 'string' && val.length <= 16000) patch[key] = val
    else if (['pinned', 'hidden'].includes(key) && typeof val === 'boolean') patch[key] = val
    else if (key === 'tags' && Array.isArray(val) && val.length <= 100 && val.every((tag) => typeof tag === 'string' && tag.length <= 200)) patch[key] = val
    else return null
  }
  return patch
}
const server = http.createServer(async (req, res) => {
  const send = (status, type, body) => { res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'" }); res.end(body) }
  const url = new URL(req.url, 'http://127.0.0.1')
  if (req.method === 'POST' && url.pathname === '/dsh-workbench/api/override' && saveMode !== 'readonly') {
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) return send(415, 'application/json', JSON.stringify({ ok: false, error: 'JSON required' }))
    if (saveDelayMs) await new Promise((resolve) => setTimeout(resolve, saveDelayMs))
    if (saveMode === 'failure') return send(503, 'application/json', JSON.stringify({ ok: false, error: 'Simulated save failure' }))
    const payload = await readJson(req)
    const project = mock.find((item) => item.id === payload?.id)
    const patch = syntheticPatch(payload?.patch)
    if (!project || !patch) return send(400, 'application/json', JSON.stringify({ ok: false, error: 'Only synthetic projects and supported fields are allowed' }))
    const { intent, ...fields } = patch
    Object.assign(project, fields)
    if (intent !== undefined) project.identity = { ...project.identity, intent }
    return send(200, 'application/json', JSON.stringify({ ok: true, project }))
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, 'text/plain', 'Preview operation not supported')
  if (url.pathname === '/') return send(200, 'text/html; charset=utf-8', previewHtml)
  if (url.pathname === '/modules.js') return send(200, 'text/javascript; charset=utf-8', bundle)
  if (url.pathname === '/dsh-workbench/api/state') return send(200, 'application/json', JSON.stringify(state))
  if (url.pathname === '/dsh-workbench/api/project-media') return send(200, 'application/json', JSON.stringify({ ok: true, artifacts: [], images: [] }))
  if (url.pathname === '/dsh-workbench/api/skills') return send(200, 'application/json', JSON.stringify({ skills: [], roots: [] }))
  const file = files.get(url.pathname)
  if (!file) return send(404, 'text/plain', 'Not found')
  try { send(200, file[1], await fs.readFile(file[0])) } catch { send(404, 'text/plain', 'Not found') }
})
server.listen(Number(process.env.ATLAS_PREVIEW_PORT || 0), '127.0.0.1', () => console.log(`Atlas preview: http://127.0.0.1:${server.address().port}/`))
