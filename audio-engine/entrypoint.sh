#!/usr/bin/env bash
set -euo pipefail

export JACK_NO_AUDIO_RESERVATION=1
export XDG_RUNTIME_DIR=/tmp/supercollider-runtime
mkdir -p "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR"
backend_url="${BACKEND_INGEST_URL:-http://backend:8000/internal/audio}"
# Docker restarts preserve /tmp inside the same container. Never accept a
# readiness marker written by a previous SuperCollider process.
rm -f /tmp/mixer-ready
python3 /engine/prepare_midi.py /music/Never-Gonna-Give-You-Up-1.mid /tmp/midi-arrangement.scd

# MIDI scheduling uses a 21 ms audio period at 48 kHz.
jackd --sync --no-realtime -d dummy -r 48000 -p 1024 -w 21333 &
jack_pid=$!

sclang_pid=""
ffmpeg_pid=""
soundfont_pid=""
cleanup() {
    for child in "$ffmpeg_pid" "$sclang_pid" "$soundfont_pid" "$jack_pid"; do
        if [ -n "$child" ]; then kill "$child" 2>/dev/null || true; fi
    done
}
trap cleanup EXIT
trap 'exit 0' INT TERM

for _ in $(seq 1 50); do
    jack_lsp >/dev/null 2>&1 && break
    sleep 0.1
done
jack_lsp >/dev/null 2>&1 || { echo 'JACK failed to start' >&2; exit 1; }

# FluidSynth turns the Pbind note messages into sampled General MIDI audio.
# --no-midi-in is intentional: a tiny local OSC bridge writes to its shell.
python3 -u /engine/soundfont_bridge.py | fluidsynth --no-midi-in \
    -a jack -r 48000 -g 0.8 \
    -o synth.reverb.active=0 -o synth.chorus.active=0 \
    /usr/share/sounds/sf2/FluidR3_GM.sf2 &
soundfont_pid=$!

for _ in $(seq 1 100); do
    jack_lsp 2>/dev/null | grep -q '^fluidsynth:left$' && break
    kill -0 "$soundfont_pid" || exit 1
    sleep 0.1
done
jack_lsp 2>/dev/null | grep -q '^fluidsynth:left$' || { echo 'FluidSynth failed to become ready' >&2; exit 1; }

sclang -D -r -u 57120 /engine/engine.scd &
sclang_pid=$!

for _ in $(seq 1 600); do
    test -f /tmp/mixer-ready && break
    kill -0 "$sclang_pid" || exit 1
    sleep 0.1
done
test -f /tmp/mixer-ready || { echo 'Mixer failed to become ready' >&2; exit 1; }

jack_connect fluidsynth:left SuperCollider:in_1
jack_connect fluidsynth:right SuperCollider:in_2

ffmpeg -hide_banner -loglevel warning \
    -use_wallclock_as_timestamps 1 -f jack -ac 2 -i live-mixer \
    -af asetpts=N/SR/TB -ac 2 -ar 48000 -codec:a libmp3lame -b:a 192k \
    -content_type audio/mpeg -f mp3 -method PUT "$backend_url" &
ffmpeg_pid=$!

for _ in $(seq 1 50); do
    if jack_lsp 2>/dev/null | grep -q '^live-mixer:input_1$'; then
        jack_connect SuperCollider:out_1 live-mixer:input_1
        jack_connect SuperCollider:out_2 live-mixer:input_2
        break
    fi
    sleep 0.1
done

wait -n "$ffmpeg_pid" "$sclang_pid" "$soundfont_pid" "$jack_pid"
