#!/usr/bin/env python3
"""Create word-timed JSON and Enhanced LRC from an isolated vocal stem.

Requires Faster-Whisper. Example:
  /tmp/shape-of-you-alignment-venv/bin/python tools/align_vocals.py \
    tracks/shape-of-you/Shape\ of\ You\ Vocals.flac
"""

import argparse
import json
from pathlib import Path

def timestamp(seconds: float) -> str:
    """Format seconds for Enhanced LRC's mm:ss.cc timestamp syntax."""
    total_centiseconds = round(seconds * 100)
    minutes, centiseconds = divmod(total_centiseconds, 6000)
    return f"{minutes:02d}:{centiseconds // 100:02d}.{centiseconds % 100:02d}"


def write_elrc(words: list[dict], output: Path) -> None:
    # Start a new display line after a substantial vocal pause. ELRC supports a
    # timestamp immediately before each word, which makes it suitable for karaoke.
    lines: list[str] = []
    current: list[dict] = []
    def line(items: list[dict]) -> str:
        return (
            f"[{timestamp(items[0]['start'])}]"
            + " ".join(f"<{timestamp(item['start'])}>{item['word']}" for item in items)
            + f"<{timestamp(items[-1]['end'])}>"
        )

    for word in words:
        if current and (word["start"] - current[-1]["end"] > 1.0 or len(current) >= 10):
            lines.append(line(current))
            current = []
        current.append(word)
    if current:
        lines.append(line(current))
    output.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("audio", type=Path, nargs="?", help="isolated vocal audio file")
    parser.add_argument("--from-json", type=Path, help="export existing word-timed JSON without transcribing")
    parser.add_argument("--model", default="small.en", help="Faster-Whisper model name")
    parser.add_argument("--output-dir", type=Path, help="defaults to the audio directory")
    parser.add_argument("--start", type=float, help="clip start in seconds")
    parser.add_argument("--end", type=float, help="clip end in seconds")
    parser.add_argument("--suffix", default="", help="append text to output file names")
    parser.add_argument("--vad-filter", action="store_true", help="enable speech detection (can omit sung passages)")
    args = parser.parse_args()

    if args.from_json:
        import yaml
        data = json.loads(args.from_json.read_text(encoding="utf-8"))
        output_dir = args.output_dir or args.from_json.parent
        output_dir.mkdir(parents=True, exist_ok=True)
        write_elrc(data["words"], output_dir / "lyrics.elrc")
        (output_dir / "lyrics.yaml").write_text(yaml.safe_dump(data, sort_keys=False, allow_unicode=True), encoding="utf-8")
        print(f"Exported {len(data['words'])} words to ELRC and YAML")
        return
    if args.audio is None or not args.audio.is_file():
        parser.error("an existing audio file is required")
    if args.start is not None and args.start < 0:
        parser.error("--start must be nonnegative")
    if args.end is not None and args.end <= (args.start or 0):
        parser.error("--end must be greater than --start")

    from faster_whisper import WhisperModel

    output_dir = args.output_dir or args.audio.parent
    output_dir.mkdir(parents=True, exist_ok=True)
    model = WhisperModel(args.model, device="cpu", compute_type="int8")
    options = {
        "language": "en", "beam_size": 5, "word_timestamps": True,
        "vad_filter": args.vad_filter, "condition_on_previous_text": False,
    }
    if args.start is not None or args.end is not None:
        start = 0 if args.start is None else args.start
        options["clip_timestamps"] = str(start) if args.end is None else f"{start},{args.end}"
    segments, info = model.transcribe(str(args.audio), **options)

    words: list[dict] = []
    for segment in segments:
        for token in segment.words or []:
            if token.start is None or token.end is None:
                continue
            words.append({
                "word": token.word.strip(),
                "start": round(token.start, 3),
                "end": round(token.end, 3),
                "probability": round(token.probability, 4),
            })
            if token.probability < 0.5 or token.end <= token.start:
                words[-1]["needs_review"] = True
    words = [word for word in words if word["word"]]
    json_output = output_dir / f"lyrics.word-timed{args.suffix}.json"
    json_output.write_text(json.dumps({
        "language": info.language, "source": args.audio.name,
        "model": args.model, "method": "faster-whisper word timestamps",
        "time_unit": "seconds", "duration": info.duration,
        "review_status": "automatic, not manually verified", "words": words,
    }, indent=2) + "\n", encoding="utf-8")
    elrc_output = output_dir / f"lyrics{args.suffix}.elrc"
    write_elrc(words, elrc_output)
    print(f"Wrote {len(words)} words to {json_output} and {elrc_output}")


if __name__ == "__main__":
    main()
