"""Exercise audio through nginx, including edits while playing (run in engine)."""
import array
import json
import math
import subprocess
import time
import urllib.request

BASE = 'http://frontend'

def api(path, method='GET', data=None):
    req = urllib.request.Request(BASE + '/api/' + path, method=method,
        data=json.dumps(data).encode() if data is not None else None,
        headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=10) as response:
        return json.load(response)

def measure(label, audible=True):
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i',
        BASE + '/api/audio/live.mp3?prebuffer=0.2', '-t', '2',
        '-f', 'f32le', '-ac', '1', '-ar', '8000', '-'], timeout=20)
    values = array.array('f', raw)
    rms = math.sqrt(sum(v*v for v in values)/len(values))
    print(f'{label}: RMS {rms:.6f}', flush=True)
    assert (rms > .0005) if audible else (rms < .0001), (label, rms)
    return rms

try:
    api('transport/pause', 'POST')
    api('genres/pop', 'PUT')
    api('transport/seek', 'PUT', {'position': 40})
    api('transport/play', 'POST')
    measure('default play')
    for genre in api('genres'):
        api('genres/' + genre['id'], 'PUT')
        api('transport/seek', 'PUT', {'position': 40})
        measure('live genre ' + genre['id'])
    for speed in [.5, 1.5, 1]:
        api('transport/speed', 'PUT', {'speed': speed})
        measure('speed ' + str(speed))
    for _ in range(2):
        api('transport/pause', 'POST')
        time.sleep(.4)
        measure('pause', False)
        api('transport/play', 'POST')
        measure('resume')
        api('transport/restart', 'POST')
        measure('restart')
    for track in api('state')['tracks']:
        api('tracks/' + track['id'], 'PUT', {'active': False})
    time.sleep(.4)
    measure('all tracks muted', False)
    api('genres/pop', 'PUT')
    api('transport/seek', 'PUT', {'position': 40})
    measure('pop restored')
    duration = api('state')['duration']
    api('transport/seek', 'PUT', {'position': duration - .2})
    time.sleep(.8)
    measure('end of song', False)
    assert not api('state')['playing']
finally:
    api('transport/pause', 'POST')
    api('genres/pop', 'PUT')
    api('transport/speed', 'PUT', {'speed': 1})
    api('transport/seek', 'PUT', {'position': 0})
