import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(here, '..', 'client.js'), 'utf8')
const start = source.indexOf('    function earthFlightEye')
const end = source.indexOf('\n    function earthApproachCamera', start)
assert.ok(start >= 0 && end > start, 'earthFlightEye must exist in client.js')
const fn = new Function(source.slice(start, end).replace(/^    /gm, '') + '\nreturn earthFlightEye')
const earthFlightEye = fn()

const radius = (point) => Math.hypot(...point)

test('flight path never cuts through the planet for an antipodal camera move', () => {
  const from = [0, 0, 1.72]
  const to = [0, 0, -1.72]
  for (let step = 0; step <= 100; step += 1) {
    const point = earthFlightEye(from, to, step / 100)
    assert.ok(radius(point) >= 1.04, `step ${step} radius ${radius(point)}`)
  }
  assert.ok(radius(earthFlightEye(from, to, 0.5)) > 1.2)
})

test('near-antipodal camera move also stays outside the planet', () => {
  const from = [0.02, 0, 1.72]
  const to = [-0.02, 0, -1.72]
  for (let step = 0; step <= 100; step += 1) {
    const point = earthFlightEye(from, to, step / 100)
    assert.ok(radius(point) >= 1.04, `step ${step} radius ${radius(point)}`)
  }
})

test('visible targets keep the direct satellite line when it is safe', () => {
  const from = [0, 0, 4.8]
  const to = [0.3, 0.2, 1.66]
  const midpoint = earthFlightEye(from, to, 0.5)
  assert.ok(radius(midpoint) > 2.5)
})

test('night terrain assistance fades in only as the camera approaches the surface', () => {
  const start = source.indexOf('    function earthTerrainAssist')
  const end = source.indexOf('\n    function earthCompile', start)
  assert.ok(start >= 0 && end > start)
  const assist = new Function(source.slice(start, end) + '\nreturn earthTerrainAssist')()
  assert.equal(assist([0, 0, 4.8]), 0)
  assert.equal(assist([0, 0, 3]), 0)
  const middle = assist([0, 0, 2.36])
  const landed = assist([0, 0, 1.72])
  assert.ok(middle > 0 && middle < landed)
  assert.ok(landed > 0.5 && landed < 1, 'night remains distinct from day')
  assert.equal(assist([1.72, 0, 0]), landed, 'effect depends on distance rather than direction')
  assert.equal(assist([0, 0, 1.01]), landed, 'effect is bounded close to the surface')
})

test('a representative image selects only its own folder, including legacy path-only overrides', () => {
  const start = source.indexOf('    function mediaMatchesRepresentative')
  const end = source.indexOf('\n    function ProjectMediaPicker', start)
  assert.ok(start >= 0 && end > start)
  const matches = new Function(source.slice(start, end).replace(/^    /gm, '') + '\nreturn mediaMatchesRepresentative')()
  const first = { path: 'output/cover.png', folder: 0 }
  const second = { path: 'output/cover.png', folder: 1 }
  assert.equal(matches({ path: first.path, folder: 1 }, first, second), false)
  assert.equal(matches({ path: first.path, folder: 1 }, second, second), true)
  for (const folder of [-1, undefined]) {
    assert.equal(matches({ path: first.path, folder }, first, first), true)
    assert.equal(matches({ path: first.path, folder }, second, first), false)
  }
  assert.equal(matches({ path: first.path, folder: -1 }, first, null), false)
})
