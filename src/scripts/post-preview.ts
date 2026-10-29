import { closeWithMotion } from '@/scripts/close-with-motion'

export function setupPostPreview() {
  const dialog = document.querySelector<HTMLDialogElement>('#post-preview')
  const timeline = document.querySelector<HTMLElement>('.post-timeline')
  const title = dialog?.querySelector<HTMLElement>('#post-preview-title')
  const date = dialog?.querySelector<HTMLTimeElement>('[data-preview-date]')
  const excerpt = dialog?.querySelector<HTMLElement>('[data-preview-excerpt]')
  const readLink = dialog?.querySelector<HTMLAnchorElement>('[data-preview-read]')
  if (
    !dialog ||
    !timeline ||
    !title ||
    !date ||
    !excerpt ||
    !readLink ||
    dialog.dataset.initialized
  )
    return
  dialog.dataset.initialized = 'true'
  const controller = new AbortController()
  const options = { signal: controller.signal }
  let opener: HTMLButtonElement | undefined
  let previousOverflow = ''
  let scrollPosition = 0
  const close = () => closeWithMotion(dialog, () => dialog.close())

  const restorePage = () => {
    if (!opener) return
    document.documentElement.style.overflow = previousOverflow
    window.scrollTo({ top: scrollPosition, behavior: 'instant' })
    if (opener.isConnected) opener.focus({ preventScroll: true })
    opener = undefined
  }

  timeline.querySelectorAll<HTMLButtonElement>('.post-preview-trigger').forEach((button) => {
    button.hidden = false
  })

  timeline.addEventListener(
    'click',
    (event) => {
      const button =
        event.target instanceof Element
          ? event.target.closest<HTMLButtonElement>('.post-preview-trigger')
          : null
      if (!button || dialog.open) return
      opener = button
      title.textContent = button.dataset.previewTitle || ''
      date.textContent = button.dataset.previewDate || ''
      date.dateTime = button.dataset.previewDate || ''
      readLink.href = button.dataset.previewHref || '/blog/'
      // This HTML is rendered and sanitized on the server by renderPreviewMarkdown.
      excerpt.innerHTML = button.dataset.previewHtml || ''
      excerpt.scrollTop = 0
      excerpt.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((link) => {
        link.href = new URL(
          link.getAttribute('href') || '',
          new URL(readLink.href, window.location.href)
        ).href
      })
      previousOverflow = document.documentElement.style.overflow
      scrollPosition = window.scrollY
      dialog.showModal()
      document.documentElement.style.overflow = 'hidden'
    },
    options
  )

  dialog.addEventListener(
    'click',
    (event) => {
      if (event.target !== dialog) return
      const rect = dialog.getBoundingClientRect()
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      ) {
        close()
      }
    },
    options
  )

  dialog.addEventListener('close', restorePage, options)
  dialog.addEventListener(
    'cancel',
    (event) => {
      event.preventDefault()
      close()
    },
    options
  )
  dialog.addEventListener(
    'submit',
    (event) => {
      if (!(event.target instanceof HTMLFormElement) || event.target.method !== 'dialog') return
      event.preventDefault()
      close()
    },
    options
  )

  document.addEventListener(
    'astro:before-swap',
    () => {
      if (dialog.open) closeWithMotion(dialog, () => dialog.close(), true)
      restorePage()
      controller.abort()
    },
    { once: true, signal: controller.signal }
  )
}
