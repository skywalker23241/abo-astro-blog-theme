import type { APIRoute } from 'astro'
import { getStore } from '@netlify/blobs'

export const prerender = false

const STORE_NAME = 'para-notes'
const STORE_KEY = 'notes'
const MAX_TITLE_LENGTH = 120
const MAX_CONTENT_LENGTH = 4000
const DEMO_NOTE_ID = 'demo-note'

type NoteRecord = {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

const DEMO_NOTE: NoteRecord = {
  id: DEMO_NOTE_ID,
  title: 'Demo memo',
  content:
    '这里可以放临时想法、文章草稿、待办事项，或者一句突然冒出来的话。点右上角的 Edit，输入管理员口令后就能新增、编辑和删除。',
  createdAt: '2026-06-03T00:00:00.000Z',
  updatedAt: '2026-06-03T00:00:00.000Z'
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

function getAdminPasscode() {
  return process.env.PRIVATE_MEMO_ADMIN_PASSCODE || import.meta.env.PRIVATE_MEMO_ADMIN_PASSCODE || ''
}

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.replace(/\r\n/g, '\n').trim()
  if (!normalized || normalized.length > maxLength) return null
  return normalized
}

function sanitizeId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 100) return null
  if (!/^[a-z0-9-]+$/i.test(trimmed)) return null
  return trimmed
}

async function readNotes(): Promise<NoteRecord[]> {
  const store = getStore(STORE_NAME)
  const raw = await store.get(STORE_KEY)
  if (raw === null) return []
  return parseStoredNotes(raw)
}

async function writeNotes(notes: NoteRecord[]) {
  const store = getStore(STORE_NAME)
  await store.set(STORE_KEY, JSON.stringify(notes))
}

function parseStoredNotes(raw: string): NoteRecord[] {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((item): item is NoteRecord => {
        if (!item || typeof item !== 'object') return false
        const note = item as Partial<NoteRecord>
        return (
          typeof note.id === 'string' &&
          typeof note.title === 'string' &&
          typeof note.content === 'string' &&
          typeof note.createdAt === 'string' &&
          typeof note.updatedAt === 'string'
        )
      })
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  } catch {
    return []
  }
}

async function readStoreState() {
  try {
    const store = getStore(STORE_NAME)
    const raw = await store.get(STORE_KEY)
    if (raw === null) {
      return {
        initialized: false,
        notes: [DEMO_NOTE]
      }
    }

    return {
      initialized: true,
      notes: parseStoredNotes(raw)
    }
  } catch {
    return {
      initialized: false,
      notes: [DEMO_NOTE]
    }
  }
}

async function parseBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>
  } catch {
    return null
  }
}

function authorize(passcode: unknown) {
  const configuredPasscode = getAdminPasscode()
  if (!configuredPasscode) {
    return { ok: false, reason: 'admin passcode is not configured', status: 503 }
  }

  if (typeof passcode !== 'string' || passcode !== configuredPasscode) {
    return { ok: false, reason: 'invalid admin passcode', status: 401 }
  }

  return { ok: true as const }
}

export const GET: APIRoute = async () => {
  const { notes } = await readStoreState()

  return json(
    {
      notes
    },
    200
  )
}

export const POST: APIRoute = async ({ request }) => {
  const body = await parseBody(request)
  if (!body) return json({ error: 'invalid body' }, 400)

  const auth = authorize(body.passcode)
  if (!auth.ok) return json({ error: auth.reason }, auth.status)

  if (body.dryRun === true) {
    return json({ ok: true }, 200)
  }

  const title = normalizeText(body.title, MAX_TITLE_LENGTH)
  const content = normalizeText(body.content, MAX_CONTENT_LENGTH)

  if (!title || !content) {
    return json({ error: 'title or content is invalid' }, 400)
  }

  const now = new Date().toISOString()
  const nextNote: NoteRecord = {
    id: crypto.randomUUID(),
    title,
    content,
    createdAt: now,
    updatedAt: now
  }

  try {
    const notes = await readNotes()
    const nextNotes = [nextNote, ...notes.filter((note) => note.id !== DEMO_NOTE_ID)]
    await writeNotes(nextNotes)
    return json({ note: nextNote, notes: nextNotes }, 201)
  } catch {
    return json({ error: 'storage unavailable' }, 503)
  }
}

export const PUT: APIRoute = async ({ request }) => {
  const body = await parseBody(request)
  if (!body) return json({ error: 'invalid body' }, 400)

  const auth = authorize(body.passcode)
  if (!auth.ok) return json({ error: auth.reason }, auth.status)

  const id = sanitizeId(body.id)
  const title = normalizeText(body.title, MAX_TITLE_LENGTH)
  const content = normalizeText(body.content, MAX_CONTENT_LENGTH)

  if (!id || !title || !content) {
    return json({ error: 'id, title, or content is invalid' }, 400)
  }

  try {
    const notes = await readNotes()
    const index = notes.findIndex((note) => note.id === id)
    if (index === -1) return json({ error: 'note not found' }, 404)

    const updatedNote: NoteRecord = {
      ...notes[index],
      title,
      content,
      updatedAt: new Date().toISOString()
    }

    const nextNotes = [...notes]
    nextNotes[index] = updatedNote
    nextNotes.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))

    await writeNotes(nextNotes)
    return json({ note: updatedNote, notes: nextNotes }, 200)
  } catch {
    return json({ error: 'storage unavailable' }, 503)
  }
}

export const DELETE: APIRoute = async ({ request }) => {
  const body = await parseBody(request)
  if (!body) return json({ error: 'invalid body' }, 400)

  const auth = authorize(body.passcode)
  if (!auth.ok) return json({ error: auth.reason }, auth.status)

  const id = sanitizeId(body.id)
  if (!id) return json({ error: 'invalid id' }, 400)

  try {
    const notes = await readNotes()
    const nextNotes = notes.filter((note) => note.id !== id)
    if (id === DEMO_NOTE_ID && notes.some((note) => note.id === DEMO_NOTE_ID)) {
      await writeNotes([])
      return json({ notes: [] }, 200)
    }

    if (nextNotes.length === notes.length) return json({ error: 'note not found' }, 404)

    await writeNotes(nextNotes)
    return json({ notes: nextNotes }, 200)
  } catch {
    return json({ error: 'storage unavailable' }, 503)
  }
}
