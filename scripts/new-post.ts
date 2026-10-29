/**
 * Create a new post with frontmatter
 * Usage: pnpm new <title>
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'

// A separate ASCII slug keeps Chinese titles readable and URLs portable.
const titleArgs = process.argv.slice(2)
const slugIndex = titleArgs.indexOf('--slug')
const explicitSlug = slugIndex >= 0 ? titleArgs.splice(slugIndex, 2)[1] : undefined
const rawTitle = titleArgs.join(' ') || 'new-post'
const isDraft = rawTitle.startsWith('_')
const displayTitle = isDraft ? rawTitle.slice(1) : rawTitle
const slug = (explicitSlug ?? displayTitle)
  .toLowerCase()
  .replace(/[^a-z0-9\s-]/g, '')
  .replace(/[\s-]+/g, '-')
  .replace(/^-|-$/g, '')
if (!displayTitle.trim() || !slug || (slugIndex >= 0 && !explicitSlug)) {
  console.error('Provide an English slug: pnpm new "中文标题" --slug my-first-post')
  process.exit(1)
}
const fileName = `${isDraft ? '_' : ''}${slug}`
const targetFile: string = `${fileName}.md`
const fullPath: string = join('src/content/posts', targetFile)

// Check if the target file already exists
if (existsSync(fullPath)) {
  console.error(`😇 File already exists: ${fullPath}`)
  process.exit(1)
}

// Ensure the directory structure exists
mkdirSync(dirname(fullPath), { recursive: true })

// Generate frontmatter with current date
const content: string = `---
title: ${JSON.stringify(displayTitle)}
pubDate: '${new Date().toISOString().split('T')[0]}'
---

`
// Write the new post file
try {
  writeFileSync(fullPath, content)
  if (isDraft) {
    console.log(`📝 Draft created: ${fullPath}`)
  } else {
    console.log(`✅ Post created: ${fullPath}`)
  }
} catch (error) {
  console.error('⚠️ Failed to create post:', error)
  process.exit(1)
}
