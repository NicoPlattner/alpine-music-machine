Generate word timestamps from the repository's isolated vocal stem:

```bash
python3 -m venv /tmp/shape-of-you-alignment-venv
/tmp/shape-of-you-alignment-venv/bin/pip install -r tools/requirements-alignment.txt
HF_HOME=/tmp/shape-of-you-hf-cache /tmp/shape-of-you-alignment-venv/bin/python tools/align_vocals.py "tracks/shape-of-you/Shape of You Vocals.flac" --model small.en
/tmp/shape-of-you-alignment-venv/bin/python tools/align_vocals.py --from-json tracks/shape-of-you/lyrics.word-timed.json
```

The first run downloads the model. Transcription runs locally on the CPU.
Speech detection is disabled by default because it can miss sung passages.
The JSON and YAML contain word text, start/end seconds, and recognition probabilities.
Times refer to the original FLAC timeline, including its opening silence, at 1× speed.
The Enhanced LRC file has line timestamps and inline word timestamps; use a player
that supports Enhanced LRC. Lines wrap after ten words or a pause.

These are automatically transcribed lyrics with estimated word timings, not a
manually verified transcript or WhisperX forced alignment. Singing, overlapping
vocals, and repeated phrases can cause recognition and timing errors. Review
the JSON against the audio, then rerun `--from-json` to update YAML and ELRC.
Words with recognition probability below 0.5 or zero duration are marked
`needs_review`; other words may still contain errors. The supplied draft's
processing notes record the additional pass used to recover its final section.
