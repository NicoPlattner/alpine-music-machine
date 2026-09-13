# Karaoke

The Performance stage loads Nico's second-based, word-timed lyrics from
`GET /api/lyrics/word-timed`. `data/nicoLyricsAdapter.ts` validates that source
and converts its flat word list to the shared `KaraokeLyricsData` model. Lyrics
always follow `estimatedPlaybackPosition`; they have no independent clock.
The Nico adapter currently applies a shared `+3s` calibration offset to every
unmarked line and word timestamp. The opening of Never Gonna Give You Up uses
manually reviewed phrase anchors; word highlighting within each marked range
retains the source timing proportions.

The development fixture is only used as a fallback when
`VITE_ENABLE_DEV_KARAOKE_FIXTURE=true`. Production keeps the neutral empty state
if the real lyric request fails.

Pitch input is analysis-only. Participation scoring deliberately does not use
expected notes, lyric timing, or a reference melody.

Hackathon scoring is participation-based and deliberately independent of lyrics
and reference melody. While backend playback is active, microphone frames are
aggregated into three-second real-time windows and classified as 0, 5, or 10
points using the tuneable constants in `scoring/karaokeScoringConfig.ts`. The
authoritative total lives in `performanceStore.score`; karaoke state retains
the latest event and tuning metrics. A new Performance or Restart resets both.
