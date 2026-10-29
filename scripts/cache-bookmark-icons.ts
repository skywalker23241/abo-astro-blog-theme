/** Run manually: pnpm cache-bookmark-icons (uses only public site origins).
 * Add --refresh to update existing icons; downloads never run during builds.
 * Successful icons are rasterized locally; failed refreshes retain the previous cache.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { parse } from 'node-html-parser'
import sharp from 'sharp'
import links from '../src/data/links.json'

const manifestPath = 'src/data/bookmark-icons.json'
const assetDir = 'public/bookmark-icons'
const maxBytes = 2 * 1024 * 1024

function iconCandidates(html: string, pageUrl: string): string[] {
  const root = parse(html)
  const baseHref = root.querySelector('base[href]')?.getAttribute('href')
  const base = new URL(baseHref || pageUrl, pageUrl)
  const candidates = root
    .querySelectorAll('link[href]')
    .filter((link) =>
      (link.getAttribute('rel') || '')
        .toLowerCase()
        .split(/\s+/)
        .some((rel) => ['icon', 'apple-touch-icon'].includes(rel))
    )
    .flatMap((link) => {
      try {
        const url = new URL(link.getAttribute('href')!, base)
        return url.protocol === 'https:' ? [url.href] : []
      } catch {
        return []
      }
    })
  return [...new Set([...candidates, new URL('/favicon.ico', pageUrl).href])]
}

async function download(url: string): Promise<{ data: Buffer; url: string; type: string }> {
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!response.ok || !response.body) throw new Error('Unavailable')
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of response.body) {
    size += chunk.length
    if (size > maxBytes) {
      throw new Error('Too large')
    }
    chunks.push(chunk)
  }
  return {
    data: Buffer.concat(chunks),
    url: response.url,
    type: response.headers.get('content-type') || ''
  }
}

async function rasterize(url: string): Promise<Buffer> {
  const { data, type } = await download(url)
  if (type.includes('text/html')) throw new Error('Not an image')
  let input = data
  // ICO containers may contain a PNG that sharp can decode directly.
  if (data.length >= 6 && data.readUInt32LE(0) === 0x00010000) {
    const count = data.readUInt16LE(4)
    for (let i = 0; i < count && 6 + (i + 1) * 16 <= data.length; i++) {
      const offset = data.readUInt32LE(6 + i * 16 + 12)
      const length = data.readUInt32LE(6 + i * 16 + 8)
      if (
        offset + length <= data.length &&
        data.subarray(offset, offset + 8).toString('hex') === '89504e470d0a1a0a'
      ) {
        input = data.subarray(offset, offset + length)
        break
      }
    }
  }
  return sharp(input, { limitInputPixels: 4 * 1024 * 1024 })
    .resize(40, 40, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer()
}

if (process.argv.includes('--test')) {
  assert.deepEqual(
    iconCandidates(
      `<link rel="canonical" href="/wrong"><link rel="shortcut icon" href="/logo.svg"><link rel="icon" href="javascript:bad"><link rel="apple-touch-icon" href="https://cdn.example/icon.png">`,
      'https://example.com/path'
    ),
    [
      'https://example.com/logo.svg',
      'https://cdn.example/icon.png',
      'https://example.com/favicon.ico'
    ]
  )
  assert.deepEqual(
    iconCandidates(
      '<base href="/assets/"><link rel="ICON" href="icon.png">',
      'https://example.com/'
    ),
    ['https://example.com/assets/icon.png', 'https://example.com/favicon.ico']
  )
  await assert.rejects(rasterize('data:text/html,not-an-image'))
  console.warn('Bookmark icon checks passed')
} else {
  const icons: Record<string, string> = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf8'))
    : {}
  mkdirSync(assetDir, { recursive: true })
  const origins = [
    ...new Set(links.flatMap((group) => group.items.map((item) => new URL(item.url).origin)))
  ]
  const queue = [...origins]
  let updated = 0
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (queue.length) {
        // Each worker takes a distinct origin, without visiting private bookmark paths.
        const origin = queue.shift()!
        const host = new URL(origin).hostname
        if (
          !process.argv.includes('--refresh') &&
          icons[host] &&
          existsSync(`public${icons[host]}`)
        )
          continue
        let candidates = [new URL('/favicon.ico', origin).href]
        try {
          const page = await download(origin)
          candidates = iconCandidates(page.data.toString('utf8'), page.url)
        } catch {
          /* Root pages can require authentication; still try the favicon. */
        }
        // This fallback runs only during maintenance, never in a visitor's browser.
        candidates = [
          ...candidates.slice(0, 5),
          `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`
        ]
        for (const candidate of candidates) {
          try {
            const buffer = await rasterize(candidate)
            const hash = createHash('sha256')
              .update(Uint8Array.from(buffer))
              .digest('hex')
              .slice(0, 16)
            const path = `/bookmark-icons/${hash}.webp`
            writeFileSync(`public${path}`, Uint8Array.from(buffer))
            icons[host] = path
            updated++
            break
          } catch {
            /* Try the next declared icon; never replace a good cached file on failure. */
          }
        }
        if (!icons[host]) console.warn(`No icon: ${host}`)
      }
    })
  )
  writeFileSync(
    manifestPath,
    `${JSON.stringify(Object.fromEntries(Object.entries(icons).sort()), null, 2)}\n`
  )
  console.warn(
    `Cached ${origins.filter((origin) => icons[new URL(origin).hostname]).length}/${origins.length} sites (${updated} updated)`
  )
}
