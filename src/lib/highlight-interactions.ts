import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

export interface InteractionStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<unknown>
  delete(key: string): Promise<unknown>
  list(options: { prefix: string }): Promise<{ blobs: Array<{ key: string }> }>
}

export interface HighlightComment {
  id: string
  nickname: string
  content: string
  createdAt: string
}

export class InteractionError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
  }
}

export function constantEqual(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(Uint8Array.from(a), Uint8Array.from(b))
}

export function interactionHash(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex')
}

export function anonymousVisitor(secret: string, cookie?: string): string {
  if (cookie) {
    const [id, signature] = cookie.split('.')
    if (/^[a-f0-9-]{36}$/.test(id) && constantEqual(signature || '', interactionHash(secret, id)))
      return cookie
  }
  const id = randomUUID()
  return `${id}.${interactionHash(secret, id)}`
}

export function validateComment(body: Record<string, unknown>) {
  const nickname = typeof body.nickname === 'string' ? body.nickname.trim() : ''
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (body.website !== '') throw new InteractionError(400, '无法提交，请刷新后重试。')
  // eslint-disable-next-line no-control-regex -- Reject control characters in anonymous submissions.
  if (!nickname || nickname.length > 24 || /[\r\n\u0000-\u001f]/.test(nickname))
    throw new InteractionError(400, '请填写 1–24 字的昵称。')
  // eslint-disable-next-line no-control-regex -- Allow line breaks but reject other control characters.
  if (!content || content.length > 1000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(content))
    throw new InteractionError(400, '请填写 1–1000 字的评论。')
  return { nickname, content }
}

export function createHighlightInteractions(store: InteractionStore, secret: string) {
  const prefix = (id: string) => `captures/${createHash('sha256').update(id).digest('hex')}/`
  const visitorKey = (visitor: string) =>
    interactionHash(secret, `visitor:${visitor.split('.')[0]}`)
  const list = async (path: string) =>
    (await store.list({ prefix: path })).blobs.map(({ key }) => key)

  async function summary(id: string, visitor: string) {
    const [likes, comments] = await Promise.all([
      list(`${prefix(id)}likes/`),
      list(`${prefix(id)}comments/`)
    ])
    return {
      likes: likes.length,
      comments: comments.length,
      liked: likes.includes(`${prefix(id)}likes/${visitorKey(visitor)}`)
    }
  }

  async function limit(ip: string, action: string, seconds: number) {
    const key = `limits/${interactionHash(secret, `${action}:${ip}`)}`
    const raw = await store.get(key)
    if (raw && Date.now() - Number(raw) < seconds * 1000)
      throw new InteractionError(429, `操作有点频繁，请 ${seconds} 秒后再试。`)
    // shortcut: Blobs has no atomic lock; this cooldown deters ordinary repeat posts, not coordinated bots.
    await store.set(key, String(Date.now()))
  }

  return {
    summary,
    async like(id: string, visitor: string, ip: string) {
      const key = `${prefix(id)}likes/${visitorKey(visitor)}`
      if (!(await store.get(key))) {
        await limit(ip, 'like', 2)
        // One record per visitor avoids losing other visitors' likes during concurrent writes.
        await store.set(key, '1')
      }
      return summary(id, visitor)
    },
    async comments(id: string, before: string | null) {
      const path = `${prefix(id)}comments/`
      const keys = (await list(path)).sort().reverse()
      const page = keys.filter((key) => !before || key.slice(path.length) < before).slice(0, 21)
      const comments = await Promise.all(
        page.slice(0, 20).map(async (key) => {
          const raw = await store.get(key)
          return raw ? (JSON.parse(raw) as HighlightComment) : null
        })
      )
      return {
        comments: comments.filter((comment) => comment !== null),
        next: page.length > 20 ? page[19].slice(path.length) : null
      }
    },
    async comment(id: string, visitor: string, ip: string, body: Record<string, unknown>) {
      const text = validateComment(body)
      await limit(ip, 'comment', 60)
      // Concurrent submissions by this browser in the same minute share one record.
      const minute = Math.floor(Date.now() / 60000)
      const commentId = `${minute}-${visitorKey(visitor)}`
      const key = `${prefix(id)}comments/${commentId}`
      if (await store.get(key)) throw new InteractionError(429, '请稍后再发表评论。')
      const comment: HighlightComment = {
        id: commentId,
        ...text,
        createdAt: new Date().toISOString()
      }
      await store.set(key, JSON.stringify(comment))
      return comment
    },
    async remove(id: string, commentId: string) {
      if (!/^\d{8,12}-[a-f0-9]{64}$/.test(commentId))
        throw new InteractionError(400, '评论标识无效。')
      const key = `${prefix(id)}comments/${commentId}`
      const raw = await store.get(key)
      if (!raw) throw new InteractionError(404, '评论已不存在。')
      await store.set(`${prefix(id)}removed/${commentId}`, raw)
      await store.delete(key)
    }
  }
}
