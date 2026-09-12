import { useEffect, useRef } from 'react'
import type { LeoAudioSignal } from './leoAudio'

export type LeoRendererStatus = 'disabled' | 'waiting' | 'initializing' | 'ready' | 'error'

export interface LeoPerformerDiagnostics {
  visual: 'Leo' | 'Segmented'
  rendererStatus: LeoRendererStatus
  sourceReady: boolean
  segmentationSourceReady: boolean
  pointCount: number
  renderFps: number
  framesRendered: number
  sourceWidth: number
  sourceHeight: number
  canvasWidth: number
  canvasHeight: number
  maskForegroundRatio: number
  cameraZ: number
  errorMessage: string | null
}

interface LeoPerformerLayerProps {
  enabled: boolean
  source: HTMLCanvasElement | null
  maskSource: HTMLCanvasElement | null
  audioSignal: LeoAudioSignal
  onDiagnosticsChange: (diagnostics: LeoPerformerDiagnostics) => void
}

export const PERFORMER_VISUAL = import.meta.env.DEV && import.meta.env.VITE_PERFORMER_VISUAL === 'segmented' ? 'segmented' : 'leo'
export const LEO_POINT_COUNT = 312 * 228

export const EMPTY_LEO_DIAGNOSTICS: LeoPerformerDiagnostics = {
  visual: PERFORMER_VISUAL === 'leo' ? 'Leo' : 'Segmented',
  rendererStatus: PERFORMER_VISUAL === 'leo' ? 'waiting' : 'disabled',
  sourceReady: false,
  segmentationSourceReady: false,
  pointCount: LEO_POINT_COUNT,
  renderFps: 0,
  framesRendered: 0,
  sourceWidth: 0,
  sourceHeight: 0,
  canvasWidth: 0,
  canvasHeight: 0,
  maskForegroundRatio: 0,
  cameraZ: 0,
  errorMessage: null,
}

export function LeoPerformerLayer({ enabled, source, maskSource, audioSignal, onDiagnosticsChange }: LeoPerformerLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!enabled || !source || !maskSource || !canvas) {
      onDiagnosticsChange({
        ...EMPTY_LEO_DIAGNOSTICS,
        visual: enabled ? 'Leo' : 'Segmented',
        rendererStatus: enabled ? 'waiting' : 'disabled',
        sourceReady: source !== null,
        segmentationSourceReady: maskSource !== null,
      })
      return
    }
    let active = true
    let renderer: import('./leoPerformerRenderer').LeoPerformerRenderer | null = null
    let resizeObserver: ResizeObserver | null = null
    let animationFrame = 0
    let lastDiagnosticsAt = 0

    const reportError = (error: unknown) => {
      onDiagnosticsChange({
        ...EMPTY_LEO_DIAGNOSTICS,
        visual: 'Segmented',
        rendererStatus: 'error',
        sourceReady: true,
        segmentationSourceReady: true,
        sourceWidth: source.width,
        sourceHeight: source.height,
        errorMessage: error instanceof Error ? error.message : 'Leo performer rendering failed.',
      })
    }
    const render = (timestamp: number) => {
      try {
        renderer?.render(timestamp)
        if (renderer && timestamp - lastDiagnosticsAt >= 250) {
          lastDiagnosticsAt = timestamp
          const metrics = renderer.getMetrics()
          onDiagnosticsChange({
            visual: metrics.framesRendered > 0 && metrics.maskForegroundRatio > 0 ? 'Leo' : 'Segmented',
            rendererStatus: metrics.framesRendered > 0 && metrics.maskForegroundRatio > 0 ? 'ready' : 'initializing',
            sourceReady: true,
            segmentationSourceReady: true,
            pointCount: LEO_POINT_COUNT,
            ...metrics,
            errorMessage: null,
          })
        }
        animationFrame = requestAnimationFrame(render)
      } catch (error) {
        resizeObserver?.disconnect()
        renderer?.dispose()
        renderer = null
        reportError(error)
      }
    }
    const initialize = async () => {
      onDiagnosticsChange({ ...EMPTY_LEO_DIAGNOSTICS, visual: 'Leo', rendererStatus: 'initializing', sourceReady: true, segmentationSourceReady: true, sourceWidth: source.width, sourceHeight: source.height })
      try {
        const { LeoPerformerRenderer } = await import('./leoPerformerRenderer')
        if (!active) return
        renderer = new LeoPerformerRenderer(canvas, source, maskSource, audioSignal)
        resizeObserver = new ResizeObserver(() => renderer?.resize(canvas.clientWidth, canvas.clientHeight))
        resizeObserver.observe(canvas)
        renderer.resize(canvas.clientWidth, canvas.clientHeight)
        animationFrame = requestAnimationFrame(render)
      } catch (error) {
        if (active) reportError(error)
      }
    }
    void initialize()
    return () => {
      active = false
      cancelAnimationFrame(animationFrame)
      resizeObserver?.disconnect()
      renderer?.dispose()
    }
  }, [audioSignal, enabled, maskSource, onDiagnosticsChange, source])

  if (!enabled) return null
  return <canvas ref={canvasRef} className="leo-performer-layer" aria-label="Leo point-cloud performer" />
}
