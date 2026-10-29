import type { APIRoute } from 'astro'
import { getStore } from '@netlify/blobs'

export const prerender = false

const STORE_NAME = 'site-stats'
const VISITORS_KEY = 'visitors'

function getStatsStore() {
  return getStore({ name: STORE_NAME, consistency: 'strong' })
}

// Returns 0 when the key is missing, null when storage itself failed —
// a failed read must never be written back as a reset count.
async function readVisitors(): Promise<number | null> {
  try {
    const value = await getStatsStore().get(VISITORS_KEY, { type: 'text' })
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

export const GET: APIRoute = async () => {
  const visitors = await readVisitors()
  if (visitors === null) return json({ error: 'storage unavailable' }, 503)
  return json({ visitors }, 200, 'public, max-age=60')
}

export const POST: APIRoute = async () => {
  const current = await readVisitors()
  if (current === null) return json({ error: 'storage unavailable' }, 503)
  try {
    const next = current + 1
    await getStatsStore().set(VISITORS_KEY, String(next))
    return json({ visitors: next }, 200)
  } catch {
    return json({ error: 'storage unavailable' }, 503)
  }
}
