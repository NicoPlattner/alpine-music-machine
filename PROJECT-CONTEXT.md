# Alpine Sound Machine — Project Context

## What we are building

Alpine Sound Machine is an interactive karaoke + music-remixing experience for a hackathon.

The user:
- sings into a microphone
- controls the experience with their right hand using webcam-based motion tracking
- remixes a prepared song
- triggers alpine-themed sound effects
- receives karaoke-style scoring and visual reactions

The experience should feel like a playful interactive performance/game, not a dashboard.

---

## Core user flow

1. Song Picker
2. Device Setup
   - microphone
   - camera
   - audio
3. Performance
4. Final Score
5. Play Again / Choose Another Song

The app must still be usable if microphone or camera hardware fails.

---

## Performance screen concept

The performance screen is ONE layered stage.

Do not use separate rectangular dashboard cards for the main experience.

### Visual hierarchy

Background:
- alpine environment
- mountain ridge acts as a SoundCloud-style audio waveform
- theme inspired by real alpine scenery:
  - blue sky
  - grey rock
  - glacier white
  - muted green
  - turquoise/deep green water

Upper / middle:
- mountain/audio waveform
- animated music reactions

Lower center:
- performer silhouette
- motion tracking overlay
- tracked right-hand/finger feedback

Lower middle:
- karaoke lyrics over/near the performer

Bottom left:
- Wolpertinger mascot
- reacts to singing/performance
- karaoke reactions such as:
  - PERFECT
  - +500
  - COMBO x8
  - double score
  - special reactions

Bottom center:
- song progress
- marmot runs/jumps along the progress path

Right side:
- Remix Toolbox
- large gesture-friendly controls
- selectable remix/equalizer controls
- alpine sound effects

Top:
- minimal HUD
- current song
- score
- optional LIVE indicator

---

## Interaction concept

The user holds the microphone in the LEFT hand.

The RIGHT hand controls the app.

Planned gesture model:

- index finger position -> cursor
- pinch -> select/grab
- vertical hand movement -> alter selected parameter
- horizontal movement -> alter/scrub parameter
- swipe -> possible special action
- release/drop -> trigger effect

The UI must always show visual feedback that the hand/finger was detected.

Gesture targets should be large and suitable for camera interaction, not tiny desktop controls.

---

## Alpine sound tools

Examples:

- falling rock
- flowing mountain water
- marmot scream
- cowbell
- wind
- alpine echo

These should be triggerable during the song.

A fun interaction may be:
grab a sound with a gesture -> drag/throw it into the song -> sound triggers.

---

## Remixing

The system may use prepared stems for the hackathon.

Do NOT make arbitrary-song stem separation a core demo dependency.

Possible controllable stems/effects:

- vocals
- drums
- bass
- other
- EQ
- reverb
- delay
- filter
- pitch/effect parameters

Possible preset modes:

- Original
- Alpine
- Techno
- other playful remix presets

"Genre changing" can be simulated through stems, effects and additional loops.

---

## Karaoke

Karaoke should support:

- timed lyrics
- current line
- optional next line
- later word-level highlighting
- microphone input
- pitch and/or loudness analysis
- score
- combo
- reactions
- final performance summary

For the hackathon, prepared timed lyrics and melody/reference data are acceptable.

Do not make speech-to-text a requirement.

Possible ratings:

- PERFECT
- GREAT
- GOOD
- MISS

The interface should have energetic Japanese-karaoke/game-like feedback.

---

## Final score screen

Should eventually show things such as:

- total score
- singing accuracy
- max combo
- alpine sounds used
- gestures/interactions
- Wolpertinger rank/reaction

Actions:
- Play Again
- Choose Another Song

---

## Team ownership

### Mark
Owns the main application/product flow:
- app architecture
- song picker
- device setup
- karaoke environment
- scoring
- final score
- motion tracking / gestures later
- integration of all systems

### Nico
Owns music/audio:
- song playback
- stems
- mixing
- effects
- remix controls
- alpine sound samples
- music engine/API

### Leo
Owns graphics/visual experience:
- mountain waveform visuals
- alpine scene
- Wolpertinger
- marmot
- animations
- reactions
- overall graphic direction

---

## Integration rule

Keep the main systems separate:

- audio
- karaoke
- motion
- visuals
- app/navigation/state

Do not tightly couple implementation details.

Prefer small, explicit interfaces.

Example future audio API:

play_song(song_id)
stop_song()

set_stem_volume("vocals", value)
set_stem_volume("drums", value)

set_effect("reverb", value)

trigger_sample("marmot")
trigger_sample("rockfall")

Example future app events:

karaoke score changed
combo changed
gesture detected
tool selected
sound triggered
song progress changed

---

## Hardware requirements

Development must work without a dedicated karaoke microphone.

Supported microphone sources may include:

- laptop internal microphone
- wired headset
- Bluetooth microphone
- USB microphone
- karaoke microphone
- audio interface

Camera/microphone failure must NOT completely block the app.

There should eventually be a device setup/check before performance.

---

## Current implementation direction

IMPORTANT:
The team is currently deciding between:

1. React + TypeScript + browser APIs
2. Godot

Do not assume the framework unless the current task explicitly confirms it.

If using React:
- React
- TypeScript
- Vite
- Zustand
- browser media APIs
- possible MediaPipe
- possible Tone.js/Web Audio

If using Godot:
- use a clean scene-based architecture
- keep karaoke/audio/motion/visual systems separate
- Leo can provide Godot-specific architecture guidance

The PRODUCT CONCEPT stays the same regardless of framework.

---

## Hackathon priorities

Prioritize:

1. reliable demo
2. clear interaction
3. visual feedback
4. fun
5. integration

Over:

- perfect abstraction
- arbitrary-song support
- production-grade infrastructure
- complicated ML
- unnecessary backend systems

A polished demo with 1–3 prepared songs is better than unreliable support for arbitrary songs.

---

## Codex working rules

Before implementing a task:

1. read this file
2. inspect the existing repository
3. preserve current architecture unless the task says otherwise
4. do not implement future phases unless explicitly requested
5. keep modules separable for team integration
6. run build/type checks after changes
7. report files changed and notable decisions
8. never redesign the core product concept without explicit instruction