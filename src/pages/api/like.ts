import type { APIRoute } from 'astro'
import { getStore } from '@netlify/blobs'

export const prerender = false

const STORE_NAME = 'post-likes'

function sanitizeSlug(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed || trimmed.length > 200) return null
  if (!/^[a-z0-9][a-z0-9-_/.]*$/i.test(trimmed)) return null
  return trimmed
}

async function readCount(slug: string): Promise<number> {
  try {
    const store = getStore(STORE_NAME)
    const value = await store.get(slug)
    if (!value) return 0
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
  } catch {
    return 0
  }
}

async function writeCount(slug: string, count: number): Promise<void> {
  const store = getStore(STORE_NAME)
  await store.set(slug, String(count))
}

export const GET: APIRoute = async ({ url }) => {
  const slug = sanitizeSlug(url.searchParams.get('slug'))
  if (!slug) {
    return new Response(JSON.stringify({ error: 'invalid slug' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    })
  }
  const count = await readCount(slug)
  return new Response(JSON.stringify({ slug, count }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=10'
    }
  })
}

export const POST: APIRoute = async ({ request }) => {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid body' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    })
  }

  const slug = sanitizeSlug((payload as { slug?: unknown })?.slug)
  if (!slug) {
    return new Response(JSON.stringify({ error: 'invalid slug' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    })
  }

  try {
    const current = await readCount(slug)
    const next = current + 1
    await writeCount(slug, next)
    return new Response(JSON.stringify({ slug, count: next }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  } catch {
    return new Response(JSON.stringify({ error: 'storage unavailable' }), {
      status: 503,
      headers: { 'content-type': 'application/json' }
    })
  }
}
