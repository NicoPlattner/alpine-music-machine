import { useEffect, useRef, useState } from 'react'
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'
import type { PoseTrackingState } from './poseTrackingTypes'

export const POSE_INFERENCE_TARGET_FPS = 15

const FRAME_INTERVAL_MS = 1000 / POSE_INFERENCE_TARGET_FPS
const MAX_INPUT_DIMENSION = 320
const MIN_VISIBILITY = 0.35
const initialState: PoseTrackingState = { status: 'idle', frame: null, fps: 0, errorMessage: null }

export function usePoseTracking(video: HTMLVideoElement | null): PoseTrackingState {
  const [state, setState] = useState(initialState)
  const animationFrameRef = useRef<number | null>(null)

  useEffect(() => {
    if (!video) { setState(initialState); return }
    let active = true
    let landmarker: PoseLandmarker | null = null
    let lastInferenceAt = 0
    let framesSinceSample = 0
    let sampleStartedAt = performance.now()
    let currentFps = 0
    const inputCanvas = document.createElement('canvas')
    const context = inputCanvas.getContext('2d')
    if (!context) { setState({ ...initialState, status: 'error', errorMessage: 'Pose canvas processing is unavailable.' }); return }

    const processFrame = (timestamp: number) => {
      if (!active) return
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && timestamp - lastInferenceAt >= FRAME_INTERVAL_MS) {
        lastInferenceAt = timestamp
        const sourceWidth = video.videoWidth || 640
        const sourceHeight = video.videoHeight || 360
        const aspect = sourceWidth / sourceHeight
        const width = aspect >= 1 ? MAX_INPUT_DIMENSION : Math.round(MAX_INPUT_DIMENSION * aspect)
        const height = aspect >= 1 ? Math.round(MAX_INPUT_DIMENSION / aspect) : MAX_INPUT_DIMENSION
        if (inputCanvas.width !== width || inputCanvas.height !== height) { inputCanvas.width = width; inputCanvas.height = height }
        context.drawImage(video, 0, 0, width, height)
        try {
          const result = landmarker?.detectForVideo(inputCanvas, timestamp)
          framesSinceSample += 1
          const sampleDuration = timestamp - sampleStartedAt
          if (sampleDuration >= 750) { currentFps = Math.round(framesSinceSample * 1000 / sampleDuration); framesSinceSample = 0; sampleStartedAt = timestamp }
          const landmarks = result?.landmarks[0]
          const hasVisibleTorso = landmarks && [11, 12, 23, 24].some((index) => (landmarks[index]?.visibility ?? 0) >= MIN_VISIBILITY)
          setState({
            status: 'ready',
            frame: landmarks && hasVisibleTorso ? { landmarks: landmarks.map((point) => ({ x: point.x, y: point.y, z: point.z, visibility: point.visibility ?? 0 })), timestamp } : null,
            fps: currentFps,
            errorMessage: null,
          })
        } catch {
          setState({ ...initialState, status: 'error', errorMessage: 'Pose tracking stopped unexpectedly.' })
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
        const nextLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: `${assetBase}mediapipe/models/pose_landmarker_lite.task` },
          runningMode: 'VIDEO', numPoses: 1, outputSegmentationMasks: false,
          minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
        })
        if (!active) { try { nextLandmarker.close() } catch { /* Route teardown must remain non-blocking. */ } return }
        landmarker = nextLandmarker
        animationFrameRef.current = requestAnimationFrame(processFrame)
      } catch {
        if (active) setState({ ...initialState, status: 'error', errorMessage: 'MediaPipe Pose Landmarker could not load.' })
      }
    }
    void initialize()
    return () => { active = false; if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = null; try { landmarker?.close() } catch { /* MediaPipe cleanup must not abort navigation. */ } }
  }, [video])

  return state
}
