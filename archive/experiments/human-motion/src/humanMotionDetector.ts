import type { BodyKeypoint, BodyResult } from '@vladmandic/human'

const TRACKED_PARTS = new Set([
  'nose',
  'leftShoulder', 'rightShoulder',
  'leftElbow', 'rightElbow',
  'leftWrist', 'rightWrist',
  'leftHip', 'rightHip',
  'leftKnee', 'rightKnee',
  'leftAnkle', 'rightAnkle',
])

export const HUMAN_KEYPOINT_MIN_CONFIDENCE = 0.3
export const HUMAN_MOVEMENT_SMOOTHING_MS = 250
export const HUMAN_MOVEMENT_NOISE_FLOOR = 0.018
export const HUMAN_MOVEMENT_FULL_SCALE = 0.32
export const HUMAN_MAX_LANDMARK_VELOCITY = 2.5

export interface HumanMovementSample {
  rawMovementMagnitude: number
  smoothedMovementMagnitude: number
  motionScore: number
}

interface TrackedPoint { x: number; y: number; score: number }

const distance = (a: TrackedPoint, b: TrackedPoint) => Math.hypot(a.x - b.x, a.y - b.y)

function pointByPart(points: BodyKeypoint[], part: string): TrackedPoint | null {
  const point = points.find((candidate) => candidate.part === part)
  if (!point || point.score < HUMAN_KEYPOINT_MIN_CONFIDENCE) return null
  return { x: point.positionRaw[0], y: point.positionRaw[1], score: point.score }
}

function bodyScale(points: BodyKeypoint[]): number {
  const leftShoulder = pointByPart(points, 'leftShoulder')
  const rightShoulder = pointByPart(points, 'rightShoulder')
  const leftHip = pointByPart(points, 'leftHip')
  const rightHip = pointByPart(points, 'rightHip')
  const shoulderWidth = leftShoulder && rightShoulder ? distance(leftShoulder, rightShoulder) : 0
  const torsoHeight = leftShoulder && rightShoulder && leftHip && rightHip
    ? Math.hypot(
      (leftShoulder.x + rightShoulder.x - leftHip.x - rightHip.x) / 2,
      (leftShoulder.y + rightShoulder.y - leftHip.y - rightHip.y) / 2,
    )
    : 0
  return Math.max(shoulderWidth, torsoHeight, 0.1)
}

export class HumanMotionDetector {
  private previousPoints = new Map<string, TrackedPoint>()
  private previousTimestamp = 0
  private smoothedMovement = 0

  analyze(body: BodyResult, timestamp: number): HumanMovementSample {
    const scale = bodyScale(body.keypoints)
    const deltaSeconds = this.previousTimestamp > 0 ? Math.max(1 / 60, (timestamp - this.previousTimestamp) / 1000) : 0
    const currentPoints = new Map<string, TrackedPoint>()
    let movementTotal = 0
    let validMovements = 0

    for (const keypoint of body.keypoints) {
      if (!TRACKED_PARTS.has(keypoint.part) || keypoint.score < HUMAN_KEYPOINT_MIN_CONFIDENCE) continue
      const current = { x: keypoint.positionRaw[0], y: keypoint.positionRaw[1], score: keypoint.score }
      currentPoints.set(keypoint.part, current)
      const previous = this.previousPoints.get(keypoint.part)
      if (!previous || deltaSeconds === 0) continue
      const velocity = distance(current, previous) / scale / deltaSeconds
      if (velocity > HUMAN_MAX_LANDMARK_VELOCITY) continue
      movementTotal += velocity
      validMovements += 1
    }

    const rawMovementMagnitude = validMovements > 0 ? movementTotal / validMovements : 0
    const alpha = deltaSeconds > 0 ? 1 - Math.exp(-(deltaSeconds * 1000) / HUMAN_MOVEMENT_SMOOTHING_MS) : 0
    this.smoothedMovement += (rawMovementMagnitude - this.smoothedMovement) * alpha
    const motionScore = Math.max(0, Math.min(1,
      (this.smoothedMovement - HUMAN_MOVEMENT_NOISE_FLOOR) / (HUMAN_MOVEMENT_FULL_SCALE - HUMAN_MOVEMENT_NOISE_FLOOR),
    ))
    this.previousPoints = currentPoints
    this.previousTimestamp = timestamp
    return { rawMovementMagnitude, smoothedMovementMagnitude: this.smoothedMovement, motionScore }
  }

  reset() {
    this.previousPoints.clear()
    this.previousTimestamp = 0
    this.smoothedMovement = 0
  }
}
