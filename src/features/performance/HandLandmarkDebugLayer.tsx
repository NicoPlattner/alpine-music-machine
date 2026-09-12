import type { TrackedHand } from '../motion/handTrackingTypes'

interface HandLandmarkDebugLayerProps { hands: TrackedHand[] }

const tipLandmarks = new Set([4, 8, 12, 16, 20])

export function HandLandmarkDebugLayer({ hands }: HandLandmarkDebugLayerProps) {
  if (!import.meta.env.DEV || hands.length === 0) return null
  return (
    <div className="hand-landmark-debug" aria-hidden="true">
      {hands.flatMap((hand) => hand.screenLandmarks.map((landmark, index) => (
        <span
          key={`${hand.index}-${index}`}
          className={`debug-landmark hand-${hand.index % 2}${index === 0 || tipLandmarks.has(index) ? ' key-landmark' : ''}`}
          style={{ left: `${landmark.x * 100}%`, top: `${landmark.y * 100}%` }}
        />
      )))}
    </div>
  )
}
