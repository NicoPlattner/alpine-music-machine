import type { Genre, GenreGesture } from '../motion/handTrackingTypes'
import type { PlaybackMotionState } from '../motion/useFrameMotionPlayback'

export type AlpineSound = 'Rock' | 'Water' | 'Marmot' | 'Cowbell'

interface RemixToolboxProps {
  genre: Genre
  genreGesture: GenreGesture
  playbackMotion: PlaybackMotionState
  onGenreChange: (genre: Genre) => void
  onToggleMovementSpeed: () => void
  onSoundTrigger?: (sound: AlpineSound) => void
}

const genres: Genre[] = ['Pop', 'Rock', 'Techno', 'Ballad']
const sounds: { name: AlpineSound; icon: string }[] = [
  { name: 'Rock', icon: '⬟' },
  { name: 'Water', icon: '≈' },
  { name: 'Marmot', icon: '●' },
  { name: 'Cowbell', icon: '♢' },
]

export function RemixToolbox({ genre, genreGesture, playbackMotion, onGenreChange, onToggleMovementSpeed, onSoundTrigger }: RemixToolboxProps) {
  const rateProgress = (playbackMotion.currentPlaybackRate - playbackMotion.minPlaybackRate) / (playbackMotion.maxPlaybackRate - playbackMotion.minPlaybackRate)
  const originalRateProgress = (playbackMotion.originalPlaybackRate - playbackMotion.minPlaybackRate) / (playbackMotion.maxPlaybackRate - playbackMotion.minPlaybackRate)
  return (
    <aside className="remix-toolbox" aria-label="Remix toolbox">
      <div className="toolbox-heading"><h2>Remix Toolbox</h2><span>Gesture control</span></div>
      <section>
        <h3>Genre</h3>
        <div className="mode-controls genre-controls">
          {genres.map((item) => (
            <button key={item} className={`${item === genre ? 'selected' : ''} ${item === genreGesture ? 'gesture-match' : ''}`.trim()} onClick={() => onGenreChange(item)} aria-pressed={item === genre}>
              {item}{item === genre ? ' ✓' : ''}
            </button>
          ))}
        </div>
      </section>
      <section><h3>Alpine sounds</h3><div className="sound-controls">{sounds.map((sound) => <button key={sound.name} onClick={() => onSoundTrigger?.(sound.name)}><span aria-hidden="true">{sound.icon}</span>{sound.name}</button>)}</div></section>
      <section className={`movement-speed-control${playbackMotion.movementSpeedEnabled ? '' : ' disabled'}`}>
        <div className="movement-speed-heading"><h3>Speed</h3><button type="button" className="movement-speed-toggle" aria-pressed={playbackMotion.movementSpeedEnabled} onClick={onToggleMovementSpeed}>{playbackMotion.movementSpeedEnabled ? '✓' : '□'}</button></div>
        <span className="movement-speed-status">{playbackMotion.movementSpeedEnabled ? 'Movement controlled' : 'Movement control off'}</span>
        <div className="movement-speed-directions"><span>Slower</span><span>Faster</span></div>
        <div className="movement-speed-track" role="progressbar" aria-label="Movement-controlled speed" aria-valuemin={playbackMotion.minPlaybackRate} aria-valuemax={playbackMotion.maxPlaybackRate} aria-valuenow={playbackMotion.currentPlaybackRate}>
          <span className="movement-speed-origin" style={{ left: `${originalRateProgress * 100}%` }} />
          <span className="movement-speed-marker" style={{ left: `${Math.max(0, Math.min(1, rateProgress)) * 100}%` }} />
        </div>
        <output>{playbackMotion.currentPlaybackRate.toFixed(2)}×{playbackMotion.movementSpeedEnabled ? '' : ' ORIGINAL'}</output>
      </section>
    </aside>
  )
}
