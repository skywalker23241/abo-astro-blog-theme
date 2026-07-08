import MarkdownIt from 'markdown-it'

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
