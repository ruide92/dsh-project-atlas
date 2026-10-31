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
