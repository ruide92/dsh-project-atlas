import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

function load() {
  const state = []
  let cursor = 0
  const React = {
    createElement(type, props, ...children) { return { type, props: props || {}, children } },
    Fragment: Symbol('Fragment'),
    useState(initial) {
      const index = cursor++
      if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial
      return [state[index], (value) => { state[index] = typeof value === 'function' ? value(state[index]) : value }]
    },
    useEffect: () => {}, useMemo: (fn) => fn(), useRef: (value) => ({ current: value }), useCallback: (fn) => fn,
  }
  const window = { matchMedia: () => ({ matches: true }), __DSH_WORKBENCH_TEST__: {}, __ModuleLoader__: { load(spec) { spec.factory((name) => name === 'react' ? React : {}) } } }
  const sandbox = { window, console, Date, Map, Set, Number, String, Array, Object, JSON, Math, RegExp, Intl, URLSearchParams, setTimeout, clearTimeout }
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8'), sandbox, { filename: 'client.js' })
  return { scenes: window.__DSH_WORKBENCH_TEST__.scenes, render(props) { cursor = 0; return window.__DSH_WORKBENCH_TEST__.scenes.findScene('library').component(props) } }
}
const tr = (key) => key
const projects = (count) => Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `Book ${i}`, lifecycle: 'persistent', tags: [] }))
function descendants(node, result = []) {
  if (Array.isArray(node)) { node.forEach((child) => descendants(child, result)); return result }
  if (!node || typeof node !== 'object' || !('type' in node)) return result
  result.push(node)
  descendants(node.children, result)
  return result
}
const hasClass = (node, name) => String(node.props.className || '').split(/\s+/).includes(name)

function props(items, overrides = {}) {
  return { projects: items, activeId: '', query: '', shelf: 'all', tr, onActive: () => {}, onOpen: () => {}, onOpenPath: () => {}, onScene: () => {}, setQuery: () => {}, setShelf: () => {}, ...overrides }
}

test('empty, exact, partial and hundreds of books paginate without missing or duplicating projects', () => {
  const { scenes } = load()
  for (const size of [0, 1, 20, 21, 357]) {
    const items = projects(size)
    const all = []
    const pageCount = Math.max(1, Math.ceil(size / scenes.LIBRARY_PAGE_SIZE))
    for (let page = 0; page < pageCount; page++) {
      const result = scenes.libraryPage(items, page)
      assert.equal(result.count, pageCount)
      assert.equal(result.page, page)
      assert.ok(result.items.length <= scenes.LIBRARY_PAGE_SIZE)
      all.push(...result.items.map((item) => item.id))
    }
    assert.deepEqual(all, items.map((item) => item.id))
    assert.equal(scenes.libraryPage(items, 999).page, pageCount - 1)
    assert.equal(scenes.libraryPage(items, -3).page, 0)
  }
})

test('shelf pages have separate book hit targets and accessible previous/next controls', () => {
  const { scenes } = load()
  const items = projects(47)
  const calls = []
  const shelf = (page) => scenes.libraryShelf({ code: 'A', label: 'Shelf A', items, activeId: '', tr, x: 0, y: 0, width: 230, height: 184, rows: 2, page, onPage: (next) => calls.push(['page', next]), onSelect: (id) => calls.push(['select', id]), onOpen: (item) => calls.push(['open', item.id]) })
  const pageSize = scenes.LIBRARY_PAGE_SIZE
  const pageCount = Math.ceil(items.length / pageSize)
  for (let page = 0; page < pageCount; page++) {
    const nodes = descendants(shelf(page))
    const books = nodes.filter((node) => hasClass(node, 'wb-llib-book'))
    assert.equal(books.length, Math.min(pageSize, items.length - page * pageSize))
    for (const book of books) {
      const hit = descendants(book).find((node) => hasClass(node, 'wb-llib-book-hit'))
      const spine = descendants(book).find((node) => hasClass(node, 'wb-llib-spine'))
      assert.ok(hit.props.width > spine.props.width, 'book slots must not overlap')
      assert.equal(book.props.tabIndex, 0)
    }
    const buttons = nodes.filter((node) => hasClass(node, 'wb-llib-page-button'))
    assert.equal(buttons.length, 2)
    assert.ok(buttons.every((button) => button.props['aria-label'].includes('Shelf A')))
    assert.equal(buttons[0].props['aria-disabled'], page === 0)
    assert.equal(buttons[1].props['aria-disabled'], page === pageCount - 1)
    if (page === 0) buttons[1].props.onKeyDown({ key: 'Enter', preventDefault() {} })
    if (page === pageCount - 1) buttons[0].props.onKeyDown({ key: ' ', preventDefault() {} })
  }
  assert.deepEqual(calls, [['page', 1], ['page', pageCount - 2]])
  const book = descendants(shelf(pageCount - 1)).find((node) => hasClass(node, 'wb-llib-book'))
  book.props.onKeyDown({ key: ' ', preventDefault() {} })
  book.props.onKeyDown({ key: 'Enter', preventDefault() {} })
  assert.deepEqual(calls.slice(-2), [['select', 'p40'], ['open', 'p40']])
})

test('selecting an index entry locates its shelf page, including after a search', () => {
  const app = load()
  const items = projects(55)
  let activeId = ''
  const callbacks = { onActive: (id) => { activeId = id } }
  let tree = app.render(props(items, callbacks))
  const index = descendants(tree).find((node) => hasClass(node, 'wb-llib-project-index'))
  descendants(index).find((node) => node.type === 'button' && node.props.title === 'Book 45').props.onClick()
  tree = app.render(props(items, { ...callbacks, activeId }))
  const books = descendants(tree).filter((node) => hasClass(node, 'wb-llib-book'))
  assert.equal(books.length, 10)
  assert.ok(books.some((book) => book.props['aria-label'].startsWith('Book 45 ·')))
  tree = app.render(props(items, { ...callbacks, activeId, query: 'Book 45' }))
  const filteredBooks = descendants(tree).filter((node) => hasClass(node, 'wb-llib-book'))
  assert.equal(filteredBooks.length, 1)
  assert.ok(filteredBooks[0].props['aria-label'].startsWith('Book 45 ·'))
})

test('missing or unexpected lifecycle values remain available on the unclassified shelf', () => {
  const app = load()
  const items = [{ id: 'one', name: 'Unknown one' }, { id: 'two', name: 'Unknown two', lifecycle: 'other' }]
  const tree = app.render(props(items, { shelf: 'unclassified' }))
  assert.equal(descendants(tree).filter((node) => hasClass(node, 'wb-llib-book')).length, 2)
})

test('the scene exposes project books as named keyboard targets and opens the correct project with reduced motion', () => {
  const app = load()
  const items = projects(22)
  const calls = []
  const tree = app.render(props(items, { onActive: (id) => calls.push(['select', id]), onOpen: (item) => calls.push(['open', item.id]) }))
  const nodes = descendants(tree)
  const scene = nodes.find((node) => hasClass(node, 'wb-llib-svg'))
  const stage = nodes.find((node) => hasClass(node, 'wb-llib-stage'))
  assert.equal(stage.props.role, 'region')
  assert.equal(stage.props.tabIndex, 0)
  assert.equal(scene.props.role, 'group', 'the interactive descendants must not be flattened into an image')
  assert.equal(scene.props['aria-label'], 'sceneLibraryTitle · 22 projects')
  const book = nodes.find((node) => hasClass(node, 'wb-llib-book') && node.props['aria-label'].startsWith('Book 0 ·'))
  assert.equal(book.props.role, 'button')
  assert.equal(book.props.tabIndex, 0)
  assert.ok(descendants(book).some((node) => hasClass(node, 'wb-llib-spine-name')), 'book titles are visible inside the scene')
  book.props.onKeyDown({ key: ' ', preventDefault() {} })
  book.props.onKeyDown({ key: 'Enter', preventDefault() {} })
  assert.deepEqual(calls, [['select', 'p0'], ['open', 'p0']])
  assert.ok(nodes.some((node) => hasClass(node, 'wb-llib-project-index')), 'the text project index remains available')
  assert.equal(app.scenes.sceneBackLabel('library', false), 'sceneBackLibrary')
})

test('reading table uses the real selected project name and stays empty with no project', () => {
  const app = load()
  const items = projects(2)
  const selected = descendants(app.render(props(items, { activeId: 'p1' })))
  const title = selected.find((node) => hasClass(node, 'wb-llib-title-on-table'))
  assert.equal(title.props.title, 'Book 1')
  assert.equal(title.children[0], 'Book 1')
  const empty = descendants(app.render(props([])))
  assert.equal(empty.some((node) => hasClass(node, 'wb-llib-title-on-table')), false)
})
