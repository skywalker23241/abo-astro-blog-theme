import { createHash, createHmac } from 'node:crypto'
import type { APIRoute } from 'astro'
import { getStore as getNetlifyStore } from '@netlify/blobs'
import { purgeCache } from '@netlify/functions'
import {
  getVideoReference,
  getVideoReferenceFromUrl,
  getVideoSourceProfile,
  isExternalVideoSource,
  R2_FREE_STORAGE_BYTES,
  SELF_HOSTED_VIDEO_ORIGIN,
  videoSourceProfiles,
  type VideoSource
} from '@/lib/game-video'
import { getDefaultVideoTitle } from '@/lib/game-highlight-title'
import {
  gameHighlights,
  gameProfiles,
  type GameHighlight,
  type GameId
} from '@/data/game-highlights'

export const prerender = false

const R2_DEFAULT_BUCKET = 'clips'
const R2_DEFAULT_OBJECT_KEY = 'meta/game-highlights.json'
const LEGACY_STORE_NAME = 'game-highlights'
const LEGACY_STORE_KEY = 'highlights'
const LEGACY_R2_DEMO_HIGHLIGHT_ID = 'r2-demo-2026-07-20-171901'
const LEGACY_R2_DEMO_VIDEO_URL = 'https://media.example.com/2026-07-20%2017-19-01.mp4'
const MAX_TITLE_LENGTH = 120
const MAX_DESCRIPTION_LENGTH = 4000
const MAX_TAG_LENGTH = 30
const MAX_TAGS = 12
const R2_LIST_MAX_KEYS = 1000
const R2_LIST_MAX_PAGES = 100
const R2_REQUEST_TIMEOUT_MS = 12_000
const R2_METADATA_WRITE_ATTEMPTS = 3
const PUBLIC_BROWSER_CACHE = 'public, max-age=30, stale-while-revalidate=120'
const PUBLIC_NETLIFY_CACHE = 'public, durable, max-age=300, stale-while-revalidate=3600'
const PUBLIC_CACHE_TAG = 'game-highlights'
const R2_GAME_PREFIXES: Record<GameId, string> = {
  valorant: 'val/',
  'delta-force': 'df/',
  'league-of-legends': 'lol/',
  cs2: 'cs2/'
}
const VIDEO_CONTENT_TYPES: Record<string, string> = {
  '.m4v': 'video/x-m4v',
  '.mov': 'video/quicktime',
  '.mp4': 'video/mp4',
  '.ogv': 'video/ogg',
  '.webm': 'video/webm'
}
const gameIds = new Set<GameId>(gameProfiles.map((profile) => profile.id))
const videoSourceIds = new Set<VideoSource>(videoSourceProfiles.map((source) => source.id))

interface R2Config {
  endpoint: string
  bucket: string
  objectKey: string
  accessKeyId: string
  secretAccessKey: string
}

interface R2ListedObject {
  key: string
  sizeBytes: number
  lastModified?: string
}

interface StorageSummary {
  scope: 'bucket' | 'registered-videos'
  capacityBytes: number
  usedBytes: number
  remainingBytes: number
  exceededByBytes: number
  percentage: number
  exceeded: boolean
  totalVideoCount: number
  countedVideoCount: number
  unknownVideoCount: number
  totalObjectCount?: number
  unclassifiedVideoCount?: number
}

interface R2Library {
  highlights: GameHighlight[]
  objects: R2ListedObject[]
  storageSummary: StorageSummary
}

interface HighlightMetadataState {
  highlights: GameHighlight[]
  etag?: string
  exists: boolean
}

interface R2LibraryCacheEntry {
  key: string
  library: R2Library
}

interface R2LibraryLoad {
  key: string
  promise: Promise<R2Library>
}

class HighlightMetadataError extends Error {}

class R2RequestError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
  }
}

let r2LibraryCache: R2LibraryCacheEntry | null = null
let r2LibraryLoad: R2LibraryLoad | null = null
let r2LibraryGeneration = 0

function getEnv(name: string) {
  const runtimeValue = process.env[name]
  const buildEnv = import.meta.env as unknown as Record<string, string | undefined> | undefined
  const buildValue = buildEnv?.[name]
  return runtimeValue || buildValue || ''
}

function getR2Config(): R2Config | null {
  const accountId = getEnv('R2_ACCOUNT_ID') || getEnv('CLOUDFLARE_ACCOUNT_ID')
  const endpoint =
    getEnv('R2_ENDPOINT') || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '')
  const accessKeyId = getEnv('R2_ACCESS_KEY_ID')
  const secretAccessKey = getEnv('R2_SECRET_ACCESS_KEY')

  if (!endpoint || !accessKeyId || !secretAccessKey) return null

  try {
    const parsedEndpoint = new URL(endpoint)
    if (parsedEndpoint.protocol !== 'https:') return null
  } catch {
    return null
  }

  return {
    endpoint: endpoint.replace(/\/+$/, ''),
    bucket: getEnv('R2_BUCKET_NAME') || getEnv('R2_BUCKET') || R2_DEFAULT_BUCKET,
    objectKey: getEnv('R2_HIGHLIGHTS_KEY') || R2_DEFAULT_OBJECT_KEY,
    accessKeyId,
    secretAccessKey
  }
}

function json(data: unknown, status = 200, cache = false) {
  const headers: Record<string, string> = {
    'cache-control': cache ? PUBLIC_BROWSER_CACHE : 'no-store',
    'content-type': 'application/json'
  }
  if (cache) {
    headers['netlify-cdn-cache-control'] = PUBLIC_NETLIFY_CACHE
    headers['netlify-cache-tag'] = PUBLIC_CACHE_TAG
  }

  return new Response(JSON.stringify(data), {
    status,
    headers
  })
}

function getAdminPasscode() {
  return getEnv('PRIVATE_MEMO_ADMIN_PASSCODE')
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

function normalizeText(value: unknown, maxLength: number, fallback = ''): string | null {
  if (value === undefined || value === null) return fallback
  if (typeof value !== 'string') return null

  const normalized = value.replace(/\r\n/g, '\n').trim()
  if (!normalized) return fallback
  if (normalized.length > maxLength) return null
  return normalized
}

function normalizeGame(value: unknown): GameId | null {
  return typeof value === 'string' && gameIds.has(value as GameId) ? (value as GameId) : null
}

function normalizeSource(value: unknown): VideoSource | null {
  return typeof value === 'string' && videoSourceIds.has(value as VideoSource)
    ? (value as VideoSource)
    : null
}

function normalizeTags(value: unknown, strict = true): string[] | null {
  if (value === undefined || value === null || value === '') return []
  if (!Array.isArray(value)) return null
  if (strict && value.some((tag) => typeof tag !== 'string')) return null

  const tags = value
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter(Boolean)
  const limitedTags = strict ? tags : tags.slice(0, MAX_TAGS)

  if (
    (strict && limitedTags.length > MAX_TAGS) ||
    limitedTags.some((tag) => tag.length > MAX_TAG_LENGTH)
  ) {
    return null
  }
  return [...new Set(limitedTags)]
}

function normalizeSizeBytes(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined
}

function normalizeStoredHighlight(value: unknown, strict = true): GameHighlight | null {
  if (!value || typeof value !== 'object') return null

  const item = value as Partial<GameHighlight>
  const id = typeof item.id === 'string' ? item.id.trim() : ''
  const game = normalizeGame(item.game)
  const source = normalizeSource(item.source)
  const inputUrl = typeof item.url === 'string' ? item.url : ''
  const reference = source ? getVideoReference(source, inputUrl) : null
  const title = normalizeText(item.title, MAX_TITLE_LENGTH, '精彩时刻')
  const description = normalizeText(item.description, MAX_DESCRIPTION_LENGTH)
  const tags = normalizeTags(item.tags, strict)
  const sizeBytes = normalizeSizeBytes(item.sizeBytes)
  const contentType = normalizeText(item.contentType, 200)
  const sizeCheckedAt = normalizeText(item.sizeCheckedAt, 50)

  if (
    !id ||
    !game ||
    !reference ||
    !title ||
    description === null ||
    tags === null ||
    contentType === null ||
    sizeCheckedAt === null
  ) {
    return null
  }

  return {
    id,
    game,
    source: reference.source,
    url: reference.url,
    title,
    date: typeof item.date === 'string' ? item.date : undefined,
    description: description || undefined,
    tags: tags.length > 0 ? tags : undefined,
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : undefined,
    sizeBytes,
    contentType: contentType || undefined,
    sizeCheckedAt: sizeCheckedAt || undefined
  }
}

function parseStoredHighlights(raw: string, strict = true): GameHighlight[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    throw new HighlightMetadataError('highlight metadata is not valid JSON')
  }

  if (!Array.isArray(parsed)) {
    throw new HighlightMetadataError('highlight metadata must be an array')
  }

  const normalized = parsed.map((highlight) => normalizeStoredHighlight(highlight, strict))
  if (strict && normalized.some((highlight) => highlight === null)) {
    throw new HighlightMetadataError('highlight metadata contains an invalid item')
  }

  return normalized
    .filter((highlight): highlight is GameHighlight => highlight !== null)
    .filter(
      (highlight) =>
        highlight.id !== LEGACY_R2_DEMO_HIGHLIGHT_ID && highlight.url !== LEGACY_R2_DEMO_VIDEO_URL
    )
    .sort((a, b) => {
      const left = Date.parse(a.createdAt || a.date || '') || 0
      const right = Date.parse(b.createdAt || b.date || '') || 0
      return right - left
    })
}

function encodeRfc3986(value: string) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  )
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function hmac(key: string | Uint8Array, value: string) {
  return Uint8Array.from(createHmac('sha256', key).update(value).digest())
}

function getObjectPath(bucket: string, objectKey: string) {
  const encodedBucket = encodeRfc3986(bucket)
  const encodedKey = objectKey.split('/').map(encodeRfc3986).join('/')
  return `/${encodedBucket}/${encodedKey}`
}

function getBucketPath(bucket: string) {
  return `/${encodeRfc3986(bucket)}`
}

function getCanonicalQuery(parameters: Record<string, string>) {
  return Object.entries(parameters)
    .map(([name, value]) => [encodeRfc3986(name), encodeRfc3986(value)] as const)
    .sort(([leftName, leftValue], [rightName, rightValue]) => {
      if (leftName !== rightName) return leftName < rightName ? -1 : 1
      if (leftValue === rightValue) return 0
      return leftValue < rightValue ? -1 : 1
    })
    .map(([name, value]) => `${name}=${value}`)
    .join('&')
}

function getSignedRequest(
  config: R2Config,
  method: 'GET' | 'PUT',
  body: string,
  objectKey: string | null = config.objectKey,
  query: Record<string, string> = {},
  conditions: { ifMatch?: string; ifNoneMatch?: string } = {}
) {
  const payloadHash = sha256(body)
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const shortDate = amzDate.slice(0, 8)
  const scope = `${shortDate}/auto/s3/aws4_request`
  const requestUrl = new URL(config.endpoint)
  const canonicalUri =
    objectKey === null ? getBucketPath(config.bucket) : getObjectPath(config.bucket, objectKey)
  const canonicalQuery = getCanonicalQuery(query)
  requestUrl.pathname = canonicalUri
  requestUrl.search = canonicalQuery

  const headers = [
    { name: 'host', value: requestUrl.host },
    { name: 'x-amz-content-sha256', value: payloadHash },
    { name: 'x-amz-date', value: amzDate }
  ]
  if (method === 'PUT') headers.push({ name: 'content-type', value: 'application/json' })
  if (conditions.ifMatch) headers.push({ name: 'if-match', value: conditions.ifMatch })
  if (conditions.ifNoneMatch) {
    headers.push({ name: 'if-none-match', value: conditions.ifNoneMatch })
  }
  headers.sort((left, right) => left.name.localeCompare(right.name))

  const canonicalHeaders = headers.map(({ name, value }) => `${name}:${value}\n`).join('')
  const signedHeaders = headers.map(({ name }) => name).join(';')
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n')
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n')
  const dateKey = hmac(`AWS4${config.secretAccessKey}`, shortDate)
  const regionKey = hmac(dateKey, 'auto')
  const serviceKey = hmac(regionKey, 's3')
  const signingKey = hmac(serviceKey, 'aws4_request')
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex')

  const requestHeaders: Record<string, string> = {
    authorization:
      `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    host: requestUrl.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate
  }
  if (method === 'PUT') requestHeaders['content-type'] = 'application/json'
  if (conditions.ifMatch) requestHeaders['if-match'] = conditions.ifMatch
  if (conditions.ifNoneMatch) requestHeaders['if-none-match'] = conditions.ifNoneMatch

  return { url: requestUrl, headers: requestHeaders }
}

async function fetchR2(url: URL, init: RequestInit) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), R2_REQUEST_TIMEOUT_MS)

  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new R2RequestError(504, 'R2 request timed out')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

async function requestR2(
  config: R2Config,
  method: 'GET' | 'PUT',
  body = '',
  conditions: { ifMatch?: string; ifNoneMatch?: string } = {}
) {
  const { url, headers } = getSignedRequest(config, method, body, config.objectKey, {}, conditions)
  // Compression can replace the object's strong ETag with a weak one that cannot guard writes.
  if (method === 'GET') headers['accept-encoding'] = 'identity'
  const response = await fetchR2(url, {
    method,
    headers,
    body: method === 'PUT' ? body : undefined
  })
  const responseBody = await response.text()

  if (!response.ok) {
    throw new R2RequestError(response.status, responseBody.slice(0, 200))
  }

  return {
    body: responseBody,
    etag: response.headers.get('etag') || undefined
  }
}

function decodeXmlText(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (entity, digits: string) => {
      const codePoint = Number.parseInt(digits, 16)
      return Number.isInteger(codePoint) && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity
    })
    .replace(/&#(\d+);/g, (entity, digits: string) => {
      const codePoint = Number.parseInt(digits, 10)
      return Number.isInteger(codePoint) && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity
    })
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function getXmlValue(xml: string, tagName: string) {
  const match = xml.match(
    new RegExp(`<(?:[\\w-]+:)?${tagName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tagName}>`, 'i')
  )
  return match ? decodeXmlText(match[1].trim()) : null
}

function decodeR2ObjectKey(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function parseR2ListResponse(raw: string) {
  if (!/<(?:[\w-]+:)?ListBucketResult\b/i.test(raw)) {
    throw new R2RequestError(502, 'R2 returned an invalid object list')
  }

  const objects: R2ListedObject[] = []
  const contentPattern = /<(?:[\w-]+:)?Contents\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?Contents>/gi
  for (const match of raw.matchAll(contentPattern)) {
    const keyValue = getXmlValue(match[1], 'Key')
    const sizeValue = Number(getXmlValue(match[1], 'Size'))
    if (!keyValue || !Number.isSafeInteger(sizeValue) || sizeValue < 0) continue

    const lastModified = getXmlValue(match[1], 'LastModified') || undefined
    objects.push({
      key: decodeR2ObjectKey(keyValue),
      sizeBytes: sizeValue,
      lastModified
    })
  }

  return {
    objects,
    truncated: getXmlValue(raw, 'IsTruncated') === 'true',
    nextContinuationToken: getXmlValue(raw, 'NextContinuationToken') || undefined
  }
}

async function requestR2ObjectPage(config: R2Config, continuationToken?: string) {
  const query: Record<string, string> = {
    'encoding-type': 'url',
    'list-type': '2',
    'max-keys': String(R2_LIST_MAX_KEYS)
  }
  if (continuationToken) query['continuation-token'] = continuationToken

  const { url, headers } = getSignedRequest(config, 'GET', '', null, query)
  const response = await fetchR2(url, { method: 'GET', headers })
  const responseBody = await response.text()
  if (!response.ok) {
    throw new R2RequestError(response.status, responseBody.slice(0, 200))
  }

  return parseR2ListResponse(responseBody)
}

async function listR2Objects(config: R2Config) {
  const objects: R2ListedObject[] = []
  let continuationToken: string | undefined

  for (let page = 0; page < R2_LIST_MAX_PAGES; page += 1) {
    const result = await requestR2ObjectPage(config, continuationToken)
    objects.push(...result.objects)
    if (!result.truncated) return objects
    if (!result.nextContinuationToken) {
      throw new R2RequestError(502, 'R2 object list pagination token is missing')
    }
    continuationToken = result.nextContinuationToken
  }

  throw new R2RequestError(502, 'R2 object list exceeded the pagination limit')
}

function isMissingObject(error: unknown) {
  return error instanceof R2RequestError && error.status === 404
}

function isWriteConflict(error: unknown) {
  return error instanceof R2RequestError && (error.status === 409 || error.status === 412)
}

async function readLegacyHighlights() {
  try {
    const store = getNetlifyStore(LEGACY_STORE_NAME)
    const raw = await store.get(LEGACY_STORE_KEY, { type: 'text' })
    return raw ? parseStoredHighlights(raw, false) : null
  } catch {
    // Legacy data is a best-effort migration source. It must never block
    // creation of the authoritative R2 metadata object.
    return null
  }
}

async function readHighlightMetadata(config: R2Config): Promise<HighlightMetadataState> {
  try {
    const response = await requestR2(config, 'GET')
    if (!response.etag) {
      throw new HighlightMetadataError('highlight metadata ETag is missing')
    }

    return {
      highlights: parseStoredHighlights(response.body),
      etag: response.etag,
      exists: true
    }
  } catch (error) {
    if (!isMissingObject(error)) throw error

    const legacyHighlights = await readLegacyHighlights()
    return {
      highlights:
        legacyHighlights && legacyHighlights.length > 0 ? legacyHighlights : [...gameHighlights],
      exists: false
    }
  }
}

async function writeHighlightMetadata(
  config: R2Config,
  highlights: GameHighlight[],
  metadataState: HighlightMetadataState
) {
  await requestR2(
    config,
    'PUT',
    JSON.stringify(highlights),
    metadataState.exists
      ? { ifMatch: metadataState.etag }
      : {
          ifNoneMatch: '*'
        }
  )
}

function getR2ObjectKey(urlValue: string) {
  try {
    const url = new URL(urlValue)
    return url.pathname
      .replace(/^\/+/, '')
      .split('/')
      .map((segment) => decodeURIComponent(segment))
      .join('/')
  } catch {
    return null
  }
}

function getGameFromObjectKey(objectKey: string): GameId | null {
  const match = (Object.entries(R2_GAME_PREFIXES) as Array<[GameId, string]>).find(
    ([, prefix]) => objectKey.startsWith(prefix) && objectKey.length > prefix.length
  )
  return match?.[0] || null
}

function getVideoContentType(objectKey: string) {
  const extension = objectKey.toLowerCase().match(/\.[^./]+$/)?.[0] || ''
  return VIDEO_CONTENT_TYPES[extension]
}

function isVideoObjectKey(objectKey: string) {
  return Boolean(getVideoContentType(objectKey))
}

function getPublicR2Url(objectKey: string) {
  const encodedKey = objectKey.split('/').map(encodeRfc3986).join('/')
  return `${SELF_HOSTED_VIDEO_ORIGIN}/${encodedKey}`
}

function getReferenceIdentity(reference: ReturnType<typeof getVideoReferenceFromUrl>) {
  if (!reference) return ''
  if (reference.source === 'r2') {
    const objectKey = getR2ObjectKey(reference.url)
    return objectKey ? `r2:${objectKey}` : ''
  }
  return `${reference.source}:${reference.videoId || reference.url}`
}

function getHighlightIdentity(highlight: GameHighlight) {
  return getReferenceIdentity(getVideoReference(highlight.source, highlight.url))
}

function mergeR2ObjectsWithMetadata(objects: R2ListedObject[], metadata: GameHighlight[]) {
  const metadataByKey = new Map<string, GameHighlight>()
  metadata.forEach((highlight) => {
    if (highlight.source !== 'r2') return
    const objectKey = getR2ObjectKey(highlight.url)
    if (objectKey && !metadataByKey.has(objectKey)) metadataByKey.set(objectKey, highlight)
  })

  const scannedAt = new Date().toISOString()
  const highlights: GameHighlight[] = []
  let unclassifiedVideoCount = 0

  objects.forEach((object) => {
    if (!isVideoObjectKey(object.key)) return

    const stored = metadataByKey.get(object.key)
    const game = getGameFromObjectKey(object.key) || stored?.game || null
    if (!game) {
      unclassifiedVideoCount += 1
      return
    }

    const reference = getVideoReference('r2', getPublicR2Url(object.key))
    if (!reference) return

    highlights.push({
      id: stored?.id || `r2-${sha256(object.key).slice(0, 20)}`,
      game,
      source: reference.source,
      url: reference.url,
      title: stored?.title || getDefaultVideoTitle(object.key, game),
      date: stored?.date || object.lastModified?.slice(0, 10),
      description: stored?.description,
      tags: stored?.tags,
      createdAt: object.lastModified || stored?.createdAt,
      sizeBytes: object.sizeBytes,
      contentType: getVideoContentType(object.key) || stored?.contentType,
      sizeCheckedAt: scannedAt
    })
  })

  highlights.push(...metadata.filter((highlight) => isExternalVideoSource(highlight.source)))

  highlights.sort((left, right) => {
    const leftTime = Date.parse(left.createdAt || left.date || '') || 0
    const rightTime = Date.parse(right.createdAt || right.date || '') || 0
    return rightTime - leftTime
  })

  return { highlights, unclassifiedVideoCount }
}

function getBucketStorageSummary(
  objects: R2ListedObject[],
  highlights: GameHighlight[],
  unclassifiedVideoCount: number
): StorageSummary {
  const usedBytes = objects.reduce((total, object) => total + object.sizeBytes, 0)
  const exceededByBytes = Math.max(0, usedBytes - R2_FREE_STORAGE_BYTES)
  const r2VideoCount = highlights.filter((highlight) => highlight.source === 'r2').length

  return {
    scope: 'bucket',
    capacityBytes: R2_FREE_STORAGE_BYTES,
    usedBytes,
    remainingBytes: Math.max(0, R2_FREE_STORAGE_BYTES - usedBytes),
    exceededByBytes,
    percentage: Math.round((usedBytes / R2_FREE_STORAGE_BYTES) * 10_000) / 100,
    exceeded: exceededByBytes > 0,
    totalVideoCount: r2VideoCount,
    countedVideoCount: r2VideoCount,
    unknownVideoCount: 0,
    totalObjectCount: objects.length,
    unclassifiedVideoCount
  }
}

async function readR2Library(
  config: R2Config,
  knownMetadata?: GameHighlight[]
): Promise<R2Library> {
  const [metadataState, objects] = await Promise.all([
    knownMetadata
      ? Promise.resolve<HighlightMetadataState>({
          highlights: knownMetadata,
          exists: true
        })
      : readHighlightMetadata(config),
    listR2Objects(config)
  ])
  const { highlights, unclassifiedVideoCount } = mergeR2ObjectsWithMetadata(
    objects,
    metadataState.highlights
  )

  return {
    highlights,
    objects,
    storageSummary: getBucketStorageSummary(objects, highlights, unclassifiedVideoCount)
  }
}

function getR2LibraryCacheKey(config: R2Config) {
  return `${config.endpoint}|${config.bucket}|${config.objectKey}`
}

function setR2LibraryCache(config: R2Config, library: R2Library) {
  r2LibraryCache = {
    key: getR2LibraryCacheKey(config),
    library
  }
}

function invalidateR2LibraryCache() {
  r2LibraryGeneration += 1
  r2LibraryCache = null
  r2LibraryLoad = null
}

function getStaleR2Library(config: R2Config) {
  return r2LibraryCache?.key === getR2LibraryCacheKey(config) ? r2LibraryCache.library : null
}

async function getR2LibraryWithCoalescing(config: R2Config) {
  const key = getR2LibraryCacheKey(config)
  if (r2LibraryLoad?.key === key) return r2LibraryLoad.promise

  const generation = r2LibraryGeneration
  const promise = readR2Library(config)
    .then((library) => {
      if (generation === r2LibraryGeneration) setR2LibraryCache(config, library)
      return library
    })
    .finally(() => {
      if (r2LibraryLoad?.promise === promise) r2LibraryLoad = null
    })
  r2LibraryLoad = { key, promise }
  return promise
}

async function purgePublicHighlightsCache() {
  try {
    await purgeCache({ tags: [PUBLIC_CACHE_TAG] })
    return true
  } catch {
    // The metadata write is already committed at this point. Report the purge
    // result to the client without turning a successful write into a false error.
    return false
  }
}

function getStorageSummary(highlights: GameHighlight[]): StorageSummary {
  const uniqueSelfHostedHighlights = new Map<string, GameHighlight>()
  highlights.forEach((highlight) => {
    if (highlight.source !== 'r2') return

    let storageIdentity = highlight.url
    try {
      const url = new URL(highlight.url)
      storageIdentity = `${url.origin}${url.pathname}`
    } catch {
      // Stored links have already been normalized; retain the raw value as a safe fallback.
    }

    const existing = uniqueSelfHostedHighlights.get(storageIdentity)
    if (!existing || (existing.sizeBytes === undefined && highlight.sizeBytes !== undefined)) {
      uniqueSelfHostedHighlights.set(storageIdentity, highlight)
    }
  })

  const selfHostedHighlights = [...uniqueSelfHostedHighlights.values()]
  const countedHighlights = selfHostedHighlights.filter(
    (highlight) => highlight.sizeBytes !== undefined
  )
  const usedBytes = countedHighlights.reduce(
    (total, highlight) => total + (highlight.sizeBytes || 0),
    0
  )
  const exceededByBytes = Math.max(0, usedBytes - R2_FREE_STORAGE_BYTES)

  return {
    scope: 'registered-videos',
    capacityBytes: R2_FREE_STORAGE_BYTES,
    usedBytes,
    remainingBytes: Math.max(0, R2_FREE_STORAGE_BYTES - usedBytes),
    exceededByBytes,
    percentage: Math.round((usedBytes / R2_FREE_STORAGE_BYTES) * 10_000) / 100,
    exceeded: exceededByBytes > 0,
    totalVideoCount: selfHostedHighlights.length,
    countedVideoCount: countedHighlights.length,
    unknownVideoCount: selfHostedHighlights.length - countedHighlights.length
  }
}

async function parseBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>
  } catch {
    return null
  }
}

async function respondAfterMetadataWrite(
  config: R2Config,
  highlights: GameHighlight[],
  extra: Record<string, unknown> = {},
  status = 200
) {
  invalidateR2LibraryCache()
  const cacheInvalidated = await purgePublicHighlightsCache()

  try {
    const library = await readR2Library(config, highlights)
    setR2LibraryCache(config, library)
    return json(
      {
        ...extra,
        highlights: library.highlights,
        storageAvailable: true,
        storageIssue:
          library.storageSummary.unclassifiedVideoCount &&
          library.storageSummary.unclassifiedVideoCount > 0
            ? 'unclassified-videos'
            : undefined,
        cacheInvalidated,
        scanPrefixes: R2_GAME_PREFIXES,
        storageSummary: library.storageSummary
      },
      status
    )
  } catch {
    const storageSummary = getStorageSummary(highlights)
    setR2LibraryCache(config, { highlights, objects: [], storageSummary })
    return json(
      {
        ...extra,
        highlights,
        storageAvailable: false,
        storageIssue: 'r2-scan-unavailable',
        cacheInvalidated,
        scanPrefixes: R2_GAME_PREFIXES,
        storageSummary
      },
      status
    )
  }
}

export async function getInteractionHighlightIds(): Promise<Set<string>> {
  const config = getR2Config()
  if (!config) return new Set(gameHighlights.map(({ id }) => id))
  try {
    const library = await getR2LibraryWithCoalescing(config)
    return new Set(library.highlights.map(({ id }) => id))
  } catch {
    const library = getStaleR2Library(config)
    if (!library) throw new Error('Highlights unavailable')
    return new Set(library.highlights.map(({ id }) => id))
  }
}

export const GET: APIRoute = async () => {
  const config = getR2Config()
  if (!config) {
    return json({
      highlights: gameHighlights,
      storage: 'r2',
      storageAvailable: false,
      storageIssue: 'r2-not-configured',
      storageSummary: getStorageSummary(gameHighlights)
    })
  }

  try {
    const library = await getR2LibraryWithCoalescing(config)
    return json(
      {
        highlights: library.highlights,
        storage: 'r2',
        storageAvailable: true,
        storageIssue:
          library.storageSummary.unclassifiedVideoCount &&
          library.storageSummary.unclassifiedVideoCount > 0
            ? 'unclassified-videos'
            : undefined,
        scanPrefixes: R2_GAME_PREFIXES,
        storageSummary: library.storageSummary
      },
      200,
      true
    )
  } catch (error) {
    const staleLibrary = getStaleR2Library(config)
    if (staleLibrary) {
      return json(
        {
          highlights: staleLibrary.highlights,
          storage: 'r2',
          storageAvailable: false,
          storageIssue:
            error instanceof HighlightMetadataError ? 'metadata-invalid' : 'stale-cache',
          scanPrefixes: R2_GAME_PREFIXES,
          storageSummary: staleLibrary.storageSummary
        },
        200,
        false
      )
    }

    return json({
      highlights: gameHighlights,
      storage: 'r2',
      storageAvailable: false,
      storageIssue: error instanceof HighlightMetadataError ? 'metadata-invalid' : 'r2-unavailable',
      storageSummary: getStorageSummary(gameHighlights)
    })
  }
}

export const POST: APIRoute = async ({ request }) => {
  const body = await parseBody(request)
  if (!body) return json({ error: 'invalid body' }, 400)

  const auth = authorize(body.passcode)
  if (!auth.ok) return json({ error: auth.reason }, auth.status)

  if (body.action === 'verify') {
    return json({ authenticated: true })
  }

  const config = getR2Config()
  if (!config) return json({ error: 'r2 storage is not configured' }, 503)

  if (body.action === 'sync') {
    try {
      invalidateR2LibraryCache()
      const library = await getR2LibraryWithCoalescing(config)
      return json({
        highlights: library.highlights,
        storageAvailable: true,
        storageSummary: library.storageSummary
      })
    } catch {
      return json({ error: 'r2 storage unavailable' }, 503)
    }
  }

  const reference = typeof body.url === 'string' ? getVideoReferenceFromUrl(body.url) : null
  const game = normalizeGame(body.game)
  const providedTitle = normalizeText(body.title, MAX_TITLE_LENGTH)
  const description = normalizeText(body.description, MAX_DESCRIPTION_LENGTH)
  const tags = normalizeTags(body.tags)

  if (
    !game ||
    !reference ||
    !isExternalVideoSource(reference.source) ||
    !reference.embedUrl ||
    providedTitle === null ||
    description === null ||
    tags === null
  ) {
    return json(
      { error: 'game, supported video link, title, description, or tags is invalid' },
      400
    )
  }

  const referenceIdentity = getReferenceIdentity(reference)
  const requestedId = crypto.randomUUID()
  const requestedAt = new Date().toISOString()

  try {
    for (let attempt = 0; attempt < R2_METADATA_WRITE_ATTEMPTS; attempt += 1) {
      const metadataState = await readHighlightMetadata(config)
      const existing = metadataState.highlights.find(
        (highlight) => getHighlightIdentity(highlight) === referenceIdentity
      )
      const defaultTitle = `${getVideoSourceProfile(reference.source)?.label || '外链'}精彩时刻`
      const nextHighlight: GameHighlight = {
        id: existing?.id || requestedId,
        game,
        source: reference.source,
        url: reference.url,
        title: providedTitle || existing?.title || defaultTitle,
        date: existing?.date || requestedAt.slice(0, 10),
        description: description || undefined,
        tags: tags.length > 0 ? tags : undefined,
        createdAt: existing?.createdAt || requestedAt
      }
      const nextMetadata = [
        nextHighlight,
        ...metadataState.highlights.filter(
          (highlight) => getHighlightIdentity(highlight) !== referenceIdentity
        )
      ]

      try {
        await writeHighlightMetadata(config, nextMetadata, metadataState)
      } catch (error) {
        if (isWriteConflict(error) && attempt + 1 < R2_METADATA_WRITE_ATTEMPTS) continue
        throw error
      }
      invalidateR2LibraryCache()
      const cacheInvalidated = await purgePublicHighlightsCache()

      try {
        const library = await readR2Library(config, nextMetadata)
        setR2LibraryCache(config, library)
        const savedHighlight =
          library.highlights.find(
            (highlight) => getHighlightIdentity(highlight) === referenceIdentity
          ) || nextHighlight
        return json(
          {
            highlight: savedHighlight,
            highlights: library.highlights,
            storageAvailable: true,
            storageIssue:
              library.storageSummary.unclassifiedVideoCount &&
              library.storageSummary.unclassifiedVideoCount > 0
                ? 'unclassified-videos'
                : undefined,
            cacheInvalidated,
            scanPrefixes: R2_GAME_PREFIXES,
            storageSummary: library.storageSummary
          },
          existing ? 200 : 201
        )
      } catch {
        const storageSummary = getStorageSummary(nextMetadata)
        setR2LibraryCache(config, {
          highlights: nextMetadata,
          objects: [],
          storageSummary
        })
        return json(
          {
            highlight: nextHighlight,
            highlights: nextMetadata,
            storageAvailable: false,
            storageIssue: 'r2-scan-unavailable',
            cacheInvalidated,
            scanPrefixes: R2_GAME_PREFIXES,
            storageSummary
          },
          existing ? 200 : 201
        )
      }
    }

    return json({ error: 'highlight metadata changed; retry the request' }, 409)
  } catch (error) {
    if (error instanceof HighlightMetadataError) {
      return json({ error: 'highlight metadata is invalid; write blocked' }, 409)
    }
    if (isWriteConflict(error)) {
      return json({ error: 'highlight metadata changed; retry the request' }, 409)
    }
    return json({ error: 'r2 storage unavailable' }, 503)
  }
}

export const PATCH: APIRoute = async ({ request }) => {
  const body = await parseBody(request)
  if (!body) return json({ error: 'invalid body' }, 400)

  const auth = authorize(body.passcode)
  if (!auth.ok) return json({ error: auth.reason }, auth.status)

  const config = getR2Config()
  if (!config) return json({ error: 'r2 storage is not configured' }, 503)

  const id = typeof body.id === 'string' ? body.id.trim() : ''
  const game = normalizeGame(body.game)
  const title = normalizeText(body.title, MAX_TITLE_LENGTH)
  const description = normalizeText(body.description, MAX_DESCRIPTION_LENGTH)
  const tags = normalizeTags(body.tags)
  if (!id || !game || title === null || description === null || tags === null) {
    return json({ error: 'highlight update is invalid' }, 400)
  }

  try {
    for (let attempt = 0; attempt < R2_METADATA_WRITE_ATTEMPTS; attempt += 1) {
      const metadataState = await readHighlightMetadata(config)
      const library = await readR2Library(config, metadataState.highlights)
      const existing = library.highlights.find((highlight) => highlight.id === id)
      if (!existing) return json({ error: 'highlight not found' }, 404)

      const updatedHighlight: GameHighlight = {
        ...existing,
        game,
        title: title || existing.title,
        description: description || undefined,
        tags: tags.length > 0 ? tags : undefined
      }
      const identity = getHighlightIdentity(existing)
      const nextMetadata = [
        updatedHighlight,
        ...metadataState.highlights.filter(
          (highlight) => highlight.id !== id && getHighlightIdentity(highlight) !== identity
        )
      ]

      try {
        await writeHighlightMetadata(config, nextMetadata, metadataState)
      } catch (error) {
        if (isWriteConflict(error) && attempt + 1 < R2_METADATA_WRITE_ATTEMPTS) continue
        throw error
      }

      return respondAfterMetadataWrite(config, nextMetadata, { highlight: updatedHighlight })
    }

    return json({ error: 'highlight metadata changed; retry the request' }, 409)
  } catch (error) {
    if (error instanceof HighlightMetadataError) {
      return json({ error: 'highlight metadata is invalid; write blocked' }, 409)
    }
    if (isWriteConflict(error)) {
      return json({ error: 'highlight metadata changed; retry the request' }, 409)
    }
    return json({ error: 'r2 storage unavailable' }, 503)
  }
}

export const DELETE: APIRoute = async ({ request }) => {
  const body = await parseBody(request)
  if (!body) return json({ error: 'invalid body' }, 400)

  const auth = authorize(body.passcode)
  if (!auth.ok) return json({ error: auth.reason }, auth.status)

  const config = getR2Config()
  if (!config) return json({ error: 'r2 storage is not configured' }, 503)

  const id = typeof body.id === 'string' ? body.id.trim() : ''
  if (!id) return json({ error: 'highlight id is required' }, 400)

  try {
    for (let attempt = 0; attempt < R2_METADATA_WRITE_ATTEMPTS; attempt += 1) {
      const metadataState = await readHighlightMetadata(config)
      const existing = metadataState.highlights.find((highlight) => highlight.id === id)
      if (!existing) return json({ error: 'highlight not found' }, 404)
      if (!isExternalVideoSource(existing.source)) {
        return json({ error: 'self-hosted captures must be removed from storage' }, 409)
      }

      const nextMetadata = metadataState.highlights.filter((highlight) => highlight.id !== id)
      try {
        await writeHighlightMetadata(config, nextMetadata, metadataState)
      } catch (error) {
        if (isWriteConflict(error) && attempt + 1 < R2_METADATA_WRITE_ATTEMPTS) continue
        throw error
      }

      return respondAfterMetadataWrite(config, nextMetadata, { deletedId: id })
    }

    return json({ error: 'highlight metadata changed; retry the request' }, 409)
  } catch (error) {
    if (error instanceof HighlightMetadataError) {
      return json({ error: 'highlight metadata is invalid; write blocked' }, 409)
    }
    if (isWriteConflict(error)) {
      return json({ error: 'highlight metadata changed; retry the request' }, 409)
    }
    return json({ error: 'r2 storage unavailable' }, 503)
  }
}
