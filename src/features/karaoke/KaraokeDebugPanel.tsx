import type { KaraokeInputFrame, KaraokeMicrophoneStatus, KaraokeTimelineState } from './types/karaokeTypes'
import type { KaraokeLyricsSource } from './data/useNicoLyrics'

interface Props {
  playbackPosition: number
  lyricsSource: KaraokeLyricsSource
  linesLoaded: number
  hasWordTiming: boolean
  timeline: KaraokeTimelineState
  microphoneStatus: KaraokeMicrophoneStatus
  input: KaraokeInputFrame
}

export function KaraokeDebugPanel({ playbackPosition, lyricsSource, linesLoaded, hasWordTiming, timeline, microphoneStatus, input }: Props) {
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
    </details>
  )
}
