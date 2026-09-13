import { useCallback, useEffect, useRef, useState } from 'react'
import * as audioApi from './api/audioApi'
import type { BackendGenre, BackendState, MusicGenre } from './api/audioApiTypes'

const FALLBACK_GENRES: BackendGenre[] = [
  { id: 'pop', label: 'Pop' }, { id: 'techno', label: 'Techno' },
  { id: 'rock', label: 'Rock' }, { id: 'ballad', label: 'Ballad' },
]
const POLL_INTERVAL_MS = 750

let performanceSessionStarted = false
let sessionReleaseTimer: number | null = null

type ConnectionStatus = 'loading' | 'connected' | 'unavailable'
export type AudioStreamStatus = 'loading' | 'playing' | 'paused' | 'blocked' | 'error'

export function useAudioBackend() {
  const [state, setState] = useState<BackendState | null>(null)
  const [genres, setGenres] = useState<BackendGenre[]>(FALLBACK_GENRES)
  const [originalGenre, setOriginalGenre] = useState<MusicGenre | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [pendingGenre, setPendingGenre] = useState<MusicGenre | null>(null)
  const [gestureFeedback, setGestureFeedback] = useState<MusicGenre | null>(null)
  const [transportPending, setTransportPending] = useState(false)
  const [audioStreamStatus, setAudioStreamStatus] = useState<AudioStreamStatus>('loading')
  const [estimatedPlaybackPosition, setEstimatedPlaybackPosition] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)
  const mountedRef = useRef(true)
  const originalGenreCapturedRef = useRef(false)
  const pendingGenreRef = useRef<MusicGenre | null>(null)
  const transportPendingRef = useRef(false)
  const requestSequenceRef = useRef(0)
  const lastAppliedRequestRef = useRef(0)
  const commandsInFlightRef = useRef(0)
  const commandControllersRef = useRef(new Set<AbortController>())
  const gestureFeedbackTimerRef = useRef<number | null>(null)

  const applyState = useCallback((next: BackendState, requestId: number) => {
    if (!mountedRef.current || requestId < lastAppliedRequestRef.current) return
    lastAppliedRequestRef.current = requestId
    setState(next)
    setConnectionStatus('connected')
    setError(null)
    if (!originalGenreCapturedRef.current) {
      originalGenreCapturedRef.current = true
      // TODO: replace initial-state snapshot with backend-provided original_genre when Nico adds it.
      if (next.genre !== null) setOriginalGenre(next.genre)
    }
  }, [])

  const runCommand = useCallback(async (command: (signal: AbortSignal) => Promise<BackendState>) => {
    const controller = new AbortController()
    commandControllersRef.current.add(controller)
    const requestId = ++requestSequenceRef.current
    commandsInFlightRef.current += 1
    try {
      const next = await command(controller.signal)
      applyState(next, requestId)
      return next
    } catch (commandError) {
      if (controller.signal.aborted) return null
      const message = commandError instanceof Error ? commandError.message : 'Audio command failed'
      if (mountedRef.current) setError(message)
      return null
    } finally {
      commandsInFlightRef.current -= 1
      commandControllersRef.current.delete(controller)
    }
  }, [applyState])

  const enableAudio = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return false
    try {
      await audio.play()
      if (mountedRef.current) setAudioStreamStatus('playing')
      return true
    } catch {
      if (mountedRef.current) setAudioStreamStatus('blocked')
      return false
    }
  }, [])

  const reconnectAudio = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return false
    audio.pause()
    // A paused live response keeps accumulating stale MP3 data. Reconnect so
    // resumed playback starts at the relay's live edge instead of old audio.
    audio.src = `${audioApi.getLiveAudioUrl(0.25)}&connection=${Date.now()}`
    audio.load()
    return enableAudio()
  }, [enableAudio])

  const selectGenre = useCallback(async (genre: MusicGenre, source: 'button' | 'gesture' = 'button') => {
    if (pendingGenreRef.current === genre || state?.genre === genre || connectionStatus === 'unavailable') return null
    pendingGenreRef.current = genre
    setPendingGenre(genre)
    const next = await runCommand((signal) => audioApi.setGenre(genre, signal))
    if (mountedRef.current && pendingGenreRef.current === genre) {
      pendingGenreRef.current = null
      setPendingGenre(null)
      if (next && source === 'gesture') {
        setGestureFeedback(genre)
        if (gestureFeedbackTimerRef.current !== null) window.clearTimeout(gestureFeedbackTimerRef.current)
        gestureFeedbackTimerRef.current = window.setTimeout(() => setGestureFeedback(null), 1600)
      }
    }
    return next
  }, [connectionStatus, runCommand, state?.genre])

  const runTransport = useCallback(async (
    command: (signal: AbortSignal) => Promise<BackendState>,
    audioAction: 'none' | 'pause' | 'reconnect' = 'none',
  ) => {
    if (transportPendingRef.current) return null
    transportPendingRef.current = true
    setTransportPending(true)
    if (audioAction === 'pause') {
      audioRef.current?.pause()
      setAudioStreamStatus('paused')
    }
    const result = await runCommand(command)
    if (result && audioAction === 'reconnect') void reconnectAudio()
    if (!result && audioAction === 'pause') void enableAudio()
    transportPendingRef.current = false
    if (mountedRef.current) setTransportPending(false)
    return result
  }, [enableAudio, reconnectAudio, runCommand])

  useEffect(() => {
    if (!state) {
      setEstimatedPlaybackPosition(0)
      return
    }
    let animationFrame = 0
    let lastPublishedAt = 0
    const backendPosition = state.position
    const synchronizedAt = performance.now()
    const updateClock = (now: number) => {
      if (now - lastPublishedAt >= 50) {
        lastPublishedAt = now
        const elapsedRealSeconds = state.playing ? (now - synchronizedAt) / 1000 : 0
        const estimated = backendPosition + elapsedRealSeconds * state.speed
        setEstimatedPlaybackPosition(Math.min(state.duration, Math.max(0, estimated)))
      }
      animationFrame = requestAnimationFrame(updateClock)
    }
    setEstimatedPlaybackPosition(Math.min(state.duration, Math.max(0, backendPosition)))
    animationFrame = requestAnimationFrame(updateClock)
    return () => cancelAnimationFrame(animationFrame)
  }, [state])

  useEffect(() => {
    mountedRef.current = true
    const lifecycleController = new AbortController()
    let pollTimer = 0
    let startupTimer = 0
    if (sessionReleaseTimer !== null) {
      window.clearTimeout(sessionReleaseTimer)
      sessionReleaseTimer = null
    }
    const loadGenres = async () => {
      try {
        const available = await audioApi.getGenres(lifecycleController.signal)
        if (mountedRef.current && available.length > 0) {
          setGenres(FALLBACK_GENRES.map((fallback) => available.find((genre) => genre.id === fallback.id) ?? fallback))
        }
      } catch { /* Known validated genre fallback remains available. */ }
    }
    const poll = async () => {
      if (commandsInFlightRef.current > 0) {
        pollTimer = window.setTimeout(poll, POLL_INTERVAL_MS)
        return
      }
      const requestId = ++requestSequenceRef.current
      try {
        const next = await audioApi.getState(lifecycleController.signal)
        applyState(next, requestId)
      } catch (pollError) {
        if (lifecycleController.signal.aborted) return
        if (mountedRef.current) {
          setConnectionStatus('unavailable')
          setError(pollError instanceof Error ? pollError.message : 'Audio backend unavailable')
        }
      } finally {
        if (!lifecycleController.signal.aborted) pollTimer = window.setTimeout(poll, POLL_INTERVAL_MS)
      }
    }
    const startSession = async () => {
      try {
        // Every new performance starts from the untouched source arrangement,
        // even if the backend retained a genre from the previous session.
        const genreId = ++requestSequenceRef.current
        const defaultState = await audioApi.setGenre('pop', lifecycleController.signal)
        applyState(defaultState, genreId)
        const restartId = ++requestSequenceRef.current
        const restarted = await audioApi.restart(lifecycleController.signal)
        applyState(restarted, restartId)
        const playId = ++requestSequenceRef.current
        const playing = await audioApi.play(lifecycleController.signal)
        applyState(playing, playId)
      } catch (startupError) {
        if (!lifecycleController.signal.aborted && mountedRef.current) {
          setConnectionStatus('unavailable')
          setError(startupError instanceof Error ? startupError.message : 'Audio backend unavailable')
        }
      }
      void enableAudio()
    }

    void loadGenres()
    void poll()
    if (!performanceSessionStarted) {
      startupTimer = window.setTimeout(() => {
        performanceSessionStarted = true
        void startSession()
      }, 0)
    } else void enableAudio()

    return () => {
      mountedRef.current = false
      lifecycleController.abort()
      window.clearTimeout(pollTimer)
      window.clearTimeout(startupTimer)
      commandControllersRef.current.forEach((controller) => controller.abort())
      commandControllersRef.current.clear()
      if (gestureFeedbackTimerRef.current !== null) window.clearTimeout(gestureFeedbackTimerRef.current)
      const audio = audioRef.current
      audio?.pause()
      sessionReleaseTimer = window.setTimeout(() => {
        performanceSessionStarted = false
        sessionReleaseTimer = null
      }, 0)
    }
  }, [applyState, enableAudio])

  const seek = useCallback((position: number) => runCommand((signal) => audioApi.seek(position, signal)), [runCommand])
  const setSpeed = useCallback((speed: number) => runCommand((signal) => audioApi.setSpeed(speed, signal)), [runCommand])

  return {
    state, estimatedPlaybackPosition, genres, originalGenre, connectionStatus, error, pendingGenre, gestureFeedback, transportPending,
    audioStreamStatus, audioRef, liveAudioUrl: audioApi.getLiveAudioUrl(0.25), enableAudio, selectGenre,
    onAudioPlaying: () => setAudioStreamStatus('playing'),
    onAudioWaiting: () => setAudioStreamStatus('loading'),
    onAudioError: () => setAudioStreamStatus('error'),
    play: () => runTransport(audioApi.play, 'reconnect'),
    pause: () => runTransport(audioApi.pause, 'pause'),
    restart: () => runTransport(audioApi.restart, 'reconnect'),
    seek, setSpeed,
  }
}
