export type KaraokeScoreAward = 0 | 5 | 10

export interface KaraokeScoreEvent {
  id: string
  timestamp: number
  points: KaraokeScoreAward
  level: number
  clarity: number
  pitchDetected: boolean
  window: KaraokeScoreWindowMetrics
}

export interface KaraokeScoreWindowMetrics {
  frameCount: number
  validPitchFrames: number
  validPitchRatio: number
  level: number
  clarity: number
}

export interface KaraokeScoringState {
  lastAward: KaraokeScoreAward
  scoreEventCount: number
  fivePointAwards: number
  tenPointAwards: number
  singingStreak: number
  maxSingingStreak: number
  consecutiveZeroWindows: number
  consecutiveTens: number
  heartsTriggerCount: number
  lastEvent: KaraokeScoreEvent | null
}
