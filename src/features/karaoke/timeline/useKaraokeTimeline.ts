import { useMemo } from 'react'
import type { KaraokeLyricsData } from '../types/karaokeTypes'
import { getKaraokeTimeline } from './karaokeTimeline'

export const useKaraokeTimeline = (lyrics: KaraokeLyricsData, estimatedPlaybackPosition: number) =>
  useMemo(() => getKaraokeTimeline(lyrics, estimatedPlaybackPosition), [estimatedPlaybackPosition, lyrics])
