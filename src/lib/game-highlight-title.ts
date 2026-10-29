import { gameProfiles, type GameId } from '@/data/game-highlights'

const gamePrefixes: Record<GameId, string> = {
  valorant: 'val',
  'delta-force': 'df',
  'league-of-legends': 'lol',
  cs2: 'cs2'
}

const mapLabels: Partial<Record<GameId, Record<string, string>>> = {
  valorant: {
    ascent: '亚海悬城',
    fracture: '裂变峡谷',
    split: '霓虹町'
  },
  'delta-force': {
    az3: 'AZ3 核电站'
  }
}

const characterLabels: Partial<Record<GameId, Record<string, string>>> = {
  valorant: {
    iso: '壹决',
    jett: '捷风',
    waylay: '幻棱'
  }
}

function getLegacyTitle(objectKey: string) {
  const fileName = objectKey.split('/').pop() || ''
  const title = fileName
    .replace(/\.[^./]+$/, '')
    .replace(/_+/g, ' ')
    .trim()
  return title || '精彩时刻'
}

function getReadableToken(token: string) {
  if (/^[a-z]+\d+$/i.test(token)) return token.toUpperCase()
  return token.replace(/\b[a-z]/g, (character) => character.toUpperCase())
}

export function getDefaultVideoTitle(objectKey: string, game: GameId) {
  const fallbackTitle = getLegacyTitle(objectKey)
  const fileName = objectKey.split('/').pop() || ''
  const tokens = fileName
    .replace(/\.[^./]+$/, '')
    .toLowerCase()
    .split(/[-_\s]+/)
    .filter(Boolean)

  if (tokens.shift() !== gamePrefixes[game]) return fallbackTitle

  let clipNumber: number | undefined
  const lastToken = tokens.at(-1)
  const previousToken = tokens.at(-2)
  if (lastToken && /^\d+$/.test(lastToken) && previousToken && /^\d+k$/.test(previousToken)) {
    clipNumber = Number(lastToken)
    tokens.pop()
  }

  const killToken = tokens.pop()
  const killMatch = killToken?.match(/^(\d+)k$/)
  if (!killMatch) return fallbackTitle

  let dateLabel = ''
  if (game === 'delta-force' && tokens.length >= 3) {
    const month = Number(tokens[0])
    const day = Number(tokens[1])
    if (
      Number.isInteger(month) &&
      month >= 1 &&
      month <= 12 &&
      Number.isInteger(day) &&
      day >= 1 &&
      day <= 31
    ) {
      dateLabel = `${month}月${day}日`
      tokens.splice(0, 2)
    }
  }

  const mapToken = tokens.shift()
  if (!mapToken) return fallbackTitle

  const characterToken = tokens.shift()
  const gameLabel = gameProfiles.find((profile) => profile.id === game)?.label || '游戏'
  const mapLabel = mapLabels[game]?.[mapToken] || getReadableToken(mapToken)
  const characterLabel = characterToken
    ? characterLabels[game]?.[characterToken] || getReadableToken(characterToken)
    : ''
  const titleParts = [gameLabel, mapLabel]

  if (characterLabel) titleParts.push(characterLabel)
  titleParts.push(`${Number(killMatch[1])} 杀`)

  let title = titleParts.join(' - ')
  if (dateLabel) title += ` · ${dateLabel}`
  if (clipNumber !== undefined) title += ` · 片段 ${clipNumber}`
  return title
}
