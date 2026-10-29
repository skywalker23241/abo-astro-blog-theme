import type { APIRoute } from 'astro'
import { getStore } from '@netlify/blobs'
import { getInteractionHighlightIds } from './game-highlights'
import {
  anonymousVisitor,
  constantEqual,
  createHighlightInteractions,
  InteractionError,
  interactionHash
} from '@/lib/highlight-interactions'

export const prerender = false

const handle: APIRoute = async ({ request, url, cookies, clientAddress }) => {
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store', vary: 'Cookie' }
    })
  try {
    // Domain-separated signing key; never expose a password-verification oracle for the admin passcode.
    const signingMaterial = (
      process.env.HIGHLIGHT_INTERACTIONS_SECRET ||
      import.meta.env.HIGHLIGHT_INTERACTIONS_SECRET ||
      process.env.R2_SECRET_ACCESS_KEY ||
      import.meta.env.R2_SECRET_ACCESS_KEY ||
      ''
    ).trim()
    if (!signingMaterial) return json({ error: '互动暂时不可用，请稍后重试。' }, 503)
    const secret = interactionHash(signingMaterial, 'highlight-interactions:v1')
    if (request.method !== 'GET') {
      if (request.headers.get('origin') !== url.origin)
        return json({ error: '请求无效，请刷新后重试。' }, 403)
      if (!request.headers.get('content-type')?.startsWith('application/json'))
        return json({ error: '请求格式无效。' }, 415)
    }
    const visitor = anonymousVisitor(secret, cookies.get('highlight-visitor')?.value)
    cookies.set('highlight-visitor', visitor, {
      httpOnly: true,
      sameSite: 'lax',
      secure: url.protocol === 'https:',
      path: '/api/highlight-interactions',
      maxAge: 31536000
    })
    const interactions = createHighlightInteractions(
      getStore({ name: 'highlight-interactions', consistency: 'strong' }),
      secret
    )
    let body: Record<string, unknown> = {}
    if (request.method !== 'GET') {
      const raw = await request.text()
      if (raw.length > 8192) return json({ error: '内容过长。' }, 413)
      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        return json({ error: '请求格式无效。' }, 400)
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        return json({ error: '请求格式无效。' }, 400)
      body = parsed as Record<string, unknown>
    }
    const ids =
      request.method === 'GET'
        ? (url.searchParams.get('ids') || url.searchParams.get('id') || '').split(',')
        : [body.id]
    if (
      !ids.length ||
      ids.length > 24 ||
      ids.some((id) => typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(id))
    )
      return json({ error: '高光标识无效。' }, 400)
    const validIds = ids as string[]
    const known = await getInteractionHighlightIds()
    if (validIds.some((id) => !known.has(id))) return json({ error: '这条高光已不存在。' }, 404)
    const id = validIds[0]
    if (request.method === 'GET') {
      if (url.searchParams.has('id')) {
        const before = url.searchParams.get('before')
        if (before && !/^\d{8,12}-[a-f0-9]{64}$/.test(before))
          return json({ error: '分页标识无效。' }, 400)
        return json(await interactions.comments(id, before))
      }
      const stats = await Promise.all(
        validIds.map(async (id) => [id, await interactions.summary(id, visitor)])
      )
      return json({ stats: Object.fromEntries(stats) })
    }
    if (request.method === 'DELETE') {
      const adminPasscode = (
        process.env.PRIVATE_MEMO_ADMIN_PASSCODE ||
        import.meta.env.PRIVATE_MEMO_ADMIN_PASSCODE ||
        ''
      ).trim()
      if (
        !adminPasscode ||
        typeof body.passcode !== 'string' ||
        !constantEqual(body.passcode, adminPasscode)
      )
        return json({ error: '请先验证管理员身份。' }, 401)
      await interactions.remove(id, typeof body.commentId === 'string' ? body.commentId : '')
      return json({ removed: true, stats: await interactions.summary(id, visitor) })
    }
    // Use Astro's adapter-provided client address, never a caller-supplied forwarded header.
    if (body.action === 'like') return json(await interactions.like(id, visitor, clientAddress))
    if (body.action === 'comment') {
      const comment = await interactions.comment(id, visitor, clientAddress, body)
      return json({ comment, stats: await interactions.summary(id, visitor) }, 201)
    }
    return json({ error: '操作无效。' }, 400)
  } catch (error) {
    return error instanceof InteractionError
      ? json({ error: error.message }, error.status)
      : json({ error: '互动暂时不可用，请稍后重试。' }, 503)
  }
}

export const GET = handle
export const POST = handle
export const DELETE = handle
