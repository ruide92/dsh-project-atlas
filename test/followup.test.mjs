import assert from 'node:assert/strict'
import { normalizeFollowups, recordDiscovery, markFollowup, followupInfo, followupSummary } from '../followup.js'

const at = '2026-10-29T05:00:00.000Z'
const projects = [
  { id: 'p1', topLevel: true, noise: false },
  { id: 'p2', topLevel: true, noise: false },
]

// First scan is a baseline: existing projects are not labelled as new.
const baseline = recordDiscovery(null, projects, at, [])
assert.deepEqual(baseline.newIds, [])
assert.equal(baseline.scans[0].projectCount, 2)

// A later scan flags only the added project.
const scanned = recordDiscovery(baseline, [...projects, { id: 'p3', topLevel: true, noise: false }], '2026-10-30T05:00:00.000Z', ['p1', 'p2'])
assert.deepEqual(scanned.newIds, ['p3'])
assert.equal(scanned.scans[0].newIds.length, 1)
assert.equal(scanned.scans[0].removedIds.length, 0)

// New projects stay in the queue until explicitly handled.
const p3 = { id: 'p3', topLevel: true, noise: false }
assert.equal(followupInfo(scanned, p3).needsFollowup, true)
const rescanned = recordDiscovery(scanned, [...projects, p3], '2026-10-30T05:30:00.000Z', ['p1', 'p2', 'p3'])
assert.deepEqual(rescanned.newIds, ['p3'])
assert.deepEqual(rescanned.scans[0].newIds, [])
const handled = markFollowup(rescanned, 'p3', 'done', '2026-10-30T06:00:00.000Z')
const info = followupInfo(handled, p3)
assert.equal(info.needsFollowup, false)
assert.equal(info.followState, 'done')

// Hidden and noise projects never enter the follow-up queue.
assert.equal(followupInfo(scanned, { ...p3, hidden: true }).needsFollowup, false)
assert.equal(followupInfo(scanned, { ...p3, noise: true }).needsFollowup, false)

// Presence-only projects are not queued.
const present = [...projects.map((p) => ({ ...p, ...followupInfo(scanned, p) })), { ...p3, ...info }]
const summary = followupSummary(present, handled)
assert.equal(summary.pending, 0)
assert.equal(summary.newCount, 0)
assert.equal(summary.handled, 1)

// Reset returns the project to the queue.
const reset = markFollowup(handled, 'p3', 'new', '')
assert.equal(followupInfo(reset, p3).needsFollowup, true)

// Malformed state is ignored rather than crashing the host.
assert.equal(normalizeFollowups({ items: { p1: { state: 'bogus' } } }).items.p1, undefined)
assert.equal(normalizeFollowups('nope').scans.length, 0)

console.log('followup tests ok')
