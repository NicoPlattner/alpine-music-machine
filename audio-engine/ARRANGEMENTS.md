# Genre instrumentation

The source MIDI notes, timing, velocity, and 15 track layout remain unchanged.
Each preset selects which tracks play and which General MIDI program renders
each track. SuperCollider schedules one `Pbind` per track; FluidSynth renders
those events with the FluidR3 sampled SoundFont.

| Genre | Arrangement |
|---|---|
| Pop | The MIDI's original programs, unchanged: Electric Piano 2, Synth Bass 2, Clean Guitar, Flute, Piccolo, Synth Drum, Saw Wave, Soprano Sax, Strings, Trumpet, Brass, Whistle, Muted Guitar, and its standard drum kit. |
| Ballad | Grand piano, cello, harp, violin, flute, clarinet, strings, French horns, and brush kit. |
| Rock | Drawbar organ, picked bass, overdriven/distorted guitars, alto sax, trumpet, brass, and power kit. |
| Techno | Clear electric-piano chords, saw melody, the song's own synth-bass line, and a quiet pad. A restrained TR-808 kick and clap replace the original drums, aligned to the first source kick. No extra bass loop or fast hats; minimal reverb and no master drive. |

Pop has no omitted parts. Ballad, Rock, and Techno omit parts which would crowd
their arrangement. The frontend lists the actual assigned instrument for every
track. Tempo changes alter scheduling only, never MIDI pitch.

Pop uses the program-change values embedded in the file. The authoritative map
is `ARRANGEMENTS` in `backend/app/main.py`.
