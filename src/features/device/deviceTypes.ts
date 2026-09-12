export type DeviceStatus = 'idle' | 'requesting' | 'ready' | 'denied' | 'unavailable' | 'error'

export interface DeviceConfig {
  microphoneDeviceId: string | null
  cameraDeviceId: string | null
  microphoneEnabled: boolean
  cameraEnabled: boolean
}

export interface MediaDeviceOption {
  deviceId: string
  label: string
}
