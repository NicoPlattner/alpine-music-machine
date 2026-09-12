import { useCallback, useState } from 'react'
import type { KaraokeLyricsData } from './types/karaokeTypes'

export const EMPTY_KARAOKE_LYRICS: KaraokeLyricsData = { lines: [] }

/** Explicit opt-in fixture; never presented as real song lyrics. */
export const DEV_KARAOKE_FIXTURE: KaraokeLyricsData = {
  lines: [
    { id: 'dev-1', text: 'Line one', start: 2, end: 6, words: [
      { text: 'Line', start: 2, end: 4 }, { text: 'one', start: 4, end: 6 },
    ] },
    { id: 'dev-2', text: 'Line two', start: 8, end: 12 },
  ],
}

export function useKaraokeLyrics(initialData: KaraokeLyricsData = EMPTY_KARAOKE_LYRICS) {
  const [lyrics, setLyricsState] = useState(() => normalizeLyrics(initialData))
  // This is the data boundary for a future backend/local JSON lyrics source.
  const setLyrics = useCallback((data: KaraokeLyricsData) => setLyricsState(normalizeLyrics(data)), [])
  return { lyrics, setLyrics }
}

function normalizeLyrics(data: KaraokeLyricsData): KaraokeLyricsData {
  return {
    lines: data.lines
      .map((line) => ({ ...line, words: line.words ? [...line.words].sort((a, b) => a.start - b.start) : undefined }))
      .sort((a, b) => a.start - b.start),
  }
}
