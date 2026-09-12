interface SongProgressTrackProps { progress: number; currentTime?: number; duration?: number; markerUrl?: string }
export function SongProgressTrack({ progress, markerUrl }: SongProgressTrackProps) {
  const safeProgress = Math.min(1, Math.max(0, progress))
  return <div className="song-progress" role="progressbar" aria-label="Song progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(safeProgress * 100)}><div className="progress-path"><div className="progress-travelled" style={{ width: `${safeProgress * 100}%` }} />{markerUrl && <img className="progress-marker" src={markerUrl} style={{ left: `${safeProgress * 100}%` }} alt="" />}</div></div>
}
