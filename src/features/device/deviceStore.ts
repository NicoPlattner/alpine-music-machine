import { create } from 'zustand'
import type { DeviceConfig } from './deviceTypes'

interface DeviceConfigActions {
  updateDeviceConfig: (config: Partial<DeviceConfig>) => void
}

const initialDeviceConfig: DeviceConfig = {
  microphoneDeviceId: null,
  cameraDeviceId: null,
  microphoneEnabled: false,
  cameraEnabled: false,
}

export const useDeviceStore = create<DeviceConfig & DeviceConfigActions>((set) => ({
  ...initialDeviceConfig,
  updateDeviceConfig: (config) => set(config),
}))
