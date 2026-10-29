import type { APIRoute } from 'astro'
import { getStore } from '@netlify/blobs'

export const prerender = false

const STORE_NAME = 'post-views'

function getViewsStore() {
  return getStore({ name: STORE_NAME, consistency: 'strong' })
}

function sanitizeSlug(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const slug = raw.trim()
  return /^[a-z0-9][a-z0-9-_/.]*$/i.test(slug) ? slug : null
}

function readCount(value: string | null) {
  if (value === null) return 0
  const count = Number.parseInt(value, 10)
  return Number.isFinite(count) && count >= 0 ? count : 0
}

function json(body: object, status = 200, cacheControl?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (cacheControl) headers['cache-control'] = cacheControl
  return new Response(JSON.stringify(body), { status, headers })
}

export const GET: APIRoute = async ({ url }) => {
  const slug = url.searchParams.get('slug')
  try {
    if (slug !== null) {
      const safeSlug = sanitizeSlug(slug)
      if (!safeSlug) return json({ error: 'invalid slug' }, 400)
      const count = readCount(await getViewsStore().get(safeSlug, { type: 'text' }))
      return json({ slug: safeSlug, count }, 200, 'public, max-age=60')
    }

    const views: Record<string, number> = {}
    for await (const page of getViewsStore().list({ paginate: true })) {
      await Promise.all(
        page.blobs.map(async (blob) => {
          views[blob.key] = readCount(await getViewsStore().get(blob.key, { type: 'text' }))
        })
      )
    }
    return json({ views }, 200, 'public, max-age=60')
  } catch {
    return json({ error: 'storage unavailable' }, 503)
  }
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

  try {
    const store = getViewsStore()
    const current = readCount(await store.get(slug, { type: 'text' }))
    // shortcut: read-modify-write may lose simultaneous increments; use an atomic counter if traffic grows.
    const next = current + 1
    await store.set(slug, String(next))
    return json({ slug, count: next }, 200)
  } catch {
    return json({ error: 'storage unavailable' }, 503)
  }
}
