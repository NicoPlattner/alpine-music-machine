import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { songs } from '../data/songs'
import { DeviceSetupModal } from '../features/device/DeviceSetupModal'
import { usePerformanceStore } from '../store/performanceStore'
import type { Song } from '../types/song'
import './leoPages.css'
const featuredSong = songs[Math.floor(songs.length / 2)]
// Disabled for presentation purposes: the browser's own getUserMedia prompt on
// the performance page is enough, and the custom device setup screen is one
// extra click nobody needs to see mid-demo. Flip this back on to restore it.
const DEVICE_SETUP_MODAL_ENABLED = false
export function SongPickerPage() {
  const navigate = useNavigate(); const selectSong = usePerformanceStore((state) => state.selectSong)
  const [setupSong, setSetupSong] = useState<Song | null>(null)
  const select = (song: Song) => {
    selectSong(song.id)
    if (DEVICE_SETUP_MODAL_ENABLED) setSetupSong(song)
    else navigate(`/performance/${song.id}`)
  }
  return <><main className="picker-page leo-page"><img className="leo-page-frame" src="/leo-visual/UI/Wolp/Frame.svg" alt="" /><div className="leo-page-content"><header className="picker-header"><img className="picker-title" src="/leo-visual/UI/Wolp/AlpineSoundMachine-text.svg" alt="Alpine Sound Machine" /></header><div className="song-list-single"><button className="song-single-card" onClick={() => select(featuredSong)}><img src="/leo-visual/UI/Wolp/nevergonnagiveuup.svg" alt={`${featuredSong.title} by ${featuredSong.artist}`} /></button></div></div></main>{setupSong && <DeviceSetupModal song={setupSong} onCancel={() => setSetupSong(null)} onStart={() => navigate(`/performance/${setupSong.id}`)} />}</>
}
