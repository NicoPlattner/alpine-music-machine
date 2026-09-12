import { useCallback, useEffect, useRef, useState } from 'react'
import type Human from '@vladmandic/human'
import type { Result } from '@vladmandic/human'
import { mapFrameMotionToPlaybackRate, PLAYBACK_RATE_MAX_RATIO, PLAYBACK_RATE_MIN_RATIO } from '../frameMotionDetector'
import {
  PLAYBACK_RATE_ATTACK_MS,
  PLAYBACK_RATE_RELEASE_MS,
  PLAYBACK_RATE_SNAP_THRESHOLD,
  type PlaybackMotionState,
} from '../useFrameMotionPlayback'
import { HumanMotionDetector } from './humanMotionDetector'

export const HUMAN_MOTION_PROTOTYPE_ENABLED = import.meta.env.DEV && import.meta.env.VITE_HUMAN_MOTION_PROTOTYPE === 'true'
export const HUMAN_BODY_TARGET_FPS = 12

export type HumanPrototypeStatus = 'disabled' | 'loading' | 'ready' | 'error'

export interface HumanMotionPrototypeState extends PlaybackMotionState {
  prototypeStatus: HumanPrototypeStatus
  bodyDetected: boolean
  poseConfidence: number
  rawBodyMovement: number
  smoothedBodyMovement: number
  fps: number
  errorMessage: string | null
}

const emptyPlayback = (originalPlaybackRate: number): PlaybackMotionState => ({
  movementSpeedEnabled: true,
  originalPlaybackRate,
  currentPlaybackRate: originalPlaybackRate,
  targetPlaybackRate: originalPlaybackRate,
  calibrationStatus: 'ready',
  calibrationElapsedMs: 0,
  calibrationAcceptedSamples: 0,
  calibrationRejectedSamples: 0,
  calibrationNeedsStill: false,
  baselineMotion: 0,
  rawMotion: 0,
  effectiveMotion: 0,
  motionScore: 0,
  motionZone: 'LOW',
  changedPixelRatio: 0,
  motionSampleIntervalMs: 0,
  minPlaybackRate: originalPlaybackRate * PLAYBACK_RATE_MIN_RATIO,
  maxPlaybackRate: originalPlaybackRate * PLAYBACK_RATE_MAX_RATIO,
})

export function useHumanMotionPrototype(video: HTMLVideoElement | null, originalPlaybackRate: number, enabled: boolean) {
  const [, setMovementSpeedEnabled] = useState(true)
  const movementSpeedEnabledRef = useRef(true)
  const [state, setState] = useState<HumanMotionPrototypeState>({
    ...emptyPlayback(originalPlaybackRate),
    prototypeStatus: enabled ? 'loading' : 'disabled',
    bodyDetected: false,
    poseConfidence: 0,
    rawBodyMovement: 0,
    smoothedBodyMovement: 0,
    fps: 0,
    errorMessage: null,
  })
  const movementDetectorRef = useRef(new HumanMotionDetector())
  const targetRateRef = useRef(originalPlaybackRate)
  const currentRateRef = useRef(originalPlaybackRate)
  const lastSpeedUpdateRef = useRef(performance.now())
  const latestMetricsRef = useRef({ bodyDetected: false, poseConfidence: 0, rawBodyMovement: 0, smoothedBodyMovement: 0, motionScore: 0, fps: 0, sampleInterval: 0 })

  useEffect(() => {
    if (!enabled || !video) {
      setState((current) => ({ ...current, prototypeStatus: enabled ? 'loading' : 'disabled' }))
      return
    }
    let active = true
    let human: Human | null = null
    let detectionFrame = 0
    let renderFrame = 0
    let lastDetectionAt = 0
    let lastRenderedAt = 0
    let fpsStartedAt = performance.now()
    let framesSinceFps = 0
    let runtimeError: string | null = null

    const detect = async (now: number) => {
      if (!active || !human) return
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && now - lastDetectionAt >= 1000 / HUMAN_BODY_TARGET_FPS) {
        const sampleInterval = lastDetectionAt > 0 ? now - lastDetectionAt : 0
        lastDetectionAt = now
        try {
          const result = await human.detect(video)
          if (!active) return
          const interpolated: Result = human.next(result)
          const body = interpolated.body[0]
          framesSinceFps += 1
          const fpsElapsed = performance.now() - fpsStartedAt
          if (fpsElapsed >= 1000) {
            latestMetricsRef.current.fps = Math.round(framesSinceFps * 1000 / fpsElapsed)
            framesSinceFps = 0
            fpsStartedAt = performance.now()
          }
          if (body) {
            const movement = movementDetectorRef.current.analyze(body, now)
            const motionScore = movement.motionScore
            latestMetricsRef.current = {
              ...latestMetricsRef.current,
              bodyDetected: true,
              poseConfidence: body.score,
              rawBodyMovement: movement.rawMovementMagnitude,
              smoothedBodyMovement: movement.smoothedMovementMagnitude,
              motionScore,
              sampleInterval,
            }
            targetRateRef.current = movementSpeedEnabledRef.current
              ? mapFrameMotionToPlaybackRate(motionScore, originalPlaybackRate)
              : originalPlaybackRate
          } else {
            latestMetricsRef.current = { ...latestMetricsRef.current, bodyDetected: false, poseConfidence: 0, sampleInterval }
            targetRateRef.current = originalPlaybackRate
          }
        } catch (error) {
          runtimeError = error instanceof Error ? error.message : 'Human body detection failed.'
          targetRateRef.current = originalPlaybackRate
          return
        }
      }
      detectionFrame = requestAnimationFrame(detect)
    }

    const updateSpeed = (now: number) => {
      if (!active) return
      if (!movementSpeedEnabledRef.current) targetRateRef.current = originalPlaybackRate
      const deltaMs = Math.min(100, now - lastSpeedUpdateRef.current)
      lastSpeedUpdateRef.current = now
      const smoothingMs = targetRateRef.current > currentRateRef.current ? PLAYBACK_RATE_ATTACK_MS : PLAYBACK_RATE_RELEASE_MS
      const alpha = 1 - Math.exp(-deltaMs / smoothingMs)
      currentRateRef.current += (targetRateRef.current - currentRateRef.current) * alpha
      if (Math.abs(targetRateRef.current - currentRateRef.current) < PLAYBACK_RATE_SNAP_THRESHOLD) currentRateRef.current = targetRateRef.current
      if (now - lastRenderedAt < 50) {
        renderFrame = requestAnimationFrame(updateSpeed)
        return
      }
      lastRenderedAt = now
      const metrics = latestMetricsRef.current
      setState({
        ...emptyPlayback(originalPlaybackRate),
        movementSpeedEnabled: movementSpeedEnabledRef.current,
        currentPlaybackRate: currentRateRef.current,
        targetPlaybackRate: targetRateRef.current,
        rawMotion: metrics.rawBodyMovement,
        effectiveMotion: metrics.smoothedBodyMovement,
        motionScore: metrics.motionScore,
        motionZone: metrics.motionScore < 0.12 ? 'LOW' : metrics.motionScore > 0.42 ? 'HIGH' : 'NORMAL',
        motionSampleIntervalMs: metrics.sampleInterval,
        prototypeStatus: runtimeError ? 'error' : 'ready',
        bodyDetected: metrics.bodyDetected,
        poseConfidence: metrics.poseConfidence,
        rawBodyMovement: metrics.rawBodyMovement,
        smoothedBodyMovement: metrics.smoothedBodyMovement,
        fps: metrics.fps,
        errorMessage: runtimeError,
      })
      renderFrame = requestAnimationFrame(updateSpeed)
    }

    const initialize = async () => {
      setState((current) => ({ ...current, prototypeStatus: 'loading', errorMessage: null }))
      try {
        const module = await import('@vladmandic/human')
        const nextHuman = new module.default({
          backend: 'webgl',
          modelBasePath: `${import.meta.env.BASE_URL}human-models/`,
          cacheModels: true,
          async: true,
          warmup: 'body',
          debug: false,
          filter: { enabled: true, width: 320, height: 180, flip: false, return: false },
          face: { enabled: false },
          hand: { enabled: false },
          object: { enabled: false },
          segmentation: { enabled: false },
          gesture: { enabled: false },
          body: { enabled: true, modelPath: 'movenet-lightning.json', maxDetected: 1, minConfidence: 0.25, skipFrames: 0, skipTime: 0 },
        })
        await nextHuman.load()
        await nextHuman.warmup()
        if (!active) {
          nextHuman.models.reset()
          return
        }
        human = nextHuman
        movementDetectorRef.current.reset()
        lastSpeedUpdateRef.current = performance.now()
        detectionFrame = requestAnimationFrame(detect)
        renderFrame = requestAnimationFrame(updateSpeed)
      } catch (error) {
        if (active) setState((current) => ({ ...current, prototypeStatus: 'error', errorMessage: error instanceof Error ? error.message : 'Human could not initialize.' }))
      }
    }
    void initialize()
    return () => {
      active = false
      cancelAnimationFrame(detectionFrame)
      cancelAnimationFrame(renderFrame)
      movementDetectorRef.current.reset()
      human?.models.reset()
    }
  }, [enabled, originalPlaybackRate, video])

  const toggleMovementSpeed = useCallback(() => setMovementSpeedEnabled((current) => {
    movementSpeedEnabledRef.current = !current
    return !current
  }), [])
  const recalibrateMovement = useCallback(() => movementDetectorRef.current.reset(), [])
  return { ...state, toggleMovementSpeed, recalibrateMovement }
}
