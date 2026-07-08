import { getCollection } from 'astro:content'
import { OGImageRoute } from 'astro-og-canvas'

const collectionEntries = (await getCollection('posts')).filter(({ id }) => !id.startsWith('_'))

// Map the array of content collection entries to create an object.
// Converts [{ id: 'post.md', data: { title: 'Example', pubDate: Date } }]
// to { 'post.md': { title: 'Example', pubDate: Date } }
const pages = Object.fromEntries(
  collectionEntries.map(({ id, data }) => [id.replace(/\.(md|mdx)$/, ''), data])
)

export const { getStaticPaths, GET } = OGImageRoute({
  param: 'route',
  pages,
  getImageOptions: (_path, page) => ({
    title: page.title,
    description: '',
    logo: {
      path: 'public/og/og-logo-white.png',
      size: [64, 64]
    },
    bgGradient: [
      [16, 19, 26],
      [34, 38, 45]
    ],
    bgImage: {
      path: 'public/og/og-bg.jpg',
      fit: 'fill'
    },
    padding: 150,
    font: {
      title: {
        color: [248, 250, 252],
        size: 58,
        lineHeight: 1.08,
        weight: 'SemiBold',
        families: ['Inter Variable', 'Besley', 'Alan Sans', 'Maple Mono CN']
      },
      description: {
        color: [218, 224, 230],
        size: 30,
        lineHeight: 1.25,
        weight: 'Medium',
        families: ['Inter Variable', 'Besley', 'Alan Sans', 'Maple Mono CN']
      }
    },
    fonts: [
      'src/assets/fonts/AlanSans-Regular.ttf',
      'public/fonts/Besley-Italic.woff2',
      'src/assets/fonts/MapleMono-CN-Regular.ttf',
      'public/fonts/Inter.woff2'
    ]
  })
})
