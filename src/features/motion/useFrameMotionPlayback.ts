import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FrameMotionDetector,
  mapFrameMotionToPlaybackRate,
  PLAYBACK_RATE_MAX_RATIO,
  PLAYBACK_RATE_MIN_RATIO,
  type FrameMotionSample,
  type MotionCalibrationStatus,
  type MotionZone,
} from './frameMotionDetector'

export const SEGMENTATION_LOSS_HOLD_MS = 500
export const SEGMENTATION_STALE_MS = 450
export const PLAYBACK_RATE_ATTACK_MS = 300
export const PLAYBACK_RATE_RELEASE_MS = 350
export const PLAYBACK_RATE_SNAP_THRESHOLD = 0.005

export interface PlaybackMotionState {
  movementSpeedEnabled: boolean
  originalPlaybackRate: number
  currentPlaybackRate: number
  targetPlaybackRate: number
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
  minPlaybackRate: number
  maxPlaybackRate: number
}

const emptyMotion: Omit<FrameMotionSample, 'sampleTimestamp'> = {
  calibrationStatus: 'waiting', calibrationElapsedMs: 0, baselineMotion: 0,
  calibrationAcceptedSamples: 0, calibrationRejectedSamples: 0, calibrationNeedsStill: false,
  rawMotion: 0, effectiveMotion: 0, motionScore: 0, motionZone: 'NORMAL', changedPixelRatio: 0,
  motionSampleIntervalMs: 0,
}

export function useFrameMotionPlayback(originalPlaybackRate: number, enabled = true) {
  const [movementSpeedEnabled, setMovementSpeedEnabled] = useState(false)
  const detectorRef = useRef<FrameMotionDetector | null>(null)
  const lastMotionFrameAtRef = useRef(0)
  const segmentationLostAtRef = useRef<number | null>(null)
  const currentRateRef = useRef(originalPlaybackRate)
  const targetRateRef = useRef(originalPlaybackRate)
  const lastAnimationAtRef = useRef(performance.now())
  const lastRenderAtRef = useRef(0)
  const metricsRef = useRef(emptyMotion)
  const [state, setState] = useState<PlaybackMotionState>({
    movementSpeedEnabled: false, originalPlaybackRate,
    currentPlaybackRate: originalPlaybackRate, targetPlaybackRate: originalPlaybackRate,
    ...emptyMotion,
    minPlaybackRate: originalPlaybackRate * PLAYBACK_RATE_MIN_RATIO,
    maxPlaybackRate: originalPlaybackRate * PLAYBACK_RATE_MAX_RATIO,
  })

  useEffect(() => {
    if (!enabled) {
      detectorRef.current = null
      return
    }
    detectorRef.current = new FrameMotionDetector()
    metricsRef.current = emptyMotion
    currentRateRef.current = originalPlaybackRate
    targetRateRef.current = originalPlaybackRate
    lastMotionFrameAtRef.current = 0
    segmentationLostAtRef.current = null
    return () => { detectorRef.current = null }
  }, [enabled, originalPlaybackRate])

  const analyzeSegmentedFrame = useCallback((frame: HTMLCanvasElement, timestamp: number) => {
    if (!enabled) return
    const sample = detectorRef.current?.analyze(frame, timestamp)
    if (!sample) return
    lastMotionFrameAtRef.current = timestamp
    segmentationLostAtRef.current = null
    const { sampleTimestamp: _sampleTimestamp, ...metrics } = sample
    metricsRef.current = metrics
    targetRateRef.current = movementSpeedEnabled && sample.calibrationStatus === 'ready'
      ? mapFrameMotionToPlaybackRate(sample.motionScore, originalPlaybackRate)
      : originalPlaybackRate
  }, [enabled, movementSpeedEnabled, originalPlaybackRate])

  useEffect(() => {
    if (!enabled) return
    let animationFrame = 0
    const update = (now: number) => {
      const framesStale = lastMotionFrameAtRef.current > 0 && now - lastMotionFrameAtRef.current > SEGMENTATION_STALE_MS
      if (framesStale && segmentationLostAtRef.current === null) {
        segmentationLostAtRef.current = now
        targetRateRef.current = currentRateRef.current
      }
      if (segmentationLostAtRef.current !== null && now - segmentationLostAtRef.current >= SEGMENTATION_LOSS_HOLD_MS) targetRateRef.current = originalPlaybackRate
      if (!movementSpeedEnabled) targetRateRef.current = originalPlaybackRate
      const deltaMs = Math.min(100, now - lastAnimationAtRef.current)
      lastAnimationAtRef.current = now
      const smoothingTime = targetRateRef.current > currentRateRef.current ? PLAYBACK_RATE_ATTACK_MS : PLAYBACK_RATE_RELEASE_MS
      const alpha = 1 - Math.exp(-deltaMs / smoothingTime)
      currentRateRef.current += (targetRateRef.current - currentRateRef.current) * alpha
      if (Math.abs(targetRateRef.current - currentRateRef.current) < PLAYBACK_RATE_SNAP_THRESHOLD) {
        currentRateRef.current = targetRateRef.current
      }
      if (now - lastRenderAtRef.current >= 50) {
        lastRenderAtRef.current = now
        setState({
          movementSpeedEnabled, originalPlaybackRate,
          currentPlaybackRate: currentRateRef.current, targetPlaybackRate: targetRateRef.current,
          ...metricsRef.current,
          minPlaybackRate: originalPlaybackRate * PLAYBACK_RATE_MIN_RATIO,
          maxPlaybackRate: originalPlaybackRate * PLAYBACK_RATE_MAX_RATIO,
        })
      }
      animationFrame = requestAnimationFrame(update)
    }
    animationFrame = requestAnimationFrame(update)
    return () => cancelAnimationFrame(animationFrame)
  }, [enabled, movementSpeedEnabled, originalPlaybackRate])

  const toggleMovementSpeed = useCallback(() => setMovementSpeedEnabled((enabled) => !enabled), [])
  const recalibrateMovement = useCallback(() => {
    detectorRef.current?.recalibrate()
    metricsRef.current = emptyMotion
    targetRateRef.current = originalPlaybackRate
  }, [originalPlaybackRate])

  return { ...state, analyzeSegmentedFrame, toggleMovementSpeed, recalibrateMovement }
}
