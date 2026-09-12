export type RemixTool = 'loop' | 'filter' | 'pitch' | 'none'
export type AudioEffect = 'echo' | 'reverb' | 'distortion' | 'none'
export type WolpertingerMood = 'idle' | 'excited' | 'impressed' | 'celebrating'
export type PerformanceStatus = 'idle' | 'ready' | 'performing' | 'finished'
export interface PerformanceState {
  selectedSongId: string | null; currentTime: number; score: number; combo: number; maxCombo: number; singingAccuracy: number
  selectedTool: RemixTool; selectedEffect: AudioEffect; wolpertingerMood: WolpertingerMood; performanceStatus: PerformanceStatus
}
