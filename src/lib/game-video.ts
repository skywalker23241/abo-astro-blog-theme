import { integrationConfig } from '@/config'

export type VideoSource = 'r2' | 'bilibili' | 'youtube' | 'douyin'
export type ExternalVideoSource = Exclude<VideoSource, 'r2'>

export const SELF_HOSTED_VIDEO_ORIGIN = integrationConfig.highlights.mediaOrigin
export const R2_FREE_STORAGE_BYTES = 10_000_000_000

export interface VideoSourceProfile {
  id: VideoSource
  label: string
  shortLabel: string
  placeholder: string
  hint: string
}

export const videoSourceProfiles: VideoSourceProfile[] = [
  {
    id: 'r2',
    label: 'R2 自托管',
    shortLabel: 'R2',
    placeholder: `${SELF_HOSTED_VIDEO_ORIGIN}/df/your-video.mp4`,
    hint: 'R2 视频由页面自动扫描，无需手动登记链接。'
  },
  {
    id: 'bilibili',
    label: '哔哩哔哩',
    shortLabel: 'BILI',
    placeholder: 'https://www.bilibili.com/video/BV...',
    hint: '支持包含 BV 号或 av 号的哔哩哔哩视频页面。'
  },
  {
    id: 'youtube',
    label: 'YouTube',
    shortLabel: 'YT',
    placeholder: 'https://www.youtube.com/watch?v=...',
    hint: '支持 youtube.com、youtu.be、Shorts 与嵌入链接。'
  },
  {
    id: 'douyin',
    label: '抖音',
    shortLabel: 'DY',
    placeholder: 'https://www.douyin.com/video/...',
    hint: '支持包含数字视频 ID 的抖音视频页面。'
  }
]

export interface VideoReference {
  source: VideoSource
  url: string
  videoId?: string
  embedUrl?: string
}

function parseUrl(value: string) {
  const input = value.trim()
  if (!input) return null

  try {
    const url = new URL(input)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    url.hash = ''
    return url
  } catch {
    return null
  }
}

function getR2Reference(url: URL): VideoReference | null {
  if (url.origin !== SELF_HOSTED_VIDEO_ORIGIN || !url.pathname || url.pathname === '/') return null

  return {
    source: 'r2',
    url: url.toString()
  }
}

function getBilibiliReference(url: URL): VideoReference | null {
  const allowedHosts = new Set([
    'bilibili.com',
    'www.bilibili.com',
    'm.bilibili.com',
    'player.bilibili.com'
  ])
  if (!allowedHosts.has(url.hostname)) return null

  const pathId = url.pathname.match(/\/video\/(BV[0-9A-Za-z]+|av\d+)/i)?.[1]
  const queryId =
    url.searchParams.get('bvid') ||
    (url.searchParams.get('aid') ? `av${url.searchParams.get('aid')}` : '')
  const rawId = pathId || queryId
  if (!rawId) return null

  const pageValue = Number(url.searchParams.get('p') || url.searchParams.get('page') || '1')
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? Math.min(pageValue, 1000) : 1
  const isBvid = /^BV/i.test(rawId)
  const videoId = isBvid ? `BV${rawId.slice(2)}` : rawId.replace(/^av/i, '')
  if (isBvid && !/^BV[0-9A-Za-z]+$/.test(videoId)) return null
  if (!isBvid && !/^\d+$/.test(videoId)) return null

  const canonicalUrl = new URL(
    isBvid
      ? `https://www.bilibili.com/video/${videoId}`
      : `https://www.bilibili.com/video/av${videoId}`
  )
  if (page > 1) canonicalUrl.searchParams.set('p', String(page))

  const embedUrl = new URL('https://player.bilibili.com/player.html')
  embedUrl.searchParams.set('isOutside', 'true')
  embedUrl.searchParams.set(isBvid ? 'bvid' : 'aid', videoId)
  embedUrl.searchParams.set('page', String(page))
  embedUrl.searchParams.set('high_quality', '1')
  embedUrl.searchParams.set('danmaku', '0')

  return {
    source: 'bilibili',
    url: canonicalUrl.toString(),
    videoId,
    embedUrl: embedUrl.toString()
  }
}

function getYouTubeReference(url: URL): VideoReference | null {
  const youtubeHosts = new Set([
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'www.youtube-nocookie.com',
    'youtube-nocookie.com'
  ])
  let videoId = ''

  if (url.hostname === 'youtu.be') {
    videoId = url.pathname.split('/').filter(Boolean)[0] || ''
  } else if (youtubeHosts.has(url.hostname)) {
    videoId = url.searchParams.get('v') || ''
    if (!videoId) {
      videoId = url.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/)?.[1] || ''
    }
  } else {
    return null
  }

  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null

  const canonicalUrl = new URL('https://www.youtube.com/watch')
  canonicalUrl.searchParams.set('v', videoId)
  const embedUrl = new URL(`https://www.youtube.com/embed/${videoId}`)
  embedUrl.searchParams.set('playsinline', '1')
  embedUrl.searchParams.set('rel', '0')

  return {
    source: 'youtube',
    url: canonicalUrl.toString(),
    videoId,
    embedUrl: embedUrl.toString()
  }
}

function getDouyinReference(url: URL): VideoReference | null {
  const allowedHosts = new Set([
    'douyin.com',
    'www.douyin.com',
    'm.douyin.com',
    'www.iesdouyin.com',
    'open.douyin.com'
  ])
  if (!allowedHosts.has(url.hostname)) return null

  const videoId =
    url.searchParams.get('vid') || url.pathname.match(/\/(?:share\/)?video\/(\d{15,22})/)?.[1] || ''
  if (!/^\d{15,22}$/.test(videoId)) return null

  const canonicalUrl = `https://www.douyin.com/video/${videoId}`
  const embedUrl = new URL('https://open.douyin.com/player/video')
  embedUrl.searchParams.set('vid', videoId)
  embedUrl.searchParams.set('autoplay', '0')

  return {
    source: 'douyin',
    url: canonicalUrl,
    videoId,
    embedUrl: embedUrl.toString()
  }
}

export function getVideoReferenceFromUrl(value: string): VideoReference | null {
  const url = parseUrl(value)
  if (!url) return null

  return (
    getR2Reference(url) ||
    getBilibiliReference(url) ||
    getYouTubeReference(url) ||
    getDouyinReference(url)
  )
}

export function getVideoReference(source: VideoSource, value: string): VideoReference | null {
  const reference = getVideoReferenceFromUrl(value)
  return reference?.source === source ? reference : null
}

export function isExternalVideoSource(source: VideoSource): source is ExternalVideoSource {
  return source !== 'r2'
}

export function getVideoSourceProfile(source: VideoSource) {
  return videoSourceProfiles.find((profile) => profile.id === source)
}
