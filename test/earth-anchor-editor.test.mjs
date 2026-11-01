import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
const start = source.indexOf('    function parseEarthAnchorDraft')
const end = source.indexOf('    function EarthView', start)
assert.ok(start >= 0 && end > start)
const h = (type, props, ...children) => ({ type, props: props || {}, children })
const { parse, submit, saveAndRefresh, refresh, Editor, finishReturn, previewTransform } = new Function('h', 'API', `${source.slice(start, end)}; return { parse: parseEarthAnchorDraft, submit: submitEarthAnchor, saveAndRefresh: saveAndRefreshEarthAnchor, refresh: refreshEarthAnchor, Editor: EarthAnchorEditor, finishReturn: finishEarthReturn, previewTransform: earthAnchorPreviewTransform }`)(h, '/dsh-workbench/api')
function walk(node, found = []) {
  if (!node || typeof node !== 'object') return found
  found.push(node)
  for (const child of node.children || []) Array.isArray(child) ? child.forEach((n) => walk(n, found)) : walk(child, found)
  return found
}

test('anchor editor validates both coordinates and supports boundary values', () => {
  assert.deepEqual(parse('90', '-180'), { lat: 90, lon: -180 })
  assert.deepEqual(parse('0', '0'), { lat: 0, lon: 0 })
  for (const pair of [['', '0'], ['0', ''], ['91', '0'], ['-91', '0'], ['0', '181'], ['0', '-181'], ['NaN', '0'], ['1e309', '0']]) {
    assert.equal(parse(...pair), null)
  }
})

test('draft marker centers the dot on the projected point in CSS pixels', () => {
  assert.equal(previewTransform({ x: 123.5, y: 45.25 }), 'translate3d(123.5px, 45.25px, 0) translate(-8px, -50%)')
  assert.match(source, /\.wb-earth-anchor-preview::before\{content:"";box-sizing:content-box;width:12px;height:12px;flex:none;border:2px/)
})

test('return flight keeps project selection and editor open when editing an anchor', () => {
  const calls = []
  const actions = { onActive: (id) => calls.push(['active', id]), setIndexOpen: (open) => calls.push(['index', open]), setIndexPreviewId: (id) => calls.push(['preview', id]) }
  finishReturn({ preserveSelection: true }, actions)
  assert.deepEqual(calls, [], 'anchor editing must not clear selection at flight completion')
  finishReturn({}, actions)
  assert.deepEqual(calls, [['active', ''], ['index', true], ['preview', '']])
})

test('saving and resetting send only explicit coordinates for the selected project', async () => {
  const calls = []
  const request = async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ ok: true }) } }
  await submit('project-1', { lat: 39.9, lon: 116.4 }, request)
  await submit('project-1', null, request)
  assert.equal(calls[0].url, '/dsh-workbench/api/override')
  assert.deepEqual(JSON.parse(calls[0].options.body), { id: 'project-1', patch: { earthAnchor: { lat: 39.9, lon: 116.4 } } })
  assert.deepEqual(JSON.parse(calls[1].options.body), { id: 'project-1', patch: { earthAnchor: null } })
  await assert.rejects(submit('project-1', null, async () => ({ ok: false, status: 503, json: async () => ({ error: 'offline' }) })), /offline/)
})

test('a successful save with failed refresh is distinct and can retry without saving again', async () => {
  let writes = 0
  const request = async () => { writes += 1; return { ok: true, json: async () => ({ ok: true }) } }
  assert.equal(await saveAndRefresh('project-1', { lat: 5, lon: 10 }, async () => false, request), false)
  assert.equal(writes, 1)
  assert.equal(await refresh(async () => { throw new Error('offline') }), false)
  assert.equal(await refresh(async () => true), true)
  assert.equal(writes, 1, 'retrying the display must not send another save')
  const retry = []
  const nodes = walk(Editor({ editor: { projectName: 'Demo', lat: '5', lon: '10', picking: false, busy: false, refreshFailed: true, error: 'saved but refresh failed' }, tr: (key) => key,
    onChange() {}, onPick() {}, onSave() {}, onReset() {}, onCancel() {}, onRetryRefresh: () => retry.push('refresh') }))
  assert.equal(nodes.find((node) => node.type === 'button' && node.children.includes('earthAnchorSave')).props.disabled, true)
  assert.equal(nodes.find((node) => node.type === 'button' && node.children.includes('earthAnchorReset')).props.disabled, true)
  nodes.find((node) => node.type === 'button' && node.children.includes('earthAnchorRetryRefresh')).props.onClick()
  assert.deepEqual(retry, ['refresh'])
})

test('editor exposes labelled number fields, accessible picking, save, reset and cancel', () => {
  const actions = []
  const nodes = walk(Editor({ editor: { projectName: 'Demo', lat: '1', lon: '2', picking: true, busy: false, error: '' }, tr: (key) => key,
    onChange: (...args) => actions.push(['change', ...args]), onPick: () => actions.push(['pick']), onSave: () => actions.push(['save']),
    onReset: () => actions.push(['reset']), onCancel: () => actions.push(['cancel']) }))
  const inputs = nodes.filter((node) => node.type === 'input')
  assert.equal(inputs.length, 2)
  assert.equal(inputs[0].props.min, '-90')
  assert.equal(inputs[1].props.max, '180')
  inputs[0].props.onChange({ target: { value: '35' } })
  const pick = nodes.find((node) => node.type === 'button' && node.children.includes('earthAnchorPick'))
  assert.equal(pick.props['aria-pressed'], true)
  pick.props.onClick()
  nodes.find((node) => node.type === 'form').props.onSubmit({ preventDefault() {} })
  nodes.find((node) => node.type === 'button' && node.children.includes('earthAnchorReset')).props.onClick()
  nodes.find((node) => node.type === 'button' && node.children.includes('earthAnchorCancel')).props.onClick()
  assert.deepEqual(actions, [['change', 'lat', '35'], ['pick'], ['save'], ['reset'], ['cancel']])
})

test('map picking accepts a tap on the surface but not a drag or a cancelled pointer', () => {
  const gestureStart = source.indexOf('      const pointerDown = (event) => {', source.indexOf('function EarthView'))
  const gestureEnd = source.indexOf('\n      const wheel = (event) => {', gestureStart)
  assert.ok(gestureStart >= 0 && gestureEnd > gestureStart)
  const make = new Function(`
    const stateRef = { current: { yaw: 0, pitch: 0, distance: 4, dragging: false, camera: {} } }
    const canvasRef = { current: { setPointerCapture() {}, getBoundingClientRect() { return {} } } }
    const dragRef = { current: null }, pinchRef = { current: null }, touchPointsRef = { current: new Map() }, anchorPointerRef = { current: null }
    const anchorEditor = { picking: true, busy: false, lat: '', lon: '', error: '' }
    const setAnchorEditor = (fn) => Object.assign(anchorEditor, fn(anchorEditor))
    const earthPickCoords = (x, y) => x === 12 && y === 20 ? { lat: 12.345678, lon: -90.123456 } : null
    const earthPinchDistance = (x) => x, tr = (x) => x, flight = null, setPlaying = () => {}
    ${source.slice(gestureStart, gestureEnd)}
    return { pointerDown, pointerMove, pointerUp, anchorEditor }
  `)
  const event = (x, y, type) => ({ pointerId: 1, pointerType: 'mouse', button: 0, clientX: x, clientY: y, type })
  const tap = make(); tap.pointerDown(event(12, 20)); tap.pointerUp(event(12, 20, 'pointerup'))
  assert.equal(tap.anchorEditor.lat, '12.34568'); assert.equal(tap.anchorEditor.lon, '-90.12346'); assert.equal(tap.anchorEditor.picking, false)
  const drag = make(); drag.pointerDown(event(0, 20)); drag.pointerMove(event(12, 20)); drag.pointerUp(event(12, 20, 'pointerup'))
  assert.equal(drag.anchorEditor.lat, '')
  const cancel = make(); cancel.pointerDown(event(12, 20)); cancel.pointerUp(event(12, 20, 'pointercancel'))
  assert.equal(cancel.anchorEditor.lat, '')
  const miss = make(); miss.pointerDown(event(0, 0)); miss.pointerUp(event(0, 0, 'pointerup'))
  assert.equal(miss.anchorEditor.error, 'earthAnchorPickMiss')
  const pinch = make()
  const touch = (id, x, y, type) => ({ pointerId: id, pointerType: 'touch', button: 0, clientX: x, clientY: y, type })
  pinch.pointerDown(touch(1, 12, 20)); pinch.pointerDown(touch(2, 40, 20))
  pinch.pointerMove(touch(2, 60, 20)); pinch.pointerUp(touch(2, 60, 20, 'pointerup')); pinch.pointerUp(touch(1, 12, 20, 'pointerup'))
  assert.equal(pinch.anchorEditor.lat, '', 'pinch must not pick a point')
})
