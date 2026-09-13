import { useEffect, useRef, useState } from 'react'
import { useDeviceStore } from '../device/deviceStore'
import type { DeviceStatus } from '../device/deviceTypes'

export function usePerformanceCamera(enabled = true) {
  const cameraDeviceId = useDeviceStore((state) => state.cameraDeviceId)
  const cameraEnabled = useDeviceStore((state) => state.cameraEnabled)
  const updateDeviceConfig = useDeviceStore((state) => state.updateDeviceConfig)
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

    if (!enabled || !cameraEnabled || !navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable')
      return stopStream
    }

    setStatus('requesting')
    const openCamera = async () => {
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: cameraDeviceId ? { deviceId: { exact: cameraDeviceId } } : true,
        })
      } catch (error) {
        // Device IDs can change when hardware is unplugged or browser data is
        // refreshed. Keep the remembered camera preference, but fall back to
        // the current default camera when the saved device no longer exists.
        if (cameraDeviceId && error instanceof DOMException && (error.name === 'NotFoundError' || error.name === 'OverconstrainedError')) {
          return navigator.mediaDevices.getUserMedia({ audio: false, video: true })
        }
        throw error
      }
    }

    void openCamera().then((nextStream) => {
      if (!active) {
        nextStream.getTracks().forEach((track) => { try { track.stop() } catch { /* Stream is already inactive. */ } })
        return
      }
      streamRef.current = nextStream
      const activeDeviceId = nextStream.getVideoTracks()[0]?.getSettings().deviceId ?? cameraDeviceId
      if (activeDeviceId !== cameraDeviceId) updateDeviceConfig({ cameraDeviceId: activeDeviceId ?? null })
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
  }, [cameraDeviceId, cameraEnabled, enabled, updateDeviceConfig])

  return { stream, status }
}
