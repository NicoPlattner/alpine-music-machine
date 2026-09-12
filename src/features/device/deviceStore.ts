import { create } from 'zustand'
import { persist } from 'zustand/middleware'
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

export const useDeviceStore = create<DeviceConfig & DeviceConfigActions>()(
  persist(
    (set) => ({
      ...initialDeviceConfig,
      updateDeviceConfig: (config) => set(config),
    }),
    {
      name: 'alpine-sound-machine-devices',
      partialize: (state) => ({
        microphoneDeviceId: state.microphoneDeviceId,
        cameraDeviceId: state.cameraDeviceId,
        microphoneEnabled: state.microphoneEnabled,
        cameraEnabled: state.cameraEnabled,
      }),
    },
  ),
)
