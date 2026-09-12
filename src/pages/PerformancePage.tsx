import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { songs } from '../data/songs'
import { PerformanceStage } from '../features/performance/PerformanceStage'
import { usePerformanceStore } from '../store/performanceStore'

export function PerformancePage() {
  const { songId } = useParams<{ songId: string }>()
  const song = songs.find((item) => item.id === songId)
  const [finishing, setFinishing] = useState(false)
  const selectedSongId = usePerformanceStore((state) => state.selectedSongId)
  const selectSong = usePerformanceStore((state) => state.selectSong)
  const finishPerformance = usePerformanceStore((state) => state.finishPerformance)

  useEffect(() => {
    if (song && selectedSongId !== song.id) selectSong(song.id)
  }, [song, selectedSongId, selectSong])

  if (finishing) return <Navigate to="/results" replace />
  if (!song) return <main className="empty-page page-shell"><h1>Song not found</h1><p>The selected track is not in the placeholder catalog.</p><Link className="primary-button" to="/">Choose a song</Link></main>

  const handleFinish = () => {
    finishPerformance()
    setFinishing(true)
  }

  return <PerformanceStage song={song} onFinish={handleFinish} />
}
