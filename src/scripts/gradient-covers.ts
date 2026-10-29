export function setupGradientCovers() {
  const cards = [...document.querySelectorAll<HTMLElement>('.gradient-cover')]
  if (!cards.length) return
  // The 128 x 128 source tile is measured in physical pixels, not CSS px.
  // An unscaled repeat is drawn into a DPR-sized backing store so that
  // each random grayscale sample occupies exactly one device pixel.
  const NOISE_SIZE = 128
  const noiseTile = document.createElement('canvas')
  noiseTile.width = NOISE_SIZE
  noiseTile.height = NOISE_SIZE
  const tileCtx = noiseTile.getContext('2d')
  if (!tileCtx) return
  const noise = tileCtx.createImageData(NOISE_SIZE, NOISE_SIZE)
  for (let i = 0; i < noise.data.length; i += 4) {
    const shade = 82 + Math.floor(Math.random() * 93)
    noise.data[i] = shade
    noise.data[i + 1] = shade
    noise.data[i + 2] = shade
    noise.data[i + 3] = 255
  }
  tileCtx.putImageData(noise, 0, 0)

  let resizeFrame = 0

  function renderNoise() {
    resizeFrame = 0
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    for (const card of cards) {
      const canvas = card.querySelector<HTMLCanvasElement>('.grain')
      if (!canvas) continue
      const { width, height } = card.getBoundingClientRect()
      const physicalWidth = Math.max(1, Math.round(width * dpr))
      const physicalHeight = Math.max(1, Math.round(height * dpr))

      if (canvas.width !== physicalWidth) canvas.width = physicalWidth
      if (canvas.height !== physicalHeight) canvas.height = physicalHeight

      const ctx = canvas.getContext('2d')
      if (!ctx) continue
      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, physicalWidth, physicalHeight)
      const pattern = ctx.createPattern(noiseTile, 'repeat')
      if (!pattern) continue
      ctx.fillStyle = pattern
      ctx.fillRect(0, 0, physicalWidth, physicalHeight)
    }
  }

  function requestNoiseRender() {
    if (!resizeFrame) resizeFrame = requestAnimationFrame(renderNoise)
  }
  const resizeObserver = new ResizeObserver(requestNoiseRender)
  cards.forEach((card) => resizeObserver.observe(card))
  window.addEventListener('resize', requestNoiseRender, { passive: true })
  requestNoiseRender()

  // Spring: stiffness = 70 s^-2; damping ratio = 0.86.
  // Gradients follow the pointer, SVG ornaments counter-shift, and
  // the glow follows the same smoothly integrated spring position.
  const fmt = (value: number) => value.toFixed(2)
  const stiffness = 70
  const dampingRatio = 0.86
  const damping = 2 * dampingRatio * Math.sqrt(stiffness)
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const hoverPointer = window.matchMedia('(hover: hover) and (pointer: fine)')
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
  let motionFrame = 0
  let lastTime = 0

  const states = cards.map((card) => ({
    card,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    tx: 0,
    ty: 0,
    halfWidth: card.getBoundingClientRect().width / 2,
    halfHeight: card.getBoundingClientRect().height / 2,
    active: false
  }))

  function paintState(s: (typeof states)[number]) {
    s.card.style.setProperty('--field-x', `${fmt(s.x * 25)}px`)
    s.card.style.setProperty('--field-y', `${fmt(s.y * 25)}px`)
    s.card.style.setProperty('--pattern-x', `${fmt(-s.x * 13)}px`)
    s.card.style.setProperty('--pattern-y', `${fmt(-s.y * 13)}px`)
    s.card.style.setProperty('--glow-x', `${fmt(s.x * s.halfWidth)}px`)
    s.card.style.setProperty('--glow-y', `${fmt(s.y * s.halfHeight)}px`)
  }

  function animate(time: number) {
    motionFrame = 0
    const dt = lastTime ? Math.min((time - lastTime) / 1000, 1 / 30) : 1 / 60
    lastTime = time
    let hasActiveSpring = false

    for (const s of states) {
      if (!s.active) continue

      const ax = stiffness * (s.tx - s.x) - damping * s.vx
      const ay = stiffness * (s.ty - s.y) - damping * s.vy
      s.vx += ax * dt
      s.vy += ay * dt
      s.x += s.vx * dt
      s.y += s.vy * dt

      if (
        Math.abs(s.tx - s.x) < 0.0003 &&
        Math.abs(s.ty - s.y) < 0.0003 &&
        Math.abs(s.vx) < 0.002 &&
        Math.abs(s.vy) < 0.002
      ) {
        s.x = s.tx
        s.y = s.ty
        s.vx = s.vy = 0
        s.active = false
      } else {
        hasActiveSpring = true
      }
      paintState(s)
    }

    if (hasActiveSpring) motionFrame = requestAnimationFrame(animate)
    else lastTime = 0
  }

  function wake(s: (typeof states)[number]) {
    s.active = true
    if (!motionFrame && !reducedMotion.matches && hoverPointer.matches) {
      motionFrame = requestAnimationFrame(animate)
    }
  }

  function resetInteractions() {
    if (motionFrame) cancelAnimationFrame(motionFrame)
    motionFrame = 0
    lastTime = 0
    for (const s of states) {
      s.x = s.y = s.vx = s.vy = s.tx = s.ty = 0
      s.active = false
      s.card.classList.remove('is-hovered')
      paintState(s)
    }
  }

  const controller = new AbortController()
  for (const s of states) {
    const { card } = s
    card.addEventListener(
      'pointerenter',
      (event) => {
        if (reducedMotion.matches || !hoverPointer.matches || event.pointerType === 'touch') return
        card.classList.add('is-hovered')
      },
      { signal: controller.signal }
    )

    card.addEventListener(
      'pointermove',
      (event) => {
        if (reducedMotion.matches || !hoverPointer.matches || event.pointerType === 'touch') return
        const rect = card.getBoundingClientRect()
        s.halfWidth = rect.width / 2
        s.halfHeight = rect.height / 2
        s.tx = clamp((event.clientX - rect.left - s.halfWidth) / s.halfWidth, -1, 1)
        s.ty = clamp((event.clientY - rect.top - s.halfHeight) / s.halfHeight, -1, 1)
        card.classList.add('is-hovered')
        wake(s)
      },
      { passive: true, signal: controller.signal }
    )

    card.addEventListener(
      'pointerleave',
      () => {
        card.classList.remove('is-hovered')
        if (reducedMotion.matches || !hoverPointer.matches) return
        s.tx = s.ty = 0
        wake(s)
      },
      { signal: controller.signal }
    )
  }

  reducedMotion.addEventListener('change', resetInteractions)
  hoverPointer.addEventListener('change', resetInteractions)

  return () => {
    controller.abort()
    resizeObserver.disconnect()
    window.removeEventListener('resize', requestNoiseRender)
    reducedMotion.removeEventListener('change', resetInteractions)
    hoverPointer.removeEventListener('change', resetInteractions)
    cancelAnimationFrame(resizeFrame)
    resetInteractions()
  }
}
