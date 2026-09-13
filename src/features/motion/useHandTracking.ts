import { useEffect, useRef, useState } from 'react'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import { getLeoPerformerRenderRect } from '../performance/performerLayout'
import type { Handedness, HandTrackingState, ScreenPoint, TrackedHand } from './handTrackingTypes'

export const DEBUG_ACCEPT_ANY_HAND = import.meta.env.DEV
export const HAND_INFERENCE_TARGET_FPS = 20

const FRAME_INTERVAL_MS = 1000 / HAND_INFERENCE_TARGET_FPS
const MAX_INPUT_DIMENSION = 320
const INDEX_FINGER_TIP = 8

const initialState: HandTrackingState = { status: 'idle', hands: [], physicalRightHandDetected: false, controlHand: null, fingertip: null, fps: 0, errorMessage: null }

function normalizeHandedness(label: string | undefined): Handedness {
  return label === 'Left' || label === 'Right' ? label : 'Unknown'
}

/** MediaPipe receives the raw, unmirrored webcam frame, so its anatomical label is preserved. */
export function getPhysicalHandedness(reportedHandedness: Handedness): Handedness {
  return reportedHandedness
}

export function useHandTracking(video: HTMLVideoElement | null, enabled = true): HandTrackingState {
  const [state, setState] = useState(initialState)
  const animationFrameRef = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled || !video) { setState(initialState); return }
    let active = true
    let landmarker: HandLandmarker | null = null
    let lastInferenceAt = 0
    let framesSinceSample = 0
    let fpsSampleStartedAt = performance.now()
    let currentFps = 0
    const inputCanvas = document.createElement('canvas')
    const context = inputCanvas.getContext('2d')
    if (!context) { setState({ ...initialState, status: 'error', errorMessage: 'Canvas processing is unavailable.' }); return }

    const processFrame = (timestamp: number) => {
      if (!active) return
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && timestamp - lastInferenceAt >= FRAME_INTERVAL_MS) {
        lastInferenceAt = timestamp
        const sourceWidth = video.videoWidth || 640
        const sourceHeight = video.videoHeight || 360
        const sourceAspect = sourceWidth / sourceHeight
        const width = sourceAspect >= 1 ? MAX_INPUT_DIMENSION : Math.round(MAX_INPUT_DIMENSION * sourceAspect)
        const height = sourceAspect >= 1 ? Math.round(MAX_INPUT_DIMENSION / sourceAspect) : MAX_INPUT_DIMENSION
        if (inputCanvas.width !== width || inputCanvas.height !== height) { inputCanvas.width = width; inputCanvas.height = height }

        // Inference deliberately sees the raw camera orientation. Mirroring belongs to display mapping only.
        context.drawImage(video, 0, 0, width, height)

        try {
          const result = landmarker?.detectForVideo(inputCanvas, timestamp)
          framesSinceSample += 1
          const sampleDuration = timestamp - fpsSampleStartedAt
          if (sampleDuration >= 750) { currentFps = Math.round(framesSinceSample * 1000 / sampleDuration); framesSinceSample = 0; fpsSampleStartedAt = timestamp }

          const stageWidth = window.innerWidth
          const stageHeight = window.innerHeight
          const rect = getLeoPerformerRenderRect(stageWidth, stageHeight, sourceAspect)
          const hands: TrackedHand[] = (result?.landmarks ?? []).map((rawHandLandmarks, index) => {
            const category = result?.handedness[index]?.[0]
            const reportedHandedness = normalizeHandedness(category?.categoryName)
            const rawLandmarks = rawHandLandmarks.map((landmark): ScreenPoint => ({ x: landmark.x, y: landmark.y, timestamp }))
            const screenLandmarks = rawHandLandmarks.map((landmark): ScreenPoint => ({
              x: (rect.x + (1 - landmark.x) * rect.width) / stageWidth,
              y: (rect.y + landmark.y * rect.height) / stageHeight,
              timestamp,
            }))
            return { index, reportedHandedness, physicalHandedness: getPhysicalHandedness(reportedHandedness), handednessConfidence: category?.score ?? null, rawLandmarks, screenLandmarks }
          })
          const physicalRightHand = hands.find((hand) => hand.physicalHandedness === 'Right') ?? null
          const controlHand = physicalRightHand ?? (DEBUG_ACCEPT_ANY_HAND ? hands[0] ?? null : null)
          setState({ status: 'ready', hands, physicalRightHandDetected: physicalRightHand !== null, controlHand, fingertip: controlHand?.screenLandmarks[INDEX_FINGER_TIP] ?? null, fps: currentFps, errorMessage: null })
        } catch {
          setState({ ...initialState, status: 'error', errorMessage: 'Hand tracking stopped unexpectedly.' })
          return
        }
      }
      animationFrameRef.current = requestAnimationFrame(processFrame)
    }

    const initialize = async () => {
      setState({ ...initialState, status: 'loading' })
      try {
        const assetBase = import.meta.env.BASE_URL
        const vision = await FilesetResolver.forVisionTasks(`${assetBase}mediapipe/wasm`)
        const nextLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: `${assetBase}mediapipe/models/hand_landmarker.task` }, runningMode: 'VIDEO', numHands: 2,
          minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5,
        })
        if (!active) { try { nextLandmarker.close() } catch { /* Route teardown must remain non-blocking. */ } return }
        landmarker = nextLandmarker
        animationFrameRef.current = requestAnimationFrame(processFrame)
      } catch {
        if (active) setState({ ...initialState, status: 'error', errorMessage: 'MediaPipe Hand Landmarker could not load.' })
      }
    }
    void initialize()
    return () => { active = false; if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = null; try { landmarker?.close() } catch { /* MediaPipe cleanup must not abort navigation. */ } }
  }, [enabled, video])

  return state
}
