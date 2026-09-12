export type HandTrackingStatus = 'idle' | 'loading' | 'ready' | 'error'
export type Handedness = 'Left' | 'Right' | 'Unknown'
export type Genre = 'Pop' | 'Rock' | 'Techno' | 'Ballad'
export type GenreGesture = Genre | 'idle'
export type FingerPosition = 'extended' | 'folded'

export interface ScreenPoint { x: number; y: number; timestamp: number }

export interface FingerState {
  thumb: FingerPosition
  index: FingerPosition
  middle: FingerPosition
  ring: FingerPosition
  pinky: FingerPosition
}

export interface TrackedHand {
  index: number
  reportedHandedness: Handedness
  physicalHandedness: Handedness
  handednessConfidence: number | null
  rawLandmarks: ScreenPoint[]
  screenLandmarks: ScreenPoint[]
}

export interface HandTrackingState {
  status: HandTrackingStatus
  hands: TrackedHand[]
  physicalRightHandDetected: boolean
  controlHand: TrackedHand | null
  fingertip: ScreenPoint | null
  fps: number
  errorMessage: string | null
}
