export type PoseTrackingStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface PoseLandmarkPoint {
  x: number
  y: number
  z: number
  visibility: number
}

export interface PoseFrame {
  landmarks: PoseLandmarkPoint[]
  timestamp: number
}

export interface PoseTrackingState {
  status: PoseTrackingStatus
  frame: PoseFrame | null
  fps: number
  errorMessage: string | null
}
