// Run: node --test scripts/check-para-notes.mjs. All storage and network calls stay in memory.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import { getStore } from '@netlify/blobs'

function moduleUrl(source) {
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
  })
  return 'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
}

const categories = moduleUrl(readFileSync('src/data/para-categories.ts', 'utf8'))
const source = readFileSync('src/pages/api/para-notes.ts', 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(
    /function getAdminPasscode\(\) \{[\s\S]*?\n\}/,
    "function getAdminPasscode() { return 'test-only' }"
  )

function apiModule(dev = false) {
  return import(
    moduleUrl(
      `import { isParaCategory, normalizeParaCategory } from '${categories}';
       const getStore = options => globalThis.__notesTestStore(options);
       const themeConfig = { site: { website: 'https://example.test' } };
       ${source.replaceAll('import.meta.env.DEV', String(dev))}`
    )
  )
}

const note = (id) => ({
  id,
  title: id,
  content: 'original',
  category: 'resources',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
})

test('API preserves edits, rejects conflicts and fails closed on storage errors', async () => {
  const entries = new Map()
  let counter = 0
  let unavailable = false
  let writes = 0
  const store = {
    async getWithMetadata(key) {
      if (unavailable) throw new Error('simulated outage')
      const entry = entries.get(key)
      return entry ? { ...entry } : null
    },
    async get(key) {
      return entries.get(key)?.data ?? null
    },
    async set(key, data, options) {
      writes++
      const previous = entries.get(key)
      assert.ok(options.onlyIfNew || options.onlyIfMatch)
      if (options.onlyIfNew ? previous : previous?.etag !== options.onlyIfMatch) {
        return { modified: false }
      }
      const etag = `revision-${++counter}`
      entries.set(key, { data, etag })
      return { modified: true, etag }
    }
  }
  globalThis.__notesTestStore = (options) => {
    assert.equal(options.consistency, 'strong')
    return store
  }
  const api = await apiModule()
  const send = (method, payload) =>
    api[method]({
      request: new Request('https://example.test/api/para-notes', {
        method,
        body: JSON.stringify({ passcode: 'test-only', ...payload })
      })
    })
  const read = async () => (await api.GET()).json()
  const edit = (id, revision) =>
    send('PUT', { id, revision, title: id + ' edited', content: 'changed' })
  const seed = () =>
    entries.set('notes', { data: JSON.stringify([note('a'), note('b')]), etag: 'seed' })
  try {
    seed()
    const first = await edit('a', 'seed')
    assert.equal(first.status, 200)
    const { revision } = await first.json()
    assert.equal((await edit('b', revision)).status, 200)
    assert.equal((await read()).notes.find((item) => item.id === 'a').title, 'a edited')
    assert.equal((await edit('a', 'seed')).status, 409)
    assert.equal((await edit('a', undefined)).status, 409)

    seed()
    const concurrent = await Promise.all([edit('a', 'seed'), edit('b', 'seed')])
    assert.deepEqual(concurrent.map((result) => result.status).sort(), [200, 409])
    assert.equal((await read()).notes.filter((item) => item.title.endsWith('edited')).length, 1)
    assert.equal((await send('DELETE', { id: 'a', revision: 'seed' })).status, 409)

    const latest = await read()
    assert.equal((await send('DELETE', { id: 'b', revision: latest.revision })).status, 200)
    assert.equal((await read()).notes.length, 1)
    const created = await send('POST', {
      title: 'new',
      content: 'new',
      revision: (await read()).revision
    })
    assert.equal(created.status, 201)
    assert.equal((await read()).notes.length, 2)

    unavailable = true
    assert.equal((await api.GET()).status, 503)
    unavailable = false
    for (const data of ['invalid JSON', '{}', '[{}]']) {
      entries.set('notes', { data, etag: 'broken' })
      const before = writes
      assert.equal((await api.GET()).status, 503)
      assert.equal((await edit('a', 'broken')).status, 503)
      assert.equal(writes, before)
    }
    entries.clear()
    const initial = await read()
    assert.equal(initial.revision, 'new')
    const payload = { title: 'first', content: 'first', revision: 'new' }
    const initialWrites = await Promise.all([send('POST', payload), send('POST', payload)])
    assert.deepEqual(initialWrites.map((result) => result.status).sort(), [201, 409])
    assert.equal((await read()).notes.length, 1)
    assert.equal((await api.GET()).headers.get('cache-control'), 'no-store')
    assert.equal((await send('POST', { dryRun: true })).status, 200)
    assert.equal((await send('PUT', { passcode: 'wrong' })).status, 401)
  } finally {
    delete globalThis.__notesTestStore
  }
})

test('client keeps the list and draft on failure, and ignores late loads', async () => {
  const client = readFileSync('src/scripts/para-notes.js', 'utf8')
  const functions = client.slice(
    client.indexOf('    async function loadNotes()'),
    client.indexOf('    var onSearchToggleClick')
  )
  const submit = client.slice(
    client.indexOf('    var onFormSubmit ='),
    client.indexOf('    var onCancelEditClick')
  )
  class Input {
    value = 'draft'
  }
  const state = {
    notes: [note('a')],
    revision: 'old',
    editingRevision: 'old',
    editingId: 'a',
    authenticated: true,
    loaded: true,
    loadFailed: false,
    busy: false
  }
  let reset = false
  let message = ''
  const context = vm.createContext({
    state,
    dataGeneration: 0,
    Error,
    HTMLInputElement: Input,
    HTMLTextAreaElement: Input,
    elements: { title: new Input(), content: new Input(), category: { value: 'resources' } },
    getPasscode: () => 'test-only',
    setBusy: (value) => {
      state.busy = value
    },
    applySearch() {},
    resetForm() {
      reset = true
    },
    setStatus: (value) => {
      message = value
    }
  })
  vm.runInContext(functions + submit, context)
  context.fetch = async () => new Response('{"error":"unavailable"}', { status: 503 })
  await context.loadNotes()
  assert.equal(state.notes[0].id, 'a')
  assert.equal(state.loadFailed, true)
  state.loadFailed = false
  let calls = 0
  context.fetch = async () =>
    ++calls === 1
      ? new Response('{}', { status: 409 })
      : Response.json({ notes: [note('updated')], revision: 'new' })
  await context.onFormSubmit({ preventDefault() {} })
  assert.equal(reset, false)
  assert.equal(context.elements.content.value, 'draft')
  assert.equal(state.revision, 'new')
  assert.equal(state.editingRevision, 'old')
  assert.ok(message.includes('复制当前草稿'))

  let resolveLoad
  context.fetch = () =>
    new Promise((resolve) => {
      resolveLoad = resolve
    })
  const loading = context.loadNotes()
  context.fetch = async () => Response.json({ notes: [note('saved')], revision: 'saved' })
  await context.request('POST', {})
  resolveLoad(Response.json({ notes: [note('stale')], revision: 'stale' }))
  await loading
  assert.equal(state.notes[0].id, 'saved')
})

test('preview keeps an empty local copy and does not replace newer online content', async () => {
  const originalFetch = globalThis.fetch
  let preview = null
  const online = { ...note('a'), title: 'online latest', updatedAt: '2026-10-01T00:00:00Z' }
  globalThis.__notesTestStore = () => ({
    getWithMetadata: async () => preview,
    get: async () => JSON.stringify([note('a')])
  })
  globalThis.fetch = async () => Response.json({ notes: [online] })
  try {
    const api = await apiModule(true)
    const response = await api.GET()
    assert.equal(response.status, 200)
    assert.equal((await response.json()).notes[0].title, 'online latest')
    preview = { data: '[]', etag: 'empty' }
    globalThis.fetch = () => {
      throw new Error('must not fetch online after local initialization')
    }
    assert.deepEqual(await (await api.GET()).json(), { notes: [], revision: 'empty' })
  } finally {
    globalThis.fetch = originalFetch
    delete globalThis.__notesTestStore
  }
})

test('installed SDK sends atomic write conditions and reports rejected writes', async () => {
  const requests = []
  let reject = false
  const store = getStore({
    name: 'test-notes',
    siteID: 'test-site',
    token: 'test-only',
    consistency: 'strong',
    edgeURL: 'https://example.test',
    uncachedEdgeURL: 'https://example.test',
    fetch: async (url, options) => {
      requests.push(new Headers(options.headers))
      return new Response('', { status: reject ? 412 : 200, headers: { etag: 'written' } })
    }
  })
  assert.equal((await store.set('notes', '[]', { onlyIfNew: true })).modified, true)
  assert.equal(requests.at(-1).get('if-none-match'), '*')
  assert.equal((await store.set('notes', '[]', { onlyIfMatch: 'old' })).etag, 'written')
  assert.equal(requests.at(-1).get('if-match'), 'old')
  reject = true
  assert.equal((await store.set('notes', '[]', { onlyIfMatch: 'stale' })).modified, false)
})
