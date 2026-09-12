import type { KaraokeLine, KaraokeLyricsData, KaraokeTimelineState } from '../types/karaokeTypes'

const clampProgress = (value: number) => Math.min(1, Math.max(0, value))
const intervalProgress = (position: number, start: number, end: number) =>
  end > start ? clampProgress((position - start) / (end - start)) : 0

/** Pure, seek-safe lyric lookup. All values are song-position seconds. */
export function getKaraokeTimeline(lyrics: KaraokeLyricsData, playbackPosition: number): KaraokeTimelineState {
  const lines = lyrics.lines
  if (lines.length === 0) return emptyTimeline()

  const insertionIndex = firstLineEndingAfter(lines, playbackPosition)
  const candidate = lines[insertionIndex]
  const currentLineIndex = candidate && candidate.start <= playbackPosition && playbackPosition < candidate.end
    ? insertionIndex
    : null
  const currentLine = currentLineIndex === null ? null : lines[currentLineIndex]
  const nextIndex = currentLineIndex === null
    ? lines.findIndex((line) => line.start > playbackPosition)
    : currentLineIndex + 1
  const nextLine = nextIndex >= 0 && nextIndex < lines.length ? lines[nextIndex] : null

  if (!currentLine) return { ...emptyTimeline(), nextLine }
  const activeWordIndex = currentLine.words?.findIndex((word) => word.start <= playbackPosition && playbackPosition < word.end) ?? -1
  const normalizedWordIndex = activeWordIndex >= 0 ? activeWordIndex : null
  const activeWord = normalizedWordIndex === null ? null : currentLine.words?.[normalizedWordIndex] ?? null
  return {
    currentLine,
    nextLine,
    currentLineIndex,
    activeWordIndex: normalizedWordIndex,
    lineProgress: intervalProgress(playbackPosition, currentLine.start, currentLine.end),
    wordProgress: activeWord ? intervalProgress(playbackPosition, activeWord.start, activeWord.end) : 0,
  }
}

function firstLineEndingAfter(lines: KaraokeLine[], position: number) {
  let low = 0
  let high = lines.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (lines[middle].end <= position) low = middle + 1
    else high = middle
  }
  return low
}

function emptyTimeline(): KaraokeTimelineState {
  return { currentLine: null, nextLine: null, currentLineIndex: null, activeWordIndex: null, lineProgress: 0, wordProgress: 0 }
}
