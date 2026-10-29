/**
 * Generate the self-hosted web-font subsets used by the site.
 *
 * Latin fonts are reduced to their declared unicode range. Noto Sans SC is
 * downloaded from a pinned Google Fonts revision, verified by SHA-256, and
 * reduced to the characters currently present in src/. The generated files
 * are written to public/fonts and served with immutable caching.
 * Requires: subset-font (devDependency)
 * Usage: pnpm subset-fonts
 */

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import subsetFont from 'subset-font'

// Latin and punctuation range retained for the existing auxiliary font assets.
const UNICODE_RANGES: [number, number][] = [
  [0x0000, 0x00ff],
  [0x0131, 0x0131],
  [0x0152, 0x0153],
  [0x02bb, 0x02bc],
  [0x02c6, 0x02c6],
  [0x02da, 0x02da],
  [0x02dc, 0x02dc],
  [0x2000, 0x206f],
  [0x2074, 0x2074],
  [0x20ac, 0x20ac],
  [0x2122, 0x2122],
  [0x2191, 0x2191],
  [0x2193, 0x2193],
  [0x2212, 0x2212],
  [0x2215, 0x2215],
  [0xfeff, 0xfeff],
  [0xfffd, 0xfffd]
]

const text = UNICODE_RANGES.flatMap(([start, end]) =>
  Array.from({ length: end - start + 1 }, (_, i) => String.fromCodePoint(start + i))
).join('')

const LATIN_FONTS: { input: string; output: string }[] = [
  { input: 'src/assets/fonts/Inter.woff2', output: 'public/fonts/Inter-latin.woff2' },
  {
    input: 'src/assets/fonts/Besley-Italic.woff2',
    output: 'public/fonts/Besley-Italic-latin.woff2'
  },
  {
    input: 'src/assets/fonts/AlanSans-Regular.ttf',
    output: 'public/fonts/AlanSans-Regular-latin.woff2'
  }
]

const kb = (n: number): string => `${(n / 1024).toFixed(0)}KB`

for (const { input, output } of LATIN_FONTS) {
  const before = statSync(input).size
  const subset = await subsetFont(readFileSync(input), text, { targetFormat: 'woff2' })
  writeFileSync(output, new Uint8Array(subset))
  console.warn(`${input} -> ${output}: ${kb(before)} -> ${kb(subset.length)}`)
}

const NOTO_COMMIT = '2894aab31764f10f29c421bdfd2340d3b382d384'
const NOTO_SHA256 = 'a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da'
const NOTO_URL = `https://raw.githubusercontent.com/google/fonts/${NOTO_COMMIT}/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf`
const NOTO_OUTPUT = 'public/fonts/NotoSansSC-site-v40.woff2'
const SOURCE_EXTENSIONS = new Set(['.astro', '.css', '.js', '.json', '.md', '.mdx', '.ts'])
const EXTRA_READING_CHARACTERS = '·—–…“”‘’•←→↑↓©®™✓✕❤'

const hash = (buffer: Buffer): string =>
  createHash('sha256').update(Uint8Array.from(buffer)).digest('hex').toLowerCase()

const collectSourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return collectSourceFiles(path)
    return SOURCE_EXTENSIONS.has(extname(entry.name)) ? [path] : []
  })

const isReadingCharacter = (character: string): boolean => {
  const codePoint = character.codePointAt(0) ?? 0
  return (
    (codePoint >= 0x20 && codePoint <= 0xff) ||
    (codePoint >= 0x2000 && codePoint <= 0x206f) ||
    (codePoint >= 0x2190 && codePoint <= 0x21ff) ||
    (codePoint >= 0x3000 && codePoint <= 0x303f) ||
    (codePoint >= 0x3400 && codePoint <= 0x9fff) ||
    (codePoint >= 0xff00 && codePoint <= 0xffef) ||
    EXTRA_READING_CHARACTERS.includes(character)
  )
}

const collectReadingCharacters = (): string => {
  const sourceText = collectSourceFiles('src')
    .map((path) => readFileSync(path, 'utf8'))
    .join('')

  return [...new Set([...sourceText].filter(isReadingCharacter))]
    .sort((a, b) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0))
    .join('')
}

const loadNotoSource = async (): Promise<Buffer> => {
  const cachePath = join(tmpdir(), `NotoSansSC-${NOTO_COMMIT}.ttf`)
  if (existsSync(cachePath)) {
    const cached = readFileSync(cachePath)
    if (hash(cached) === NOTO_SHA256) return cached
  }

  const response = await fetch(NOTO_URL)
  if (!response.ok) throw new Error(`Unable to download Noto Sans SC: ${response.status}`)

  const source = Buffer.from(await response.arrayBuffer())
  if (hash(source) !== NOTO_SHA256) throw new Error('Noto Sans SC checksum mismatch')
  writeFileSync(cachePath, Uint8Array.from(source))
  return source
}

const readingCharacters = collectReadingCharacters()
const notoSource = await loadNotoSource()
const notoSubset = await subsetFont(notoSource, readingCharacters, { targetFormat: 'woff2' })
writeFileSync(NOTO_OUTPUT, new Uint8Array(notoSubset))
console.warn(
  `Noto Sans SC: ${readingCharacters.length} characters, ${kb(notoSource.length)} -> ${kb(notoSubset.length)}`
)
