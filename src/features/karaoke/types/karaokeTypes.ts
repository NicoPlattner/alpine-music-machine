export interface KaraokeWord {
  text: string
  start: number
  end: number
}

export interface KaraokeLine {
  id: string
  text: string
  start: number
  end: number
  words?: KaraokeWord[]
}

export interface KaraokeLyricsData {
  lines: KaraokeLine[]
}

export interface KaraokeTimelineState {
  currentLine: KaraokeLine | null
  nextLine: KaraokeLine | null
  currentLineIndex: number | null
  activeWordIndex: number | null
  lineProgress: number
  wordProgress: number
}

export type KaraokeMicrophoneStatus = 'idle' | 'requesting' | 'ready' | 'denied' | 'unavailable' | 'error'

export interface KaraokeInputFrame {
  /** Current song position from the shared backend playback clock, in seconds. */
  timestamp: number
  level: number
  pitchHz: number | null
  midiNote: number | null
  clarity: number
}
