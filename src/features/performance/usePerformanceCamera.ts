import { useEffect, useRef, useState } from 'react'
import { useDeviceStore } from '../device/deviceStore'
import type { DeviceStatus } from '../device/deviceTypes'

export function usePerformanceCamera() {
  const cameraDeviceId = useDeviceStore((state) => state.cameraDeviceId)
  const cameraEnabled = useDeviceStore((state) => state.cameraEnabled)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [status, setStatus] = useState<DeviceStatus>('idle')
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    let active = true
    setStream(null)

    const stopStream = () => {
      streamRef.current?.getTracks().forEach((track) => { try { track.stop() } catch { /* Camera teardown must not abort navigation. */ } })
      streamRef.current = null
    }

    if (!cameraEnabled || !navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable')
      return stopStream
    }

    setStatus('requesting')
    void navigator.mediaDevices.getUserMedia({
      audio: false,
      video: cameraDeviceId ? { deviceId: { exact: cameraDeviceId } } : true,
    }).then((nextStream) => {
      if (!active) {
        nextStream.getTracks().forEach((track) => { try { track.stop() } catch { /* Stream is already inactive. */ } })
        return
      }
      streamRef.current = nextStream
      setStream(nextStream)
      setStatus('ready')
    }).catch((error: unknown) => {
      if (!active) return
      if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) setStatus('denied')
      else if (error instanceof DOMException && error.name === 'NotFoundError') setStatus('unavailable')
      else setStatus('error')
    })

    return () => {
      active = false
      stopStream()
    }
  }, [cameraDeviceId, cameraEnabled])

  return { stream, status }
}
