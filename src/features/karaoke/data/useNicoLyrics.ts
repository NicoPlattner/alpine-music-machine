import { useEffect, useMemo, useState } from 'react'
import { DEV_KARAOKE_FIXTURE, EMPTY_KARAOKE_LYRICS } from '../karaokeLyricsData'
import type { KaraokeLyricsData } from '../types/karaokeTypes'
import { getNicoWordTimedLyrics } from './nicoLyricsApi'
import { adaptNicoLyrics } from './nicoLyricsAdapter'

export type KaraokeLyricsSource = 'nico' | 'fixture' | 'unavailable'

interface NicoLyricsState {
  lyrics: KaraokeLyricsData
  source: KaraokeLyricsSource
  error: string | null
}

const INITIAL_STATE: NicoLyricsState = {
  lyrics: EMPTY_KARAOKE_LYRICS,
  source: 'unavailable',
  error: null,
}
const LYRICS_RETRY_INTERVAL_MS = 5000

/** Loads lyrics once per Performance session. Genre changes do not restart it. */
export function useNicoLyrics(enableFixtureFallback: boolean) {
  const [state, setState] = useState<NicoLyricsState>(INITIAL_STATE)

  useEffect(() => {
    const controller = new AbortController()
    let retryTimer: number | undefined

    const load = async () => {
      try {
        const payload = await getNicoWordTimedLyrics(controller.signal)
        const lyrics = adaptNicoLyrics(payload)
        setState({ lyrics, source: 'nico', error: null })
      } catch (error: unknown) {
        if (controller.signal.aborted) return
        const message = error instanceof Error ? error.message : 'Lyrics unavailable'
        setState(enableFixtureFallback
          ? { lyrics: DEV_KARAOKE_FIXTURE, source: 'fixture', error: message }
          : { lyrics: EMPTY_KARAOKE_LYRICS, source: 'unavailable', error: message })
        retryTimer = window.setTimeout(() => { void load() }, LYRICS_RETRY_INTERVAL_MS)
      }
    }

    void load()
    return () => {
      controller.abort()
      if (retryTimer !== undefined) window.clearTimeout(retryTimer)
    }
  }, [enableFixtureFallback])

  const hasWordTiming = useMemo(
    () => state.lyrics.lines.some((line) => Boolean(line.words?.length)),
    [state.lyrics],
  )

  return { ...state, hasWordTiming, linesLoaded: state.lyrics.lines.length }
}
