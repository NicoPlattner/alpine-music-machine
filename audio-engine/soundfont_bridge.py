#!/usr/bin/env python3
"""Translate local OSC messages from SuperCollider into FluidSynth commands."""

from __future__ import annotations

import socket
import struct
import sys


def osc_string(packet: bytes, offset: int) -> tuple[str, int]:
    end = packet.index(0, offset)
    value = packet[offset:end].decode("utf-8")
    return value, (end + 4) & ~3


def decode(packet: bytes) -> tuple[str, list[int | float]]:
    address, offset = osc_string(packet, 0)
    tags, offset = osc_string(packet, offset)
    values: list[int | float] = []
    for tag in tags[1:]:
        if tag == "i":
            values.append(struct.unpack_from(">i", packet, offset)[0])
            offset += 4
        elif tag == "f":
            values.append(struct.unpack_from(">f", packet, offset)[0])
            offset += 4
        else:
            raise ValueError(f"Unsupported OSC type: {tag}")
    return address, values


def command(address: str, values: list[int | float]) -> list[str]:
    numbers = [int(value) for value in values]
    if address == "/soundfont/note-on":
        channel, note, velocity, program = numbers
        bank = 128 if channel == 9 else 0
        return [f"select {channel} 1 {bank} {program}", f"noteon {channel} {note} {velocity}"]
    if address == "/soundfont/note-off":
        channel, note = numbers
        return [f"noteoff {channel} {note}"]
    if address == "/soundfont/cc":
        channel, controller, value = numbers
        return [f"cc {channel} {controller} {value}"]
    if address == "/soundfont/pitch-bend":
        channel, value = numbers
        return [f"pitch_bend {channel} {value}"]
    if address == "/soundfont/all-notes-off":
        return [f"cc {channel} 123 0" for channel in range(16)]
    return []


def main() -> None:
    receiver = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    receiver.bind(("127.0.0.1", 57130))
    while True:
        packet, _ = receiver.recvfrom(65535)
        try:
            address, values = decode(packet)
            for line in command(address, values):
                print(line, flush=True)
        except (ValueError, IndexError, struct.error) as error:
            print(f"Ignored malformed OSC packet: {error}", file=sys.stderr, flush=True)


if __name__ == "__main__":
    main()
