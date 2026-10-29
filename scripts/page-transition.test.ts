import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'

const source = readFileSync('src/components/ui/PageTransition.astro', 'utf8')
const code = source.match(/<script is:inline>([\s\S]*?)<\/script>/)?.[1] ?? ''
assert.ok(code)

function fixture(landing: boolean, reducedMotion = false) {
  function classList(...initial: string[]) {
    const names = new Set(initial)
    return {
      add: (...values: string[]) => values.forEach((value) => names.add(value)),
      remove: (...values: string[]) => values.forEach((value) => names.delete(value)),
      contains: (value: string) => names.has(value)
    }
  }
  const overlay = {
    hidden: false,
    classList: classList(...(landing ? ['is-landing', 'is-active'] : [])),
    setAttribute: () => {}
  }
  const root = { classList: classList() }
  const incoming = { documentElement: { classList: classList() } }
  const handlers = new Map<string, (event: unknown) => void>()
  const timers = new Map<number, () => void>()
  let timerId = 0
  let skipped = false
  runInNewContext(code, {
    performance: { now: () => 100 },
    window: {
      matchMedia: () => ({ matches: reducedMotion }),
      clearTimeout: (id: number) => timers.delete(id),
      setTimeout: (callback: () => void) => {
        timers.set(++timerId, callback)
        return timerId
      },
      addEventListener: () => {}
    },
    document: {
      documentElement: root,
      querySelector: () => overlay,
      addEventListener: (name: string, handler: (event: unknown) => void) =>
        handlers.set(name, handler)
    }
  })
  return {
    overlay,
    root,
    incoming,
    timers,
    skipped: () => skipped,
    swap(pathname = '/blog/') {
      handlers.get('astro:before-swap')?.({
        to: { pathname },
        newDocument: incoming,
        viewTransition: { skipTransition: () => (skipped = true) }
      })
      if (incoming.documentElement.classList.contains('is-landing-pending')) {
        root.classList.add('is-landing-pending')
      }
    },
    loaded: () => handlers.get('astro:page-load')?.({}),
    prepare: () => handlers.get('astro:before-preparation')?.({})
  }
}

test('landing is hidden before swap and starts opening without an extra animation frame', () => {
  const state = fixture(true)
  state.swap()
  assert.ok(state.incoming.documentElement.classList.contains('is-landing-pending'))
  assert.ok(state.skipped())
  state.loaded()
  assert.ok(state.root.classList.contains('is-landing-arrival'))
  assert.ok(!state.root.classList.contains('is-landing-pending'))
  assert.ok(state.overlay.classList.contains('is-opening'))
  for (const callback of [...state.timers.values()]) callback()
  assert.ok(!state.root.classList.contains('is-landing-arrival'))
  assert.ok(!state.overlay.classList.contains('is-active'))
  assert.ok(state.overlay.hidden, 'landing cleanup must not reveal the generic loader')
  state.prepare()
  assert.ok(!state.overlay.hidden, 'later ordinary navigation can still show the loader')
  assert.ok(state.overlay.classList.contains('is-active'))
})

test('ordinary navigation and reduced-motion navigation retain normal transitions', () => {
  for (const reduced of [false, true]) {
    const state = fixture(false, reduced)
    state.swap()
    state.loaded()
    assert.ok(!state.skipped())
    assert.ok(!state.root.classList.contains('is-landing-pending'))
    assert.ok(!state.root.classList.contains('is-landing-arrival'))
  }
})

test('unrelated destinations do not receive landing preparation', () => {
  const state = fixture(true)
  state.swap('/categories/')
  assert.ok(!state.skipped())
  assert.ok(!state.incoming.documentElement.classList.contains('is-landing-pending'))
})
