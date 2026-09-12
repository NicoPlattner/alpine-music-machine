import type { FingerPosition, FingerState, GenreGesture, ScreenPoint } from '../handTrackingTypes'

const WRIST = 0
const THUMB_IP = 3
const THUMB_TIP = 4
const INDEX_PIP = 6
const INDEX_TIP = 8
const MIDDLE_PIP = 10
const MIDDLE_TIP = 12
const RING_PIP = 14
const RING_TIP = 16
const PINKY_PIP = 18
const PINKY_TIP = 20

const EXTENSION_RATIO = 1.12
const THUMB_EXTENSION_RATIO = 1.08
const FIST_TOP_LIMIT = 0.34
const CHEST_MIN_X = 0.22
const CHEST_MAX_X = 0.72
const CHEST_MIN_Y = 0.32
const CHEST_MAX_Y = 0.76

const position = (extended: boolean): FingerPosition => extended ? 'extended' : 'folded'
const distance = (a: ScreenPoint, b: ScreenPoint) => Math.hypot(a.x - b.x, a.y - b.y)
const isExtended = (landmarks: ScreenPoint[], tip: number, pip: number) => distance(landmarks[tip], landmarks[WRIST]) > distance(landmarks[pip], landmarks[WRIST]) * EXTENSION_RATIO

export function classifyFingerState(rawLandmarks: ScreenPoint[] | null): FingerState | null {
  if (!rawLandmarks || rawLandmarks.length < 21) return null
  return {
    thumb: position(distance(rawLandmarks[THUMB_TIP], rawLandmarks[WRIST]) > distance(rawLandmarks[THUMB_IP], rawLandmarks[WRIST]) * THUMB_EXTENSION_RATIO),
    index: position(isExtended(rawLandmarks, INDEX_TIP, INDEX_PIP)),
    middle: position(isExtended(rawLandmarks, MIDDLE_TIP, MIDDLE_PIP)),
    ring: position(isExtended(rawLandmarks, RING_TIP, RING_PIP)),
    pinky: position(isExtended(rawLandmarks, PINKY_TIP, PINKY_PIP)),
  }
}

export function detectGenreGesture(rawLandmarks: ScreenPoint[] | null, screenLandmarks: ScreenPoint[] | null): GenreGesture {
  const fingers = classifyFingerState(rawLandmarks)
  if (!fingers || !screenLandmarks || screenLandmarks.length < 21) return 'idle'
  const is = (finger: FingerPosition) => finger === 'extended'
  const palmX = (screenLandmarks[WRIST].x + screenLandmarks[INDEX_PIP].x + screenLandmarks[PINKY_PIP].x) / 3
  const palmY = (screenLandmarks[WRIST].y + screenLandmarks[INDEX_PIP].y + screenLandmarks[PINKY_PIP].y) / 3

  if (is(fingers.thumb) && is(fingers.index) && !is(fingers.middle) && !is(fingers.ring) && is(fingers.pinky)) return 'Rock'
  if (is(fingers.index) && is(fingers.middle) && !is(fingers.ring) && !is(fingers.pinky)) return 'Pop'
  if (!is(fingers.index) && !is(fingers.middle) && !is(fingers.ring) && !is(fingers.pinky) && palmY < FIST_TOP_LIMIT) return 'Techno'
  if (is(fingers.index) && is(fingers.middle) && is(fingers.ring) && is(fingers.pinky) && palmX >= CHEST_MIN_X && palmX <= CHEST_MAX_X && palmY >= CHEST_MIN_Y && palmY <= CHEST_MAX_Y) return 'Ballad'
  return 'idle'
}

export const GENRE_GESTURE_THRESHOLDS = {
  extensionRatio: EXTENSION_RATIO,
  thumbExtensionRatio: THUMB_EXTENSION_RATIO,
  fistTopLimit: FIST_TOP_LIMIT,
  chestBounds: { minX: CHEST_MIN_X, maxX: CHEST_MAX_X, minY: CHEST_MIN_Y, maxY: CHEST_MAX_Y },
} as const
