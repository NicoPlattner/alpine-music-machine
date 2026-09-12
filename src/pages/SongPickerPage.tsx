import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { songs } from '../data/songs'
import { DeviceSetupModal } from '../features/device/DeviceSetupModal'
import { usePerformanceStore } from '../store/performanceStore'
import type { Song } from '../types/song'
const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
export function SongPickerPage() {
  const navigate = useNavigate(); const selectSong = usePerformanceStore((state) => state.selectSong)
  const [setupSong, setSetupSong] = useState<Song | null>(null)
  const select = (song: Song) => { selectSong(song.id); setSetupSong(song) }
  return <><main className="picker-page page-shell"><header className="picker-header"><p className="status-label">Choose your song</p><h1>Alpine Sound Machine</h1><p>Sing it. Move it. Remix the Alps.</p></header><div className="song-list" aria-label="Available songs">{songs.map((song) => <button className="song-card" key={song.id} onClick={() => select(song)}><img className="song-cover" src={song.coverUrl} alt="" /><span className="song-details"><strong>{song.title}</strong><span>{song.artist}</span><span className="song-tags">{song.genre && <em>{song.genre}</em>}{song.difficulty && <em>{song.difficulty}</em>}</span></span><span className="song-duration">{formatDuration(song.duration)}</span><span className="song-action">Select <span aria-hidden="true">→</span></span></button>)}</div></main>{setupSong && <DeviceSetupModal song={setupSong} onCancel={() => setSetupSong(null)} onStart={() => navigate(`/performance/${setupSong.id}`)} />}</>
}
