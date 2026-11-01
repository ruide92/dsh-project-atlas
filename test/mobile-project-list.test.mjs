import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

// Exercise the real table's localized labels and row actions without a host.
const source = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
const start = source.indexOf('    function ProjectTable(')
const end = source.indexOf('    function DeleteDialog(', start)
assert.ok(start >= 0 && end > start, 'project table must be present')
const h = (type, props, ...children) => ({ type, props: props || {}, children })
const ProjectTable = vm.runInNewContext(`(() => { ${source.slice(start, end)}; return ProjectTable })()`, {
  h, cx: (...values) => values.filter(Boolean).join(' '),
  StatusPill: () => null, sourceLabel: (id) => id,
  relTime: () => 'recent', fmtBytes: () => '0 B',
})

function rowFor(project, options = {}) {
  const selected = []
  const toggled = []
  const tree = ProjectTable({
    projects: [project], tr: (key) => key,
    onSelect: (item) => selected.push(item.id),
    selectionMode: false, selectedIds: new Set(), onToggle: (item) => toggled.push(item.id),
    ...options,
  })
  return { row: tree.children[0].children[1].children[0][0], selected, toggled }
}

test('project details retain localized labels and row navigation', () => {
  const { row, selected } = rowFor({ id: 'p', name: 'Example', status: 'active', sources: ['dsh'] })
  assert.deepEqual(Array.from(row.children.filter((cell) => cell?.props?.['data-label']), (cell) => cell.props['data-label']), ['status', 'sourcesLabel', 'lastActivity', 'size', 'path'])
  row.props.onClick()
  assert.deepEqual(selected, ['p'])
})

test('selection mode still uses the project checkbox without opening the row', () => {
  const { row, selected, toggled } = rowFor({ id: 'p', name: 'Example', topLevel: true, status: 'archived', sources: [] }, { selectionMode: true })
  const checkbox = row.children[0].children[0]
  assert.equal(checkbox.props.checked, false)
  assert.equal(checkbox.props.disabled, false)
  checkbox.props.onChange()
  assert.deepEqual(toggled, ['p'])
  assert.deepEqual(selected, [])
})
