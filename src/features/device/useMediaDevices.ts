import { useCallback, useEffect, useRef, useState } from 'react'
import { useDeviceStore } from './deviceStore'
import type { DeviceStatus, MediaDeviceOption } from './deviceTypes'

const getFailureStatus = (error: unknown): DeviceStatus => {
  if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) return 'denied'
  if (error instanceof DOMException && (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError')) return 'unavailable'
  return 'error'
}

export function useMediaDevices() {
  const [microphoneStatus, setMicrophoneStatus] = useState<DeviceStatus>('idle')
  const [cameraStatus, setCameraStatus] = useState<DeviceStatus>('idle')
  const [microphones, setMicrophones] = useState<MediaDeviceOption[]>([])
  const [cameras, setCameras] = useState<MediaDeviceOption[]>([])
  const [microphoneLevel, setMicrophoneLevel] = useState(0)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const { microphoneDeviceId, cameraDeviceId, updateDeviceConfig } = useDeviceStore()

  const microphoneStreamRef = useRef<MediaStream | null>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const mountedRef = useRef(true)
  const microphoneRequestRef = useRef(0)
  const cameraRequestRef = useRef(0)

  const stopMicrophone = useCallback(() => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current)
    animationFrameRef.current = null
    microphoneStreamRef.current?.getTracks().forEach((track) => track.stop())
    microphoneStreamRef.current = null
    void audioContextRef.current?.close()
    audioContextRef.current = null
    if (mountedRef.current) setMicrophoneLevel(0)
  }, [])

  const stopCamera = useCallback(() => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
    cameraStreamRef.current = null
    if (mountedRef.current) setCameraStream(null)
  }, [])

  const refreshDeviceLists = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    const devices = await navigator.mediaDevices.enumerateDevices()
    if (!mountedRef.current) return
    setMicrophones(devices.filter((device) => device.kind === 'audioinput').map((device, index) => ({ deviceId: device.deviceId, label: device.label || `Microphone ${index + 1}` })))
    setCameras(devices.filter((device) => device.kind === 'videoinput').map((device, index) => ({ deviceId: device.deviceId, label: device.label || `Camera ${index + 1}` })))
  }, [])

  const startMicrophone = useCallback(async (deviceId?: string | null) => {
    const requestId = ++microphoneRequestRef.current
    stopMicrophone()
    if (!navigator.mediaDevices?.getUserMedia) { setMicrophoneStatus('unavailable'); return }
    setMicrophoneStatus('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: deviceId ? { deviceId: { exact: deviceId } } : true, video: false })
      if (!mountedRef.current || requestId !== microphoneRequestRef.current) { stream.getTracks().forEach((track) => track.stop()); return }
      microphoneStreamRef.current = stream
      const activeDeviceId = stream.getAudioTracks()[0]?.getSettings().deviceId ?? deviceId ?? null
      updateDeviceConfig({ microphoneDeviceId: activeDeviceId, microphoneEnabled: true })
      const context = new AudioContext()
      audioContextRef.current = context
      const analyser = context.createAnalyser()
      analyser.fftSize = 256
      context.createMediaStreamSource(stream).connect(analyser)
      const samples = new Uint8Array(analyser.fftSize)
      const readLevel = () => {
        analyser.getByteTimeDomainData(samples)
        let sum = 0
        for (const sample of samples) { const normalized = (sample - 128) / 128; sum += normalized * normalized }
        if (mountedRef.current) setMicrophoneLevel(Math.min(1, Math.sqrt(sum / samples.length) * 4))
        animationFrameRef.current = requestAnimationFrame(readLevel)
      }
      readLevel()
      setMicrophoneStatus('ready')
      void refreshDeviceLists().catch(() => undefined)
    } catch (error) {
      if (mountedRef.current && requestId === microphoneRequestRef.current) { setMicrophoneStatus(getFailureStatus(error)); updateDeviceConfig({ microphoneEnabled: false }) }
    }
  }, [refreshDeviceLists, stopMicrophone, updateDeviceConfig])

  const startCamera = useCallback(async (deviceId?: string | null) => {
    const requestId = ++cameraRequestRef.current
    stopCamera()
    if (!navigator.mediaDevices?.getUserMedia) { setCameraStatus('unavailable'); return }
    setCameraStatus('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: deviceId ? { deviceId: { exact: deviceId } } : true })
      if (!mountedRef.current || requestId !== cameraRequestRef.current) { stream.getTracks().forEach((track) => track.stop()); return }
      cameraStreamRef.current = stream
      setCameraStream(stream)
      const activeDeviceId = stream.getVideoTracks()[0]?.getSettings().deviceId ?? deviceId ?? null
      updateDeviceConfig({ cameraDeviceId: activeDeviceId, cameraEnabled: true })
      setCameraStatus('ready')
      void refreshDeviceLists().catch(() => undefined)
    } catch (error) {
      if (mountedRef.current && requestId === cameraRequestRef.current) { setCameraStatus(getFailureStatus(error)); updateDeviceConfig({ cameraEnabled: false }) }
    }
  }, [refreshDeviceLists, stopCamera, updateDeviceConfig])

  const retry = useCallback(() => {
    void startMicrophone(microphoneDeviceId)
    void startCamera(cameraDeviceId)
  }, [cameraDeviceId, microphoneDeviceId, startCamera, startMicrophone])

  useEffect(() => {
    mountedRef.current = true
    void startMicrophone(microphoneDeviceId)
    void startCamera(cameraDeviceId)
    return () => {
      mountedRef.current = false
      microphoneRequestRef.current += 1
      cameraRequestRef.current += 1
      stopMicrophone()
      stopCamera()
    }
    // Permissions are requested once when setup opens; device changes use the explicit selectors.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    microphoneStatus, cameraStatus, microphones, cameras, microphoneLevel, cameraStream,
    microphoneDeviceId, cameraDeviceId,
    selectMicrophone: (id: string) => void startMicrophone(id),
    selectCamera: (id: string) => void startCamera(id),
    retry,
  }
}
