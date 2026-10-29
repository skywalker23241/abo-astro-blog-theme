import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const IMAGE_PATTERN = /<img\b(?=[^>]*\bsrc="\/.netlify\/images\?)([^>]*)>/gi

/**
 * Add AVIF sources after Astro has emitted Netlify Image CDN URLs. Markdown
 * image transforms happen after Rehype plugins, so this build hook is the
 * reliable place to create a progressive AVIF > original-image fallback.
 */
export default function netlifyAvif() {
  return {
    name: 'netlify-avif',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        for (const file of await findHtmlFiles(fileURLToPath(dir))) {
          const html = await readFile(file, 'utf8')
          const optimized = html.replace(IMAGE_PATTERN, (img, attributes) => {
            if (img.includes('<picture>')) return img

            const srcSet = getAttribute(attributes, 'srcset')
            const src = getAttribute(attributes, 'src')
            const sizes = getAttribute(attributes, 'sizes')
            const avifSrcSet = toAvifSrcSet(srcSet || src)
            const sizesAttribute = sizes ? ` sizes="${sizes}"` : ''

            return `<picture><source type="image/avif" srcset="${avifSrcSet}"${sizesAttribute}>${img}</picture>`
          })

          if (optimized !== html) {
            await writeFile(file, optimized)
          }
        }
      }
    }
  }
}

async function findHtmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name)
      return entry.isDirectory() ? findHtmlFiles(path) : entry.name.endsWith('.html') ? [path] : []
    })
  )

  return files.flat()
}

function getAttribute(attributes, name) {
  return new RegExp(`\\b${name}="([^"]+)"`, 'i').exec(attributes)?.[1]
}

function toAvifSrcSet(srcSet) {
  return srcSet
    .split(',')
    .map((candidate) => {
      const [url, descriptor] = candidate.trim().split(/\s+/, 2)
      const separator = url.includes('?') ? '&#38;' : '?'
      const avifUrl = `${url}${separator}fm=avif&#38;q=72`
      return descriptor ? `${avifUrl} ${descriptor}` : avifUrl
    })
    .join(', ')
}
