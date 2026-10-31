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
