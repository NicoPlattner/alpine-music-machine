import { PitchDetector } from 'pitchy'

export const MIN_VOICE_LEVEL = 0.018
export const MIN_PITCH_CLARITY = 0.9

export interface PitchDetectionResult { pitchHz: number | null; clarity: number }

export function createPitchDetector(inputLength: number) {
  const detector = PitchDetector.forFloat32Array(inputLength)
  detector.minVolumeAbsolute = MIN_VOICE_LEVEL
  return detector
}

export function detectPitch(
  detector: PitchDetector<Float32Array>,
  samples: Float32Array,
  sampleRate: number,
  level: number,
): PitchDetectionResult {
  if (level < MIN_VOICE_LEVEL) return { pitchHz: null, clarity: 0 }
  const [frequency, clarity] = detector.findPitch(samples, sampleRate)
  const valid = Number.isFinite(frequency) && frequency > 0 && clarity >= MIN_PITCH_CLARITY
  return { pitchHz: valid ? frequency : null, clarity }
}

export const frequencyToMidi = (frequency: number) => 69 + 12 * Math.log2(frequency / 440)

/** Ready for future comparison against Nico's reference vocal melody. */
export const centsDifference = (actualHz: number, expectedHz: number) =>
  1200 * Math.log2(actualHz / expectedHz)
