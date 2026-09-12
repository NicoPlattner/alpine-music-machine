import type { KaraokeLine, KaraokeTimelineState } from './types/karaokeTypes'

interface Props { timeline: KaraokeTimelineState; hasLyrics: boolean }

export function KaraokeLyrics({ timeline, hasLyrics }: Props) {
  if (!hasLyrics) return <div className="leo-lyrics leo-lyrics-empty">Karaoke lyrics will appear here</div>
  return (
    <div className="leo-lyrics" aria-live="polite">
      <div className="karaoke-current-line">
        {timeline.currentLine ? <Line line={timeline.currentLine} activeWordIndex={timeline.activeWordIndex} /> : <span aria-hidden="true">&nbsp;</span>}
      </div>
      {timeline.nextLine && <div className="karaoke-next-line">{timeline.nextLine.text}</div>}
    </div>
  )
}

function Line({ line, activeWordIndex }: { line: KaraokeLine; activeWordIndex: number | null }) {
  if (!line.words?.length) return <>{line.text}</>
  return <>{line.words.map((word, index) => {
    const state = activeWordIndex === null ? 'future' : index < activeWordIndex ? 'past' : index === activeWordIndex ? 'active' : 'future'
    return <span key={`${word.start}-${index}`} className={`karaoke-word ${state}`}>{word.text}</span>
  })}</>
}
