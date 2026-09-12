import asyncio
import unittest
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
                self.assertLess(track['voice'], len(main.VOICE_NAMES))

    def test_pop_preserves_every_source_track_and_voice(self):
        result = asyncio.run(main.apply_genre("pop"))
        self.assertEqual(result["genre"], "pop")
        self.assertTrue(all(track["active"] for track in result["tracks"]))
        self.assertEqual([track["voice"] for track in result["tracks"]], main.DEFAULT_VOICES)
        self.send.assert_any_call("/mixer/style", [0, 0])


if __name__ == "__main__":
    unittest.main()
