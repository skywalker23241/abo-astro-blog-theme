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
  readonly R2_ACCOUNT_ID?: string
  readonly R2_ENDPOINT?: string
  readonly R2_BUCKET_NAME?: string
  readonly R2_BUCKET?: string
  readonly R2_ACCESS_KEY_ID?: string
  readonly R2_SECRET_ACCESS_KEY?: string
  readonly R2_HIGHLIGHTS_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
