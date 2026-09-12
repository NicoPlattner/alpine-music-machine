import type { KaraokeLine, KaraokeLyricsData, KaraokeWord } from '../types/karaokeTypes'

const NICO_WORDS_PER_LINE = 10
const NICO_LINE_BREAK_GAP_SECONDS = 1

interface NicoTimedWord {
  word: string
  start: number
  end: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseWord(value: unknown): NicoTimedWord | null {
  if (!isRecord(value)) return null
  const text = typeof value.word === 'string' ? value.word.trim() : ''
  const start = value.start
  const end = value.end
  if (!text || typeof start !== 'number' || !Number.isFinite(start) || start < 0) return null
  if (typeof end !== 'number' || !Number.isFinite(end) || end < start) return null
  return { word: text, start, end }
}

/**
 * Converts Nico's flat, second-based Whisper word list into the existing
 * karaoke model. The accompanying ELRC uses at most ten words per line and
 * starts a new line after a one-second vocal gap, so the same boundaries are
 * reproduced here without changing any source word timestamps.
 */
export function adaptNicoLyrics(payload: unknown): KaraokeLyricsData {
  if (!isRecord(payload) || payload.time_unit !== 'seconds' || !Array.isArray(payload.words)) {
    throw new Error('Nico lyrics must contain a seconds-based words array')
  }

  const sourceWords = payload.words
    .map(parseWord)
    .filter((word): word is NicoTimedWord => word !== null)
    .sort((a, b) => a.start - b.start || a.end - b.end)

  if (sourceWords.length === 0) throw new Error('Nico lyrics contain no valid timed words')

  const lines: KaraokeLine[] = []
  for (let offset = 0; offset < sourceWords.length;) {
    const sourceLine: NicoTimedWord[] = []
    while (offset < sourceWords.length && sourceLine.length < NICO_WORDS_PER_LINE) {
      const word = sourceWords[offset]
      sourceLine.push(word)
      offset += 1
      const nextWord = sourceWords[offset]
      if (nextWord && nextWord.start - word.end >= NICO_LINE_BREAK_GAP_SECONDS) break
    }
    const words: KaraokeWord[] = sourceLine.map(({ word, start, end }) => ({ text: word, start, end }))
    const start = words[0].start
    const end = words[words.length - 1].end
    if (end <= start) continue

    lines.push({
      id: `nico-line-${lines.length + 1}`,
      text: words.map((word) => word.text).join(' '),
      start,
      end,
      words,
    })
  }

  return { lines }
}
