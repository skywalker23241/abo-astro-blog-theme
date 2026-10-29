import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { gameProfiles } from '../src/data/game-highlights'
import { getDefaultVideoTitle } from '../src/lib/game-highlight-title'

const source = ts.createSourceFile(
  'game-highlights.ts',
  readFileSync('src/pages/api/game-highlights.ts', 'utf8'),
  ts.ScriptTarget.Latest,
  true
)
const declarations: string[] = []
const names = new Set(['requestR2', 'writeHighlightMetadata', 'R2RequestError'])
function visit(node: ts.Node) {
  if (
    (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
    node.name &&
    names.has(node.name.text)
  )
    declarations.push(node.getText(source))
  ts.forEachChild(node, visit)
}
visit(source)
assert.equal(declarations.length, names.size)
const code = ts.transpileModule(declarations.join('\n'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 }
}).outputText

test('CS2 objects are discovered without changing existing game prefixes', () => {
  const prefixDeclaration = source.statements.find(
    (node) =>
      ts.isVariableStatement(node) && node.getText(source).includes('const R2_GAME_PREFIXES:')
  )
  const classifier = source.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'getGameFromObjectKey'
  )
  assert.ok(prefixDeclaration && classifier)
  const classify = runInNewContext(
    ts.transpileModule(`${prefixDeclaration.getText(source)}\n${classifier.getText(source)}`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022 }
    }).outputText + '\ngetGameFromObjectKey'
  ) as (key: string) => string | null
  for (const [prefix, game] of [
    ['val', 'valorant'],
    ['df', 'delta-force'],
    ['lol', 'league-of-legends'],
    ['cs2', 'cs2']
  ]) {
    assert.equal(classify(`${prefix}/clip.mp4`), game)
  }
  assert.equal(classify('cs2/'), null)
  assert.equal(classify('cs2-other/clip.mp4'), null)
  assert.ok(gameProfiles.some((game) => game.id === 'cs2'))
  assert.equal(getDefaultVideoTitle('cs2/cs2-dust2-awp-4k.mp4', 'cs2'), 'CS2 - DUST2 - Awp - 4 杀')
})

type Conditions = { ifMatch?: string; ifNoneMatch?: string }
type MetadataState = { exists: boolean; etag?: string }

function fixture() {
  const requests: { method: string; headers: Record<string, string>; body?: string }[] = []
  const objectEtag = '"original-object-etag"'
  const api = runInNewContext(`${code}\n({ requestR2, writeHighlightMetadata })`, {
    getSignedRequest: (
      _config: object,
      _method: string,
      _body: string,
      _key: string,
      _query: object,
      conditions: Conditions
    ) => ({
      url: new URL('https://storage.example.test/bucket/index.json'),
      headers: {
        ...(conditions.ifMatch ? { 'if-match': conditions.ifMatch } : {}),
        ...(conditions.ifNoneMatch ? { 'if-none-match': conditions.ifNoneMatch } : {})
      }
    }),
    fetchR2: async (
      _url: URL,
      request: { method: string; headers: Record<string, string>; body?: string }
    ) => {
      requests.push(request)
      if (request.method === 'GET') {
        return new Response('[]', {
          headers: {
            etag: request.headers['accept-encoding'] === 'identity' ? objectEtag : `W/${objectEtag}`
          }
        })
      }
      if (request.headers['if-match'] !== objectEtag && request.headers['if-none-match'] !== '*')
        return new Response('PreconditionFailed', { status: 412 })
      return new Response('', { status: 200 })
    }
  }) as {
    requestR2: (config: object, method: string) => Promise<{ etag: string; body: string }>
    writeHighlightMetadata: (
      config: object,
      highlights: unknown[],
      state: MetadataState
    ) => Promise<void>
  }
  return { api, requests, objectEtag, config: { objectKey: 'index.json' } }
}

test('metadata reads request identity encoding and preserve a strong ETag for updates', async () => {
  const { api, requests, objectEtag, config } = fixture()
  const metadata = await api.requestR2(config, 'GET')
  assert.equal(metadata.etag, objectEtag)
  assert.equal(requests[0].headers['accept-encoding'], 'identity')
  await api.writeHighlightMetadata(config, [], { exists: true, etag: metadata.etag })
  assert.equal(requests[1].headers['if-match'], objectEtag)
  assert.equal(requests[1].body, '[]')
})

test('real revision conflicts remain rejected rather than overwriting the index', async () => {
  const { api, config } = fixture()
  await assert.rejects(
    api.writeHighlightMetadata(config, [], { exists: true, etag: '"stale-revision"' }),
    (error: unknown) =>
      typeof error === 'object' && error !== null && 'status' in error && error.status === 412
  )
})

test('new metadata retains create-only conditional writes', async () => {
  const { api, requests, config } = fixture()
  await api.writeHighlightMetadata(config, [], { exists: false })
  assert.equal(requests[0].headers['if-none-match'], '*')
  assert.equal(requests[0].headers['if-match'], undefined)
})
