export const prerender = false

import type { APIContext } from 'astro'

// LinkCard only needs the target page's <head> metadata, so we keep this proxy
// deliberately narrow: HTML-ish documents, small, fast, and pointed at public
// hosts only. The checks below are an SSRF guard — without them anyone could
// use this Netlify function to reach internal services (cloud metadata, intranet
// hosts) or relay arbitrary traffic through our domain.
const MAX_BYTES = 512 * 1024 // 512KB — plenty for <head>, caps abuse/cost
const TIMEOUT_MS = 4000
const ALLOWED_CONTENT_TYPES = ['text/html', 'application/xhtml+xml', 'text/plain']

/**
 * Reject hostnames that resolve (or could resolve) to loopback / private /
 * link-local space when given as IP literals, plus obvious internal hostnames.
 * The Netlify runtime can't intercept DNS before fetch, so we block the literal
 * forms that cover the vast majority of SSRF vectors.
 */
function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '') // strip IPv6 brackets

  if (host === 'localhost' || host.endsWith('.localhost') || host === '0.0.0.0') {
    return true
  }

  // IPv4 literal
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const [a, b] = ipv4.slice(1).map(Number)
    if ([a, b, Number(ipv4[3]), Number(ipv4[4])].some((n) => n > 255)) return true
    if (a === 127 || a === 10 || a === 0) return true // loopback, private, this-host
    if (a === 172 && b >= 16 && b <= 31) return true // 172.16/12
    if (a === 192 && b === 168) return true // 192.168/16
    if (a === 169 && b === 254) return true // link-local (cloud metadata)
    if (a === 100 && b >= 64 && b <= 127) return true // CGNAT 100.64/10
    return false
  }

  // IPv6 literal
  if (host.includes(':')) {
    if (host === '::1' || host === '::') return true // loopback, unspecified
    if (host.startsWith('fc') || host.startsWith('fd')) return true // fc00::/7 ULA
    if (host.startsWith('fe8') || host.startsWith('fe9') || host.startsWith('fea') || host.startsWith('feb'))
      return true // fe80::/10 link-local
    // IPv4-mapped (::ffff:169.254.x.x etc.)
    const mapped = host.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
    if (mapped) return isBlockedHost(mapped[1])
    return false
  }

  return false
}

export async function GET(context: APIContext) {
  const host = context.request.headers.get('host') || 'localhost:4321'
  const url = new URL(context.request.url, `http://${host}`)
  const target = url.searchParams.get('url')

  if (!target) {
    return new Response('Missing url param', { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(target)
  } catch {
    return new Response('Invalid url', { status: 400 })
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return new Response('Unsupported scheme', { status: 400 })
  }

  if (isBlockedHost(parsed.hostname)) {
    return new Response('Forbidden host', { status: 403 })
  }

  try {
    const res = await fetch(parsed.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })

    const contentType = res.headers.get('content-type') || 'text/html'
    const baseType = contentType.split(';')[0].trim().toLowerCase()
    if (!ALLOWED_CONTENT_TYPES.includes(baseType)) {
      return new Response('Unsupported content type', { status: 415 })
    }

    const declaredLength = Number(res.headers.get('content-length') || '0')
    if (declaredLength > MAX_BYTES) {
      return new Response('Response too large', { status: 413 })
    }

    const data = await readCapped(res, MAX_BYTES)

    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=600',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error) {
    const status = error instanceof DOMException && error.name === 'TimeoutError' ? 504 : 500
    return new Response('Proxy error', { status })
  }
}

/**
 * Read a response body up to `limit` bytes, aborting the stream once exceeded so
 * a server lying about content-length can't blow past the cap.
 */
async function readCapped(res: Response, limit: number): Promise<string> {
  if (!res.body) {
    return (await res.text()).slice(0, limit)
  }

  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0

  while (received < limit) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      received += value.length
      chunks.push(value)
    }
  }
  await reader.cancel().catch(() => {})

  const merged = new Uint8Array(Math.min(received, limit))
  let offset = 0
  for (const chunk of chunks) {
    const remaining = merged.length - offset
    if (remaining <= 0) break
    merged.set(chunk.subarray(0, remaining), offset)
    offset += chunk.length
  }

  return new TextDecoder('utf-8').decode(merged)
}
