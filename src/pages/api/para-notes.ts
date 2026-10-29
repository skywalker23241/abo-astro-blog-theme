import type { APIRoute } from 'astro'
import { getStore } from '@netlify/blobs'
import { themeConfig } from '@/config'
import { isParaCategory, normalizeParaCategory, type ParaCategory } from '@/data/para-categories'

export const prerender = false

const STORE_NAME = 'para-notes'
const STORE_KEY = 'notes'
const LOCAL_PREVIEW_KEY = 'preview-notes'
const MAX_TITLE_LENGTH = 120
const MAX_CONTENT_LENGTH = 4000
const DEMO_NOTE_ID = 'demo-note'

type NoteRecord = {
  id: string
  title: string
  content: string
  category: ParaCategory
  createdAt: string
  updatedAt: string
}

const DEMO_NOTE: NoteRecord = {
  id: DEMO_NOTE_ID,
  title: 'Demo memo',
  category: 'resources',
  content:
    '这里可以放临时想法、文章草稿、待办事项，或者一句突然冒出来的话。点右上角的 Edit，输入管理员口令后就能新增、编辑和删除。',
  createdAt: '2026-06-03T00:00:00.000Z',
  updatedAt: '2026-06-03T00:00:00.000Z'
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  })
}

function getAdminPasscode() {
  return (
    process.env.PRIVATE_MEMO_ADMIN_PASSCODE || import.meta.env.PRIVATE_MEMO_ADMIN_PASSCODE || ''
  )
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

async function readNotes() {
  if (import.meta.env.DEV) return readPreviewNotes()
  const entry = await getNotesStore().getWithMetadata(STORE_KEY)
  if (entry === null) return { notes: [DEMO_NOTE], revision: 'new' }
  if (!entry.etag) throw new Error('missing revision')
  return { notes: parseStoredNotes(entry.data), revision: entry.etag }
}

function getNotesStore() {
  return getStore({ name: STORE_NAME, consistency: 'strong' })
}

async function writeNotes(notes: NoteRecord[], revision: string) {
  const result = await getNotesStore().set(
    import.meta.env.DEV ? LOCAL_PREVIEW_KEY : STORE_KEY,
    JSON.stringify(notes),
    revision === 'new' ? { onlyIfNew: true } : { onlyIfMatch: revision }
  )
  if (!result.modified) return json({ error: 'conflict' }, 409)
  if (!result.etag) throw new Error('missing revision')
  return result.etag
}

async function readPreviewNotes() {
  const store = getNotesStore()
  // After the first local edit, keep using the isolated preview copy, including an empty one.
  const preview = await store.getWithMetadata(LOCAL_PREVIEW_KEY)
  if (preview !== null) {
    if (!preview.etag) throw new Error('missing revision')
    return { notes: parseStoredNotes(preview.data), revision: preview.etag }
  }

  const response = await fetch(new URL('/api/para-notes', themeConfig.site.website), {
    signal: AbortSignal.timeout(8000),
    cache: 'no-store'
  })
  if (!response.ok) throw new Error('notes unavailable')
  const data: unknown = await response.json()
  if (!data || typeof data !== 'object' || !('notes' in data) || !Array.isArray(data.notes)) {
    throw new Error('invalid notes response')
  }

  const online = parseStoredNotes(JSON.stringify(data.notes))
  const rawLocal = await store.get(STORE_KEY, { type: 'text' })
  const local = rawLocal === null ? [] : parseStoredNotes(rawLocal)
  const merged = new Map(online.map((note) => [note.id, note]))
  for (const note of local) {
    const current = merged.get(note.id)
    if (
      note.id !== DEMO_NOTE_ID &&
      (!current || Date.parse(note.updatedAt) > Date.parse(current.updatedAt))
    ) {
      merged.set(note.id, note)
    }
  }
  return {
    notes: [...merged.values()].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    revision: 'new'
  }
}

function parseStoredNotes(raw: string): NoteRecord[] {
  const parsed = JSON.parse(raw) as unknown
  if (!Array.isArray(parsed)) throw new Error('invalid notes')

  return parsed
    .map((item): NoteRecord => {
      if (!item || typeof item !== 'object') throw new Error('invalid note')
      const note = item as Partial<NoteRecord>
      if (
        typeof note.id !== 'string' ||
        typeof note.title !== 'string' ||
        typeof note.content !== 'string' ||
        typeof note.createdAt !== 'string' ||
        typeof note.updatedAt !== 'string'
      )
        throw new Error('invalid note')
      return { ...note, category: normalizeParaCategory(note.category) } as NoteRecord
    })
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}

async function parseBody(request: Request) {
  try {
    const body: unknown = await request.json()
    return body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null
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
  try {
    return json(await readNotes())
  } catch {
    return json({ error: 'notes unavailable' }, 503)
  }
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

  if (body.category !== undefined && !isParaCategory(body.category)) {
    return json({ error: 'invalid category' }, 400)
  }

  if (!title || !content) {
    return json({ error: 'title or content is invalid' }, 400)
  }

  const now = new Date().toISOString()
  const nextNote: NoteRecord = {
    id: crypto.randomUUID(),
    title,
    content,
    category: normalizeParaCategory(body.category),
    createdAt: now,
    updatedAt: now
  }

  try {
    const { notes, revision } = await readNotes()
    if (body.revision !== revision) return json({ error: 'conflict' }, 409)
    const nextNotes = [nextNote, ...notes.filter((note) => note.id !== DEMO_NOTE_ID)]
    const nextRevision = await writeNotes(nextNotes, revision)
    if (nextRevision instanceof Response) return nextRevision
    return json({ note: nextNote, notes: nextNotes, revision: nextRevision }, 201)
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

  if (body.category !== undefined && !isParaCategory(body.category)) {
    return json({ error: 'invalid category' }, 400)
  }

  if (!id || !title || !content) {
    return json({ error: 'id, title, or content is invalid' }, 400)
  }

  try {
    const { notes, revision } = await readNotes()
    if (body.revision !== revision) return json({ error: 'conflict' }, 409)
    const index = notes.findIndex((note) => note.id === id)
    if (index === -1) return json({ error: 'note not found' }, 404)

    const updatedNote: NoteRecord = {
      ...notes[index],
      title,
      content,
      category:
        body.category === undefined ? notes[index].category : normalizeParaCategory(body.category),
      updatedAt: new Date().toISOString()
    }

    const nextNotes = [...notes]
    nextNotes[index] = updatedNote
    nextNotes.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))

    const nextRevision = await writeNotes(nextNotes, revision)
    if (nextRevision instanceof Response) return nextRevision
    return json({ note: updatedNote, notes: nextNotes, revision: nextRevision }, 200)
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
    const { notes, revision } = await readNotes()
    if (body.revision !== revision) return json({ error: 'conflict' }, 409)
    const nextNotes = notes.filter((note) => note.id !== id)
    if (nextNotes.length === notes.length) return json({ error: 'note not found' }, 404)

    const nextRevision = await writeNotes(nextNotes, revision)
    if (nextRevision instanceof Response) return nextRevision
    return json({ notes: nextNotes, revision: nextRevision }, 200)
  } catch {
    return json({ error: 'storage unavailable' }, 503)
  }
}
