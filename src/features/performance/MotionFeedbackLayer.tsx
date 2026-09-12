interface MotionFeedbackLayerProps { detected: boolean; x?: number; y?: number }
export function MotionFeedbackLayer({ detected, x = 0, y = 0 }: MotionFeedbackLayerProps) {
  if (!detected) return null
  return <div className="motion-feedback" aria-label="Control-hand index fingertip tracking"><div className="hand-cursor tracked-hand-cursor" style={{ left: `${x * 100}%`, top: `${y * 100}%` }}><span /></div></div>
}
