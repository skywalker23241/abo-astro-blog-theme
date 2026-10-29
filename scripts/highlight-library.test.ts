import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const source = ts.createSourceFile(
  'game-highlights.js',
  readFileSync('src/scripts/game-highlights.js', 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.JS
)

function controllerFunction(name: string, scope: Record<string, unknown>) {
  let code = ''
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) code = node.getText(source)
    ts.forEachChild(node, visit)
  }
  visit(source)
  assert.ok(code, `Missing controller function: ${name}`)
  return runInNewContext(`(${code})`, scope) as (...args: unknown[]) => unknown
}

function fixture() {
  const highlights = [
    { id: 'v1', game: 'valorant', title: '首杀', tags: ['步枪'] },
    { id: 'v2', game: 'valorant', title: '残局', tags: ['手枪'] },
    { id: 'd1', game: 'delta-force', title: '撤离', tags: ['步枪'] },
    { id: 'c1', game: 'cs2', title: '沙二残局', tags: ['AWP'] }
  ]
  const state = {
    highlights,
    gameFilter: 'all',
    tagFilter: 'all',
    searchQuery: '',
    visibleLimit: 12,
    loading: false,
    admin: false,
    playerHighlights: []
  }
  const elements = {
    folders: { hidden: false },
    folderHeading: { hidden: true },
    folderCounts: [
      { dataset: { folderCount: 'valorant' }, textContent: '' },
      { dataset: { folderCount: 'delta-force' }, textContent: '' },
      { dataset: { folderCount: 'cs2' }, textContent: '' }
    ],
    list: { hidden: false, innerHTML: '' },
    allEmpty: { hidden: true },
    filterEmpty: { hidden: true },
    loadMore: { hidden: true },
    filters: [],
    filterCounts: []
  }
  const profileMap = {
    valorant: { label: '无畏契约' },
    'delta-force': { label: '三角洲行动' },
    cs2: { label: 'CS2' }
  }
  const scope = {
    state,
    elements,
    profileMap,
    previewObserver: null,
    commentsList: null,
    getHighlightTags: (highlight: (typeof highlights)[number]) => highlight.tags,
    renderTags: () => {},
    renderLibraryStatus: () => {},
    renderStorageSummary: () => {},
    hydratePreviewVideos: () => {},
    paintInteractions: () => {},
    loadInteractionStats: () => {},
    renderCard: (highlight: (typeof highlights)[number]) => highlight.title,
    escapeHtml: (value: string) => value
  }
  const getFilteredHighlights = controllerFunction('getFilteredHighlights', scope)
  const render = controllerFunction('render', { ...scope, getFilteredHighlights })
  return { state, elements, render }
}

test('overview renders game folders without mounting video previews', () => {
  const { elements, render } = fixture()
  render()
  assert.equal(elements.folders.hidden, false)
  assert.equal(elements.list.hidden, true)
  assert.equal(elements.list.innerHTML, '')
  assert.deepEqual(
    elements.folderCounts.map((item) => item.textContent),
    ['2 段录像', '1 段录像', '1 段录像']
  )
  assert.equal(elements.loadMore.hidden, true)
})

test('folder, search and tag filters compose and keep playback order', () => {
  const { state, elements, render } = fixture()
  state.gameFilter = 'valorant'
  state.tagFilter = '步枪'
  state.searchQuery = '首'
  render()
  assert.equal(elements.folders.hidden, true)
  assert.equal(elements.folderHeading.hidden, false)
  assert.ok(elements.list.innerHTML.includes('首杀'))
  assert.ok(!elements.list.innerHTML.includes('撤离'))
  assert.equal(state.playerHighlights.length, 1)
})

test('CS2 folder composes with search and tag filters', () => {
  const { state, elements, render } = fixture()
  state.gameFilter = 'cs2'
  state.searchQuery = 'CS2'
  state.tagFilter = 'awp'
  render()
  assert.equal(elements.folders.hidden, true)
  assert.ok(elements.list.innerHTML.includes('沙二残局'))
  assert.ok(!elements.list.innerHTML.includes('撤离'))
  assert.equal(state.playerHighlights.length, 1)
})

test('search across games bypasses folders; clearing returns to overview', () => {
  const { state, elements, render } = fixture()
  state.searchQuery = '步枪'
  render()
  assert.equal(elements.list.hidden, false)
  assert.equal(state.playerHighlights.length, 2)
  state.searchQuery = ''
  render()
  assert.equal(elements.list.hidden, true)
  assert.equal(elements.folders.hidden, false)
})

test('an empty folder keeps a usable no-result state', () => {
  const { state, elements, render } = fixture()
  state.gameFilter = 'league-of-legends'
  render()
  assert.equal(elements.filterEmpty.hidden, false)
  assert.equal(elements.allEmpty.hidden, true)
  assert.equal(elements.folderHeading.hidden, false)
})

test('thumbnail cards reserve title and tags for playback but keep an accessible play label', () => {
  const escapeHtml = controllerFunction('escapeHtml', {})
  const renderCard = controllerFunction('renderCard', {
    state: { admin: false, durations: new Map() },
    escapeHtml,
    playIcon: () => '<svg aria-hidden="true"></svg>',
    renderPreviewMedia: () => '<video preload="none"></video>',
    formatDate: controllerFunction('formatDate', {})
  })
  const html = String(
    renderCard({
      id: 'v1',
      game: 'valorant',
      source: 'r2',
      title: '<残局>',
      tags: ['ACE'],
      date: '2026-09-22'
    })
  )
  assert.ok(html.includes('aria-label="播放 &lt;残局&gt;"'))
  assert.ok(!html.includes('<h3>'))
  assert.ok(!html.includes('game-video-tags'))
  assert.ok(html.includes('2026.09.22'))
  assert.ok(html.includes('<time class="capture-date"'))
  assert.ok(html.indexOf('capture-date') < html.indexOf('</button>'))
  assert.ok(!html.includes('capture-card-body'))
})

test('admin thumbnails edit directly and only external records retain a delete action', () => {
  const renderCard = controllerFunction('renderCard', {
    state: { admin: true, durations: new Map() },
    escapeHtml: controllerFunction('escapeHtml', {}),
    editIcon: () => '<svg aria-hidden="true"></svg>',
    trashIcon: () => '<svg aria-hidden="true"></svg>',
    renderPreviewMedia: () => '<video preload="none"></video>',
    formatDate: controllerFunction('formatDate', {})
  })
  const highlight = { id: 'v1', game: 'valorant', source: 'r2', title: '残局' }
  const html = String(renderCard(highlight))
  assert.ok(html.includes('data-edit-highlight="v1"'))
  assert.ok(html.includes('aria-label="编辑 残局"'))
  assert.ok(html.includes('capture-edit-indicator'))
  assert.ok(!html.includes('data-open-player'))
  assert.ok(!html.includes('capture-admin-actions'))
  const external = String(renderCard({ ...highlight, source: 'bilibili' }))
  assert.ok(external.includes('data-delete-highlight="v1"'))
  assert.ok(external.includes('删除外部录像'))
  assert.equal(external.match(/data-edit-highlight/g)?.length, 1)
})
