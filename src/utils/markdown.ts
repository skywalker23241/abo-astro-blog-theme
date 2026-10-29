import MarkdownIt from 'markdown-it'
import sanitizeHtml from 'sanitize-html'
import { sanitizeFeedBody } from '@/utils/seo'

// Single shared instance — importing this module instantiates the parser once
// per process instead of once per component render.
const inlineRenderer = new MarkdownIt({ html: false })

/**
 * Render a short string of inline markdown (e.g. a post title with emphasis)
 * to HTML, without wrapping block-level tags.
 */
export function renderInlineMarkdown(text: string): string {
  return inlineRenderer.renderInline(text)
}

const previewRenderer = new MarkdownIt({ html: true })
// Previews keep the reading structure without loading article media or embeds.
previewRenderer.renderer.rules.image = () => ''

export function renderPreviewMarkdown(content: string, fallback: string, maxLength = 1000): string {
  const source = (sanitizeFeedBody(content) || fallback).replace(/\r\n/g, '\n')
  const lines = source.split(/\r?\n/)
  let endLine = 0
  for (const token of previewRenderer.parse(source, {})) {
    if (token.level !== 0 || !token.map) continue
    const candidateLength = lines.slice(0, token.map[1]).join('\n').length
    if (candidateLength > maxLength && endLine > 0) break
    endLine = token.map[1]
    if (candidateLength >= maxLength) break
  }
  const selected = lines.slice(0, endLine).join('\n').slice(0, maxLength).trim()
  const markdown = selected.length < source.trim().length ? `${selected}\n\n…` : selected
  const rendered = sanitizeHtml(previewRenderer.render(markdown), {
    allowedTags: [
      'p',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'strong',
      'em',
      's',
      'ul',
      'ol',
      'li',
      'blockquote',
      'pre',
      'code',
      'a',
      'br',
      'hr',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td'
    ],
    allowedAttributes: { a: ['href', 'title'], ol: ['start'] },
    allowedSchemes: ['http', 'https', 'mailto']
  }).replace(/<p>\s*<\/p>/g, '')
  return rendered.trim() ? rendered : inlineRenderer.render(fallback)
}
