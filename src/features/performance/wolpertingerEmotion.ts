import type { KaraokeScoreEvent } from '../karaoke/scoring/karaokeScoringTypes'

export type WolpertingerEmotion = 'neutral' | 'dead' | 'happy' | 'heartEyes'

export function scoreEventToWolpertingerEmotion(event: KaraokeScoreEvent | null): WolpertingerEmotion {
  if (!event) return 'neutral'
  if (event.points === 0) return 'dead'
  if (event.points === 5) return 'happy'
  return 'heartEyes'
}
