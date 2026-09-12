export const MUSIC_GENRES = ['pop', 'rock', 'techno', 'ballad'] as const

export type MusicGenre = (typeof MUSIC_GENRES)[number]

export interface BackendTrack {
  id: string
  name: string
  active: boolean
  voice: number
  gain: number
  voice_name: string
}

export interface BackendGenre {
  id: MusicGenre
  label: string
}

export interface BackendState {
  playing: boolean
  speed: number
  position: number
  duration: number
  genre: MusicGenre | null
  audio_connected: boolean
  song_bpm: number
  song_key: string
  tracks: BackendTrack[]
}

export const isMusicGenre = (value: unknown): value is MusicGenre =>
  typeof value === 'string' && (MUSIC_GENRES as readonly string[]).includes(value)
