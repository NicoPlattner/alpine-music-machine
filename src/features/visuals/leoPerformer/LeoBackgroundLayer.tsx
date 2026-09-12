import { useEffect, useRef } from 'react'
import type { LeoAudioDriver } from './leoAudio'

interface Props { audio: LeoAudioDriver }
const VISUAL_RENDER_INTERVAL_MS = 1000 / 24

export function LeoBackgroundLayer({ audio }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let active = true
    let renderer: import('./leoBackgroundRenderer').LeoBackgroundRenderer | null = null
    let observer: ResizeObserver | null = null
    let animationFrame = 0
    const image = new Image()
    const initialize = async () => {
      try {
        await new Promise<void>((resolve, reject) => {
          image.addEventListener('load', () => resolve(), { once: true })
          image.addEventListener('error', () => reject(new Error('Leo mountain image failed to load.')), { once: true })
          image.src = `${import.meta.env.BASE_URL}leo-visual/Mountains.jpeg`
        })
        const { LeoBackgroundRenderer } = await import('./leoBackgroundRenderer')
        if (!active) return
        renderer = new LeoBackgroundRenderer(canvas, image, audio)
        observer = new ResizeObserver(() => renderer?.resize(canvas.clientWidth, canvas.clientHeight))
        observer.observe(canvas)
        renderer.resize(canvas.clientWidth, canvas.clientHeight)
        let lastRenderedAt = 0
        const render = (timestamp: number) => {
          if (timestamp - lastRenderedAt >= VISUAL_RENDER_INTERVAL_MS) {
            lastRenderedAt = timestamp
            renderer?.render(timestamp)
          }
          animationFrame = requestAnimationFrame(render)
        }
        animationFrame = requestAnimationFrame(render)
      } catch (error) {
        console.error(error)
      }
    }
    void initialize()
    return () => {
      active = false
      cancelAnimationFrame(animationFrame)
      observer?.disconnect()
      renderer?.dispose()
    }
  }, [audio])

  return <canvas ref={canvasRef} className="leo-background-layer" aria-hidden="true" />
}
