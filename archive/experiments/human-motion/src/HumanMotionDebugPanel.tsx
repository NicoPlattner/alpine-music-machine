import type { HumanMotionPrototypeState } from './useHumanMotionPrototype'

interface Props { state: HumanMotionPrototypeState }

export function HumanMotionDebugPanel({ state }: Props) {
  if (!import.meta.env.DEV) return null
  return (
    <aside className="motion-debug human-motion-debug" aria-label="Human motion prototype diagnostics">
      <strong>HUMAN MOTION PROTOTYPE</strong>
      <span>Status: {state.prototypeStatus}</span>
      <span>Body detected: {state.bodyDetected ? 'yes' : 'no'}</span>
      <span>Pose confidence: {state.poseConfidence.toFixed(2)}</span>
      <span>Per-frame movement: {state.rawBodyMovement.toFixed(4)}</span>
      <span>Smoothed movement: {state.smoothedBodyMovement.toFixed(4)}</span>
      <span>Motion score: {state.motionScore.toFixed(2)}</span>
      <span>FPS: {state.fps} / 12 target</span>
      <span>Sample interval: {Math.round(state.motionSampleIntervalMs)} ms</span>
      <span>Target speed: {state.targetPlaybackRate.toFixed(2)}×</span>
      <span>Current speed: {state.currentPlaybackRate.toFixed(2)}×</span>
      {state.errorMessage && <span className="debug-error">{state.errorMessage}</span>}
    </aside>
  )
}
