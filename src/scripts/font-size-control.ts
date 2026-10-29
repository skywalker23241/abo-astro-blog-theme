import type { TransitionBeforeSwapEvent } from 'astro:transitions/client'

const sizes = ['100', '112.5', '125']

function updateControls() {
  const size = document.documentElement.dataset.readingSize || '100'
  document
    .querySelectorAll<HTMLButtonElement>('[data-font-size-control] [data-reading-size]')
    .forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.readingSize === size))
    })
  document.querySelectorAll<HTMLElement>('[data-font-size-control]').forEach((control) => {
    control.hidden = false
  })
}

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return
  const button = event.target.closest<HTMLButtonElement>(
    '[data-font-size-control] [data-reading-size]'
  )
  const size = button?.dataset.readingSize
  if (!size || !sizes.includes(size)) return

  document.documentElement.dataset.readingSize = size
  try {
    localStorage.setItem('abo-reading-size', size)
  } catch {
    // Keep the choice for this visit if browser storage is blocked.
  }
  updateControls()
})

document.addEventListener('astro:before-swap', (event) => {
  const { newDocument } = event as TransitionBeforeSwapEvent
  newDocument.documentElement.dataset.readingSize =
    document.documentElement.dataset.readingSize || '100'
})

document.addEventListener('astro:page-load', updateControls)
updateControls()
