import type { BackendGenre, BackendState, MusicGenre } from './audioApiTypes'
import { isMusicGenre } from './audioApiTypes'

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
export const AUDIO_API_BASE_URL = (configuredBaseUrl || 'http://localhost:8000').replace(/\/$/, '')

class AudioApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
    this.name = 'AudioApiError'
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${AUDIO_API_BASE_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Network request failed'
    throw new AudioApiError(`Audio backend unavailable: ${detail}`)
  }
  if (!response.ok) {
    let detail = `Request failed (${response.status})`
    try {
      const payload = await response.json() as { detail?: unknown }
      if (typeof payload.detail === 'string') detail = payload.detail
    } catch { /* Fall back to the HTTP status. */ }
    throw new AudioApiError(detail, response.status)
  }
  return response.json() as Promise<T>
}

export const getState = (signal?: AbortSignal) => request<BackendState>('/api/state', { signal })

export async function getGenres(signal?: AbortSignal): Promise<BackendGenre[]> {
  const genres = await request<Array<{ id: unknown; label: unknown }>>('/api/genres', { signal })
  return genres
    .filter((genre): genre is { id: MusicGenre; label: string } => isMusicGenre(genre.id) && typeof genre.label === 'string')
    .map(({ id, label }) => ({ id, label }))
}

export const setGenre = (genre: MusicGenre, signal?: AbortSignal) =>
  request<BackendState>(`/api/genres/${encodeURIComponent(genre)}`, { method: 'PUT', signal })
export const play = (signal?: AbortSignal) => request<BackendState>('/api/transport/play', { method: 'POST', signal })
export const pause = (signal?: AbortSignal) => request<BackendState>('/api/transport/pause', { method: 'POST', signal })
export const restart = (signal?: AbortSignal) => request<BackendState>('/api/transport/restart', { method: 'POST', signal })
export const setSpeed = (speed: number, signal?: AbortSignal) => request<BackendState>('/api/transport/speed', {
  method: 'PUT', signal, body: JSON.stringify({ speed: Math.min(1.5, Math.max(0.5, speed)) }),
})
export const seek = (position: number, signal?: AbortSignal) => request<BackendState>('/api/transport/seek', {
  method: 'PUT', signal, body: JSON.stringify({ position: Math.max(0, position) }),
})
export const getLiveAudioUrl = (prebuffer = 3) =>
  `${AUDIO_API_BASE_URL}/api/audio/live.mp3?prebuffer=${encodeURIComponent(Math.min(10, Math.max(0.2, prebuffer)))}`
