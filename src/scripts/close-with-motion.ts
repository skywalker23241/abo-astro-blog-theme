const pending = new WeakMap<HTMLElement, () => void>()

export function closeWithMotion(element: HTMLElement, finish: () => void, immediate = false) {
  const complete = pending.get(element)
  if (complete) {
    if (immediate) complete()
    return
  }
  if (immediate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    finish()
    return
  }

  let timer = 0
  const onEnd = (event: AnimationEvent) => {
    if (event.target === element && event.animationName === 'surface-out') done()
  }
  const done = () => {
    window.clearTimeout(timer)
    element.removeEventListener('animationend', onEnd)
    pending.delete(element)
    element.classList.remove('is-motion-closing')
    finish()
  }
  pending.set(element, done)
  element.addEventListener('animationend', onEnd)
  element.classList.add('is-motion-closing')
  // Finish even if an animation is cancelled or the stylesheet cannot load.
  timer = window.setTimeout(done, 220)
}
