export interface MountainWaveformProps {
  active?: boolean
  intensity?: number
  progress?: number
  frequencyBands?: readonly number[]
  energy?: number
}

export function MountainWaveformLayer({ active = false, frequencyBands = [] }: MountainWaveformProps) {
  if (!active) return null
  return <div className="mountain-waveform" aria-label="Audio-reactive visual layer"><span className="sr-only">{frequencyBands.length} frequency bands available</span></div>
}
