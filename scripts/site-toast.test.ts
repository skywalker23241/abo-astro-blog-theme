import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const code = ts.transpileModule(readFileSync('src/scripts/site-toast.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText

function fixture() {
  type Handler = (event: Record<string, unknown>) => void
  const animations: { duration: number; state: string }[] = []
  const focusState: { active: ElementStub | null } = { active: null }
  class ElementStub {
    hidden = true
    isConnected = true
    dataset: Record<string, string> = {}
    parentElement: ElementStub | null = null
    handlers = new Map<string, Handler>()
    text = ''
    addEventListener(name: string, handler: Handler) {
      this.handlers.set(name, handler)
    }
    contains(node: ElementStub | null) {
      return node === this || node?.parentElement === this
    }
    focus() {
      focusState.active = this
    }
    append(child: ElementStub) {
      child.parentElement = this
    }
    replaceChildren(text: string) {
      this.text = text
    }
    querySelector(selector: string) {
      return selector === '[data-toast-message]'
        ? message
        : selector === '[data-toast-progress]'
          ? fill
          : close
    }
    animate(_frames: unknown, options: { duration: number }) {
      const animation = { duration: options.duration, state: 'running' }
      animations.push(animation)
      return {
        pause: () => {
          animation.state = 'paused'
        },
        play: () => {
          animation.state = 'running'
        },
        cancel: () => {
          animation.state = 'cancelled'
        }
      }
    }
  }
  const root = new ElementStub(),
    message = new ElementStub(),
    close = new ElementStub(),
    fill = new ElementStub()
  close.parentElement = root
  const body = new ElementStub(),
    dialog = new ElementStub(),
    trigger = new ElementStub()
  focusState.active = trigger
  let modal = false,
    reducedMotion = false,
    now = 0,
    sequence = 0
  const timers = new Map<number, { callback: () => void; delay: number }>()
  const events = new Map<string, Handler>()
  const api: { showToast?: (message: string, type?: string) => void; placeToast?: () => void } = {}
  runInNewContext(code, {
    exports: api,
    HTMLElement: ElementStub,
    Node: ElementStub,
    Date: { now: () => now },
    window: {
      matchMedia: () => ({ matches: reducedMotion }),
      setTimeout: (callback: () => void, delay: number) => {
        timers.set(++sequence, { callback, delay })
        return sequence
      },
      clearTimeout: (id: number) => timers.delete(id)
    },
    document: {
      body,
      get activeElement() {
        return focusState.active
      },
      createTextNode: (text: string) => text,
      querySelector: (selector: string) =>
        selector === '[data-site-toast]' ? root : modal ? dialog : null,
      addEventListener: (name: string, handler: Handler) => events.set(name, handler)
    }
  })
  return {
    api,
    root,
    message,
    close,
    body,
    dialog,
    trigger,
    timers,
    events,
    animations,
    nextTimer: () => {
      const [id, { callback }] = [...timers.entries()][0]
      timers.delete(id)
      callback()
    },
    setReducedMotion: () => {
      reducedMotion = true
    },
    setTime: (time: number) => {
      now = time
    },
    setModal: (open: boolean) => {
      modal = open
    },
    active: () => focusState.active
  }
}

test('notifications replace each other and preserve text without HTML interpretation', () => {
  const f = fixture()
  f.api.showToast!('已复制')
  assert.equal(f.root.hidden, false)
  assert.equal([...f.timers.values()][0].delay, 4500)
  f.api.showToast!('<script>literal ID</script>', 'error')
  assert.equal(f.message.text, '<script>literal ID</script>')
  assert.equal(f.root.dataset.type, 'error')
  assert.equal(f.timers.size, 1)
  assert.equal([...f.timers.values()][0].delay, 6500)
})

test('hover and keyboard focus pause dismissal; close restores the initiating control', () => {
  const f = fixture()
  f.api.showToast!('已复制')
  f.setTime(1000)
  f.root.handlers.get('pointerenter')!({ pointerType: 'mouse' })
  assert.equal(f.timers.size, 0)
  assert.equal(f.animations[0].state, 'paused')
  f.close.focus()
  f.root.handlers.get('focusin')!({})
  f.root.handlers.get('pointerleave')!({})
  assert.equal(f.timers.size, 0)
  f.close.handlers.get('click')!({})
  assert.equal(f.root.hidden, false)
  assert.equal(f.root.dataset.closing, 'true')
  assert.equal([...f.timers.values()][0].delay, 180)
  f.nextTimer()
  assert.equal(f.root.hidden, true)
  assert.equal(f.active(), f.trigger)
})

test('countdown resumes after hover and a new notification cancels an unfinished fade', () => {
  const f = fixture()
  f.api.showToast!('已复制')
  assert.equal(f.animations[0].duration, 4500)
  f.setTime(1000)
  f.root.handlers.get('pointerenter')!({ pointerType: 'mouse' })
  f.root.handlers.get('pointerleave')!({})
  assert.equal([...f.timers.values()][0].delay, 3500)
  assert.equal(f.animations[0].state, 'running')
  f.nextTimer()
  assert.equal(f.root.dataset.closing, 'true')
  f.api.showToast!('下一条', 'error')
  assert.equal(f.root.dataset.closing, 'false')
  assert.equal(f.root.hidden, false)
  assert.equal(f.timers.size, 1)
  assert.equal([...f.timers.values()][0].delay, 6500)
  assert.equal(f.animations[0].state, 'cancelled')
})

test('reduced motion skips the animated countdown and dismisses immediately', () => {
  const f = fixture()
  f.setReducedMotion()
  f.api.showToast!('已复制')
  assert.equal(f.animations.length, 0)
  f.nextTimer()
  assert.equal(f.root.hidden, true)
  assert.equal(f.timers.size, 0)
})

test('notifications remain usable in dialogs and are cleared on route navigation', () => {
  const f = fixture()
  f.setModal(true)
  f.api.showToast!('验证失败', 'error')
  assert.equal(f.root.parentElement, f.dialog)
  f.setModal(false)
  f.api.placeToast!()
  assert.equal(f.root.parentElement, f.body)
  f.events.get('astro:before-swap')!({})
  assert.equal(f.root.hidden, true)
  assert.equal(f.timers.size, 0)
})
