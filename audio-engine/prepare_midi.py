#!/usr/bin/env python3
"""Turn a standard MIDI file into a small SuperCollider data file.

No Python MIDI dependency is needed in the runtime image.  The output contains
one note list per MIDI track, preserving its instrument name and channel.
"""
from __future__ import annotations

import sys
from collections import defaultdict
from pathlib import Path


def vlq(data: bytes, index: int) -> tuple[int, int]:
    value = 0
    while True:
        byte = data[index]
        index += 1
        value = (value << 7) | (byte & 0x7F)
        if not byte & 0x80:
            return value, index


def quoted(value: str) -> str:
    return '"' + value.replace('\\', '\\\\').replace('"', '\\"') + '"'


def parse(path: Path) -> tuple[int, int, list[dict]]:
    raw = path.read_bytes()
    if raw[:4] != b"MThd" or int.from_bytes(raw[4:8], "big") != 6:
        raise ValueError("Expected a standard MIDI file")
    track_count = int.from_bytes(raw[10:12], "big")
    division = int.from_bytes(raw[12:14], "big")
    if division & 0x8000:
        raise ValueError("SMPTE MIDI timing is not supported")
    offset, tracks, bpm = 14, [], 120
    for number in range(track_count):
        if raw[offset:offset + 4] != b"MTrk":
            raise ValueError("Malformed MIDI track")
        length = int.from_bytes(raw[offset + 4:offset + 8], "big")
        data, offset = raw[offset + 8:offset + 8 + length], offset + 8 + length
        index = tick = 0
        running = None
        name = f"Track {number + 1}"
        active: dict[tuple[int, int], list[tuple[int, int]]] = defaultdict(list)
        notes: list[tuple[int, int, int, int]] = []
        while index < len(data):
            delta, index = vlq(data, index)
            tick += delta
            status = data[index]
            if status < 0x80:
                if running is None:
                    raise ValueError("Invalid running MIDI status")
                status = running
            else:
                index += 1
                running = status
            if status == 0xFF:
                meta_type, index = data[index], index + 1
                size, index = vlq(data, index)
                payload, index = data[index:index + size], index + size
                if meta_type == 0x03 and payload:
                    name = payload.decode("latin1", "replace").strip()
                elif meta_type == 0x51 and len(payload) == 3 and not tracks:
                    bpm = round(60_000_000 / int.from_bytes(payload, "big"))
                continue
            if status in (0xF0, 0xF7):
                size, index = vlq(data, index)
                index += size
                continue
            command, channel = status & 0xF0, status & 0x0F
            size = 1 if command in (0xC0, 0xD0) else 2
            payload, index = data[index:index + size], index + size
            if command == 0x90 and payload[1]:
                active[channel, payload[0]].append((tick, payload[1]))
            elif command == 0x80 or (command == 0x90 and not payload[1]):
                key = channel, payload[0]
                if active[key]:
                    start, velocity = active[key].pop(0)
                    notes.append((start, max(1, tick - start), payload[0], velocity))
        if notes:
            tracks.append({"id": f"track-{number}", "name": name, "channel": channel, "notes": notes})
    # Remove the file's empty count-in consistently across every instrument.
    first_tick = min(note[0] for track in tracks for note in track['notes'])
    for track in tracks:
        track['notes'] = sorted((start-first_tick, length, pitch, velocity)
                                for start, length, pitch, velocity in track['notes'])
    return division, bpm, tracks


def main() -> None:
    source, destination = map(Path, sys.argv[1:3])
    division, bpm, tracks = parse(source)
    lines = [f"~midiBpm={bpm};", f"~midiDivision={division};", "~midiTracks=["]
    for track in tracks:
        notes = ",".join("[%d,%d,%d,%d]" % note for note in track["notes"])
        lines.append(f"(id:{quoted(track['id'])},name:{quoted(track['name'])},channel:{track['channel']},notes:[{notes}]),")
    lines.append("];\n")
    destination.write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    main()
