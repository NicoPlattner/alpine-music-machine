"""Exercise the running API, actual song stems and MP3 decoder."""
import json
import subprocess
import time
import urllib.request

import array
import math

BASE = 'http://backend:8000/api'


def call(path, body=None, method='PUT'):
    request = urllib.request.Request(BASE + path, method=method,
        data=json.dumps(body).encode() if body is not None else b'',
        headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(request, timeout=5) as response:
        return json.load(response)


def capture():
    result = subprocess.run(['ffmpeg', '-v', 'error', '-i', BASE + '/audio/live.mp3',
        '-t', '3', '-f', 'f32le', '-acodec', 'pcm_f32le', '-'],
        check=True, capture_output=True, timeout=15)
    audio = array.array('f', result.stdout)
    assert len(audio) > 48000 and all(math.isfinite(x) for x in audio)
    return math.sqrt(sum(x*x for x in audio) / len(audio))


with urllib.request.urlopen(BASE + '/state') as response:
    original = json.load(response)
try:
    call('/transport/pause', method='POST')
    for stem in original['volumes']:
        for other in original['volumes']:
            call(f'/stems/{other}/volume', {'volume': 1 if other == stem else 0})
        # Find an audible section in each source, including sparse backing parts.
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-i',
            f'/music/Shape of You {stem.title()}.flac', '-ac', '1', '-ar', '1000',
            '-f', 'f32le', '-'], check=True, capture_output=True).stdout
        source = array.array('f', raw)
        second = max(range(0, len(source)//1000-5),
            key=lambda n: sum(x*x for x in source[n*1000:(n+5)*1000]))
        call('/transport/seek', {'position': second})
        call('/transport/play', method='POST')
        rms = capture()
        assert rms > 0.001, (stem, 'silent solo stem')
        print(f'Solo {stem} RMS: {rms:.5f}', flush=True)
        call(f'/stems/{stem}/volume', {'volume': 0})
        time.sleep(0.5)
        rms = capture()
        assert rms < 0.0001, (stem, 'mute failed', rms)
        call('/transport/pause', method='POST')
    for stem in original['volumes']:
        call(f'/stems/{stem}/volume', {'volume': 1 if stem in ('bass', 'drums') else 0})
    call('/transport/seek', {'position': 30})
    call('/transport/play', method='POST')
    for speed in (0.75, 1, 1.25, 1.5):
        call('/transport/speed', {'speed': speed})
        rms = capture()
        assert rms > 0.001, (speed, 'silent stream')
        print(f'Live bass + drums {speed}x RMS: {rms:.5f}', flush=True)
    call('/transport/pause', method='POST')
    time.sleep(0.2)
    rms = capture()
    assert rms < 0.0001, ('pause is not silent', rms)
    print('Pause emits silence', flush=True)
finally:
    call('/transport/pause', method='POST')
    call('/transport/speed', {'speed': original['speed']})
    call('/transport/seek', {'position': original['position']})
    for stem, volume in original['volumes'].items():
        call(f'/stems/{stem}/volume', {'volume': volume})
    if original['playing']:
        call('/transport/play', method='POST')
