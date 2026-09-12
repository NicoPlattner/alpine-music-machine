import importlib.util
import struct
import unittest
from pathlib import Path


MODULE = Path(__file__).parents[1] / "soundfont_bridge.py"
spec = importlib.util.spec_from_file_location("soundfont_bridge", MODULE)
bridge = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(bridge)


class SoundfontBridgeTests(unittest.TestCase):
    def test_decodes_supercollider_integer_osc_message(self):
        def padded(value):
            raw = value.encode() + b"\0"
            return raw + b"\0" * (-len(raw) % 4)

        packet = padded("/soundfont/note-off") + padded(",ii") + struct.pack(">ii", 3, 60)
        self.assertEqual(bridge.decode(packet), ("/soundfont/note-off", [3, 60]))

    def test_melodic_note_selects_requested_gm_program(self):
        self.assertEqual(
            bridge.command("/soundfont/note-on", [2, 64, 100, 27]),
            ["select 2 1 0 27", "noteon 2 64 100"],
        )

    def test_drum_channel_uses_gm_percussion_bank(self):
        self.assertEqual(
            bridge.command("/soundfont/note-on", [9, 36, 110, 16])[0],
            "select 9 1 128 16",
        )

    def test_stop_releases_every_channel(self):
        commands = bridge.command("/soundfont/all-notes-off", [])
        self.assertEqual(len(commands), 16)
        self.assertEqual(commands[9], "cc 9 123 0")


if __name__ == "__main__":
    unittest.main()
