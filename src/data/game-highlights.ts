import type { VideoSource } from '@/lib/game-video'

export type GameId = 'valorant' | 'delta-force' | 'league-of-legends' | 'cs2'

export interface GameProfile {
  id: GameId
  label: string
  shortLabel: string
  playerId: string
}

export const gameProfiles: GameProfile[] = [
  {
    id: 'valorant',
    label: '无畏契约',
    shortLabel: 'VAL',
    playerId: ''
  },
  {
    id: 'delta-force',
    label: '三角洲行动',
    shortLabel: 'DF',
    playerId: ''
  },
  {
    id: 'league-of-legends',
    label: '英雄联盟',
    shortLabel: 'LOL',
    playerId: ''
  },
  {
    id: 'cs2',
    label: 'CS2',
    shortLabel: 'CS2',
    playerId: ''
  }
]

export interface GameHighlight {
  id: string
  game: GameId
  source: VideoSource
  url: string
  title: string
  date?: string
  description?: string
  tags?: string[]
  createdAt?: string
  sizeBytes?: number
  contentType?: string
  sizeCheckedAt?: string
}

/**
 * Static fallback content shown only when the R2 API is unavailable.
 * R2 videos are discovered from the bucket, while external videos are stored as metadata.
 */
export const gameHighlights: GameHighlight[] = []
