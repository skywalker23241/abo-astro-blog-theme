import { closeWithMotion } from '@/scripts/close-with-motion'

function initBookmarkWebSearch() {
  const dialog = document.querySelector<HTMLDialogElement>('#bookmark-web-search')
  const form = dialog?.querySelector('form')
  const query = dialog?.querySelector<HTMLInputElement>('#web-search-query')
  const title = dialog?.querySelector<HTMLElement>('#bookmark-web-search-title')
  if (!dialog || !form || !query || !title || dialog.dataset.initialized) return
  dialog.dataset.initialized = 'true'
  form.setAttribute('rel', 'noopener noreferrer')

  const controller = new AbortController()
  const options = { signal: controller.signal }
  let opener: HTMLButtonElement | null = null
  let previousOverflow = ''
  let previousScroll = { x: 0, y: 0 }

  const close = () => closeWithMotion(dialog, () => dialog.close())
  const restore = () => {
    document.documentElement.style.overflow = previousOverflow
    window.scrollTo(previousScroll.x, previousScroll.y)
    opener?.focus({ preventScroll: true })
  }

  document.querySelectorAll<HTMLButtonElement>('[data-search-engine]').forEach((button) => {
    button.addEventListener(
      'click',
      () => {
        if (dialog.open) return
        const isGoogle = button.dataset.searchEngine === 'google'
        form.action = isGoogle ? 'https://www.google.com/search' : 'https://www.baidu.com/s'
        query.name = isGoogle ? 'q' : 'wd'
        title.textContent = isGoogle ? 'Google 搜索' : '百度搜索'
        query.value = ''
        opener = button
        previousOverflow = document.documentElement.style.overflow
        previousScroll = { x: window.scrollX, y: window.scrollY }
        dialog.showModal()
        document.documentElement.style.overflow = 'hidden'
        query.focus({ preventScroll: true })
      },
      options
    )
  })
  dialog.querySelectorAll('[data-close-web-search]').forEach((button) => {
    button.addEventListener('click', close, options)
  })
  dialog.addEventListener(
    'click',
    (event) => {
      if (event.target === dialog) close()
    },
    options
  )
  dialog.addEventListener(
    'cancel',
    (event) => {
      event.preventDefault()
      close()
    },
    options
  )
  dialog.addEventListener('close', restore, options)
  // The browser submits the native form to a new tab; keep this page in place.
  form.addEventListener('submit', () => window.setTimeout(close, 0), options)
  document.addEventListener(
    'astro:before-swap',
    () => {
      if (dialog.open) {
        closeWithMotion(dialog, () => dialog.close(), true)
        restore()
      }
      controller.abort()
    },
    { once: true, signal: controller.signal }
  )
}

initBookmarkWebSearch()
document.addEventListener('astro:page-load', initBookmarkWebSearch)
