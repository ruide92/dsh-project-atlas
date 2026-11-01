import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const source = readFileSync(join(root, 'client.js'), 'utf8')
const start = source.indexOf('    function earthProjectPointOnGlobe')
const end = source.indexOf('\n    // A satellite descends', start)
assert.ok(start >= 0 && end > start, 'earthProjectPointOnGlobe must exist')
const fn = new Function('const EARTH_RAD = Math.PI / 180\n' + source.slice(start, end).replace(/^    /gm, '') + '\nreturn earthProjectPointOnGlobe')
const projectPoint = fn()
const coordsStart = source.indexOf('    function earthHash')
const coordsEnd = source.indexOf('\n    function earthReduced', coordsStart)
assert.ok(coordsStart >= 0 && coordsEnd > coordsStart, 'earthCoords must exist')
const earthCoords = new Function('const EARTH_RAD = Math.PI / 180\n' + source.slice(coordsStart, coordsEnd) + '\nreturn earthCoords')()
const cameraStart = source.indexOf('    function earthPerspective')
const cameraEnd = source.indexOf('\n    function earthSunVector', cameraStart)
assert.ok(cameraStart >= 0 && cameraEnd > cameraStart, 'earth camera helpers must exist')
const { earthPerspective, earthLookAt, earthProjectPoint, earthPointVisible, earthMarkerViewport, earthPickCoords } = new Function(
  'const EARTH_RAD = Math.PI / 180\n' + source.slice(cameraStart, cameraEnd) + '\nreturn {earthPerspective,earthLookAt,earthProjectPoint,earthPointVisible,earthMarkerViewport,earthPickCoords}'
)()

function jpegSize(buffer) {
  let offset = 2
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue }
    const marker = buffer[offset + 1]
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) }
    }
    const length = buffer.readUInt16BE(offset + 2)
    offset += 2 + length
  }
  throw new Error('JPEG dimensions not found')
}

test('day and night textures are equirectangular 2:1 at the expected resolution', () => {
  const day = jpegSize(readFileSync(join(root, 'assets', 'earth-blue-marble.jpg')))
  const night = jpegSize(readFileSync(join(root, 'assets', 'earth-night.jpg')))
  assert.deepEqual(day, { width: 2048, height: 1024 })
  assert.deepEqual(night, { width: 3600, height: 1800 })
})

test('globe coordinates put the prime meridian on +X and east on -Z', () => {
  const near = (point, expected) => point.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 1e-9, `${point} != ${expected}`))
  near(projectPoint({ lat: 0, lon: 0 }), [1, 0, 0])
  near(projectPoint({ lat: 90, lon: 0 }), [0, 1, 0])
  near(projectPoint({ lat: 0, lon: 90 }), [0, 0, -1])
  near(projectPoint({ lat: 0, lon: -90 }), [0, 0, 1])
})

test('manual coordinates including zero and poles win; automatic locations stay stable across reordering and edits', () => {
  assert.deepEqual(earthCoords({ id: 'a', earthAnchor: { lat: 0, lon: 0 } }, 12), { lat: 0, lon: 0 })
  assert.deepEqual(earthCoords({ id: 'a', earthAnchor: { lat: 90, lon: -180 } }), { lat: 90, lon: -180 })
  const base = earthCoords({ id: 'project-a', name: 'before', lifecycle: 'persistent' }, 0)
  assert.deepEqual(earthCoords({ id: 'project-a', name: 'after', lifecycle: 'temporary' }, 200), base)
  assert.deepEqual(earthCoords({ id: 'project-a', earthAnchor: { lat: 91, lon: 1 } }), base)
  assert.notDeepEqual(earthCoords({ id: 'project-b' }), base)
  assert.ok(base.lat >= -90 && base.lat <= 90 && base.lon >= -180 && base.lon <= 180)
})

test('markers use CSS dimensions rather than a high-DPI WebGL backing buffer', () => {
  assert.deepEqual(earthMarkerViewport({ clientWidth: 390, clientHeight: 640, width: 780, height: 1280 }), { width: 390, height: 640 })
  assert.deepEqual(earthMarkerViewport({ clientWidth: 390, clientHeight: 640, width: 390, height: 640 }), { width: 390, height: 640 })
  const camera = [4, 0, 0], projection = earthPerspective(34 * Math.PI / 180, 390 / 640, 0.05, 20)
  const screen = earthProjectPoint([1, 0, 0], earthLookAt(camera, [0, 0, 0]), projection, 390, 640)
  assert.ok(Math.abs(screen.x - 195) < 1e-9 && Math.abs(screen.y - 320) < 1e-9)
})

test('surface markers behind the true horizon are hidden, including at a close landing', () => {
  assert.equal(earthPointVisible([1, 0, 0], [1.72, 0, 0]), true)
  assert.equal(earthPointVisible([0.5, Math.sqrt(0.75), 0], [1.72, 0, 0]), false)
  assert.equal(earthPointVisible([-1, 0, 0], [4, 0, 0]), false)
})

test('screen picking resolves actual globe coordinates and rejects clicks in space', () => {
  const point = projectPoint({ lat: 25, lon: 115 })
  const eye = point.map((n) => n * 4)
  const view = earthLookAt(eye, [0, 0, 0])
  const projection = earthPerspective(34 * Math.PI / 180, 390 / 640, 0.05, 20)
  const rect = { left: 21, top: 38, width: 390, height: 640 }
  const picked = earthPickCoords(216, 358, rect, { eye, view, projection })
  assert.ok(Math.abs(picked.lat - 25) < 1e-8 && Math.abs(picked.lon - 115) < 1e-8)
  assert.equal(earthPickCoords(21, 38, rect, { eye, view, projection }), null)
  assert.equal(earthPickCoords(20, 358, rect, { eye, view, projection }), null)
  assert.equal(earthPickCoords(216, 358, rect, null), null)
  const other = projectPoint({ lat: 30, lon: 110 })
  const screen = earthProjectPoint(other, view, projection, rect.width, rect.height)
  const roundtrip = earthPickCoords(rect.left + screen.x, rect.top + screen.y, rect, { eye, view, projection })
  assert.ok(Math.abs(roundtrip.lat - 30) < 1e-8 && Math.abs(roundtrip.lon - 110) < 1e-8)
})

test('view and picking remain well-defined directly over both geographic poles', () => {
  for (const lat of [-90, 90]) {
    const eye = [0, lat > 0 ? 3 : -3, 0]
    const view = earthLookAt(eye, [0, 0, 0])
    assert.ok(view.every(Number.isFinite))
    assert.ok(Math.hypot(view[0], view[4], view[8]) > 0.99)
    const projection = earthPerspective(34 * Math.PI / 180, 1, 0.05, 20)
    const picked = earthPickCoords(200, 200, { left: 0, top: 0, width: 400, height: 400 }, { eye, view, projection })
    assert.ok(Math.abs(picked.lat - lat) < 1e-6)
  }
})
