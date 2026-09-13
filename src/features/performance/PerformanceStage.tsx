import { useCallback, useEffect, useRef, useState } from 'react'
import type { Song } from '../../types/song'
import type { MusicGenre } from '../audio/api/audioApiTypes'
import { useAudioBackend } from '../audio/useAudioBackend'
import { useNicoLyrics } from '../karaoke/data/useNicoLyrics'
import { useKaraokeMicrophone } from '../karaoke/input/useKaraokeMicrophone'
import { useKaraokeScoring } from '../karaoke/scoring/useKaraokeScoring'
import { useKaraokeTimeline } from '../karaoke/timeline/useKaraokeTimeline'
import { useGenreGestureControl } from '../motion/useGenreGestureControl'
import { useHandTracking } from '../motion/useHandTracking'
import { useFrameMotionPlayback } from '../motion/useFrameMotionPlayback'
import { usePoseTracking } from '../motion/usePoseTracking'
import { HandLandmarkDebugLayer } from './HandLandmarkDebugLayer'
import { LeoInterfaceLayer } from './LeoInterfaceLayer'
import { MotionFeedbackLayer } from './MotionFeedbackLayer'
import { MotionDebugPanel } from './MotionDebugPanel'
import { PerformerLayer } from './PerformerLayer'
import { usePerformanceCamera } from './usePerformanceCamera'
import {
  EMPTY_LEO_DIAGNOSTICS,
  PERFORMER_VISUAL,
  type LeoPerformerDiagnostics,
} from '../visuals/leoPerformer/LeoPerformerLayer'
import { LeoVisualStage } from '../visuals/leoPerformer/LeoVisualStage'
import './leoPerformanceStage.css'

interface PerformanceStageProps { song: Song; onFinish: () => void }

const SONG_END_TOLERANCE_SECONDS = 0.05

export function PerformanceStage({ song, onFinish }: PerformanceStageProps) {
  const finishTriggeredRef = useRef(false)
  const karaokeOnlyMode = import.meta.env.VITE_KARAOKE_ONLY_MODE === 'true'
  const performerSystemsEnabled = !karaokeOnlyMode
  const { stream, status } = usePerformanceCamera(performerSystemsEnabled)
  const [videoSource, setVideoSource] = useState<HTMLVideoElement | null>(null)
  const [segmentedPerformerSource, setSegmentedPerformerSource] = useState<HTMLCanvasElement | null>(null)
  const [segmentationMaskSource, setSegmentationMaskSource] = useState<HTMLCanvasElement | null>(null)
  const [leoDiagnostics, setLeoDiagnostics] = useState<LeoPerformerDiagnostics>(EMPTY_LEO_DIAGNOSTICS)
  const handTracking = useHandTracking(videoSource, performerSystemsEnabled)
  const genreGesture = useGenreGestureControl(handTracking.controlHand)
  const poseTracking = usePoseTracking(videoSource, performerSystemsEnabled)
  const movementPlayback = useFrameMotionPlayback(song.originalPlaybackRate, performerSystemsEnabled)
  const audioBackend = useAudioBackend()
  const fixtureEnabled = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV_KARAOKE_FIXTURE === 'true'
  const karaokeLyrics = useNicoLyrics(fixtureEnabled)
  const { lyrics } = karaokeLyrics
  const karaokeTimeline = useKaraokeTimeline(lyrics, audioBackend.estimatedPlaybackPosition)
  const karaokeMicrophone = useKaraokeMicrophone(audioBackend.estimatedPlaybackPosition)
  const karaokeScoring = useKaraokeScoring(
    karaokeMicrophone.frame,
    karaokeMicrophone.status,
    audioBackend.state?.playing ?? false,
  )
  const handleSegmentedFrame = useCallback((frame: HTMLCanvasElement, timestamp: number, mask: HTMLCanvasElement) => {
    setSegmentedPerformerSource((current) => current === frame ? current : frame)
    setSegmentationMaskSource((current) => current === mask ? current : mask)
    movementPlayback.analyzeSegmentedFrame(frame, timestamp)
  }, [movementPlayback.analyzeSegmentedFrame])
  const leoVisualEnabled = performerSystemsEnabled && PERFORMER_VISUAL === 'leo'
  // Keep the photographic segmentation canvas source-only while Leo initializes.
  // Reveal it only when Leo is disabled or has genuinely failed, avoiding a
  // temporary raw-looking performer during the model/WebGL warm-up.
  const performerVisualMode = leoVisualEnabled && leoDiagnostics.rendererStatus !== 'error' ? 'leo' : 'segmented'

  useEffect(() => {
    const confirmed = genreGesture.confirmedGesture
    if (confirmed === 'idle') return
    void audioBackend.selectGenre(confirmed.toLowerCase() as MusicGenre, 'gesture')
  }, [audioBackend.selectGenre, genreGesture.confirmedGesture])

  useEffect(() => {
    if (import.meta.env.VITE_ENABLE_MOVEMENT_SPEED_BACKEND !== 'true' || !movementPlayback.movementSpeedEnabled) return
    const backendSpeed = audioBackend.state?.speed
    const nextSpeed = Math.min(1.5, Math.max(0.5, movementPlayback.currentPlaybackRate))
    if (backendSpeed === undefined || Math.abs(nextSpeed - backendSpeed) < 0.02) return
    const timer = window.setTimeout(() => { void audioBackend.setSpeed(nextSpeed) }, 250)
    return () => window.clearTimeout(timer)
  }, [audioBackend.setSpeed, audioBackend.state?.speed, movementPlayback.currentPlaybackRate, movementPlayback.movementSpeedEnabled])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onFinish() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onFinish])

  useEffect(() => {
    const backendState = audioBackend.state
    if (!backendState || finishTriggeredRef.current || backendState.duration <= 0) return
    const endPosition = backendState.duration - SONG_END_TOLERANCE_SECONDS
    const estimatedReachedEnd = backendState.playing && audioBackend.estimatedPlaybackPosition >= endPosition
    const backendReachedEnd = backendState.position >= endPosition
    if (!estimatedReachedEnd && !backendReachedEnd) return
    finishTriggeredRef.current = true
    onFinish()
  }, [audioBackend.estimatedPlaybackPosition, audioBackend.state, onFinish])

  return (
    <main className="performance-stage">
      <LeoVisualStage enabled={leoVisualEnabled} source={segmentedPerformerSource} maskSource={segmentationMaskSource} onDiagnosticsChange={setLeoDiagnostics} />
      {performerSystemsEnabled && <PerformerLayer stream={stream} status={status} visualMode={performerVisualMode} onVideoSourceChange={setVideoSource} onSegmentedFrame={handleSegmentedFrame} />}
      {performerSystemsEnabled && <HandLandmarkDebugLayer hands={handTracking.hands} />}
      {performerSystemsEnabled && <MotionFeedbackLayer detected={handTracking.fingertip !== null} x={handTracking.fingertip?.x} y={handTracking.fingertip?.y} />}
      <audio ref={audioBackend.audioRef} className="sr-only" src={audioBackend.liveAudioUrl} preload="auto" onPlaying={audioBackend.onAudioPlaying} onWaiting={audioBackend.onAudioWaiting} onStalled={audioBackend.onAudioWaiting} onError={audioBackend.onAudioError} />
      <LeoInterfaceLayer
        currentTime={audioBackend.estimatedPlaybackPosition} duration={audioBackend.state?.duration ?? 0}
        karaokeTimeline={karaokeTimeline} hasLyrics={lyrics.lines.length > 0}
        genre={audioBackend.state?.genre ?? null} genres={audioBackend.genres}
        genreGesture={genreGesture.rawGesture} pendingGenre={audioBackend.pendingGenre} gestureFeedback={audioBackend.gestureFeedback}
        playing={audioBackend.state?.playing ?? false} transportPending={audioBackend.transportPending}
        backendConnected={audioBackend.connectionStatus === 'connected'} audioConnected={audioBackend.state?.audio_connected ?? false}
        audioStreamStatus={audioBackend.audioStreamStatus} backendError={audioBackend.error}
        totalScore={karaokeScoring.totalScore} latestScoreEvent={karaokeScoring.lastEvent} heartsTriggerCount={karaokeScoring.heartsTriggerCount}
        onGenreChange={(genre) => { void audioBackend.selectGenre(genre, 'button') }}
        onPlayPause={() => { void (audioBackend.state?.playing ? audioBackend.pause() : audioBackend.play()) }}
        onRestart={() => { karaokeScoring.resetScore(); void audioBackend.restart() }} onEnableAudio={() => { void audioBackend.enableAudio() }}
        onSeek={(position) => { void audioBackend.seek(position) }} onFinish={onFinish}
      />
      {performerSystemsEnabled && <MotionDebugPanel tracking={handTracking} gesture={genreGesture} pose={poseTracking} playbackMotion={movementPlayback} leoPerformer={leoDiagnostics} onRecalibrateMovement={movementPlayback.recalibrateMovement} />}
    </main>
  )
}
