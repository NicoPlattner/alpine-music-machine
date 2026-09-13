import { useEffect, useRef, type RefObject } from 'react'
import { useDeviceStore } from '../../device/deviceStore'
import { LeoMicrophoneAudioController, LeoSongAudioController, type LeoAudioDriver, type LeoAudioSignal } from './leoAudio'
import { LeoBackgroundLayer } from './LeoBackgroundLayer'
import { LeoPerformerLayer, type LeoPerformerDiagnostics } from './LeoPerformerLayer'

interface Props {
  enabled: boolean
  source: HTMLCanvasElement | null
  maskSource: HTMLCanvasElement | null
  audioElementRef: RefObject<HTMLAudioElement | null>
  onDiagnosticsChange: (diagnostics: LeoPerformerDiagnostics) => void
}

export function LeoVisualStage({ enabled, source, maskSource, audioElementRef, onDiagnosticsChange }: Props) {
  const microphoneDeviceId = useDeviceStore((state) => state.microphoneDeviceId)
  const microphoneEnabled = useDeviceStore((state) => state.microphoneEnabled)
  const microphoneSignalRef = useRef<LeoAudioSignal>({ beat: 0, level: 0 })
  const microphoneControllerRef = useRef<LeoMicrophoneAudioController | null>(null)
  const songSignalRef = useRef<LeoAudioSignal>({ beat: 0, level: 0 })
  const songControllerRef = useRef<LeoSongAudioController | null>(null)
  const driverRef = useRef<LeoAudioDriver>({
    signal: songSignalRef.current,
    update: () => {},
  })

  useEffect(() => {
    const audioElement = audioElementRef.current
    if (!enabled || !audioElement) return
    const controller = new LeoSongAudioController(audioElement, songSignalRef.current)
    songControllerRef.current = controller
    void controller.start().catch((error) => {
      console.warn("Leo's mountains couldn't connect to the song stream; the background will continue without it.", error)
    })
    return () => {
      songControllerRef.current?.dispose()
      songControllerRef.current = null
      songSignalRef.current.beat = 0
      songSignalRef.current.level = 0
    }
  }, [enabled, audioElementRef])

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
      songControllerRef.current?.update()
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
    </>
  )
}
