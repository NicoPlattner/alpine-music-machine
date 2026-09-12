import { useCallback, useEffect, useRef, useState } from 'react'
import { useDeviceStore } from '../../device/deviceStore'
import { LeoAudioController, LeoMicrophoneAudioController, type LeoAudioDriver, type LeoAudioSignal } from './leoAudio'
import { LeoBackgroundLayer } from './LeoBackgroundLayer'
import { LeoPerformerLayer, type LeoPerformerDiagnostics } from './LeoPerformerLayer'

interface Props {
  enabled: boolean
  source: HTMLCanvasElement | null
  maskSource: HTMLCanvasElement | null
  onDiagnosticsChange: (diagnostics: LeoPerformerDiagnostics) => void
}

export function LeoVisualStage({ enabled, source, maskSource, onDiagnosticsChange }: Props) {
  const microphoneDeviceId = useDeviceStore((state) => state.microphoneDeviceId)
  const microphoneEnabled = useDeviceStore((state) => state.microphoneEnabled)
  const controllerRef = useRef<LeoAudioController | null>(null)
  const musicSignalRef = useRef<LeoAudioSignal>({ beat: 0, level: 0 })
  const microphoneSignalRef = useRef<LeoAudioSignal>({ beat: 0, level: 0 })
  const microphoneControllerRef = useRef<LeoMicrophoneAudioController | null>(null)
  const driverRef = useRef<LeoAudioDriver>({
    signal: musicSignalRef.current,
    update: () => controllerRef.current?.update(),
  })
  const [audioBlocked, setAudioBlocked] = useState(false)

  const startAudio = useCallback(async () => {
    try {
      await controllerRef.current?.play()
      setAudioBlocked(false)
    } catch {
      setAudioBlocked(true)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    try {
      const controller = new LeoAudioController(musicSignalRef.current)
      controllerRef.current = controller
      void startAudio()
      return () => {
        controller.dispose()
        controllerRef.current = null
        musicSignalRef.current.beat = 0
        musicSignalRef.current.level = 0
      }
    } catch {
      setAudioBlocked(false)
    }
  }, [enabled, startAudio])

  useEffect(() => {
    if (!enabled || !microphoneEnabled) return
    let active = true
    const startMicrophone = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: microphoneDeviceId ? { deviceId: { exact: microphoneDeviceId } } : true,
          video: false,
        })
        if (!active) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        const controller = new LeoMicrophoneAudioController(stream, microphoneSignalRef.current)
        microphoneControllerRef.current = controller
        await controller.start()
      } catch (error) {
        console.warn("Leo's microphone pulse is unavailable; the visual will continue without it.", error)
      }
    }
    void startMicrophone()
    return () => {
      active = false
      microphoneControllerRef.current?.dispose()
      microphoneControllerRef.current = null
      microphoneSignalRef.current.beat = 0
      microphoneSignalRef.current.level = 0
    }
  }, [enabled, microphoneDeviceId, microphoneEnabled])

  useEffect(() => {
    if (!enabled) return
    let frame = 0
    const update = () => {
      microphoneControllerRef.current?.update()
      frame = requestAnimationFrame(update)
    }
    frame = requestAnimationFrame(update)
    return () => cancelAnimationFrame(frame)
  }, [enabled])

  if (!enabled) return null
  return (
    <>
      <LeoBackgroundLayer audio={driverRef.current} />
      <LeoPerformerLayer enabled source={source} maskSource={maskSource} audioSignal={microphoneSignalRef.current} onDiagnosticsChange={onDiagnosticsChange} />
      {audioBlocked && <button type="button" className="leo-audio-start" onClick={startAudio}>▶ Play music</button>}
    </>
  )
}
