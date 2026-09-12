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

A containerized proof of concept for playing synchronized song stems while changing
tempo (without deliberate pitch shifting) and each stem's volume in real time.
Eight genre presets (Pop, Rock, Hip-Hop, Electronic, Jazz, Classical, Reggae,
and Metal) rebalance the stems and apply bass/treble EQ, reverb, and compression.

## Run it

```bash
docker compose up --build
```

Open <http://localhost:8080> and press **Play** to start playback and connect audio.
While playing, the play button becomes **Restart from beginning**. Use **Pause**
to pause and **Play** to resume, or drag the timeline to seek. The audio button
lets you disconnect or reconnect the live stream if needed. Engine position and
audible playback differ slightly because the live MP3 stream is buffered.

The included Compose setup mounts `./tracks/shape-of-you` read-only into the audio
engine. All audio processing happens in SuperCollider. The browser receives a live
MP3 stream through the backend; the files themselves are never exposed by nginx.

## Layout

```text
audio-engine/  SuperCollider + JACK + FFmpeg live encoder
backend/       FastAPI control API and streaming relay
frontend/      Static test controls served by nginx
tracks/        One directory per song, containing equal-length stems
```

## API

- `GET /api/state` — transport and mixer state
- `GET /api/genres` — available genre presets
- `GET /api/lyrics/word-timed` — word-level lyric timestamps for the mounted song
- `PUT /api/genres/{genre}` — apply a genre's stem levels and effects
- `POST /api/transport/play`
- `POST /api/transport/pause`
- `POST /api/transport/restart` — seek to zero and play
- `PUT /api/transport/speed` with `{ "speed": 1.1 }` (range `0.5..1.5`)
- `PUT /api/transport/seek` with `{ "position": 30 }` (seconds)
- `PUT /api/stems/{stem}/volume` with `{ "volume": 0.7 }` (range `0..1.5`)
- `GET /api/audio/live.mp3` — live audio stream
- `GET /health`

Interactive API documentation is available at <http://localhost:8000/docs>.

## Adding another song

Put synchronized stereo stems in one directory. Supported formats depend on
libsndfile; WAV and FLAC are good defaults. Change the `audio-engine` volume in
`compose.yaml` to mount the desired host directory at `/music`, then update the
filename list in `audio-engine/engine.scd`. Keep every stem the
same sample rate, channel count, start point, and duration.

## Time-stretch quality

The engine uses Rubber Band time-stretch processors with `pitchShift = 1`, so changing
tempo does not transpose the source. Every stem uses the same R3/Finer short-window engine and linked
stereo channels. Tempo, start, and seek commands are timestamped together.
Each instrument has its own smoothed gain after stretching, including complete mute.
The pinned native wrapper is vendored in `audio-engine/RubberBand.cpp`: it feeds input
until a full output block is available (avoiding injected silence), and finalizes input
to drain the end of the song correctly.
No pre-rendered tempo bank is needed; speed changes remain live. Pause freezes the processor
and fades the master to silence.

Large tempo changes can still sound processed, especially cymbal tails or artifacts
already present in separated stems. Start around 0.8–1.2× when judging quality.
Stretch analysis buffers and the live MP3 stream delay when a change becomes audible;
the API position remains a wall-clock estimate, not an audio-engine acknowledgement.

The JACK dummy device uses an 8192-sample period, synchronous processing and ordinary scheduling for Docker.
The plugin links Ubuntu's optimized Rubber Band library instead of compiling the basic
single-file FFT implementation. Engine and encoder buffering still add control latency.

For a production application, add authentication, persistent song metadata,
engine acknowledgements, and a streaming server/WebRTC layer. HTTP MP3 is simple
and useful for this test UI. The relay prebuffers three seconds for each new browser
connection to absorb short network or scheduler stalls. Volume and speed adjustments keep
one decoder connected: overlapping MP3 connections have different song positions and cause
echoes and phase cancellation. Seek/restart replaces the stream without overlapping it.
Edits become audible after the existing buffer. This is a live MP3 relay, not a timestamped
segment renderer; it cannot provide both instant edits and long look-ahead buffering.

Regression checks (run after building):

```sh
docker compose run --rm --no-deps --entrypoint python3 audio-engine /engine/tests/pitch.py
docker compose exec -T audio-engine python3 - < audio-engine/tests/live.py
```

The first renders 55 Hz and 440 Hz references through the actual native SC plugin at
0.5, 0.75, 1, 1.25, and 1.5x and checks pitch within five cents, output duration and
dropouts. The second tests each song stem solo/muted, tempo changes and pause silence.
