import fs from 'node:fs/promises'
import { getCollection } from 'astro:content'
import satori from 'satori'
import sharp from 'sharp'
import { themeConfig } from '@/config'
import { formatDate } from '@/utils/date'
import type { APIRoute } from 'astro'

export const prerender = true

const WIDTH = 1200
const HEIGHT = 630

// Neutral template palette; site identity comes from config.
const GOLD = '#B79674'
const TITLE_COLOR = '#F6F1E6'
const META_COLOR = '#C0B4A0'
const META_DIM = '#6E665A'

const collectionEntries = (await getCollection('posts')).filter(({ id }) => !id.startsWith('_'))

// Map the array of content collection entries to create an object.
// Converts [{ id: 'post', data: { title: 'Example', pubDate: Date } }]
// to { post: { title: 'Example', pubDate: Date } }
const pages = Object.fromEntries(
  collectionEntries.map(({ id, data }) => [id.replace(/\.(md|mdx)$/, ''), data])
)

// Background and fonts are loaded once — this route is prerendered at build time
const [bgBuffer, mapleFont, hanSansBold] = await Promise.all([
  sharp('public/og/og-bg.png').resize(WIDTH, HEIGHT).png().toBuffer(),
  fs.readFile('src/assets/fonts/MapleMono-CN-Regular.ttf'),
  fs.readFile('src/assets/fonts/SourceHanSansCN-Bold.otf')
])

type OGElement = {
  type: string
  props: {
    style: Record<string, string | number>
    children?: OGElement[] | string
  }
}

function el(
  type: string,
  style: Record<string, string | number>,
  children?: OGElement[] | string
): OGElement {
  return { type, props: children === undefined ? { style } : { style, children } }
}

/** CJK glyphs count as 1, latin/digits as roughly half a glyph width */
function visualLength(text: string): number {
  let len = 0
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0
    const wide =
      (cp >= 0x2e80 && cp <= 0x9fff) || // CJK radicals, kana, unified ideographs
      (cp >= 0xf900 && cp <= 0xfaff) || // CJK compatibility ideographs
      (cp >= 0xff00 && cp <= 0xffef) || // full-width forms
      (cp >= 0x3000 && cp <= 0x303f) // CJK symbols and punctuation
    len += wide ? 1 : 0.55
  }
  return len
}

function titleFontSize(title: string): number {
  const len = visualLength(title)
  if (len <= 10.5) return 64
  if (len <= 22) return 56
  if (len <= 34) return 48
  return 42
}

/** Split a `「分类」标题` style title into kicker + headline */
function splitTitle(raw: string): { kicker: string | null; headline: string } {
  const match = raw.match(/^「([^」]{1,8})」\s*(.+)$/)
  if (match) return { kicker: match[1], headline: match[2] }
  return { kicker: null, headline: raw }
}

function buildCard(rawTitle: string, pubDate: Date): OGElement {
  const { kicker, headline } = splitTitle(rawTitle)
  const date = formatDate(pubDate).replace(/<[^>]+>/g, '')
  const author = themeConfig.site.author

  const blocks: OGElement[] = []

  if (kicker) {
    blocks.push(
      el('div', { display: 'flex', alignItems: 'center', marginBottom: '26px' }, [
        el('div', { width: '28px', height: '2px', backgroundColor: GOLD, marginRight: '18px' }),
        el('div', { display: 'flex', fontSize: '25px', color: GOLD, letterSpacing: '5px' }, kicker)
      ])
    )
  }

  blocks.push(
    el(
      'div',
      {
        display: 'flex',
        fontFamily: 'Source Han Sans CN',
        fontWeight: 700,
        fontSize: `${titleFontSize(headline)}px`,
        lineHeight: 1.32,
        color: TITLE_COLOR,
        letterSpacing: '1px',
        lineClamp: 3
      },
      headline
    )
  )

  blocks.push(
    el('div', { display: 'flex', alignItems: 'center', marginTop: '34px', fontSize: '25px' }, [
      el('div', { display: 'flex', color: META_COLOR }, author),
      el('div', { display: 'flex', color: META_DIM, margin: '0 16px' }, '·'),
      el('div', { display: 'flex', color: GOLD, letterSpacing: '1px' }, date)
    ])
  )

  // Keep the headline inside a consistent margin for long Chinese and English titles.
  return el(
    'div',
    {
      width: `${WIDTH}px`,
      height: `${HEIGHT}px`,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '72px 84px'
    },
    blocks
  )
}

async function renderOGImage(title: string, pubDate: Date): Promise<Buffer> {
  const svg = await satori(buildCard(title, pubDate) as Parameters<typeof satori>[0], {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      { name: 'Maple Mono CN', data: mapleFont, weight: 400, style: 'normal' },
      { name: 'Source Han Sans CN', data: hanSansBold, weight: 700, style: 'normal' }
    ]
  })
  return sharp(bgBuffer)
    .composite([{ input: Buffer.from(svg) }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer()
}

export function getStaticPaths() {
  return Object.keys(pages).map((slug) => ({ params: { route: `${slug}.png` } }))
}

export const GET: APIRoute = async ({ params }) => {
  const slug = (params.route ?? '').replace(/\.png$/, '')
  const page = pages[slug]
  if (!page) return new Response('Page not found', { status: 404 })

  const png = await renderOGImage(page.title, page.pubDate)
  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png' }
  })
}
