#!/usr/bin/env python3

from pathlib import Path

verse_one = [
    "The club isn't the best place to find a lover",
    "So the bar is where I go (mm)",
    "Me and my friends at the table doing shots",
    "Drinking fast and then we talk slow (mm)",
    "Come over and start up a conversation with just me",
    "And trust me I'll give it a chance now (mm)",
    "Take my hand, stop, put Van the Man on the jukebox",
    "And then we start to dance, and now I'm singing like",
]

lines = verse_one

Path("tracks/shape-of-you/lyrics.canonical.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
