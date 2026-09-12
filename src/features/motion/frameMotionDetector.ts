export type MotionCalibrationStatus = 'waiting' | 'calibrating' | 'ready'
export type MotionZone = 'LOW' | 'NORMAL' | 'HIGH'

export const MOTION_ANALYSIS_WIDTH = 96
export const MOTION_SAMPLE_FPS = 12
export const ALPHA_THRESHOLD = 180
export const PIXEL_DIFF_THRESHOLD = 26
export const MIN_CHANGED_PIXEL_RATIO = 0.004
export const MIN_FOREGROUND_PIXELS = 40
export const MASK_CHANGE_WEIGHT = 0.75
export const TEXTURE_CHANGE_WEIGHT = 0.25
export const REQUIRED_CALIBRATION_SAMPLES = 10
export const CALIBRATION_STILL_SAMPLE_MAX = 0.05
export const MAX_REASONABLE_BASELINE = 0.04
export const BASELINE_MULTIPLIER = 1.35
export const MOTION_SCORE_SENSITIVITY = 10
export const LOW_ENTER_THRESHOLD = 0.12
export const LOW_LEAVE_THRESHOLD = 0.17
export const HIGH_ENTER_THRESHOLD = 0.42
export const HIGH_LEAVE_THRESHOLD = 0.36

export interface FrameMotionSample {
  calibrationStatus: MotionCalibrationStatus
  calibrationElapsedMs: number
  calibrationAcceptedSamples: number
  calibrationRejectedSamples: number
  calibrationNeedsStill: boolean
  baselineMotion: number
  rawMotion: number
  effectiveMotion: number
  motionScore: number
  motionZone: MotionZone
  changedPixelRatio: number
  motionSampleIntervalMs: number
  sampleTimestamp: number
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const luminance = (data: Uint8ClampedArray, offset: number) => data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722

function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export class FrameMotionDetector {
  private readonly canvas = document.createElement('canvas')
  private readonly context: CanvasRenderingContext2D | null
  private previousFrame: Uint8ClampedArray | null = null
  private lastSampleAt = 0
  private calibrationStartedAt = 0
  private calibrationSamples: number[] = []
  private calibrationRejectedSamples = 0
  private calibrationNeedsStill = false
  private calibrationStatus: MotionCalibrationStatus = 'waiting'
  private baselineMotion = 0
  private zone: MotionZone = 'NORMAL'

  constructor() {
    this.context = this.canvas.getContext('2d', { willReadFrequently: true })
  }

  analyze(frame: HTMLCanvasElement, timestamp: number): FrameMotionSample | null {
    if (!this.context || timestamp - this.lastSampleAt < 1000 / MOTION_SAMPLE_FPS) return null
    const motionSampleIntervalMs = this.lastSampleAt > 0 ? timestamp - this.lastSampleAt : 0
    this.lastSampleAt = timestamp
    const targetHeight = Math.max(54, Math.round(MOTION_ANALYSIS_WIDTH * frame.height / Math.max(1, frame.width)))
    if (this.canvas.width !== MOTION_ANALYSIS_WIDTH || this.canvas.height !== targetHeight) {
      this.canvas.width = MOTION_ANALYSIS_WIDTH
      this.canvas.height = targetHeight
      this.previousFrame = null
    }
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.context.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height)
    const current = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height).data
    if (!this.previousFrame) {
      this.previousFrame = current.slice()
      return null
    }

    let foregroundPixels = 0
    let maskChangedPixels = 0
    let textureChangedPixels = 0
    let textureMagnitude = 0
    for (let offset = 0; offset < current.length; offset += 4) {
      const currentPerson = current[offset + 3] >= ALPHA_THRESHOLD
      const previousPerson = this.previousFrame[offset + 3] >= ALPHA_THRESHOLD
      if (!currentPerson && !previousPerson) continue
      foregroundPixels += 1
      if (currentPerson !== previousPerson) {
        maskChangedPixels += 1
        continue
      }
      const difference = Math.abs(luminance(current, offset) - luminance(this.previousFrame, offset))
      if (difference < PIXEL_DIFF_THRESHOLD) continue
      textureChangedPixels += 1
      textureMagnitude += (difference - PIXEL_DIFF_THRESHOLD) / (255 - PIXEL_DIFF_THRESHOLD)
    }
    this.previousFrame = current.slice()
    if (foregroundPixels < MIN_FOREGROUND_PIXELS) return null

    const changedPixelRatio = (maskChangedPixels + textureChangedPixels) / foregroundPixels
    const maskChangeRatio = maskChangedPixels / foregroundPixels
    const textureChangeRatio = textureMagnitude / foregroundPixels
    const rawMotion = changedPixelRatio < MIN_CHANGED_PIXEL_RATIO ? 0 : maskChangeRatio * MASK_CHANGE_WEIGHT + textureChangeRatio * TEXTURE_CHANGE_WEIGHT
    if (this.calibrationStatus === 'waiting') {
      this.calibrationStatus = 'calibrating'
      this.calibrationStartedAt = timestamp
    }
    if (this.calibrationStatus === 'calibrating') {
      if (rawMotion <= CALIBRATION_STILL_SAMPLE_MAX) {
        this.calibrationSamples.push(rawMotion)
        this.calibrationNeedsStill = false
      } else {
        this.calibrationRejectedSamples += 1
        this.calibrationNeedsStill = true
      }
      if (this.calibrationSamples.length >= REQUIRED_CALIBRATION_SAMPLES) {
        const candidateBaseline = median(this.calibrationSamples)
        if (candidateBaseline <= MAX_REASONABLE_BASELINE) {
          this.baselineMotion = candidateBaseline
          this.calibrationStatus = 'ready'
          this.calibrationNeedsStill = false
        } else {
          this.calibrationRejectedSamples += this.calibrationSamples.length
          this.calibrationSamples = []
          this.calibrationNeedsStill = true
        }
      }
    }

    const effectiveMotion = this.calibrationStatus === 'ready' ? Math.max(0, rawMotion - this.baselineMotion * BASELINE_MULTIPLIER) : 0
    const motionScore = clamp01(effectiveMotion * MOTION_SCORE_SENSITIVITY)
    this.zone = this.nextZone(motionScore)
    return {
      calibrationStatus: this.calibrationStatus,
      calibrationElapsedMs: this.calibrationStartedAt > 0 ? timestamp - this.calibrationStartedAt : 0,
      calibrationAcceptedSamples: this.calibrationSamples.length,
      calibrationRejectedSamples: this.calibrationRejectedSamples,
      calibrationNeedsStill: this.calibrationNeedsStill,
      baselineMotion: this.baselineMotion,
      rawMotion,
      effectiveMotion,
      motionScore,
      motionZone: this.zone,
      changedPixelRatio,
      motionSampleIntervalMs,
      sampleTimestamp: timestamp,
    }
  }

  recalibrate() {
    this.previousFrame = null
    this.calibrationStartedAt = 0
    this.calibrationSamples = []
    this.calibrationRejectedSamples = 0
    this.calibrationNeedsStill = false
    this.calibrationStatus = 'waiting'
    this.baselineMotion = 0
    this.zone = 'NORMAL'
  }

  private nextZone(score: number): MotionZone {
    if (this.zone === 'LOW') return score > LOW_LEAVE_THRESHOLD ? (score > HIGH_ENTER_THRESHOLD ? 'HIGH' : 'NORMAL') : 'LOW'
    if (this.zone === 'HIGH') return score < HIGH_LEAVE_THRESHOLD ? (score < LOW_ENTER_THRESHOLD ? 'LOW' : 'NORMAL') : 'HIGH'
    if (score < LOW_ENTER_THRESHOLD) return 'LOW'
    if (score > HIGH_ENTER_THRESHOLD) return 'HIGH'
    return 'NORMAL'
  }
}

export const PLAYBACK_RATE_MIN_RATIO = 0.84
export const PLAYBACK_RATE_MAX_RATIO = 1.2
export const FRAME_MOTION_SPEED_CURVE = [
  { motionScore: 0, rateRatio: 0.84 },
  { motionScore: 0.1, rateRatio: 0.9 },
  { motionScore: 0.24, rateRatio: 1 },
  { motionScore: 0.38, rateRatio: 1.08 },
  { motionScore: 0.55, rateRatio: 1.14 },
  { motionScore: 0.75, rateRatio: 1.2 },
] as const

export function mapFrameMotionToPlaybackRate(motionScore: number, originalPlaybackRate: number): number {
  const score = clamp01(motionScore)
  for (let index = 1; index < FRAME_MOTION_SPEED_CURVE.length; index += 1) {
    const lower = FRAME_MOTION_SPEED_CURVE[index - 1]
    const upper = FRAME_MOTION_SPEED_CURVE[index]
    if (score <= upper.motionScore) {
      const progress = (score - lower.motionScore) / (upper.motionScore - lower.motionScore)
      return originalPlaybackRate * (lower.rateRatio + (upper.rateRatio - lower.rateRatio) * progress)
    }
  }
  return originalPlaybackRate * PLAYBACK_RATE_MAX_RATIO
}
