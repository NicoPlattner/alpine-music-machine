# Karaoke

The Performance stage loads Nico's second-based, word-timed lyrics from
`GET /api/lyrics/word-timed`. `data/nicoLyricsAdapter.ts` validates that source
and converts its flat word list to the shared `KaraokeLyricsData` model. Lyrics
always follow `estimatedPlaybackPosition`; they have no independent clock.

The development fixture is only used as a fallback when
`VITE_ENABLE_DEV_KARAOKE_FIXTURE=true`. Production keeps the neutral empty state
if the real lyric request fails.

Pitch input is analysis-only. Expected vocal notes are not connected to scoring
yet; the MIDI `MELODY` track needs confirmation as the intended vocal reference.
