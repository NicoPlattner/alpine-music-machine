# Alpine Sound Machine

React/TypeScript foundation for an interactive karaoke and music-remixing experience. This phase includes routing, mock songs, shared state, and placeholders only.

## Install and run

```bash
npm install
npm run dev
```

Run the type check and production build with `npm run build`.

## Architecture

- `src/app` — application shell and routes
- `src/pages` — route-level screens
- `src/components` — shared presentation
- `src/store` — Zustand live performance state
- `src/types` — shared domain contracts
- `src/data` — replaceable placeholder data
- `src/features/songs` — catalog and song selection
- `src/features/karaoke` — future lyrics and scoring engine
- `src/features/motion` — future camera and gesture system
- `src/features/audio` — future playback and remix engine
- `src/features/visuals` — future stage and mountain visuals
- `src/features/device` — permissions, device selection, camera preview, and microphone level monitoring
- `src/features/performance` — layered stage composition and replaceable HUD, mountain, performer, motion, karaoke, mascot, progress, and remix views

Feature modules stay independent so team members can develop each engine without coupling it to page layout. Playback, pitch detection, gesture recognition, scoring, and media processing are intentionally not implemented yet.

Device setup keeps `MediaStream`, `AudioContext`, analyser nodes, and animation frames local to its React hook. Only serializable selected device IDs and enabled flags are stored in Zustand for later karaoke and motion modules.

Camera and microphone access require a secure browser context (`https://` or localhost) and explicit user permission. Device labels may remain generic until permission is granted.

The performance performer layer uses `@mediapipe/tasks-vision` with a locally hosted MediaPipe Selfie Segmenter model. Camera frames stay in the browser and are composited through a transparent canvas; raw video is used only if segmentation cannot initialize or run.

The first motion prototype reuses that same camera video source with MediaPipe Hand Landmarker. `src/features/motion` separates landmark tracking, circular-path interpretation, and the UI-only Speed controller; no playback behavior is connected yet.

The performance route composes a single viewport-filling stage. Its layers accept explicit mock props today so Nico's audio state, Mark's karaoke/motion state, and Leo's production artwork can replace them independently later.

## Live Stem Mixer backend

This is a live SuperCollider arrangement playground for `Never Gonna Give You
Up`. It reads the supplied Standard MIDI file, keeps each MIDI instrument track
separate, and renders enabled tracks through genre-specific SuperCollider voices.

## Run

```sh
docker compose up --build
```

Open <http://localhost:8080> and press Play. Pop is the default: all 15
source MIDI parts play with their original instrument families and no added
master effects. The empty MIDI count-in is trimmed. This is an instrumental
MIDI rendition, without recorded singing.
Choose a genre to select the MIDI tracks that
should play and the synth family they use; adjust individual track levels in the
mixer. The browser receives the SuperCollider output as a live MP3 stream.

## How MIDI playback works

At container startup, `audio-engine/prepare_midi.py` parses
`tracks/never-gonna-give-you-up/Never-Gonna-Give-You-Up-1.mid` without an
external MIDI dependency and writes a compact SuperCollider data file. The
engine creates one `Pbind` for every MIDI track and combines enabled patterns in
a `Ppar`. MIDI note onsets, overlapping notes and lengths are retained. Synths
are placed in a dedicated group before the persistent master effects synth.

There are four presets: Pop, Ballad, Rock, and Techno. Ballad, Rock and Techno
choose which source parts play and which SuperCollider voice renders each one.
The note data is never transposed by a preset.

See [the genre instrumentation table](audio-engine/ARRANGEMENTS.md) for each
track's assignment. Each instrument has its own synth graph and envelope; one
genre can use many different instruments.

The tempo slider changes the shared `TempoClock`. That changes scheduling speed,
not MIDI note numbers, so no pitch correction or Rubber Band time stretching is
needed. Seeking or changing genres rebuilds the pattern streams from the target
MIDI beat, including the remaining duration of notes spanning that point. Each
note frees itself after its remaining duration; no arbitrary short note cap is
used. Rebuilding the streams preserves the master output and effects.

## API

- `GET /api/state` — transport and MIDI-track state
- `GET /api/genres` and `PUT /api/genres/{genre}` — apply an arrangement preset
- `PUT /api/tracks/{track_id}` with `{ "active": true, "gain": 0.8 }`
- `POST /api/transport/play`, `/pause`, `/restart`
- `PUT /api/transport/speed` with `{ "speed": 1.1 }`
- `PUT /api/transport/seek` with `{ "position": 30 }`
- `GET /api/audio/live.mp3` — live rendered audio

Run the backend checks with:

```sh
docker compose run --rm --no-deps -v "$PWD/backend/tests:/app/tests:ro" backend python -m unittest discover -s tests
node --test testing-frontend/tests/playback.test.cjs
docker compose exec -T audio-engine python3 - < audio-engine/tests/midi_live.py
```
