import { useEffect, useMemo, useState } from 'react'
import type { Genre, GenreGesture } from '../motion/handTrackingTypes'

interface LeoInterfaceLayerProps {
  currentTime: number
  genre: Genre
  genreGesture: GenreGesture
  onFinish: () => void
  onGenreChange: (genre: Genre) => void
}

const genres: Genre[] = ['Pop', 'Techno', 'Rock', 'Ballad']
const wolpertingers = ['Wolp_shame.png', 'Wolp_love.png', 'Wolp_dead.png', 'Wolp_happy.png']
const lyrics = [
  { time: 2, text: 'la la la placeholder line' },
  { time: 8, text: 'swap this array for the real lyrics' },
  { time: 14, text: 'each line just needs a start time' },
  { time: 20, text: 'words highlight one by one as they play' },
  { time: 26, text: 'the caret jumps above the active word' },
  { time: 32, text: 'replace me when the real lrc data is ready' },
]
const asset = (name: string) => `${import.meta.env.BASE_URL}leo-visual/UI/Wolp/${name}`
const genreTintBounds: Record<Genre, { x: number; width: number }> = {
  Pop: { x: 2300, width: 145 },
  Techno: { x: 2420, width: 145 },
  Rock: { x: 2540, width: 145 },
  Ballad: { x: 2660, width: 160 },
}

export function LeoInterfaceLayer({ currentTime, genre, genreGesture, onFinish, onGenreChange }: LeoInterfaceLayerProps) {
  const [wolpertingerIndex, setWolpertingerIndex] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => setWolpertingerIndex((index) => (index + 1) % wolpertingers.length), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const lyricState = useMemo(() => {
    let lineIndex = -1
    for (let index = 0; index < lyrics.length; index += 1) {
      if (currentTime >= lyrics[index].time) lineIndex = index
      else break
    }
    if (lineIndex < 0) return null
    const line = lyrics[lineIndex]
    const words = line.text.split(' ')
    const lineEnd = lyrics[lineIndex + 1]?.time ?? line.time + 6
    const wordDuration = (lineEnd - line.time) / words.length
    const activeWord = Math.max(0, Math.min(words.length - 1, Math.floor((currentTime - line.time) / wordDuration)))
    return { lineIndex, words, activeWord }
  }, [currentTime])

  return (
    <div className="leo-interface" aria-label="Alpine Sound Machine performance controls">
      <img className="leo-interface-art" src={asset('AlpineSoundMachine.svg')} alt="" />
      <svg className="leo-genre-tint" viewBox="0 0 3072 1728" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <clipPath id="leo-selected-genre-column">
            <rect x={genreTintBounds[genre].x} y="420" width={genreTintBounds[genre].width} height="440" />
          </clipPath>
        </defs>
        <rect className="leo-selected-genre-color" x="0" y="0" width="3072" height="1728" clipPath="url(#leo-selected-genre-column)" />
      </svg>
      <img className="leo-interface-slider" src={asset('slider.svg')} alt="" />
      <img className="leo-interface-frame" src={asset('Frame.svg')} alt="" />
      <img className="leo-wolpertinger" src={asset(wolpertingers[wolpertingerIndex])} alt="Wolpertinger" />
      <p className="leo-score">666</p>
      {lyricState && (
        <div className="leo-lyrics" aria-live="polite">
          {lyricState.words.map((word, index) => (
            <span key={`${lyricState.lineIndex}-${index}`} className={index === lyricState.activeWord ? 'active' : ''}>
              {word}{index === lyricState.activeWord && <i key={`${lyricState.lineIndex}-${index}`} aria-hidden="true" />}
            </span>
          ))}
        </div>
      )}
      <div className="leo-genre-controls" aria-label="Genre controls">
        {genres.map((item) => (
          <button type="button" key={item} className={`${genre === item ? 'selected' : ''} ${genreGesture === item ? 'gesture-match' : ''}`.trim()} aria-label={`Select ${item} genre`} aria-pressed={genre === item} onClick={() => onGenreChange(item)} />
        ))}
      </div>
      <button type="button" className="leo-finish-hotspot" aria-label="Finish performance" title="Finish performance" onClick={onFinish} />
    </div>
  )
}
