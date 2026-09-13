interface SongProgressTrackProps {
  progress: number
  currentTime: number
  duration: number
  markerUrl?: string
  className?: string
  showTimes?: boolean
  disabled?: boolean
  onSeek?: (position: number) => void
}

export const formatPlaybackTime = (seconds: number) => {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}

export function SongProgressTrack({ progress, currentTime, duration, markerUrl, className, showTimes = true, disabled, onSeek }: SongProgressTrackProps) {
  const safeProgress = Math.min(1, Math.max(0, progress))
  const commitSeek = (event: PointerEvent<HTMLButtonElement>) => {
    if (!onSeek || disabled || duration <= 0) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width))
    onSeek(ratio * duration)
  }
  return (
    <div className={`song-progress${className ? ` ${className}` : ''}`}>
      {showTimes && <time>{formatPlaybackTime(currentTime)}</time>}
      <button type="button" className="progress-path" aria-label="Seek in song" disabled={disabled || duration <= 0} onPointerUp={commitSeek}>
        <span className="progress-travelled" style={{ width: `${safeProgress * 100}%` }} />
        {markerUrl && <img className="progress-marker" src={markerUrl} style={{ left: `${safeProgress * 100}%` }} alt="" />}
      </button>
      {showTimes && <time>{formatPlaybackTime(duration)}</time>}
    </div>
  )
}
import type { PointerEvent } from 'react'
