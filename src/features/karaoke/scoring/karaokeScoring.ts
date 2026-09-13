import type { KaraokeInputFrame } from '../types/karaokeTypes'
import {
  SCORE_MIN_CLARITY,
  SCORE_MIN_LEVEL,
  SCORE_MIN_VALID_PITCH_RATIO,
  SCORE_STRONG_CLARITY,
  SCORE_STRONG_LEVEL,
  SCORE_STRONG_VALID_PITCH_RATIO,
} from './karaokeScoringConfig'
import type { KaraokeScoreAward, KaraokeScoreEvent, KaraokeScoreWindowMetrics } from './karaokeScoringTypes'

export const EMPTY_SCORE_WINDOW: KaraokeScoreWindowMetrics = {
  frameCount: 0,
  validPitchFrames: 0,
  validPitchRatio: 0,
  level: 0,
  clarity: 0,
}

/** Participation scoring only: no lyric, note, or reference-melody input. */
export function getKaraokeScoreBucket(window: KaraokeScoreWindowMetrics): KaraokeScoreAward {
  if (window.validPitchRatio < SCORE_MIN_VALID_PITCH_RATIO || window.level < SCORE_MIN_LEVEL || window.clarity < SCORE_MIN_CLARITY) return 0
  if (window.validPitchRatio >= SCORE_STRONG_VALID_PITCH_RATIO && window.level >= SCORE_STRONG_LEVEL && window.clarity >= SCORE_STRONG_CLARITY) return 10
  return 5
}

export function summarizeKaraokeScoreWindow(frames: KaraokeInputFrame[]): KaraokeScoreWindowMetrics {
  if (frames.length === 0) return EMPTY_SCORE_WINDOW
  const voicedFrames = frames.filter((frame) => frame.pitchHz !== null && frame.clarity >= SCORE_MIN_CLARITY && frame.level >= SCORE_MIN_LEVEL)
  return {
    frameCount: frames.length,
    validPitchFrames: voicedFrames.length,
    validPitchRatio: voicedFrames.length / frames.length,
    level: median(voicedFrames.map((frame) => frame.level)),
    clarity: median(voicedFrames.map((frame) => frame.clarity)),
  }
}

export function createKaraokeScoreEvent(id: string, timestamp: number, window: KaraokeScoreWindowMetrics): KaraokeScoreEvent {
  return {
    id,
    timestamp,
    points: getKaraokeScoreBucket(window),
    level: window.level,
    clarity: window.clarity,
    pitchDetected: window.validPitchFrames > 0,
    window,
  }
}

function median(values: number[]) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}
