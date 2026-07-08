/// <reference types="astro/client" />
/// <reference types="astro/content" />

declare module 'astro:content' {
  interface Render {
    '.md': Promise<{
      Content: import('astro').MarkdownInstance<Record<string, unknown>>['Content']
      headings: import('astro').MarkdownHeading[]
      remarkPluginFrontmatter: Record<string, unknown>
    }>
  }
}

interface ImportMetaEnv {
  readonly PRIVATE_PAGE_PASSWORD?: string
  readonly PRIVATE_MEMO_ADMIN_PASSCODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
