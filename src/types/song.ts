export type SongDifficulty = 'Easy' | 'Medium' | 'Hard'

export interface Song {
  id: string
  title: string
  artist: string
  duration: number
  originalPlaybackRate: number
  coverUrl?: string
  audioUrl?: string
  genre?: string
  difficulty?: SongDifficulty
}
