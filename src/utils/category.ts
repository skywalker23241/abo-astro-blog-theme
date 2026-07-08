const QUOTED_DASH_PREFIX = /^[\s]*「([^」]+)」[\s]*[-—–][\s]*/
const BRACKET_PREFIX = /^[\s]*[【[]([^】\]]+)[】\]][\s:：|｜-]*/
const QUOTE_PREFIX = /^[\s]*「([^」]+)」[\s:：|｜-]*/
const DELIMITER_PREFIX = /^[\s]*([A-Za-z0-9\u4e00-\u9fa5&+-]{1,20})[\s]*[：:|｜-]+[\s]*/
const CATEGORY_PREFIX_PATTERNS = [
  QUOTED_DASH_PREFIX,
  BRACKET_PREFIX,
  QUOTE_PREFIX,
  DELIMITER_PREFIX
] as const

export function getCategoryFromTitle(title: string): string | null {
  const source = title.trim()
  if (!source) return null

  for (const pattern of CATEGORY_PREFIX_PATTERNS) {
    const match = source.match(pattern)
    if (match?.[1]) return match[1].trim()
  }

  return null
}

export function stripCategoryPrefix(title: string): string {
  const source = title.trim()
  for (const pattern of CATEGORY_PREFIX_PATTERNS) {
    if (pattern.test(source)) {
      return source.replace(pattern, '').trim()
    }
  }

  return source
}
