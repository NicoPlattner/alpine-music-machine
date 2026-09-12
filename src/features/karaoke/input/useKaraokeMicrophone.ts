import { useEffect, useRef, useState } from 'react'
import { useDeviceStore } from '../../device/deviceStore'
import type { KaraokeInputFrame, KaraokeMicrophoneStatus } from '../types/karaokeTypes'
import { createPitchDetector, detectPitch, frequencyToMidi, MIN_VOICE_LEVEL } from './pitchDetection'

const ANALYSIS_INTERVAL_MS = 50
const PITCH_HISTORY_SIZE = 5
const EMPTY_FRAME: KaraokeInputFrame = { timestamp: 0, level: 0, pitchHz: null, midiNote: null, clarity: 0 }

export function useKaraokeMicrophone(estimatedPlaybackPosition: number) {
  const microphoneDeviceId = useDeviceStore((state) => state.microphoneDeviceId)
  const microphoneEnabled = useDeviceStore((state) => state.microphoneEnabled)
  const updateDeviceConfig = useDeviceStore((state) => state.updateDeviceConfig)
  const playbackPositionRef = useRef(estimatedPlaybackPosition)
  const [status, setStatus] = useState<KaraokeMicrophoneStatus>('idle')
  const [frame, setFrame] = useState<KaraokeInputFrame>(EMPTY_FRAME)

  useEffect(() => { playbackPositionRef.current = estimatedPlaybackPosition }, [estimatedPlaybackPosition])

  useEffect(() => {
    let active = true
    let stream: MediaStream | null = null
    let context: AudioContext | null = null
    let animationFrame = 0

    if (!microphoneEnabled || !navigator.mediaDevices?.getUserMedia || typeof AudioContext === 'undefined') {
      setStatus('unavailable')
      setFrame({ ...EMPTY_FRAME, timestamp: playbackPositionRef.current })
      return
    }

    const start = async () => {
      setStatus('requesting')
      try {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: microphoneDeviceId ? { deviceId: { exact: microphoneDeviceId } } : true,
            video: false,
          })
        } catch (error) {
          if (!microphoneDeviceId || !(error instanceof DOMException) || !['NotFoundError', 'OverconstrainedError'].includes(error.name)) throw error
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        }
        if (!active) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        const activeDeviceId = stream.getAudioTracks()[0]?.getSettings().deviceId ?? microphoneDeviceId
        if (activeDeviceId !== microphoneDeviceId) updateDeviceConfig({ microphoneDeviceId: activeDeviceId ?? null })

        context = new AudioContext()
        await context.resume()
        const analyser = context.createAnalyser()
        analyser.fftSize = 2048
        analyser.smoothingTimeConstant = 0
        context.createMediaStreamSource(stream).connect(analyser)
        const samples = new Float32Array(analyser.fftSize)
        const pitchDetector = createPitchDetector(samples.length)
        const pitchHistory: number[] = []
        let lastAnalyzedAt = 0

        const analyze = (now: number) => {
          if (!active) return
          if (now - lastAnalyzedAt >= ANALYSIS_INTERVAL_MS) {
            lastAnalyzedAt = now
            analyser.getFloatTimeDomainData(samples)
            let energy = 0
            for (const sample of samples) energy += sample * sample
            const level = Math.sqrt(energy / samples.length)
            let pitchHz: number | null = null
            let clarity = 0
            if (level >= MIN_VOICE_LEVEL) {
              const detected = detectPitch(pitchDetector, samples, context!.sampleRate, level)
              clarity = detected.clarity
              if (detected.pitchHz !== null) {
                pitchHistory.push(detected.pitchHz)
                if (pitchHistory.length > PITCH_HISTORY_SIZE) pitchHistory.shift()
                pitchHz = median(pitchHistory)
              } else pitchHistory.length = 0
            } else pitchHistory.length = 0
            setFrame({
              timestamp: playbackPositionRef.current,
              level,
              pitchHz,
              midiNote: pitchHz === null ? null : frequencyToMidi(pitchHz),
              clarity,
            })
          }
          animationFrame = requestAnimationFrame(analyze)
        }
        setStatus('ready')
        animationFrame = requestAnimationFrame(analyze)
      } catch (error) {
        if (!active) return
        if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) setStatus('denied')
        else if (error instanceof DOMException && error.name === 'NotFoundError') setStatus('unavailable')
        else setStatus('error')
        setFrame({ ...EMPTY_FRAME, timestamp: playbackPositionRef.current })
      }
    }
    void start()

    return () => {
      active = false
      cancelAnimationFrame(animationFrame)
      stream?.getTracks().forEach((track) => track.stop())
      void context?.close()
    }
  }, [microphoneDeviceId, microphoneEnabled, updateDeviceConfig])

  return { status, frame }
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}
