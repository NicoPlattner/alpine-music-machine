import { DEBUG_ACCEPT_ANY_HAND, HAND_INFERENCE_TARGET_FPS } from '../motion/useHandTracking'
import { GENRE_GESTURE_HOLD_MS, type GenreGestureControl } from '../motion/useGenreGestureControl'
import type { HandTrackingState } from '../motion/handTrackingTypes'
import type { PoseTrackingState } from '../motion/poseTrackingTypes'
import type { PlaybackMotionState } from '../motion/useFrameMotionPlayback'
import { REQUIRED_CALIBRATION_SAMPLES } from '../motion/frameMotionDetector'
import type { LeoPerformerDiagnostics } from '../visuals/leoPerformer/LeoPerformerLayer'

interface MotionDebugPanelProps { tracking: HandTrackingState; gesture: GenreGestureControl; pose: PoseTrackingState; playbackMotion: PlaybackMotionState; leoPerformer: LeoPerformerDiagnostics; onRecalibrateMovement: () => void }
const formatPoint = (value: number) => value.toFixed(2)
const gestureLabel = (gesture: string) => gesture === 'idle' ? 'none' : gesture

export function MotionDebugPanel({ tracking, gesture, pose, playbackMotion, leoPerformer, onRecalibrateMovement }: MotionDebugPanelProps) {
  if (!import.meta.env.DEV || import.meta.env.VITE_SHOW_MOTION_DEBUG !== 'true') return null
  const fingers = gesture.fingerState
  return (
    <aside className="motion-debug" aria-label="Motion diagnostics">
      <strong>HAND TRACKING</strong>
      <span>Status: {tracking.status}</span>
      <span>Hands detected: {tracking.hands.length}</span>
      <span>Physical right hand: {tracking.physicalRightHandDetected ? 'detected' : 'not detected'}</span>
      <span>Control: {tracking.controlHand ? `Hand ${tracking.controlHand.index}` : 'none'}{DEBUG_ACCEPT_ANY_HAND ? ' · any-hand debug ON' : ''}</span>
      <span>Inference: {tracking.fps || 0} FPS / {HAND_INFERENCE_TARGET_FPS} target</span>
      {tracking.hands.map((hand) => (
        <div className="debug-hand" key={hand.index}>
          <b>Hand {hand.index}</b>
          <span>Label: {hand.reportedHandedness}</span>
          <span>Physical: {hand.physicalHandedness}</span>
          <span>Confidence: {hand.handednessConfidence?.toFixed(2) ?? 'n/a'}</span>
          <span>Wrist: {formatPoint(hand.rawLandmarks[0].x)}, {formatPoint(hand.rawLandmarks[0].y)}</span>
          <span>Index tip: {formatPoint(hand.rawLandmarks[8].x)}, {formatPoint(hand.rawLandmarks[8].y)}</span>
        </div>
      ))}
      <strong>GESTURE</strong>
      <span>Raw hand shape: {gestureLabel(gesture.rawGesture)}</span>
      <span>Candidate genre: {gestureLabel(gesture.candidateGesture)}</span>
      <span>Confirmed gesture: {gestureLabel(gesture.confirmedGesture)}</span>
      <span>Hold: {Math.round(gesture.holdProgressMs)} / {GENRE_GESTURE_HOLD_MS} ms</span>
      <span>Finger state: {fingers ? `T:${fingers.thumb} I:${fingers.index} M:${fingers.middle} R:${fingers.ring} P:${fingers.pinky}` : 'n/a'}</span>
      <strong>POSE / GENRE</strong>
      <span>Pose: {pose.frame ? 'detected' : 'not detected'}</span>
      <span>Tracking: {pose.status}{pose.fps ? ` · ${pose.fps} FPS` : ''}</span>
      <strong>LEO PERFORMER VISUAL</strong>
      <span>Performer visual: {leoPerformer.visual}</span>
      <span>Leo renderer: {leoPerformer.rendererStatus}</span>
      <span>Source: {leoPerformer.sourceReady ? 'ready' : 'missing'}</span>
      <span>Segmentation source: {leoPerformer.segmentationSourceReady ? 'ready' : 'missing'}</span>
      <span>Points: {leoPerformer.pointCount.toLocaleString()}</span>
      <span>Render FPS: {leoPerformer.renderFps}</span>
      <span>Frames rendered: {leoPerformer.framesRendered}</span>
      <span>Source: {leoPerformer.sourceWidth} × {leoPerformer.sourceHeight}</span>
      <span>Canvas: {leoPerformer.canvasWidth} × {leoPerformer.canvasHeight}</span>
      <span>Mask foreground: {(leoPerformer.maskForegroundRatio * 100).toFixed(1)}%</span>
      {leoPerformer.errorMessage && <span className="debug-error">{leoPerformer.errorMessage}</span>}
      <strong>MOTION SPEED</strong>
      <span>Calibration: {playbackMotion.calibrationStatus === 'calibrating' ? (playbackMotion.calibrationNeedsStill ? 'Hold still to calibrate' : 'calibrating') : playbackMotion.calibrationStatus}</span>
      <span>Calibration samples: {playbackMotion.calibrationAcceptedSamples} / {REQUIRED_CALIBRATION_SAMPLES} accepted · {playbackMotion.calibrationRejectedSamples} rejected</span>
      <span>Calibration elapsed: {(playbackMotion.calibrationElapsedMs / 1000).toFixed(1)} s</span>
      <span>Motion sample interval: {Math.round(playbackMotion.motionSampleIntervalMs)} ms</span>
      <span>Raw frame motion: {playbackMotion.rawMotion.toFixed(4)}</span>
      <span>Baseline: {playbackMotion.baselineMotion.toFixed(4)}</span>
      <span>Effective motion: {playbackMotion.effectiveMotion.toFixed(4)}</span>
      <span>Changed pixels: {(playbackMotion.changedPixelRatio * 100).toFixed(1)}%</span>
      <span>Motion score: {playbackMotion.motionScore.toFixed(2)}</span>
      <span>Motion zone: {playbackMotion.motionZone}</span>
      <span>Original speed: {playbackMotion.originalPlaybackRate.toFixed(2)}×</span>
      <span>Target speed: {playbackMotion.targetPlaybackRate.toFixed(2)}×</span>
      <span>Current speed: {playbackMotion.currentPlaybackRate.toFixed(2)}×</span>
      <span>Speed error: {(playbackMotion.targetPlaybackRate - playbackMotion.currentPlaybackRate).toFixed(3)}×</span>
      <span>Movement speed enabled: {playbackMotion.movementSpeedEnabled ? 'yes' : 'no'}</span>
      <button type="button" className="debug-action" onClick={onRecalibrateMovement}>Recalibrate movement</button>
      {pose.errorMessage && <span className="debug-error">{pose.errorMessage}</span>}
      {tracking.errorMessage && <span className="debug-error">{tracking.errorMessage}</span>}
    </aside>
  )
}
