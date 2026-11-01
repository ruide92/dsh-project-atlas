import { promises as fs } from 'node:fs'
import { rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Writable } from 'node:stream'
import { DatabaseSync } from 'node:sqlite'

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-workbench-smoke-'))
process.env.DSH_WORKBENCH_DATA = tmp
const fixture = path.resolve('..', `.wb-verify-${process.pid}`)
const linkedRoot = path.join(tmp, 'linked')
const secondLinkedRoot = path.join(tmp, 'second-linked')
const conventionRoot = path.resolve('..', `.wb-convention-${process.pid}`)
const codexDb = path.join(tmp, 'codex-state.sqlite')
const codexLog = path.join(tmp, 'codex-rollout.jsonl')
await fs.writeFile(codexLog, [
  JSON.stringify({ timestamp: '2026-10-29T18:00:00.000Z', type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Codex fixture request' }] } }),
  JSON.stringify({ timestamp: '2026-10-29T18:00:01.000Z', type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Codex fixture reply' }] } }),
].join('\n') + '\n', 'utf8')
const codexSeed = new DatabaseSync(codexDb)
codexSeed.exec(`
  CREATE TABLE threads (
    id TEXT PRIMARY KEY, title TEXT, cwd TEXT, created_at_ms INTEGER, updated_at_ms INTEGER,
    archived INTEGER, thread_source TEXT, originator TEXT, rollout_path TEXT, first_user_message TEXT
  );
`)
codexSeed.prepare(`INSERT INTO threads VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  'c1', 'Codex fixture thread', fixture, 1793298000000, 1793298125744, 0, 'user', 'Codex Desktop', codexLog, 'Codex fixture request',
)
codexSeed.prepare(`INSERT INTO threads VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  'c-sub', 'Codex subagent', fixture, 1793298000000, 1793298125744, 0, 'subagent', 'Codex Desktop', '', 'subagent',
)
codexSeed.close()
process.env.DSH_WORKBENCH_CODEX_DB = codexDb
process.on('exit', () => {
  for (const target of [fixture, conventionRoot, tmp]) {
    try { rmSync(target, { recursive: true, force: true }) } catch { /* best effort */ }
  }
})
await fs.mkdir(path.join(fixture, 'output'), { recursive: true })
await fs.mkdir(path.join(linkedRoot, 'output'), { recursive: true })
await fs.mkdir(path.join(secondLinkedRoot, 'output'), { recursive: true })
await fs.mkdir(path.join(conventionRoot, 'output'), { recursive: true })
await fs.writeFile(path.join(fixture, 'output', 'result.png'), Buffer.from('89504e470d0a1a0a', 'hex'))
await fs.writeFile(path.join(fixture, 'output', 'main-only.png'), Buffer.from('main only'))
await fs.writeFile(path.join(linkedRoot, 'output', 'result.png'), Buffer.from('linked image'))
await fs.writeFile(path.join(linkedRoot, 'output', 'linked-only.png'), Buffer.from('only linked'))
await fs.writeFile(path.join(secondLinkedRoot, 'output', 'result.png'), Buffer.from('second linked image'))
await fs.writeFile(path.join(conventionRoot, 'output', 'result.png'), Buffer.from('convention'))
await fs.writeFile(path.join(tmp, 'overrides.json'), JSON.stringify({ p2: { folders: [{ path: linkedRoot, role: 'output' }, { path: secondLinkedRoot, role: 'output' }] } }), 'utf8')
await fs.writeFile(path.join(fixture, 'workbench.project.json'), JSON.stringify({
  schemaVersion: 1,
  integration: { kind: 'fixture-agent', agent: 'codex', entry: { type: 'cli', value: 'fixture run' }, state: '.dsh/handoff/state.json', apply: 'AGENTS.md' },
  state: 'running',
  stage: { id: 'render', label: '渲染中', progress: 0.4 },
  stages: [
    { id: 'collect', label: '收集素材', status: 'done', progress: 1 },
    { id: 'render', label: '渲染中', status: 'running', progress: 0.4 },
  ],
  progress: 0.65,
  heartbeatAt: new Date().toISOString(),
  artifacts: [
    { path: 'output/result.png', title: '主目录结果帧', kind: 'image' },
    { path: path.join(linkedRoot, 'output', 'result.png'), title: '关联目录结果帧', kind: 'image' },
    { path: path.join(secondLinkedRoot, 'output', 'result.png'), title: '第二关联目录结果帧', kind: 'image' },
  ],
}), 'utf8')
await fs.writeFile(path.join(fixture, 'status.json'), JSON.stringify({
  state: 'waiting',
  stage: { id: 'approve', label: '等待确认', progress: 0.8 },
  progress: 0.8,
  heartbeatAt: new Date().toISOString(),
}), 'utf8')
await fs.writeFile(path.join(tmp, 'catalog.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  projects: [{
    id: 'p1', name: 'workbench', displayName: 'workbench',
    path: 'C:\\Projects\\workbench', drive: 'C:', group: 'C:',
    markers: ['package.json'], hasGit: false, hasDsh: true,
    codeFiles: 10, sizeBytes: 100, fileCount: 10,
    created: '2026-01-01T00:00:00.000Z', lastActivity: '2026-01-02T00:00:00.000Z',
    status: 'active', sources: ['dsh'], childrenCount: 0,
  }, {
    id: 'p2', name: 'runtime-project', displayName: 'Runtime Project',
    path: fixture, drive: 'C:', group: 'fixture',
    markers: ['workbench.project.json'], hasGit: false, hasDsh: false,
    codeFiles: 2, sizeBytes: 128, fileCount: 2,
    created: '2026-01-01T00:00:00.000Z', lastActivity: new Date().toISOString(),
    status: 'active', sources: ['folder'], childrenCount: 0, topLevel: true,
  }, {
    id: 'p3', name: 'convention-project', displayName: 'Convention Project',
    path: conventionRoot, drive: 'C:', group: 'fixture', markers: [], hasGit: false, hasDsh: false,
    codeFiles: 0, sizeBytes: 10, fileCount: 1,
    created: '2026-01-01T00:00:00.000Z', lastActivity: new Date().toISOString(),
    status: 'active', sources: ['folder'], childrenCount: 0, topLevel: true,
  }],
  software: [],
  stats: {},
}), 'utf8')

const routes = new Map()
const webServer = {
  register({ path: routePath, handler }) {
    routes.set(routePath, handler)
    return () => routes.delete(routePath)
  },
}
const ctx = {
  inject(names, callback) {
    if (names.includes('webServer')) callback({ webServer, effect(fn) { fn() } })
    if (names.includes('sessionQuery')) callback({
      sessionQuery: {
        async listSessions() {
          return [{
            header: {
              version: 4,
              id: 's1',
              createdAt: 1767225600000,
              cwd: 'C:\\Projects\\workbench',
              isSeeded: false,
            },
            live: false,
            persisted: true,
          }, {
            header: {
              version: 4,
              id: 's2',
              createdAt: 1767225600100,
              cwd: fixture,
              isSeeded: false,
            },
            live: false,
            persisted: true,
          }]
        },
        async readTitleSnapshots(ids) {
          return ids.map((sessionId) => ({
            sessionId,
            status: 'fulfilled',
            value: { title: { title: 'demo session' } },
          }))
        },
      },
      effect(fn) { fn() },
    })
  },
  effect(fn) { fn() },
}
const mod = await import('../index.js')
mod.apply(ctx)

function mockRes() {
  return {
    status: 0,
    body: null,
    writeHead(status) { this.status = status },
    end(text) { this.body = JSON.parse(text) },
  }
}
async function call(method, route, body, origin = 'http://127.0.0.1:64382') {
  const req = {
    method,
    url: route,
    headers: { origin, host: '127.0.0.1:64382' },
    async *[Symbol.asyncIterator]() { if (body !== undefined) yield Buffer.from(JSON.stringify(body)) },
  }
  const res = mockRes()
  await routes.get(route.split('?')[0])(req, res)
  return res
}
async function readArtifact(route) {
  const chunks = []
  const res = new Writable({ write(chunk, _encoding, done) { chunks.push(Buffer.from(chunk)); done() } })
  res.writeHead = (status) => { res.status = status }
  const finished = new Promise((resolve, reject) => { res.on('finish', resolve); res.on('error', reject) })
  const req = { method: 'GET', url: route, headers: { host: '127.0.0.1:64382' } }
  await routes.get('/dsh-workbench/api/artifact')(req, res)
  await finished
  return { status: res.status, body: Buffer.concat(chunks) }
}

const state = await call('GET', '/dsh-workbench/api/state')
// Manual globe positions belong only to workbench overrides, not project files.
const anchored = await call('POST', '/dsh-workbench/api/override', { id: 'p1', patch: { earthAnchor: { lat: 0, lon: 0 } } })
if (anchored.status !== 200 || anchored.body.project?.earthAnchor?.lat !== 0 || anchored.body.project?.earthAnchor?.lon !== 0) {
  throw new Error(`valid zero coordinates rejected: ${JSON.stringify(anchored.body)}`)
}
let anchorState = await call('GET', '/dsh-workbench/api/state')
if (anchorState.body.projects.find((project) => project.id === 'p1')?.earthAnchor?.lon !== 0) throw new Error('saved anchor missing from state')
let diskOverrides = JSON.parse(await fs.readFile(path.join(tmp, 'overrides.json'), 'utf8'))
if (diskOverrides.p1?.earthAnchor?.lat !== 0 || diskOverrides.p1?.earthAnchor?.lon !== 0) throw new Error('anchor missing from persisted workbench overrides')
for (const anchor of [{ lat: 90, lon: 180 }, { lat: -90, lon: -180 }]) {
  const response = await call('POST', '/dsh-workbench/api/override', { id: 'p1', patch: { earthAnchor: anchor } })
  const fromState = (await call('GET', '/dsh-workbench/api/state')).body.projects.find((project) => project.id === 'p1')?.earthAnchor
  const fromDisk = JSON.parse(await fs.readFile(path.join(tmp, 'overrides.json'), 'utf8')).p1?.earthAnchor
  for (const value of [response.body.project?.earthAnchor, fromState, fromDisk]) {
    if (value?.lat !== anchor.lat || value?.lon !== anchor.lon) throw new Error(`boundary anchor changed: ${JSON.stringify({ anchor, value })}`)
  }
}
await call('POST', '/dsh-workbench/api/override', { id: 'p1', patch: { earthAnchor: { lat: 0, lon: 0 } } })
const renamed = await call('POST', '/dsh-workbench/api/override', { id: 'p1', patch: { name: 'Renamed fixture', lifecycle: 'persistent' } })
if (renamed.body.project?.earthAnchor?.lat !== 0 || renamed.body.project?.earthAnchor?.lon !== 0) throw new Error('other project overrides changed a saved anchor')
for (const invalid of [{ lat: 91, lon: 0 }, { lat: 0, lon: -181 }, { lat: '0', lon: 0 }, { lat: 0 }, []]) {
  const response = await call('POST', '/dsh-workbench/api/override', { id: 'p1', patch: { earthAnchor: invalid, note: 'must not save' } })
  if (response.status !== 400) throw new Error(`invalid anchor accepted: ${JSON.stringify(invalid)}`)
}
const deniedAnchor = await call('POST', '/dsh-workbench/api/override', { id: 'p1', patch: { earthAnchor: { lat: 1, lon: 1 } } }, 'http://evil.invalid')
if (deniedAnchor.status !== 403) throw new Error('cross-origin anchor update was accepted')
const unknownAnchor = await call('POST', '/dsh-workbench/api/override', { id: 'missing', patch: { earthAnchor: { lat: 1, lon: 1 } } })
if (unknownAnchor.status !== 404) throw new Error('unknown project anchor update was accepted')
diskOverrides = JSON.parse(await fs.readFile(path.join(tmp, 'overrides.json'), 'utf8'))
if (diskOverrides.p1?.earthAnchor?.lat !== 0 || diskOverrides.p1?.note === 'must not save') throw new Error('invalid anchor request partially persisted')
const cleared = await call('POST', '/dsh-workbench/api/override', { id: 'p1', patch: { earthAnchor: null } })
anchorState = await call('GET', '/dsh-workbench/api/state')
if (cleared.status !== 200 || anchorState.body.projects.find((project) => project.id === 'p1')?.earthAnchor !== null) throw new Error('anchor clear failed')
diskOverrides = JSON.parse(await fs.readFile(path.join(tmp, 'overrides.json'), 'utf8'))
if (Object.hasOwn(diskOverrides.p1, 'earthAnchor')) throw new Error('anchor was not removed from persisted overrides')
const originalProject = state.body.projects.find((project) => project.id === 'p1')
if (state.status !== 200 || originalProject?.sessionCount !== 1) {
  throw new Error(`state session mapping failed: ${JSON.stringify(state.body)}`)
}
if (originalProject.sessions?.[0]?.id !== 's1') throw new Error('state session id missing')
const runtimeProject = state.body.projects.find((project) => project.id === 'p2')
const codexSession = state.body.sessions?.find((session) => session.id === 'c1')
if (!codexSession || codexSession.source !== 'codex' || codexSession.projectId) {
  throw new Error(`Codex session inventory failed: ${JSON.stringify(state.body.sessions)}`)
}
if (state.body.sessions?.some((session) => session.id === 'c-sub')) throw new Error('Codex subagent leaked into inventory')
if (runtimeProject?.sessions?.some((session) => session.id === 'c1')) throw new Error('Codex session was auto-mapped by cwd')
if (runtimeProject?.runtime?.source !== 'status') throw new Error(`runtime status priority missing: ${JSON.stringify(runtimeProject?.runtime)} projects=${JSON.stringify(state.body.projects.map((project) => ({ id: project.id, path: project.path, topLevel: project.topLevel, noise: project.noise, container: project.container })))}`)
if (runtimeProject.runtime.state !== 'waiting' || runtimeProject.runtime.stage?.label !== '等待确认') {
  throw new Error(`runtime state/stage wrong: ${JSON.stringify(runtimeProject.runtime)}`)
}
const sameNameArtifacts = runtimeProject.runtime.artifacts.filter((artifact) => artifact.path === 'output/result.png')
if (sameNameArtifacts.length !== 3 || new Set(sameNameArtifacts.map((artifact) => artifact.id)).size !== 3) {
  throw new Error(`distinct linked artifacts collapsed: ${JSON.stringify(runtimeProject.runtime.artifacts)}`)
}
for (const [folder, expected] of [[0, Buffer.from('89504e470d0a1a0a', 'hex')], [1, Buffer.from('linked image')], [2, Buffer.from('second linked image')]]) {
  const item = sameNameArtifacts.find((artifact) => artifact.folder === folder)
  if (!item?.url.endsWith(`&folder=${folder}`)) throw new Error(`wrong artifact root: ${JSON.stringify(item)}`)
  const response = await readArtifact(item.url)
  if (response.status !== 200 || !response.body.equals(expected)) throw new Error(`wrong artifact bytes from folder ${folder}`)
}
const conventionProject = state.body.projects.find((project) => project.id === 'p3')
if (conventionProject?.runtime?.source !== 'convention' || conventionProject.runtime.state !== 'unknown') {
  throw new Error(`discovered file incorrectly implies runtime ready: ${JSON.stringify(conventionProject?.runtime)}`)
}
if (state.body.runtime?.measured !== 2 || state.body.runtime?.waiting !== 1) {
  throw new Error(`runtime stats wrong: ${JSON.stringify(state.body.runtime)}`)
}
const traversal = await call('GET', '/dsh-workbench/api/artifact?id=p2&path=..%2Fpackage.json')
if (traversal.status !== 400 && traversal.status !== 404) throw new Error(`artifact traversal guard failed: ${traversal.status} ${JSON.stringify(traversal.body)}`)
const nonImage = await call('GET', '/dsh-workbench/api/artifact?id=p2&path=workbench.project.json')
if (nonImage.status !== 415) throw new Error(`artifact mime guard failed: ${nonImage.status} ${JSON.stringify(nonImage.body)}`)

const health = await call('GET', '/dsh-workbench/api/health')
if (health.status !== 200 || health.body.version !== 12 || health.body.routes !== 24 || health.body.hasCodexSessions !== true || health.body.sessionSources !== true) throw new Error(`health version failed: ${JSON.stringify(health.body)}`)
for (const asset of ['/dsh-workbench/assets/earth-blue-marble.jpg', '/dsh-workbench/assets/earth-night.jpg']) {
  if (!routes.has(asset)) throw new Error(`earth asset route missing: ${asset}`)
}
if (!routes.has('/dsh-workbench/api/project-media')) throw new Error('project-media route missing')
const projectMedia = await call('GET', '/dsh-workbench/api/project-media?id=p2')
if (projectMedia.status !== 200 || projectMedia.body.ok !== true || !projectMedia.body.items?.some((item) => item.path === 'output/result.png')) {
  throw new Error('project media scan failed: ' + JSON.stringify(projectMedia.body))
}
const mediaItem = projectMedia.body.items.find((item) => item.path === 'output/result.png')
if (!mediaItem.url?.includes('folder=')) throw new Error('project media folder index missing')
const mediaProbe = await call('GET', '/dsh-workbench/api/project-media?id=p2&path=output%2Fresult.png')
if (mediaProbe.status !== 200 || mediaProbe.body.item?.path !== 'output/result.png') throw new Error('project media probe failed: ' + JSON.stringify(mediaProbe.body))
const linkedProbe = await call('GET', '/dsh-workbench/api/project-media?id=p2&path=output%2Flinked-only.png')
if (linkedProbe.status !== 200 || linkedProbe.body.item?.folder !== 1) throw new Error(`missing folder should search linked roots: ${JSON.stringify(linkedProbe.body)}`)
const linkedLegacyArtifact = await readArtifact('/dsh-workbench/api/artifact?id=p2&path=output%2Flinked-only.png')
if (linkedLegacyArtifact.status !== 200 || !linkedLegacyArtifact.body.equals(Buffer.from('only linked'))) {
  throw new Error('legacy artifact link without folder did not search linked roots')
}
await call('POST', '/dsh-workbench/api/override', { id: 'p2', patch: { representativeImage: { path: 'output/result.png', folder: 1, title: '关联图片' } } })
const linkedPinned = await call('GET', '/dsh-workbench/api/project-media?id=p2')
if (linkedPinned.body.representative?.folder !== 1 || !linkedPinned.body.representative?.url.endsWith('&folder=1')) {
  throw new Error(`pinned image resolved to wrong root: ${JSON.stringify(linkedPinned.body.representative)}`)
}
await call('POST', '/dsh-workbench/api/override', { id: 'p2', patch: { representativeImage: { path: 'output/main-only.png', folder: 1, title: '缺失图片' } } })
const missingPinned = await call('GET', '/dsh-workbench/api/project-media?id=p2')
if (!missingPinned.body.pinnedMissing || missingPinned.body.representative !== null) {
  throw new Error(`missing pinned image silently switched roots: ${JSON.stringify(missingPinned.body)}`)
}
await call('POST', '/dsh-workbench/api/override', { id: 'p2', patch: { representativeImage: { path: 'output/result.png', folder: 2, title: '第二关联图片' } } })
await call('POST', '/dsh-workbench/api/override', { id: 'p2', patch: { earthAnchor: { lat: 35.2, lon: -180 } } })
const detachFirst = await call('DELETE', '/dsh-workbench/api/project-folders', { id: 'p2', path: linkedRoot })
if (detachFirst.status !== 200) throw new Error(`could not detach first linked root: ${JSON.stringify(detachFirst.body)}`)
const movedPinned = await call('GET', '/dsh-workbench/api/project-media?id=p2')
if (movedPinned.body.representative?.folder !== 1) throw new Error(`pin not preserved when linked root moves: ${JSON.stringify(movedPinned.body.representative)}`)
const movedImage = await readArtifact(movedPinned.body.representative.url)
if (!movedImage.body.equals(Buffer.from('second linked image'))) throw new Error('pin switched to a different root after unlink')
const changedState = await call('GET', '/dsh-workbench/api/state')
const changedProject = changedState.body.projects.find((project) => project.id === 'p2')
if (changedProject?.representativeImage?.folder !== 1) throw new Error('project metadata retained obsolete pinned folder index')
if (changedProject?.earthAnchor?.lat !== 35.2 || changedProject?.earthAnchor?.lon !== -180) throw new Error('linked-folder change lost owner anchor')
const changedArtifacts = changedProject?.runtime?.artifacts || []
const secondAfterDetach = changedArtifacts.find((item) => item.title === '第二关联目录结果帧')
if (secondAfterDetach?.folder !== 1) throw new Error(`runtime cache ignored folder change: ${JSON.stringify(changedArtifacts)}`)
const detachPinned = await call('DELETE', '/dsh-workbench/api/project-folders', { id: 'p2', path: secondLinkedRoot })
if (detachPinned.status !== 200) throw new Error('could not detach pinned root')
const detachedPinned = await call('GET', '/dsh-workbench/api/project-media?id=p2')
if (!detachedPinned.body.pinnedMissing || detachedPinned.body.representative !== null) throw new Error('detached pinned root silently reused another image')
const detachedState = await call('GET', '/dsh-workbench/api/state')
if (detachedState.body.projects.find((project) => project.id === 'p2')?.representativeImage?.folder !== -2) throw new Error('detached pinned root was not marked unavailable')
for (const endpoint of ['artifact', 'project-media']) {
  for (const folder of ['-1', '99', '', '1.5']) {
    const response = await call('GET', `/dsh-workbench/api/${endpoint}?id=p2&path=output%2Fresult.png&folder=${folder}`)
    if (response.status !== 400) throw new Error(`${endpoint} accepted invalid folder ${folder}: ${response.status}`)
  }
}
// A project-relative junction must not expose a real image outside its authorized root.
const escapedRoot = path.join(tmp, 'outside')
await fs.mkdir(escapedRoot)
await fs.writeFile(path.join(escapedRoot, 'escape.png'), Buffer.from('outside'))
await fs.symlink(escapedRoot, path.join(fixture, 'escape'), 'junction')
for (const endpoint of ['artifact', 'project-media']) {
  const response = await call('GET', `/dsh-workbench/api/${endpoint}?id=p2&path=escape%2Fescape.png&folder=0`)
  if (response.status !== 404) throw new Error(`${endpoint} followed a junction outside the root: ${response.status}`)
}
const mediaTraversal = await call('GET', '/dsh-workbench/api/project-media?id=p2&path=..%2Fpackage.json')
if (mediaTraversal.status !== 400) throw new Error('project media traversal guard failed: ' + mediaTraversal.status)
const pinned = await call('POST', '/dsh-workbench/api/override', { id: 'p2', patch: { representativeImage: { path: 'output/result.png', folder: 0, title: '结果帧' } } })
if (pinned.status !== 200 || pinned.body.ok === false) throw new Error('representative image override failed: ' + JSON.stringify(pinned.body))
const pinnedState = await call('GET', '/dsh-workbench/api/state')
const pinnedProject = pinnedState.body.projects.find((project) => project.id === 'p2')
if (pinnedProject?.representativeImage?.path !== 'output/result.png') throw new Error('representative image projection failed: ' + JSON.stringify(pinnedProject?.representativeImage))
const unpinned = await call('POST', '/dsh-workbench/api/override', { id: 'p2', patch: { representativeImage: null } })
if (unpinned.status !== 200) throw new Error('representative image clear failed')
const badSkillOpen = await call('POST', '/dsh-workbench/api/skill-open', { id: '../outside', path: fixture })
if (badSkillOpen.status !== 404 || badSkillOpen.body.ok) throw new Error(`skill-open must reject unknown ids: ${badSkillOpen.status} ${JSON.stringify(badSkillOpen.body)}`)
const codexList = await call('GET', '/dsh-workbench/api/codex-sessions')
if (codexList.status !== 200 || codexList.body.sessions?.length !== 1 || codexList.body.sessions[0].id !== 'c1') {
  throw new Error(`Codex session route failed: ${JSON.stringify(codexList.body)}`)
}
const badCodexOpen = await call('POST', '/dsh-workbench/api/codex-session-open', { id: '../../evil' })
if (badCodexOpen.status !== 404) throw new Error('invalid Codex thread id was accepted')

// Missing writeProject must never write, even when a full prompt is present.
const missingFlag = await call('POST', '/dsh-workbench/api/project-handoff', {
  projectId: 'p2', cwd: fixture, targetApp: 'codex', goal: '继续渲染',
  progress: '已完成收集', summary: '结果帧已生成', prompt: '# 项目交接\n继续渲染',
})
if (missingFlag.status !== 400 || missingFlag.body.ok) throw new Error(`handoff without explicit writeProject was accepted: ${JSON.stringify(missingFlag.body)}`)
if (await fs.stat(path.join(fixture, '.dsh', 'handoff')).then(() => true).catch(() => false)) throw new Error('handoff created .dsh/handoff without explicit writeProject')
if (await fs.stat(path.join(fixture, 'AGENTS.md')).then(() => true).catch(() => false)) throw new Error('handoff created AGENTS.md without explicit writeProject')

const written = await call('POST', '/dsh-workbench/api/project-handoff', {
  projectId: 'p2', cwd: fixture, targetApp: 'codex', goal: '继续渲染',
  progress: '已完成收集', summary: '结果帧已生成', prompt: '# 项目交接\n继续渲染', writeProject: true,
})
if (written.status !== 200 || !written.body.ok || written.body.wroteProject !== true || written.body.wroteAgents !== false) {
  throw new Error(`project-only handoff write failed: ${JSON.stringify(written.body)}`)
}
const handoffState = JSON.parse(await fs.readFile(path.join(fixture, '.dsh', 'handoff', 'state.json'), 'utf8'))
if (handoffState.goal !== '继续渲染' || handoffState.targetApp !== 'codex') throw new Error('project handoff state wrong')
const handoffDoc = await fs.readFile(path.join(fixture, '.dsh', 'handoff', 'PROJECT_STATE.md'), 'utf8')
if (!handoffDoc.includes('继续渲染') || !handoffDoc.includes('项目现状')) throw new Error('project handoff doc wrong')
if (await fs.stat(path.join(fixture, 'AGENTS.md')).then(() => true).catch(() => false)) throw new Error('project-only handoff wrote AGENTS.md')
await fs.appendFile(path.join(fixture, '.dsh', 'handoff', 'PROJECT_STATE.md'), '\n- 用户自己的段落必须保留。\n')
const readHandoff = await call('GET', '/dsh-workbench/api/project-handoff?projectId=p2')
if (readHandoff.status !== 200 || readHandoff.body.exists !== true || readHandoff.body.state?.goal !== '继续渲染' || !readHandoff.body.doc?.includes('继续渲染')) {
  throw new Error(`project handoff read failed: ${JSON.stringify(readHandoff.body)}`)
}
const agentsWritten = await call('POST', '/dsh-workbench/api/project-handoff', {
  projectId: 'p2', goal: '继续渲染第二版', summary: '重写交接正文，用户段落必须保留',
  prompt: '# 项目交接\n继续渲染第二版', writeProject: true, writeAgents: true,
})
if (agentsWritten.status !== 200 || agentsWritten.body.wroteAgents !== true) throw new Error(`handoff with AGENTS failed: ${JSON.stringify(agentsWritten.body)}`)
const agents = await fs.readFile(path.join(fixture, 'AGENTS.md'), 'utf8')
if (!agents.includes('dsh-workbench:handoff:start') || !agents.includes('PROJECT_STATE.md')) throw new Error('AGENTS pointer missing')
const rewrittenDoc = await fs.readFile(path.join(fixture, '.dsh', 'handoff', 'PROJECT_STATE.md'), 'utf8')
if (!rewrittenDoc.includes('用户自己的段落必须保留') || !rewrittenDoc.includes('继续渲染第二版')) throw new Error('managed handoff rewrite lost user content')
const agentsOnly = await call('POST', '/dsh-workbench/api/project-handoff', {
  projectId: 'p2', prompt: '# 项目交接\n只写 AGENTS', writeAgents: true,
})
if (agentsOnly.status !== 400) throw new Error('AGENTS-only handoff was accepted')
const noteRejected = await call('POST', '/dsh-workbench/api/project-handoff', { projectId: 'p2', note: '晚上继续核对光照' })
if (noteRejected.status !== 400) throw new Error('note was accepted by deep handoff endpoint')
const noteAfter = (await call('GET', '/dsh-workbench/api/state')).body.projects?.find((project) => project.id === 'p2')
if (noteAfter?.note === '晚上继续核对光照') throw new Error('note rejection still changed local view')

const followed = await call('POST', '/dsh-workbench/api/followup', { id: 'p1', state: 'done' })
if (followed.status !== 200 || followed.body.project?.followState !== 'done') {
  throw new Error(`follow-up update failed: ${JSON.stringify(followed.body)}`)
}
const followFile = JSON.parse(await fs.readFile(path.join(tmp, 'followups.json'), 'utf8'))
if (followFile.items?.p1?.state !== 'done') throw new Error('follow-up state was not persisted')

const empty = await call('GET', '/dsh-workbench/api/handoffs')
if (empty.status !== 200 || !Array.isArray(empty.body.handoffs)) throw new Error('GET handoffs failed')

const posted = await call('POST', '/dsh-workbench/api/handoffs', {
  projectId: 'f68703e0aa36',
  projectPath: 'C:\\Projects\\workbench',
  sourceKind: 'dsh',
  sourceSessionId: 'session-test',
  sourceTitle: 'test',
  goal: 'continue',
  prompt: '# handoff\ncontinue',
})
if (posted.status !== 201 || !posted.body.ok) throw new Error(`POST handoffs failed: ${JSON.stringify(posted.body)}`)
const saved = JSON.parse(await fs.readFile(path.join(tmp, 'handoffs.json'), 'utf8'))
if (saved.length !== 1 || saved[0].goal !== 'continue') throw new Error('handoff was not persisted')

const status = await call('POST', '/dsh-workbench/api/path-status', { path: fixture })
if (status.status !== 200 || status.body.exists !== true || status.body.isDirectory !== true) throw new Error(`path-status failed: ${JSON.stringify(status.body)}`)

const linked = await call('POST', '/dsh-workbench/api/project-folders', {
  id: 'p1', path: path.join(fixture, 'output'), role: 'docs',
})
if (linked.status !== 200 || linked.body.folders?.[0]?.role !== 'docs') throw new Error(`link folder failed: ${JSON.stringify(linked.body)}`)
const linkedFile = JSON.parse(await fs.readFile(path.join(tmp, 'overrides.json'), 'utf8'))
if (linkedFile.p1?.folders?.[0]?.path !== path.join(fixture, 'output')) throw new Error('folder link was not persisted')
const unlinked = await call('DELETE', '/dsh-workbench/api/project-folders', {
  id: 'p1', path: path.join(fixture, 'output'),
})
if (unlinked.status !== 200 || unlinked.body.folders?.length !== 0) throw new Error(`unlink folder failed: ${JSON.stringify(unlinked.body)}`)

const linkedSession = await call('POST', '/dsh-workbench/api/project-sessions', { id: 'p1', sessionId: 's1' })
if (linkedSession.status !== 200 || linkedSession.body.sessions?.[0]?.id !== 's1') {
  throw new Error(`link session failed: ${JSON.stringify(linkedSession.body)}`)
}
const linkedState = await call('GET', '/dsh-workbench/api/state')
if (linkedState.body.projects?.find((project) => project.id === 'p1')?.sessions?.[0]?.manual !== true) throw new Error('manual session flag missing')
if (linkedState.body.sessions?.[0]?.projectId !== 'p1') throw new Error('all-session projectId missing')
const unlinkedSession = await call('DELETE', '/dsh-workbench/api/project-sessions', { id: 'p1', sessionId: 's1' })
if (unlinkedSession.status !== 200 || unlinkedSession.body.sessions?.length !== 0) {
  throw new Error(`unlink session failed: ${JSON.stringify(unlinkedSession.body)}`)
}
const codexLinked = await call('POST', '/dsh-workbench/api/project-sessions', { id: 'p2', sessionId: 'c1', source: 'codex' })
if (codexLinked.status !== 200 || codexLinked.body.sessions?.[0]?.source !== 'codex') {
  throw new Error(`link Codex session failed: ${JSON.stringify(codexLinked.body)}`)
}
const codexLinkedState = await call('GET', '/dsh-workbench/api/state')
if (codexLinkedState.body.sessions?.find((session) => session.id === 'c1')?.projectId !== 'p2') throw new Error('linked Codex session did not join project')
const codexUnlinked = await call('DELETE', '/dsh-workbench/api/project-sessions', { id: 'p2', sessionId: 'c1', source: 'codex' })
if (codexUnlinked.status !== 200 || codexUnlinked.body.sessions?.length !== 0) {
  throw new Error(`unlink Codex session failed: ${JSON.stringify(codexUnlinked.body)}`)
}

// Workbench-local lifecycle/notes must win without touching project files.
const followSeed = await call('POST', '/dsh-workbench/api/followup', { id: 'p2', state: 'new' })
if (followSeed.status !== 200 || followSeed.body.project?.needsFollowup !== true) {
  throw new Error(`follow-up seed did not mark p2 as new: ${JSON.stringify(followSeed.body)}`)
}
const localOverride = await call('POST', '/dsh-workbench/api/override', {
  id: 'p2',
  patch: { lifecycle: 'persistent', intent: '本地长期维护', note: '只存工作台' },
})
const localProject = localOverride.body.project
if (localOverride.status !== 200 || localProject?.lifecycle !== 'persistent' || localProject?.lifecycleSource !== 'manual') {
  throw new Error(`local lifecycle override failed: ${JSON.stringify(localOverride.body)}`)
}
if (localProject?.needsFollowup !== false || localProject?.isNew !== false) {
  throw new Error(`confirmed long-term project still looks new: ${JSON.stringify(localProject)}`)
}
if (localProject?.note !== '只存工作台' || localProject?.noteSource !== 'local') {
  throw new Error(`local note override failed: ${JSON.stringify(localProject)}`)
}
const manifestAfterLocal = JSON.parse(await fs.readFile(path.join(fixture, 'workbench.project.json'), 'utf8'))
if (Object.hasOwn(manifestAfterLocal, 'lifecycle')) throw new Error('local override leaked into project manifest')
if (manifestAfterLocal.integration?.kind !== 'fixture-agent') throw new Error('local override erased manifest integration')
const overrideFile = JSON.parse(await fs.readFile(path.join(tmp, 'overrides.json'), 'utf8'))
if (overrideFile.p2?.lifecycle !== 'persistent' || overrideFile.p2?.note !== '只存工作台') {
  throw new Error(`local override not persisted: ${JSON.stringify(overrideFile)}`)
}

const outsideInherit = await call('POST', '/dsh-workbench/api/inherit', {
  projectId: 'p1', targetApp: 'other', cwd: 'C:\\Windows', prompt: 'x',
})
if (outsideInherit.status !== 403) throw new Error(`inherit cwd guard failed: ${JSON.stringify(outsideInherit.body)}`)

const crossOrigin = await call('POST', '/dsh-workbench/api/handoffs', { projectId: 'x' }, 'http://evil.example')
if (crossOrigin.status !== 403) throw new Error('cross-origin handoff POST was not rejected')
const crossPort = await call('POST', '/dsh-workbench/api/handoffs', { projectId: 'x' }, 'http://127.0.0.1:9999')
if (crossPort.status !== 403) throw new Error('cross-port handoff POST was not rejected')
const otherLoopback = await call('POST', '/dsh-workbench/api/handoffs', { projectId: 'x' }, 'http://localhost:64382')
if (otherLoopback.status !== 403) throw new Error('loopback alias was treated as same-origin')

console.log('host smoke ok', { routes: [...routes.keys()].length, saved: saved.length, pathStatus: status.body })
await fs.rm(tmp, { recursive: true, force: true })
await fs.rm(fixture, { recursive: true, force: true })
await fs.rm(conventionRoot, { recursive: true, force: true })
