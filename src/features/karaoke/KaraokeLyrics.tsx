import type { KaraokeLine, KaraokeTimelineState } from './types/karaokeTypes'

interface Props { timeline: KaraokeTimelineState; hasLyrics: boolean }

const WORDS_PER_VISUAL_LINE = 7

export function KaraokeLyrics({ timeline, hasLyrics }: Props) {
  if (!hasLyrics) return <div className="leo-lyrics leo-lyrics-empty">Karaoke lyrics will appear here</div>
  return (
    <div className="leo-lyrics" aria-live="polite">
      <div className="karaoke-current-line">
        {timeline.currentLine ? <Line line={timeline.currentLine} activeWordIndex={timeline.activeWordIndex} /> : <span aria-hidden="true">&nbsp;</span>}
      </div>
      {timeline.nextLine && <div className="karaoke-next-line"><PlainLine line={timeline.nextLine} /></div>}
    </div>
  )
}

function Line({ line, activeWordIndex }: { line: KaraokeLine; activeWordIndex: number | null }) {
  if (!line.words?.length) return <PlainText text={line.text} />
  return <>{chunk(line.words, WORDS_PER_VISUAL_LINE).map((words, rowIndex) => (
    <span className="karaoke-lyric-row" key={`row-${rowIndex}`}>
      {words.map((word, indexInRow) => {
        const index = rowIndex * WORDS_PER_VISUAL_LINE + indexInRow
        const state = activeWordIndex === null ? 'future' : index < activeWordIndex ? 'past' : index === activeWordIndex ? 'active' : 'future'
        return <span key={`${word.start}-${index}`} className={`karaoke-word ${state}`}>{word.text}</span>
      })}
    </span>
  ))}</>
}

function PlainLine({ line }: { line: KaraokeLine }) {
  return <PlainText text={line.text} />
}

function PlainText({ text }: { text: string }) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  return <>{chunk(words, WORDS_PER_VISUAL_LINE).map((row, index) => <span className="karaoke-lyric-row" key={`${index}-${row.join('-')}`}>{row.join(' ')}</span>)}</>
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = []
  for (let index = 0; index < items.length; index += size) rows.push(items.slice(index, index + size))
  return rows
}
