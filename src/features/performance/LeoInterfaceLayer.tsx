import type { GenreGesture } from '../motion/handTrackingTypes'
import type { BackendGenre, MusicGenre } from '../audio/api/audioApiTypes'
import type { AudioStreamStatus } from '../audio/useAudioBackend'
import { KaraokeLyrics } from '../karaoke/KaraokeLyrics'
import type { KaraokeTimelineState } from '../karaoke/types/karaokeTypes'
import type { KaraokeScoreEvent } from '../karaoke/scoring/karaokeScoringTypes'
import { HeartBurstLayer } from './HeartBurstLayer'
import { SongProgressTrack } from './SongProgressTrack'
import { WolpertingerLayer } from './WolpertingerLayer'
import { scoreEventToWolpertingerEmotion } from './wolpertingerEmotion'

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
  totalScore: number
  latestScoreEvent: KaraokeScoreEvent | null
  heartsTriggerCount: number
  onFinish: () => void
  onGenreChange: (genre: MusicGenre) => void
  onPlayPause: () => void
  onRestart: () => void
  onEnableAudio: () => void
  onSeek: (position: number) => void
}

const asset = (name: string) => `${import.meta.env.BASE_URL}leo-visual/UI/Wolp/${name}`
const genreIconAsset: Record<MusicGenre, string> = {
  pop: 'pop.svg', techno: 'techno.svg', rock: 'rock.svg', ballad: 'ballad.svg',
}

export function LeoInterfaceLayer({ currentTime, duration, karaokeTimeline, hasLyrics, genre, genres, genreGesture, pendingGenre, gestureFeedback, playing, transportPending, backendConnected, audioConnected, audioStreamStatus, backendError, totalScore, latestScoreEvent, heartsTriggerCount, onFinish, onGenreChange, onPlayPause, onRestart, onEnableAudio, onSeek }: LeoInterfaceLayerProps) {
  const wolpertingerEmotion = scoreEventToWolpertingerEmotion(latestScoreEvent)

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
      <SongProgressTrack
        className="leo-side-progress"
        progress={duration > 0 ? currentTime / duration : 0}
        currentTime={currentTime}
        duration={duration}
        markerUrl={asset('slider.svg')}
        showTimes={false}
        disabled={!backendConnected}
        onSeek={onSeek}
      />
      <img className="leo-interface-frame" src={asset('Frame.svg')} alt="" />
      <WolpertingerLayer emotion={wolpertingerEmotion} />
      <p className="leo-score" aria-label={`Participation score ${totalScore}`}>{totalScore.toLocaleString()}</p>
      {latestScoreEvent && <p key={latestScoreEvent.id} className={`karaoke-score-feedback award-${latestScoreEvent.points}`} role="status">{latestScoreEvent.points === 10 ? '+10' : latestScoreEvent.points === 5 ? '+5' : '+0'}</p>}
      <KaraokeLyrics timeline={karaokeTimeline} hasLyrics={hasLyrics} />
      <div className="leo-genre-controls" aria-label="Genre controls">
        {genres.map((item) => (
          <button type="button" key={item.id} className={`${genre === item.id ? 'selected' : ''} ${genreGesture.toLowerCase() === item.id ? 'gesture-match' : ''} ${pendingGenre === item.id ? 'pending' : ''}`.trim()} aria-label={`Select ${item.label} genre`} aria-pressed={genre === item.id} disabled={!backendConnected || pendingGenre === item.id} onClick={() => onGenreChange(item.id)} />
        ))}
      </div>
      <div className="leo-side-transport" aria-label="Playback controls">
        <button
          type="button"
          className={`leo-side-control leo-side-play${playing ? ' playing' : ''}`}
          onClick={onPlayPause}
          disabled={!backendConnected || transportPending}
          aria-label={playing ? 'Pause song' : 'Play song'}
        >
          <span className="leo-side-control-icon leo-side-play-icon" aria-hidden="true">
            {playing ? <><i /><i /></> : <i />}
          </span>
          <span className="leo-side-control-label">{playing ? 'PAUSE' : 'PLAY'}</span>
        </button>
        <button
          type="button"
          className="leo-side-control leo-side-restart"
          onClick={onRestart}
          disabled={!backendConnected || transportPending}
          aria-label="Restart song"
        >
          <span className="leo-side-control-icon leo-side-restart-icon" aria-hidden="true">↻</span>
          <span className="leo-side-control-label">RESTART</span>
        </button>
      </div>
      {StreamStatus(audioStreamStatus, backendConnected, audioConnected, backendError, onEnableAudio)}
      {gestureFeedback && <p className="leo-gesture-confirmation" role="status">Gesture → {genres.find((item) => item.id === gestureFeedback)?.label ?? gestureFeedback}</p>}
      <button type="button" className="leo-finish-hotspot" aria-label="Finish performance" title="Finish performance" onClick={onFinish} />
      <HeartBurstLayer triggerCount={heartsTriggerCount} />
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
