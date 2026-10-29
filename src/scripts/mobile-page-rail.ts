function initMobilePageRail() {
  const rail = document.querySelector<HTMLElement>('.site-rail')
  const content = rail?.querySelector<HTMLElement>('.rail-sticky')
  const dialog = rail?.querySelector<HTMLDialogElement>('#mobile-page-rail')
  const destination = dialog?.querySelector<HTMLElement>('[data-mobile-rail-content]')
  const toggle = document.querySelector<HTMLButtonElement>('[data-open-page-rail]')
  if (!rail || !content || !dialog || !destination || !toggle || dialog.dataset.initialized) return
  dialog.dataset.initialized = 'true'
  const controller = new AbortController()
  const options = { signal: controller.signal }
  const desktop = window.matchMedia('(min-width: 1180px)')
  let previousOverflow = ''
  let position = { x: 0, y: 0 }
  let locked = false
  let closeTimer = 0

  const restore = (restorePosition = true) => {
    if (!locked) return
    locked = false
    rail.insertBefore(content, dialog)
    document.documentElement.style.overflow = previousOverflow
    if (restorePosition) window.scrollTo(position.x, position.y)
    toggle.setAttribute('aria-expanded', 'false')
    toggle.setAttribute('aria-label', '打开页面目录')
    if (!desktop.matches) toggle.focus({ preventScroll: true })
  }
  const close = (target?: HTMLElement, immediate = false) => {
    if (!dialog.open) return
    if (closeTimer && !immediate) return
    toggle.setAttribute('aria-expanded', 'false')
    toggle.setAttribute('aria-label', '打开页面目录')
    window.clearTimeout(closeTimer)
    const finish = () => {
      closeTimer = 0
      dialog.classList.remove('is-closing')
      dialog.close()
      restore(!target)
      target?.scrollIntoView({ block: 'start' })
    }
    if (immediate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish()
      return
    }
    dialog.classList.add('is-closing')
    closeTimer = window.setTimeout(finish, 180)
  }
  toggle.addEventListener(
    'click',
    () => {
      if (desktop.matches || dialog.open) return
      position = { x: window.scrollX, y: window.scrollY }
      previousOverflow = document.documentElement.style.overflow
      locked = true
      destination.append(content)
      dialog.showModal()
      document.documentElement.style.overflow = 'hidden'
      toggle.setAttribute('aria-expanded', 'true')
      toggle.setAttribute('aria-label', '关闭页面目录')
    },
    options
  )
  dialog.querySelector('[data-close-page-rail]')?.addEventListener('click', () => close(), options)
  dialog.addEventListener(
    'cancel',
    (event) => {
      event.preventDefault()
      close()
    },
    options
  )
  dialog.addEventListener('close', () => restore(), options)
  dialog.addEventListener(
    'click',
    (event) => {
      if (event.target === dialog) close()
      const link = event.target instanceof Element ? event.target.closest('a') : null
      if (!link) return
      const url = new URL(link.href, location.href)
      if (url.origin === location.origin && url.pathname === location.pathname && url.hash) {
        const target = document.getElementById(decodeURIComponent(url.hash.slice(1)))
        if (!target) return
        event.preventDefault()
        history.replaceState(null, '', url.hash)
        close(target)
        return
      }
      close()
    },
    options
  )
  desktop.addEventListener(
    'change',
    () => {
      if (desktop.matches && dialog.open) close(undefined, true)
    },
    options
  )
  document.addEventListener(
    'astro:before-swap',
    () => {
      if (dialog.open) close(undefined, true)
      window.clearTimeout(closeTimer)
      controller.abort()
    },
    { once: true, signal: controller.signal }
  )
}

initMobilePageRail()
document.addEventListener('astro:page-load', initMobilePageRail)
