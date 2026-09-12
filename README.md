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
