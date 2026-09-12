interface KaraokeLyricsProps { currentLine?: string; nextLine?: string; highlightedWords?: number }
export function KaraokeLyricsLayer({ currentLine }: KaraokeLyricsProps) {
  return <div className="karaoke-lyrics" aria-live="polite">{currentLine ? <p className="current-lyric">{currentLine}</p> : <p className="lyrics-placeholder">Karaoke lyrics will appear here</p>}</div>
}
