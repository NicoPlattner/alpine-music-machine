import { useEffect, useRef, useState } from 'react'
import type { FingerState, Genre, GenreGesture, TrackedHand } from './handTrackingTypes'
import { classifyFingerState, detectGenreGesture } from './gesture/genreGestureDetector'

export const GENRE_GESTURE_HOLD_MS = 350

export interface GenreGestureControl {
  genre: Genre
  setGenre: (genre: Genre) => void
  rawGesture: GenreGesture
  confirmedGesture: GenreGesture
  candidateGesture: GenreGesture
  holdProgressMs: number
  fingerState: FingerState | null
}

export function useGenreGestureControl(controlHand: TrackedHand | null): GenreGestureControl {
  const [genre, setGenre] = useState<Genre>('Rock')
  const [rawGesture, setRawGesture] = useState<GenreGesture>('idle')
  const [confirmedGesture, setConfirmedGesture] = useState<GenreGesture>('idle')
  const [candidateGesture, setCandidateGesture] = useState<GenreGesture>('idle')
  const [holdProgressMs, setHoldProgressMs] = useState(0)
  const [fingerState, setFingerState] = useState<FingerState | null>(null)
  const candidateRef = useRef<GenreGesture>('idle')
  const candidateStartedAtRef = useRef(0)
  const appliedCandidateRef = useRef<GenreGesture>('idle')

  useEffect(() => {
    const nextFingerState = classifyFingerState(controlHand?.rawLandmarks ?? null)
    const nextGesture = detectGenreGesture(controlHand?.rawLandmarks ?? null, controlHand?.screenLandmarks ?? null)
    setFingerState(nextFingerState)
    setRawGesture(nextGesture)

    if (nextGesture === 'idle') {
      candidateRef.current = 'idle'
      appliedCandidateRef.current = 'idle'
      candidateStartedAtRef.current = 0
      setCandidateGesture('idle')
      setConfirmedGesture('idle')
      setHoldProgressMs(0)
      return
    }

    const now = controlHand?.rawLandmarks[0]?.timestamp ?? performance.now()
    if (candidateRef.current !== nextGesture) {
      candidateRef.current = nextGesture
      candidateStartedAtRef.current = now
      appliedCandidateRef.current = 'idle'
      setCandidateGesture(nextGesture)
      setConfirmedGesture('idle')
      setHoldProgressMs(0)
      return
    }

    const progress = Math.min(GENRE_GESTURE_HOLD_MS, now - candidateStartedAtRef.current)
    setHoldProgressMs(progress)
    if (appliedCandidateRef.current !== nextGesture && progress >= GENRE_GESTURE_HOLD_MS) {
      setGenre(nextGesture)
      setConfirmedGesture(nextGesture)
      appliedCandidateRef.current = nextGesture
    }
  }, [controlHand])

  return { genre, setGenre, rawGesture, confirmedGesture, candidateGesture, holdProgressMs, fingerState }
}
