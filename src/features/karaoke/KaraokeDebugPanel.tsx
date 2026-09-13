import type { KaraokeInputFrame, KaraokeMicrophoneStatus, KaraokeTimelineState } from './types/karaokeTypes'
import type { KaraokeLyricsSource } from './data/useNicoLyrics'
import type { KaraokeScoreAward, KaraokeScoringState } from './scoring/karaokeScoringTypes'
import { HEARTS_TEN_STREAK_TARGET, SCORING_INTERVAL_MS } from './scoring/karaokeScoringConfig'

interface Props {
  playbackPosition: number
  lyricsSource: KaraokeLyricsSource
  linesLoaded: number
  hasWordTiming: boolean
  timeline: KaraokeTimelineState
  microphoneStatus: KaraokeMicrophoneStatus
  input: KaraokeInputFrame
  scoring: KaraokeScoringState & { currentBucket: KaraokeScoreAward; totalScore: number; windowMetrics: { validPitchRatio: number; level: number; clarity: number } }
}

export function KaraokeDebugPanel({ playbackPosition, lyricsSource, linesLoaded, hasWordTiming, timeline, microphoneStatus, input, scoring }: Props) {
  if (!import.meta.env.DEV) return null
  return (
    <details className="karaoke-debug">
      <summary>Karaoke diagnostics</summary>
      <strong>KARAOKE</strong>
      <span>Playback position: {playbackPosition.toFixed(2)} s</span>
      <span>Lyrics source: {lyricsSource === 'nico' ? 'Nico' : lyricsSource}</span>
      <span>Lines loaded: {linesLoaded}</span>
      <span>Word timing: {hasWordTiming ? 'yes' : 'no'}</span>
      <span>Current line: {timeline.currentLineIndex ?? 'none'}</span>
      <span>Active word: {timeline.activeWordIndex ?? 'none'}</span>
      <span>Line progress: {timeline.lineProgress.toFixed(2)}</span>
      <span>Word progress: {timeline.wordProgress.toFixed(2)}</span>
      <strong>MICROPHONE</strong>
      <span>Mic: {microphoneStatus}</span>
      <span>Input level: {input.level.toFixed(3)}</span>
      <span>Pitch: {input.pitchHz === null ? 'none' : `${input.pitchHz.toFixed(1)} Hz`}</span>
      <span>MIDI: {input.midiNote?.toFixed(1) ?? 'none'}</span>
      <span>Clarity: {input.clarity.toFixed(2)}</span>
      <strong>PARTICIPATION SCORE</strong>
      <span>Scoring interval: {(SCORING_INTERVAL_MS / 1000).toFixed(1)} s</span>
      <span>Window valid pitch ratio: {(scoring.windowMetrics.validPitchRatio * 100).toFixed(0)}%</span>
      <span>Window level: {scoring.windowMetrics.level.toFixed(3)}</span>
      <span>Window clarity: {scoring.windowMetrics.clarity.toFixed(2)}</span>
      <span>Current bucket: {scoring.currentBucket}</span>
      <span>Last award: {scoring.lastAward}</span>
      <span>Total score: {scoring.totalScore}</span>
      <span>Scored windows: {scoring.scoreEventCount}</span>
      <span>Singing streak: {scoring.singingStreak}</span>
      <span>10 streak: {scoring.consecutiveTens} / {HEARTS_TEN_STREAK_TARGET}</span>
      <span>Hearts trigger count: {scoring.heartsTriggerCount}</span>
    </details>
  )
}
