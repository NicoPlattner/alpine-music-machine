import { useCallback, useEffect, useRef, useState } from 'react'
import { usePerformanceStore } from '../../../store/performanceStore'
import type { KaraokeInputFrame, KaraokeMicrophoneStatus } from '../types/karaokeTypes'
import { SCORING_INTERVAL_MS } from './karaokeScoringConfig'
import { createKaraokeScoreEvent, EMPTY_SCORE_WINDOW, getKaraokeScoreBucket, summarizeKaraokeScoreWindow } from './karaokeScoring'
import { useKaraokeScoreStore } from './karaokeScoreStore'
import type { KaraokeScoreWindowMetrics } from './karaokeScoringTypes'

export function useKaraokeScoring(input: KaraokeInputFrame, microphoneStatus: KaraokeMicrophoneStatus, playing: boolean) {
  const framesRef = useRef<KaraokeInputFrame[]>([])
  const latestTimestampRef = useRef(0)
  const eventSequenceRef = useRef(0)
  const [windowMetrics, setWindowMetrics] = useState<KaraokeScoreWindowMetrics>(EMPTY_SCORE_WINDOW)
  const [windowGeneration, setWindowGeneration] = useState(0)
  const scoring = useKaraokeScoreStore()
  const totalScore = usePerformanceStore((state) => state.score)
  const addScore = usePerformanceStore((state) => state.addScore)
  const resetPerformanceScore = usePerformanceStore((state) => state.resetScore)

  const clearWindow = useCallback(() => {
    framesRef.current = []
    setWindowMetrics(EMPTY_SCORE_WINDOW)
  }, [])

  const resetScore = useCallback(() => {
    clearWindow()
    scoring.resetScore()
    resetPerformanceScore()
    setWindowGeneration((generation) => generation + 1)
  }, [clearWindow, resetPerformanceScore, scoring.resetScore])

  useEffect(() => { resetScore() }, [resetScore])

  useEffect(() => {
    if (!playing || microphoneStatus !== 'ready') return
    framesRef.current.push(input)
    latestTimestampRef.current = input.timestamp
    setWindowMetrics(summarizeKaraokeScoreWindow(framesRef.current))
  }, [input, microphoneStatus, playing])

  useEffect(() => {
    if (!playing || microphoneStatus !== 'ready') {
      clearWindow()
      return
    }

    let active = true
    let timer = 0
    let deadline = performance.now() + SCORING_INTERVAL_MS
    const finalizeWindow = () => {
      if (!active) return
      const metrics = summarizeKaraokeScoreWindow(framesRef.current)
      const id = `karaoke-score-${Date.now()}-${++eventSequenceRef.current}`
      const event = createKaraokeScoreEvent(id, latestTimestampRef.current, metrics)
      scoring.recordScoreEvent(event)
      addScore(event.points)
      clearWindow()
      deadline += SCORING_INTERVAL_MS
      timer = window.setTimeout(finalizeWindow, Math.max(0, deadline - performance.now()))
    }
    timer = window.setTimeout(finalizeWindow, SCORING_INTERVAL_MS)
    return () => {
      active = false
      window.clearTimeout(timer)
      clearWindow()
    }
  }, [addScore, clearWindow, microphoneStatus, playing, scoring.recordScoreEvent, windowGeneration])

  return {
    ...scoring,
    totalScore,
    resetScore,
    windowMetrics,
    currentBucket: playing && microphoneStatus === 'ready' ? getKaraokeScoreBucket(windowMetrics) : 0,
  }
}
