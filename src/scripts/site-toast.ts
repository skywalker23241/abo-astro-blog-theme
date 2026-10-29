type ToastType = 'success' | 'error'

let toast: HTMLElement | null = null
let timer = 0
let dismissTimer = 0
let progress: Animation | null = null
let started = 0
let remaining = 0
let hovered = false
let focused = false
let returnFocus: Element | null = null

export function hideToast() {
  window.clearTimeout(timer)
  window.clearTimeout(dismissTimer)
  timer = 0
  dismissTimer = 0
  progress?.cancel()
  progress = null
  if (!toast) return
  toast.hidden = true
  toast.dataset.closing = 'false'
  if (
    toast.contains(document.activeElement) &&
    returnFocus instanceof HTMLElement &&
    returnFocus.isConnected
  ) {
    returnFocus.focus({ preventScroll: true })
  }
  hovered = false
  focused = false
}

function dismissToast() {
  if (!toast || toast.hidden || toast.dataset.closing === 'true') return
  window.clearTimeout(timer)
  timer = 0
  progress?.pause()
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    hideToast()
    return
  }
  toast.dataset.closing = 'true'
  dismissTimer = window.setTimeout(hideToast, 180)
}

function pauseToast() {
  if (!timer) return
  window.clearTimeout(timer)
  timer = 0
  progress?.pause()
  remaining = Math.max(0, remaining - (Date.now() - started))
}

function resumeToast() {
  if (!toast || toast.hidden || toast.dataset.closing === 'true' || hovered || focused || timer)
    return
  started = Date.now()
  progress?.play()
  timer = window.setTimeout(dismissToast, remaining)
}

function getToast() {
  const element = document.querySelector<HTMLElement>('[data-site-toast]')
  if (!element) {
    hideToast()
    toast = null
    return null
  }
  if (element === toast) return toast
  hideToast()
  toast = element
  element.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'touch') return
    hovered = true
    pauseToast()
  })
  element.addEventListener('pointerleave', () => {
    hovered = false
    resumeToast()
  })
  element.addEventListener('focusin', () => {
    focused = true
    pauseToast()
  })
  element.addEventListener('focusout', (event) => {
    if (event.relatedTarget instanceof Node && element.contains(event.relatedTarget)) return
    focused = false
    resumeToast()
  })
  element.querySelector('[data-toast-close]')?.addEventListener('click', dismissToast)
  return element
}

export function placeToast() {
  const element = getToast()
  if (!element) return
  // Native dialogs make outside controls inert; keep the close control usable inside them.
  const host =
    document.querySelector(
      'dialog[open], .replay-modal:not([hidden]), .highlight-editor:not([hidden])'
    ) || document.body
  if (element.parentElement !== host) host.append(element)
}

export function showToast(message: string, type: ToastType = 'success') {
  if (!message) return
  placeToast()
  if (!toast) return
  window.clearTimeout(timer)
  window.clearTimeout(dismissTimer)
  timer = 0
  dismissTimer = 0
  progress?.cancel()
  if (!toast.contains(document.activeElement)) returnFocus = document.activeElement
  const content = toast.querySelector('[data-toast-message]')
  content?.replaceChildren(document.createTextNode(message))
  toast.dataset.type = type
  toast.dataset.closing = 'false'
  toast.hidden = false
  remaining = type === 'error' ? 6500 : 4500
  progress = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? null
    : toast
        .querySelector<HTMLElement>('[data-toast-progress]')
        ?.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], {
          duration: remaining,
          fill: 'forwards'
        }) || null
  progress?.pause()
  resumeToast()
}

// Inline legacy controls use an event rather than adding a global window API.
document.addEventListener('site:notify', (event) => {
  const detail: unknown = (event as CustomEvent<unknown>).detail
  if (
    !detail ||
    typeof detail !== 'object' ||
    !('message' in detail) ||
    typeof detail.message !== 'string'
  )
    return
  showToast(detail.message, 'type' in detail && detail.type === 'error' ? 'error' : 'success')
})
document.addEventListener('close', placeToast, true)
document.addEventListener('astro:before-swap', hideToast)
