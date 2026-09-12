import asyncio
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from app import main


class TransportTests(unittest.TestCase):
    def setUp(self):
        self.state = patch.object(main, 'state', main.MixerState())
        self.duration = patch.object(main, 'DURATION', 240.0)
        self.osc = patch.object(main, 'send_osc')
        self.state.start()
        self.duration.start()
        self.send = self.osc.start()
        self.addCleanup(patch.stopall)

    def test_seek_then_play_preserves_position(self):
        asyncio.run(main.seek(main.SeekChange(position=90)))
        result = asyncio.run(main.play())
        self.assertAlmostEqual(result['position'], 90, delta=0.1)
        self.send.assert_any_call('/transport/seek', 90)
        self.assertTrue(result['playing'])

    def test_restart_preserves_mixer_and_tempo(self):
        main.state.position = 120
        main.state.speed = 1.25
        main.state.volumes['bass'] = 0.4
        result = asyncio.run(main.restart())
        self.assertLess(result['position'], 0.1)
        self.assertTrue(result['playing'])
        self.assertEqual(result['speed'], 1.25)
        self.assertEqual(result['volumes']['bass'], 0.4)
        self.send.assert_any_call('/transport/seek', 0.0)

    def test_finished_track_stops_and_can_replay(self):
        main.state.position = 240
        main.state.playing = True
        self.assertFalse(main.response_state()['playing'])
        self.send.assert_called_with('/transport/pause')
        result = asyncio.run(main.play())
        self.assertTrue(result['playing'])
        self.assertLess(result['position'], 0.1)

    def test_genre_preset_updates_levels_and_effects_atomically(self):
        result = asyncio.run(main.apply_genre('hip-hop'))
        self.assertEqual(result['genre'], 'hip-hop')
        self.assertEqual(result['volumes']['bass'], 1.35)
        self.assertEqual(result['effects']['bass'], 6.0)
        self.send.assert_any_call('/mixer/volume', ['bass', 1.35])
        self.send.assert_any_call('/mixer/effects', [6.0, 1.0, 0.08, 0.65])

    def test_manual_level_change_marks_mix_as_custom(self):
        main.state.genre = 'pop'
        result = asyncio.run(main.set_volume('bass', main.VolumeChange(volume=0.7)))
        self.assertIsNone(result['genre'])

    def test_unknown_genre_is_rejected(self):
        with self.assertRaises(main.HTTPException) as raised:
            asyncio.run(main.apply_genre('polka'))
        self.assertEqual(raised.exception.status_code, 404)

    def test_word_timed_lyrics_are_loaded_from_song_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            lyrics_path = Path(directory) / 'lyrics.word-timed.json'
            lyrics_path.write_text(json.dumps({
                'language': 'en',
                'words': [{'word': 'Hello', 'start': 1.2, 'end': 1.5}],
            }), encoding='utf-8')
            with patch.object(main, 'LYRICS_PATH', lyrics_path):
                result = asyncio.run(main.get_word_timed_lyrics())
        self.assertEqual(result['words'][0]['word'], 'Hello')
        self.assertEqual(result['words'][0]['start'], 1.2)

    def test_missing_word_timed_lyrics_return_not_found(self):
        with patch.object(main, 'LYRICS_PATH', Path('/tmp/missing-lyrics.word-timed.json')):
            with self.assertRaises(main.HTTPException) as raised:
                asyncio.run(main.get_word_timed_lyrics())
        self.assertEqual(raised.exception.status_code, 404)


if __name__ == '__main__':
    unittest.main()
