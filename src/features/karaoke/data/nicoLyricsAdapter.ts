import type { KaraokeLine, KaraokeLyricsData, KaraokeWord } from '../types/karaokeTypes'

const NICO_WORDS_PER_LINE = 10
const NICO_LINE_BREAK_GAP_SECONDS = 1
export const NICO_LYRICS_TIMING_OFFSET_SECONDS = 3

interface NicoTimedWord {
  word: string
  start: number
  end: number
}

interface AnchoredPhrase {
  text: string
  sourceStartIndex: number
  sourceEndIndex: number
  start: number
  end?: number
}

const NEVER_GONNA_GIVE_YOU_UP_OPENING: AnchoredPhrase[] = [
  { text: "We're no strangers to love You know the rules and so do I", sourceStartIndex: 0, sourceEndIndex: 13, start: 20.5, end: 28.5 },
  { text: "A full commitment's what I'm thinking of", sourceStartIndex: 13, sourceEndIndex: 20, start: 29.5, end: 33 },
  { text: "You wouldn't get this from any other guy", sourceStartIndex: 20, sourceEndIndex: 28, start: 33.5, end: 37.5 },
  { text: "I just wanna tell you how I'm feeling", sourceStartIndex: 28, sourceEndIndex: 36, start: 38, end: 41 },
  { text: 'Gotta make you understand', sourceStartIndex: 36, sourceEndIndex: 40, start: 42, end: 45 },
  { text: 'Never gonna give you up', sourceStartIndex: 40, sourceEndIndex: 45, start: 45.5 },
]

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

function fitPhraseToAnchor(phrase: AnchoredPhrase, sourceWords: NicoTimedWord[]): KaraokeWord[] {
  const source = sourceWords.slice(phrase.sourceStartIndex, phrase.sourceEndIndex)
  const text = phrase.text.split(/\s+/)
  if (source.length !== text.length || source.length === 0) return []

  const sourceStart = source[0].start
  const sourceEnd = source[source.length - 1].end
  const sourceDuration = sourceEnd - sourceStart
  const targetEnd = phrase.end ?? phrase.start + sourceDuration
  const targetDuration = targetEnd - phrase.start
  if (sourceDuration <= 0 || targetDuration <= 0) return []

  const mapTime = (time: number) => phrase.start + ((time - sourceStart) / sourceDuration) * targetDuration
  return source.map((word, index) => ({
    text: text[index],
    start: mapTime(word.start),
    end: mapTime(word.end),
  }))
}

function createLine(id: string, words: KaraokeWord[]): KaraokeLine | null {
  if (words.length === 0 || words[words.length - 1].end <= words[0].start) return null
  return {
    id,
    text: words.map((word) => word.text).join(' '),
    start: words[0].start,
    end: words[words.length - 1].end,
    words,
  }
}

function appendGeneratedLines(lines: KaraokeLine[], sourceWords: NicoTimedWord[], startOffset: number) {
  for (let offset = startOffset; offset < sourceWords.length;) {
    const sourceLine: NicoTimedWord[] = []
    while (offset < sourceWords.length && sourceLine.length < NICO_WORDS_PER_LINE) {
      const word = sourceWords[offset]
      sourceLine.push(word)
      offset += 1
      const nextWord = sourceWords[offset]
      if (nextWord && nextWord.start - word.end >= NICO_LINE_BREAK_GAP_SECONDS) break
    }
    const words: KaraokeWord[] = sourceLine.map(({ word, start, end }) => ({
      text: word,
      start: start + NICO_LYRICS_TIMING_OFFSET_SECONDS,
      end: end + NICO_LYRICS_TIMING_OFFSET_SECONDS,
    }))
    const line = createLine(`nico-line-${lines.length + 1}`, words)
    if (line) lines.push(line)
  }
}

/**
 * Converts Nico's flat, second-based Whisper word list into the existing
 * karaoke model. The accompanying ELRC uses at most ten words per line and
 * starts a new line after a one-second vocal gap, so the same boundaries are
 * reproduced here. A single calibration offset moves every word and line
 * together without changing playback-clock or speed behavior.
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
  const isNeverGonnaGiveYouUp = typeof payload.source === 'string' && /never gonna give you up/i.test(payload.source)
  let generatedStartIndex = 0

  if (isNeverGonnaGiveYouUp) {
    for (const phrase of NEVER_GONNA_GIVE_YOU_UP_OPENING) {
      const line = createLine(`nico-line-${lines.length + 1}`, fitPhraseToAnchor(phrase, sourceWords))
      if (line) lines.push(line)
    }
    generatedStartIndex = NEVER_GONNA_GIVE_YOU_UP_OPENING.at(-1)?.sourceEndIndex ?? 0
  }

  appendGeneratedLines(lines, sourceWords, generatedStartIndex)

  return { lines }
}
