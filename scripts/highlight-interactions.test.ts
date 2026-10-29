import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  anonymousVisitor,
  createHighlightInteractions,
  InteractionError,
  validateComment,
  type InteractionStore
} from '../src/lib/highlight-interactions'

function memoryStore(): InteractionStore & { records: Map<string, string> } {
  const records = new Map<string, string>()
  return {
    records,
    get: async (key) => records.get(key) ?? null,
    set: async (key, value) => {
      records.set(key, value)
    },
    delete: async (key) => {
      records.delete(key)
    },
    list: async ({ prefix }) => ({
      blobs: [...records.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key }))
    })
  }
}

test('anonymous cookies are stable and forged signatures are replaced', () => {
  const cookie = anonymousVisitor('test-secret')
  assert.equal(anonymousVisitor('test-secret', cookie), cookie)
  assert.notEqual(anonymousVisitor('test-secret', `${cookie.slice(0, 36)}.forged`), cookie)
})

test('storage failures propagate instead of displaying a false zero or losing data', async () => {
  const store = memoryStore()
  store.list = async () => {
    throw new Error('unavailable')
  }
  const service = createHighlightInteractions(store, 'test-secret')
  await assert.rejects(service.summary('one', anonymousVisitor('test-secret')), /unavailable/)
})

test('validates nickname, body length, control characters and honeypot', () => {
  assert.deepEqual(validateComment({ nickname: ' Abo ', content: ' 好操作 ', website: '' }), {
    nickname: 'Abo',
    content: '好操作'
  })
  for (const body of [
    { nickname: '', content: 'test', website: '' },
    { nickname: 'ab\nc', content: 'test', website: '' },
    { nickname: 'test', content: 'x'.repeat(1001), website: '' },
    { nickname: 'test', content: 'hello', website: 'bot.invalid' }
  ])
    assert.throws(() => validateComment(body), InteractionError)
})

test('concurrent distinct likes are retained, repeats do not increment and captures are isolated', async () => {
  const service = createHighlightInteractions(memoryStore(), 'test-secret')
  const visitors = Array.from({ length: 12 }, () => anonymousVisitor('test-secret'))
  await Promise.all(visitors.map((visitor, index) => service.like('one', visitor, `ip-${index}`)))
  assert.equal((await service.summary('one', visitors[0])).likes, 12)
  assert.equal((await service.like('one', visitors[0], 'ip-0')).likes, 12)
  assert.equal((await service.summary('two', visitors[0])).likes, 0)
})

test('comments preserve plain text, enforce cooldown and can be removed with a recovery copy', async () => {
  const store = memoryStore()
  const service = createHighlightInteractions(store, 'test-secret')
  const visitor = anonymousVisitor('test-secret')
  const text = {
    nickname: '<b>名字</b>',
    content: '<script>alert(1)</script>\n保留为纯文本',
    website: ''
  }
  const comment = await service.comment('one', visitor, 'ip-1', text)
  assert.equal((await service.comments('one', null)).comments[0].content, text.content)
  await assert.rejects(
    service.comment('two', visitor, 'ip-1', text),
    (error: unknown) => error instanceof InteractionError && error.status === 429
  )
  assert.equal((await service.comments('two', null)).comments.length, 0)
  await service.remove('one', comment.id)
  assert.equal((await service.summary('one', visitor)).comments, 0)
  assert.equal([...store.records.keys()].filter((key) => key.includes('/removed/')).length, 1)
  await assert.rejects(service.remove('one', '../invalid'), InteractionError)
})

test('comment pagination has no duplicates and a new signing secret does not orphan existing comments', async () => {
  const store = memoryStore()
  const service = createHighlightInteractions(store, 'test-secret')
  for (let i = 0; i < 23; i++) {
    await service.comment('one', anonymousVisitor('test-secret'), `ip-${i}`, {
      nickname: '访客',
      content: String(i),
      website: ''
    })
  }
  const first = await service.comments('one', null)
  const second = await service.comments('one', first.next)
  assert.equal(first.comments.length, 20)
  assert.equal(second.comments.length, 3)
  assert.equal(new Set([...first.comments, ...second.comments].map(({ id }) => id)).size, 23)
  const rotated = createHighlightInteractions(store, 'rotated-secret')
  assert.equal((await rotated.summary('one', anonymousVisitor('rotated-secret'))).comments, 23)
})
