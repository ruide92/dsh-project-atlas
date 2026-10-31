import test from 'node:test'
import assert from 'node:assert/strict'
import { sessionFileKeys } from '../index.js'

test('session folder names keep the live id and register the bare alias', () => {
  const id = '00000000-0000-4000-8000-000000000001'
  assert.deepEqual(sessionFileKeys(`session-${id}`), [`session-${id}`, id])
  assert.deepEqual(sessionFileKeys(id), [id, `session-${id}`])
  assert.deepEqual(sessionFileKeys(''), [])
})
