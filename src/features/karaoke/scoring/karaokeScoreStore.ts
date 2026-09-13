import { create } from 'zustand'
import { HEARTS_TEN_STREAK_TARGET, ZERO_WINDOWS_BEFORE_STREAK_RESET } from './karaokeScoringConfig'
import type { KaraokeScoreEvent, KaraokeScoringState } from './karaokeScoringTypes'

interface KaraokeScoreActions {
  recordScoreEvent: (event: KaraokeScoreEvent) => void
  resetScore: () => void
}

export const INITIAL_KARAOKE_SCORE: KaraokeScoringState = {
  lastAward: 0,
  scoreEventCount: 0,
  fivePointAwards: 0,
  tenPointAwards: 0,
  singingStreak: 0,
  maxSingingStreak: 0,
  consecutiveZeroWindows: 0,
  consecutiveTens: 0,
  heartsTriggerCount: 0,
  lastEvent: null,
}

export const useKaraokeScoreStore = create<KaraokeScoringState & KaraokeScoreActions>((set) => ({
  ...INITIAL_KARAOKE_SCORE,
  recordScoreEvent: (event) => set((state) => {
    const consecutiveZeroWindows = event.points === 0 ? state.consecutiveZeroWindows + 1 : 0
    const singingStreak = event.points > 0
      ? state.singingStreak + 1
      : consecutiveZeroWindows >= ZERO_WINDOWS_BEFORE_STREAK_RESET ? 0 : state.singingStreak
    const nextConsecutiveTens = event.points === 10 ? state.consecutiveTens + 1 : 0
    const shouldTriggerHearts = nextConsecutiveTens === HEARTS_TEN_STREAK_TARGET
    return {
      lastAward: event.points,
      scoreEventCount: state.scoreEventCount + 1,
      fivePointAwards: state.fivePointAwards + (event.points === 5 ? 1 : 0),
      tenPointAwards: state.tenPointAwards + (event.points === 10 ? 1 : 0),
      singingStreak,
      maxSingingStreak: Math.max(state.maxSingingStreak, singingStreak),
      consecutiveZeroWindows,
      consecutiveTens: shouldTriggerHearts ? 0 : nextConsecutiveTens,
      heartsTriggerCount: state.heartsTriggerCount + (shouldTriggerHearts ? 1 : 0),
      lastEvent: event,
    }
  }),
  resetScore: () => set(INITIAL_KARAOKE_SCORE),
}))
