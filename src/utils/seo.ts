const MAX_EXCERPT_LENGTH = 160

function stripMdxBoilerplate(content: string) {
  return content
    .replace(/^\s*import\s.+$/gm, '')
    .replace(/^\s*export\s.+$/gm, '')
    .trim()
}

function stripMarkup(content: string) {
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildExcerpt(content: string, fallback: string, maxLength = MAX_EXCERPT_LENGTH) {
  const cleaned = stripMarkup(stripMdxBoilerplate(content))
  if (!cleaned) {
    return fallback
  }

  if (cleaned.length <= maxLength) {
    return cleaned
  }

  return `${cleaned.slice(0, maxLength).trimEnd()}...`
}

export function stripSiteSuffix(title: string, siteTitle: string) {
  const suffix = ` · ${siteTitle}`
  return title.endsWith(suffix) ? title.slice(0, -suffix.length) : title
}

export function sanitizeFeedBody(content: string) {
  return stripMdxBoilerplate(content)
}
