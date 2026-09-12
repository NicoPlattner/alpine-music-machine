import { useEffect, useState } from 'react'
import type { GenreGesture } from '../motion/handTrackingTypes'
import type { BackendGenre, MusicGenre } from '../audio/api/audioApiTypes'
import type { AudioStreamStatus } from '../audio/useAudioBackend'
import { KaraokeLyrics } from '../karaoke/KaraokeLyrics'
import type { KaraokeTimelineState } from '../karaoke/types/karaokeTypes'
import { HeartBurstLayer } from './HeartBurstLayer'
import { SongProgressTrack } from './SongProgressTrack'

interface LeoInterfaceLayerProps {
  currentTime: number
  duration: number
  karaokeTimeline: KaraokeTimelineState
  hasLyrics: boolean
  genre: MusicGenre | null
  genres: BackendGenre[]
  genreGesture: GenreGesture
  pendingGenre: MusicGenre | null
  gestureFeedback: MusicGenre | null
  playing: boolean
  transportPending: boolean
  backendConnected: boolean
  audioConnected: boolean
  audioStreamStatus: AudioStreamStatus
  backendError: string | null
  onFinish: () => void
  onGenreChange: (genre: MusicGenre) => void
  onPlayPause: () => void
  onRestart: () => void
  onEnableAudio: () => void
  onSeek: (position: number) => void
}

const wolpertingers = ['Wolp_shame.png', 'Wolp_love.png', 'Wolp_dead.png', 'Wolp_happy.png']
const asset = (name: string) => `${import.meta.env.BASE_URL}leo-visual/UI/Wolp/${name}`
const genreIconAsset: Record<MusicGenre, string> = {
  pop: 'pop.svg', techno: 'techno.svg', rock: 'rock.svg', ballad: 'ballad.svg',
}

export function LeoInterfaceLayer({ currentTime, duration, karaokeTimeline, hasLyrics, genre, genres, genreGesture, pendingGenre, gestureFeedback, playing, transportPending, backendConnected, audioConnected, audioStreamStatus, backendError, onFinish, onGenreChange, onPlayPause, onRestart, onEnableAudio, onSeek }: LeoInterfaceLayerProps) {
  const [wolpertingerIndex, setWolpertingerIndex] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => setWolpertingerIndex((index) => (index + 1) % wolpertingers.length), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="leo-interface" aria-label="Alpine Sound Machine performance controls">
      <img className="leo-interface-art" src={asset('AlpineSoundMachine.svg')} alt="" />
      <div className="leo-genre-icons" aria-hidden="true">
        {genres.map((item) => (
          <span
            key={item.id}
            className={`leo-genre-icon${genre === item.id ? ' selected' : ''}${gestureFeedback === item.id ? ' gesture-applied' : ''}`}
            style={{ WebkitMaskImage: `url(${asset(genreIconAsset[item.id])})`, maskImage: `url(${asset(genreIconAsset[item.id])})` }}
          />
        ))}
      </div>
      <img className="leo-interface-slider" src={asset('slider.svg')} alt="" />
      <img className="leo-interface-frame" src={asset('Frame.svg')} alt="" />
      <img className="leo-wolpertinger" src={asset(wolpertingers[wolpertingerIndex])} alt="Wolpertinger" />
      <p className="leo-score">666</p>
      <KaraokeLyrics timeline={karaokeTimeline} hasLyrics={hasLyrics} />
      <div className="leo-genre-controls" aria-label="Genre controls">
        {genres.map((item) => (
          <button type="button" key={item.id} className={`${genre === item.id ? 'selected' : ''} ${genreGesture.toLowerCase() === item.id ? 'gesture-match' : ''} ${pendingGenre === item.id ? 'pending' : ''}`.trim()} aria-label={`Select ${item.label} genre`} aria-pressed={genre === item.id} disabled={!backendConnected || pendingGenre === item.id} onClick={() => onGenreChange(item.id)} />
        ))}
      </div>
      <div className="leo-transport" aria-label="Playback controls">
        <button type="button" onClick={onPlayPause} disabled={!backendConnected || transportPending} aria-label={playing ? 'Pause' : 'Play'}>{playing ? 'Ⅱ' : '▶'}</button>
        <button type="button" onClick={onRestart} disabled={!backendConnected || transportPending} aria-label="Restart">↺</button>
        <SongProgressTrack progress={duration > 0 ? currentTime / duration : 0} currentTime={currentTime} duration={duration} disabled={!backendConnected} onSeek={onSeek} />
      </div>
      {StreamStatus(audioStreamStatus, backendConnected, audioConnected, backendError, onEnableAudio)}
      {gestureFeedback && <p className="leo-gesture-confirmation" role="status">Gesture → {genres.find((item) => item.id === gestureFeedback)?.label ?? gestureFeedback}</p>}
      <button type="button" className="leo-finish-hotspot" aria-label="Finish performance" title="Finish performance" onClick={onFinish} />
      <HeartBurstLayer triggerKey={karaokeTimeline.currentLineIndex ?? -1} />
    </div>
  )
}

function StreamStatus(status: AudioStreamStatus, backendConnected: boolean, audioConnected: boolean, backendError: string | null, onEnableAudio: () => void) {
  if (!backendConnected) return <p className="leo-backend-status" role="status" title={backendError ?? undefined}>Audio backend unavailable</p>
  if (backendError) return <p className="leo-backend-status" role="status" title={backendError}>Audio change failed</p>
  if (!audioConnected) return <p className="leo-backend-status" role="status">Audio engine disconnected</p>
  if (status === 'blocked') return <button type="button" className="leo-enable-audio" onClick={onEnableAudio}>Start Audio</button>
  if (status === 'error') return <p className="leo-backend-status" role="status">Audio stream error</p>
  return null
}
