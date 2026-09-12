# Genre instrumentation

The source MIDI notes, timing, velocity, and 15 track layout remain unchanged.
Each preset selects which tracks play and the SuperCollider instrument voice for
each track. These are synthesized instruments, not sampled recordings.

| Genre | Arrangement |
|---|---|
| Pop | The default, unmodified MIDI arrangement: every source track plays with its closest original voice and no added master effects. |
| Ballad | Piano keys; cello bass; violin melody and strings; harp for both guitar parts; flute/clarinet high accents; French horns; soft ballad kit. |
| Rock | Picked bass; electric guitar melody, Saw Wave, and both guitar tracks; organ strings; rock kit; brass accents. |
| Techno | Synth bass; synth lead melody; synth keys, fills, Saw Wave, string pad, and brass stabs; techno kit; high flute-like accents. |

Pop has no omitted parts. Ballad, Rock, and Techno omit parts which would crowd
their arrangement. The frontend lists the actual assigned instrument for every
track. Tempo changes alter scheduling only, never MIDI pitch.

The authoritative map is `ARRANGEMENTS` in `backend/app/main.py`.
