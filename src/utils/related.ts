import type { CollectionEntry } from 'astro:content'
import { getSortedFilteredPosts } from '@/utils/draft'
import { getCategoryFromTitle } from '@/utils/category'

export interface RelatedPost {
  id: string
  title: string
  displayTitle?: string
  pubDate: Date
}

/**
 * Pick up to `limit` posts related to the given slug. Same-category posts come
 * first (most recent first), then recent posts fill any remaining slots. The
 * current post is always excluded.
 */
export async function getRelatedPosts(currentId: string, limit = 3): Promise<RelatedPost[]> {
  const posts = await getSortedFilteredPosts()
  const current = posts.find((post) => post.id === currentId)
  if (!current) return []

  const currentCategory = getCategoryFromTitle(current.data.title)
  const candidates = posts.filter((post) => post.id !== currentId)

  const sameCategory = currentCategory
    ? candidates.filter((post) => getCategoryFromTitle(post.data.title) === currentCategory)
    : []

  const seen = new Set(sameCategory.map((post) => post.id))
  const fillers = candidates.filter((post) => !seen.has(post.id))

  const toRelated = (post: CollectionEntry<'posts'>): RelatedPost => ({
    id: post.id,
    title: post.data.title,
    displayTitle: post.data.displayTitle,
    pubDate: post.data.pubDate
  })

  return [...sameCategory, ...fillers].slice(0, limit).map(toRelated)
}
