import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import playformInline from '@playform/inline'
import remarkMath from 'remark-math'
import remarkDirective from 'remark-directive'
import rehypeKatex from 'rehype-katex'
import remarkEmbeddedMedia from './src/plugins/remark-embedded-media.mjs'
import remarkReadingTime from './src/plugins/remark-reading-time.mjs'
import rehypeCleanup from './src/plugins/rehype-cleanup.mjs'
import rehypeImageProcessor from './src/plugins/rehype-image-processor.mjs'
import rehypeCopyCode from './src/plugins/rehype-copy-code.mjs'
import remarkTOC from './src/plugins/remark-toc.mjs'
import netlifyAvif from './src/plugins/netlify-avif.mjs'
import { themeConfig } from './src/config'
import { imageConfig } from './src/utils/image-config'
import path from 'path'
import netlify from '@astrojs/netlify'

import robotsTxt from 'astro-robots-txt'

export default defineConfig({
  adapter: netlify(), // Set adapter for deployment, or set `linkCard` to `false` in `src/config.ts`
  site: themeConfig.site.website,
  redirects: {
    '/about': { destination: '/', status: 301 }
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover'
  },
  image: {
    // Emit responsive srcset/sizes for markdown images (multiple Netlify Image CDN
    // widths instead of a single full-resolution URL).
    layout: 'constrained',
    service: {
      entrypoint: 'astro/assets/services/sharp',
      config: imageConfig
    }
  },
  markdown: {
    shikiConfig: {
      theme: 'css-variables',
      wrap: false
    },
    remarkPlugins: [remarkMath, remarkDirective, remarkEmbeddedMedia, remarkReadingTime, remarkTOC],
    // Cast rehypeKatex to avoid type collision between differing @types/hast instances in unified plugins
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rehypePlugins: [rehypeKatex as any, rehypeCleanup, rehypeImageProcessor, rehypeCopyCode]
  },
  integrations: [
    netlifyAvif(),
    playformInline({
      Beasties: {
        pruneSource: false
      },
      Exclude: [(file) => file.toLowerCase().includes('katex')]
    }),
    mdx(),
    sitemap({
      filter: (page) => !['/nav/', '/newsletter/'].some((path) => page.endsWith(path))
    }),
    robotsTxt()
  ],
  vite: {
    resolve: {
      alias: {
        '@': path.resolve('./src')
      }
    }
  },
  devToolbar: {
    enabled: false
  }
})
