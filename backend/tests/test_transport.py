import asyncio
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from app import main


class TransportTests(unittest.TestCase):
    def setUp(self):
        self.state = patch.object(main, "state", main.MixerState())
        self.duration = patch.object(main, "DURATION", 240.0)
        self.osc = patch.object(main, "send_osc")
        self.state.start(); self.duration.start(); self.send = self.osc.start()
        self.addCleanup(patch.stopall)

    def test_seek_then_play_preserves_position(self):
        asyncio.run(main.seek(main.SeekChange(position=90)))
        result = asyncio.run(main.play())
        self.assertAlmostEqual(result["position"], 90, delta=.1)
        self.send.assert_any_call("/transport/seek", 90)

    def test_speed_changes_transport_not_midi_pitch(self):
        result = asyncio.run(main.set_speed(main.SpeedChange(speed=1.25)))
        self.assertEqual(result["speed"], 1.25)
        self.send.assert_called_with("/transport/speed", 1.25)

    def test_ballad_reassigns_midi_parts_to_acoustic_voices(self):
        result = asyncio.run(main.apply_genre("ballad"))
        tracks = {track["id"]: track for track in result["tracks"]}
        self.assertTrue(tracks["track-11"]["active"])
        self.assertTrue(tracks["track-10"]["active"])
        self.assertEqual(tracks["track-11"]["voice_name"], "Violin")
        self.assertEqual(tracks["track-4"]["voice_name"], "Violin")
        self.assertEqual(tracks["track-2"]["voice_name"], "Cello")
        self.send.assert_any_call("/midi/state", unittest.mock.ANY)

    def test_rock_and_techno_replace_synth_parts_with_suitable_instruments(self):
        rock = {track["id"]: track for track in asyncio.run(main.apply_genre("rock"))["tracks"]}
        self.assertEqual(rock["track-1"]["voice_name"], "Drawbar organ")
        self.assertEqual(rock["track-2"]["voice_name"], "Picked electric bass")
        self.assertEqual(rock["track-3"]["voice_name"], "Overdriven guitar")
        self.assertEqual(rock["track-8"]["voice_name"], "Overdriven guitar")
        self.assertEqual(rock["track-9"]["voice_name"], "Alto sax")

        techno = {track["id"]: track for track in asyncio.run(main.apply_genre("techno"))["tracks"]}
        self.assertEqual(techno["track-2"]["voice_name"], "Synth bass 1")
        self.assertEqual(techno["track-4"]["voice_name"], "Saw wave")
        self.assertEqual(techno["track-8"]["voice_name"], "Saw wave")
        self.assertEqual(techno["track-10"]["voice_name"], "TR-808 kit")
        self.assertLess(techno["track-10"]["gain"], techno["track-4"]["gain"])
        self.assertFalse(techno["track-6"]["active"])
        self.assertFalse(techno["track-7"]["active"])
        self.send.assert_any_call("/mixer/style", [.035, 0, 1])

    def test_manual_track_change_marks_arrangement_custom(self):
        asyncio.run(main.apply_genre("pop"))
        result = asyncio.run(main.set_track("track-3", main.TrackChange(active=True, gain=.5)))
        self.assertIsNone(result["genre"])
        self.assertTrue(next(track for track in result["tracks"] if track["id"] == "track-3")["active"])

    def test_unknown_track_is_rejected(self):
        with self.assertRaises(main.HTTPException) as raised:
            asyncio.run(main.set_track("nope", main.TrackChange(active=True)))
        self.assertEqual(raised.exception.status_code, 404)

    def test_every_arrangement_has_valid_distinct_instruments(self):
        for genre, voices in main.ARRANGEMENTS.items():
            self.assertEqual(len(voices), len(main.TRACKS))
            result = asyncio.run(main.apply_genre(genre))
            active = [t for t in result['tracks'] if t['active']]
            self.assertGreater(len({t['voice'] for t in active}), 1)
            for track in active:
                self.assertGreaterEqual(track['voice'], 0)
                self.assertLess(track['voice'], 128)

    def test_pop_preserves_every_source_track_and_program(self):
        result = asyncio.run(main.apply_genre("pop"))
        self.assertEqual(result["genre"], "pop")
        self.assertTrue(all(track["active"] for track in result["tracks"]))
        self.assertEqual([track["voice"] for track in result["tracks"]], main.SOURCE_PROGRAMS)
        self.assertTrue(all(track["gain"] == 1.0 for track in result["tracks"]))
        tracks = {track["id"]: track for track in result["tracks"]}
        self.assertEqual(tracks["track-2"]["voice_name"], "Synth bass 2")
        self.assertEqual(tracks["track-4"]["voice_name"], "Flute")
        self.assertEqual(tracks["track-6"]["voice_name"], "Synth drum")
        self.assertEqual(tracks["track-8"]["voice_name"], "Saw wave")
        self.send.assert_any_call("/mixer/style", [0, 0, 0])

    def test_word_timed_lyrics_are_loaded_from_the_mounted_song(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "lyrics.word-timed.json"
            path.write_text(json.dumps({"words": [{"word": "Never", "start": 1.0, "end": 1.4}]}), encoding="utf-8")
            with patch.object(main, "LYRICS_PATH", path):
                result = asyncio.run(main.get_word_timed_lyrics())
        self.assertEqual(result["words"][0]["word"], "Never")

    def test_missing_word_timed_lyrics_are_not_found(self):
        with patch.object(main, "LYRICS_PATH", Path("/tmp/no-such-lyrics.json")):
            with self.assertRaises(main.HTTPException) as raised:
                asyncio.run(main.get_word_timed_lyrics())
        self.assertEqual(raised.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
