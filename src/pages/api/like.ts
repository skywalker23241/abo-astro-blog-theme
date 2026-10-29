import type { APIRoute } from 'astro'
import { getStore } from '@netlify/blobs'

export const prerender = false

const STORE_NAME = 'post-likes'

function getLikesStore() {
  return getStore({ name: STORE_NAME, consistency: 'strong' })
}

function sanitizeSlug(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed || trimmed.length > 200) return null
  if (!/^[a-z0-9][a-z0-9-_/.]*$/i.test(trimmed)) return null
  return trimmed
}

// Returns 0 when the key is missing, null when storage itself failed —
// a failed read must never be written back as a reset count.
async function readCount(slug: string): Promise<number | null> {
  try {
    const value = await getLikesStore().get(slug, { type: 'text' })
    if (value === null) return 0
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
  } catch {
    return null
  }
}

function json(body: object, status: number, cacheControl?: string): Response {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (cacheControl) headers['cache-control'] = cacheControl
  return new Response(JSON.stringify(body), { status, headers })
}

export const GET: APIRoute = async ({ url }) => {
  const slug = sanitizeSlug(url.searchParams.get('slug'))
  if (!slug) return json({ error: 'invalid slug' }, 400)

  const count = await readCount(slug)
  if (count === null) return json({ error: 'storage unavailable' }, 503)
  return json({ slug, count }, 200, 'public, max-age=10')
}

export const POST: APIRoute = async ({ request }) => {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return json({ error: 'invalid body' }, 400)
  }

  const slug = sanitizeSlug((payload as { slug?: unknown })?.slug)
  if (!slug) return json({ error: 'invalid slug' }, 400)

  const current = await readCount(slug)
  if (current === null) return json({ error: 'storage unavailable' }, 503)

  try {
    const next = current + 1
    await getLikesStore().set(slug, String(next))
    return json({ slug, count: next }, 200)
  } catch {
    return json({ error: 'storage unavailable' }, 503)
  }
}
