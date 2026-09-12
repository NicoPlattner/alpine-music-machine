import { useEffect, useRef, useState } from 'react'
import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision'
import { getPerformerRenderRect } from './performerLayout'

export type SegmentationStatus = 'idle' | 'loading' | 'ready' | 'error'

const PROCESSING_WIDTH = 640
const PROCESSING_HEIGHT = 360
const FRAME_INTERVAL_MS = 1000 / 15

export function usePersonSegmentation(
  stream: MediaStream | null,
  videoRef: React.RefObject<HTMLVideoElement | null>,
  outputCanvasRef: React.RefObject<HTMLCanvasElement | null>,
  onSegmentedFrame?: (frame: HTMLCanvasElement, timestamp: number, mask: HTMLCanvasElement) => void,
) {
  const [status, setStatus] = useState<SegmentationStatus>('idle')
  const animationFrameRef = useRef<number | null>(null)
  const segmentedFrameCallbackRef = useRef(onSegmentedFrame)

  useEffect(() => { segmentedFrameCallbackRef.current = onSegmentedFrame }, [onSegmentedFrame])

  useEffect(() => {
    const video = videoRef.current
    const outputCanvas = outputCanvasRef.current
    if (!stream || !video || !outputCanvas) {
      setStatus('idle')
      return
    }

    let active = true
    let segmenter: ImageSegmenter | null = null
    let lastProcessedAt = 0
    let maskImage: ImageData | null = null
    const frameCanvas = document.createElement('canvas')
    const maskCanvas = document.createElement('canvas')
    const cutoutCanvas = document.createElement('canvas')
    frameCanvas.width = cutoutCanvas.width = PROCESSING_WIDTH
    frameCanvas.height = cutoutCanvas.height = PROCESSING_HEIGHT
    const frameContext = frameCanvas.getContext('2d', { willReadFrequently: true })
    const maskContext = maskCanvas.getContext('2d')
    const cutoutContext = cutoutCanvas.getContext('2d')
    const outputContext = outputCanvas.getContext('2d')

    if (!frameContext || !maskContext || !cutoutContext || !outputContext) {
      setStatus('error')
      return
    }

    const drawCameraFrame = () => {
      const sourceWidth = video.videoWidth || PROCESSING_WIDTH
      const sourceHeight = video.videoHeight || PROCESSING_HEIGHT
      const sourceAspect = sourceWidth / sourceHeight
      const processingWidth = sourceAspect >= 1 ? PROCESSING_WIDTH : Math.round(PROCESSING_WIDTH * sourceAspect)
      const processingHeight = sourceAspect >= 1 ? Math.round(PROCESSING_WIDTH / sourceAspect) : PROCESSING_WIDTH
      if (frameCanvas.width !== processingWidth || frameCanvas.height !== processingHeight) {
        frameCanvas.width = processingWidth
        frameCanvas.height = processingHeight
        cutoutCanvas.width = processingWidth
        cutoutCanvas.height = processingHeight
      }
      frameContext.drawImage(video, 0, 0, processingWidth, processingHeight)
    }

    const drawPerformerOnStage = () => {
      const stageWidth = outputCanvas.clientWidth || window.innerWidth
      const stageHeight = outputCanvas.clientHeight || window.innerHeight
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)
      const requiredWidth = Math.round(stageWidth * pixelRatio)
      const requiredHeight = Math.round(stageHeight * pixelRatio)
      if (outputCanvas.width !== requiredWidth || outputCanvas.height !== requiredHeight) {
        outputCanvas.width = requiredWidth
        outputCanvas.height = requiredHeight
      }
      outputContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      outputContext.clearRect(0, 0, stageWidth, stageHeight)
      const rect = getPerformerRenderRect(stageWidth, stageHeight, cutoutCanvas.width / cutoutCanvas.height)
      outputContext.drawImage(cutoutCanvas, rect.x, rect.y, rect.width, rect.height)
    }

    const renderMask = (confidence: Float32Array, maskWidth: number, maskHeight: number, timestamp: number) => {
      if (maskCanvas.width !== maskWidth || maskCanvas.height !== maskHeight) {
        maskCanvas.width = maskWidth
        maskCanvas.height = maskHeight
        maskImage = null
      }
      maskImage ??= maskContext.createImageData(maskWidth, maskHeight)
      for (let index = 0; index < confidence.length; index += 1) {
        const confidenceValue = Math.max(0, Math.min(255, Math.round(confidence[index] * 255)))
        const alpha = Math.max(0, Math.min(255, (confidence[index] - 0.15) * 392))
        const pixel = index * 4
        maskImage.data[pixel] = confidenceValue
        maskImage.data[pixel + 1] = confidenceValue
        maskImage.data[pixel + 2] = confidenceValue
        maskImage.data[pixel + 3] = alpha
      }
      maskContext.putImageData(maskImage, 0, 0)
      cutoutContext.clearRect(0, 0, cutoutCanvas.width, cutoutCanvas.height)
      cutoutContext.globalCompositeOperation = 'source-over'
      cutoutContext.drawImage(frameCanvas, 0, 0)
      cutoutContext.globalCompositeOperation = 'destination-in'
      cutoutContext.drawImage(maskCanvas, 0, 0, cutoutCanvas.width, cutoutCanvas.height)
      cutoutContext.globalCompositeOperation = 'source-over'
      drawPerformerOnStage()
      segmentedFrameCallbackRef.current?.(cutoutCanvas, timestamp, maskCanvas)
    }

    const processFrame = (timestamp: number) => {
      if (!active) return
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && timestamp - lastProcessedAt >= FRAME_INTERVAL_MS) {
        lastProcessedAt = timestamp
        drawCameraFrame()
        try {
          segmenter?.segmentForVideo(frameCanvas, timestamp, (result) => {
            const mask = result.confidenceMasks?.[0]
            if (!active || !mask) return
            renderMask(mask.getAsFloat32Array(), mask.width, mask.height, timestamp)
            setStatus('ready')
          })
        } catch {
          setStatus('error')
          return
        }
      }
      animationFrameRef.current = requestAnimationFrame(processFrame)
    }

    const initialize = async () => {
      setStatus('loading')
      try {
        const assetBase = import.meta.env.BASE_URL
        const vision = await FilesetResolver.forVisionTasks(`${assetBase}mediapipe/wasm`)
        const nextSegmenter = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: { modelAssetPath: `${assetBase}mediapipe/models/selfie_segmenter.tflite` },
          runningMode: 'VIDEO',
          outputConfidenceMasks: true,
          outputCategoryMask: false,
        })
        if (!active) {
          try { nextSegmenter.close() } catch { /* Route teardown must remain non-blocking. */ }
          return
        }
        segmenter = nextSegmenter
        animationFrameRef.current = requestAnimationFrame(processFrame)
      } catch {
        if (active) setStatus('error')
      }
    }

    void initialize()

    return () => {
      active = false
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
      try { segmenter?.close() } catch { /* MediaPipe cleanup must not abort navigation. */ }
      try {
        outputContext.setTransform(1, 0, 0, 1, 0, 0)
        outputContext.clearRect(0, 0, outputCanvas.width, outputCanvas.height)
      } catch { /* A detached canvas does not need further cleanup. */ }
    }
  }, [outputCanvasRef, stream, videoRef])

  return status
}
