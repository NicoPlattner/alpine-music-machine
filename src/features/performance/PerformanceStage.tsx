import { useCallback, useEffect, useState } from 'react'
import type { Song } from '../../types/song'
import { usePerformanceStore } from '../../store/performanceStore'
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

export function PerformanceStage({ song, onFinish }: PerformanceStageProps) {
  const currentTime = usePerformanceStore((state) => state.currentTime)
  const setCurrentTime = usePerformanceStore((state) => state.setCurrentTime)
  const { stream, status } = usePerformanceCamera()
  const [videoSource, setVideoSource] = useState<HTMLVideoElement | null>(null)
  const [segmentedPerformerSource, setSegmentedPerformerSource] = useState<HTMLCanvasElement | null>(null)
  const [segmentationMaskSource, setSegmentationMaskSource] = useState<HTMLCanvasElement | null>(null)
  const [leoDiagnostics, setLeoDiagnostics] = useState<LeoPerformerDiagnostics>(EMPTY_LEO_DIAGNOSTICS)
  const handTracking = useHandTracking(videoSource)
  const genreGesture = useGenreGestureControl(handTracking.controlHand)
  const poseTracking = usePoseTracking(videoSource)
  const movementPlayback = useFrameMotionPlayback(song.originalPlaybackRate)
  const handleSegmentedFrame = useCallback((frame: HTMLCanvasElement, timestamp: number, mask: HTMLCanvasElement) => {
    setSegmentedPerformerSource((current) => current === frame ? current : frame)
    setSegmentationMaskSource((current) => current === mask ? current : mask)
    movementPlayback.analyzeSegmentedFrame(frame, timestamp)
  }, [movementPlayback.analyzeSegmentedFrame])
  const leoVisualEnabled = PERFORMER_VISUAL === 'leo'
  // Keep the photographic segmentation canvas source-only while Leo initializes.
  // Reveal it only when Leo is disabled or has genuinely failed, avoiding a
  // temporary raw-looking performer during the model/WebGL warm-up.
  const performerVisualMode = leoVisualEnabled && leoDiagnostics.rendererStatus !== 'error' ? 'leo' : 'segmented'

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onFinish() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onFinish])

  return (
    <main className="performance-stage">
      <LeoVisualStage enabled={leoVisualEnabled} source={segmentedPerformerSource} maskSource={segmentationMaskSource} onDiagnosticsChange={setLeoDiagnostics} onPlaybackTime={setCurrentTime} />
      <PerformerLayer stream={stream} status={status} visualMode={performerVisualMode} onVideoSourceChange={setVideoSource} onSegmentedFrame={handleSegmentedFrame} />
      <HandLandmarkDebugLayer hands={handTracking.hands} />
      <MotionFeedbackLayer detected={handTracking.fingertip !== null} x={handTracking.fingertip?.x} y={handTracking.fingertip?.y} />
      <LeoInterfaceLayer currentTime={currentTime} genre={genreGesture.genre} genreGesture={genreGesture.rawGesture} onGenreChange={genreGesture.setGenre} onFinish={onFinish} />
      <MotionDebugPanel tracking={handTracking} gesture={genreGesture} pose={poseTracking} playbackMotion={movementPlayback} leoPerformer={leoDiagnostics} onRecalibrateMovement={movementPlayback.recalibrateMovement} />
    </main>
  )
}
