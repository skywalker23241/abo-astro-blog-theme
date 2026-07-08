export const primaryNavLinks = [
  { href: '/', label: 'Home' },
  { href: '/categories', label: 'Categories' },
  { href: '/now', label: 'Now' },
  { href: '/nav', label: 'Bookmarks' },
  { href: '/newsletter', label: 'Newsletter' },
  { href: '/para-notes', label: 'Notes' }
]

export function getNextNavLink(pathname: string) {
  const currentIndex = getCurrentNavIndex(pathname)

  if (currentIndex === -1) return primaryNavLinks[0]

  return primaryNavLinks[(currentIndex + 1) % primaryNavLinks.length]
}

export function getPreviousNavLink(pathname: string) {
  const currentIndex = getCurrentNavIndex(pathname)

  if (currentIndex === -1) return primaryNavLinks[0]

  return primaryNavLinks[(currentIndex - 1 + primaryNavLinks.length) % primaryNavLinks.length]
}

function getCurrentNavIndex(pathname: string) {
  const normalizedPath = pathname === '/' ? '/' : pathname.replace(/\/$/, '')

  return primaryNavLinks.findIndex(({ href }) => {
    const normalizedHref = href === '/' ? '/' : href.replace(/\/$/, '')
    return normalizedHref === '/'
      ? normalizedPath === '/'
      : normalizedPath === normalizedHref || normalizedPath.startsWith(`${normalizedHref}/`)
  })
}
