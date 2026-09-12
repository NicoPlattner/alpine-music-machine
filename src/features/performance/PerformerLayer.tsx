import { useEffect, useRef } from 'react'
import type { DeviceStatus } from '../device/deviceTypes'
import { usePersonSegmentation } from './usePersonSegmentation'

export type PerformerVisualMode = 'segmented' | 'leo'
interface PerformerLayerProps { stream: MediaStream | null; status: DeviceStatus; visualMode?: PerformerVisualMode; onVideoSourceChange?: (video: HTMLVideoElement | null) => void; onSegmentedFrame?: (frame: HTMLCanvasElement, timestamp: number, mask: HTMLCanvasElement) => void }
export function PerformerLayer({ stream, status, visualMode = 'segmented', onVideoSourceChange, onSegmentedFrame }: PerformerLayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const segmentationStatus = usePersonSegmentation(stream, videoRef, canvasRef, onSegmentedFrame)
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream
    onVideoSourceChange?.(stream ? videoRef.current : null)
    return () => onVideoSourceChange?.(null)
  }, [onVideoSourceChange, stream])
  const canvasClassName = segmentationStatus === 'error' ? 'performer-canvas-hidden' : `performer-cutout${visualMode === 'leo' ? ' performer-cutout-source-only' : ''}`
  return <section className="performer-layer" aria-label="Live performer area">{stream ? <><video ref={videoRef} className={segmentationStatus === 'error' ? 'performer-video-fallback' : 'performer-source-video'} autoPlay muted playsInline /><canvas ref={canvasRef} className={canvasClassName} aria-label="Background-removed performer" />{segmentationStatus === 'loading' && <span className="segmentation-status">Preparing performer…</span>}</> : <div className="performer-placeholder"><span>Performer</span><small>{status === 'requesting' ? 'Connecting camera…' : 'Camera unavailable'}</small></div>}</section>
}
