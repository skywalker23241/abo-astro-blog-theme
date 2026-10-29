/**
 * One-time script: compress oversized source images under src/content/posts/_assets.
 * - Resizes images whose longest edge exceeds MAX_DIMENSION to fit within it.
 * - Re-encodes in place (png: max compression; jpeg: quality 82 + mozjpeg).
 * - Converts large opaque PNGs (photographic content) to JPEG and deletes the
 *   original — markdown references must be updated manually (listed at the end).
 * - Only overwrites when the result is actually smaller.
 * Usage: pnpm exec tsx scripts/optimize-source-images.ts
 */

import { readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import sharp from 'sharp'

const ASSETS_DIR = 'src/content/posts/_assets'
const MAX_DIMENSION = 2000
const SKIP_BELOW_BYTES = 300 * 1024
const CONVERT_PNG_ABOVE_BYTES = 1024 * 1024

const kb = (n: number): string => `${(n / 1024).toFixed(0)}KB`

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

const converted: { from: string; to: string }[] = []
let totalBefore = 0
let totalAfter = 0

for (const file of walk(ASSETS_DIR)) {
  const ext = extname(file).toLowerCase()
  if (!['.png', '.jpg', '.jpeg'].includes(ext)) continue

  const before = statSync(file).size
  if (before < SKIP_BELOW_BYTES) continue

  const input = readFileSync(file)
  const meta = await sharp(input).metadata()
  const needsResize = Math.max(meta.width ?? 0, meta.height ?? 0) > MAX_DIMENSION

  let pipeline = sharp(input)
  if (needsResize) {
    pipeline = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true
    })
  }

  if (ext === '.png') {
    const recompressed = await pipeline.png({ compressionLevel: 9 }).toBuffer()
    // Photographic content stored as PNG stays huge — convert opaque ones to JPEG
    if (recompressed.length > CONVERT_PNG_ABOVE_BYTES && !meta.hasAlpha) {
      const jpeg = await sharp(input)
        .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer()
      const target = file.slice(0, -ext.length) + '.jpg'
      writeFileSync(target, new Uint8Array(jpeg))
      unlinkSync(file)
      converted.push({ from: file, to: target })
      totalBefore += before
      totalAfter += jpeg.length
      console.log(`CONVERTED ${file} -> ${target}: ${kb(before)} -> ${kb(jpeg.length)}`)
      continue
    }
    if (recompressed.length < before) {
      writeFileSync(file, new Uint8Array(recompressed))
      totalBefore += before
      totalAfter += recompressed.length
      console.log(`png  ${file}: ${kb(before)} -> ${kb(recompressed.length)}`)
    }
  } else {
    const recompressed = await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer()
    if (recompressed.length < before) {
      writeFileSync(file, new Uint8Array(recompressed))
      totalBefore += before
      totalAfter += recompressed.length
      console.log(`jpeg ${file}: ${kb(before)} -> ${kb(recompressed.length)}`)
    }
  }
}

console.log(`\nTotal: ${kb(totalBefore)} -> ${kb(totalAfter)}`)
if (converted.length > 0) {
  console.log('\nPNG->JPG conversions — update markdown references:')
  for (const { from, to } of converted) {
    console.log(`  ${from} -> ${to}`)
  }
}
