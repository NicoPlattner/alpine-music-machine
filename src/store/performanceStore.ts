import { create } from 'zustand'
import type { PerformanceState } from '../types/performance'
interface PerformanceActions {
  selectSong: (songId: string) => void; setCurrentTime: (time: number) => void; addScore: (points: number) => void
  setCombo: (combo: number) => void; resetPerformance: () => void; finishPerformance: () => void
}
const initialState: PerformanceState = { selectedSongId: null, currentTime: 0, score: 0, combo: 0, maxCombo: 0, singingAccuracy: 0, selectedTool: 'none', selectedEffect: 'none', wolpertingerMood: 'idle', performanceStatus: 'idle' }
export const usePerformanceStore = create<PerformanceState & PerformanceActions>((set) => ({
  ...initialState,
  selectSong: (selectedSongId) => set({ ...initialState, selectedSongId, performanceStatus: 'ready' }),
  setCurrentTime: (currentTime) => set({ currentTime: Math.max(0, currentTime) }),
  addScore: (points) => set((state) => ({ score: Math.max(0, state.score + points) })),
  setCombo: (combo) => set((state) => ({ combo: Math.max(0, combo), maxCombo: Math.max(state.maxCombo, combo) })),
  resetPerformance: () => set(initialState), finishPerformance: () => set({ performanceStatus: 'finished', combo: 0 }),
}))
