"""Exercise the actual SC UGen at 0.5x, 0.75x, 1x, 1.25x and 1.5x.

Run in the engine container: python3 /engine/tests/pitch.py
Uses stereo 55 Hz bass / 440 Hz voice-range reference tones and checks pitch,
rendered duration, channel isolation and interior silence (dropouts).
"""
import array
import math
import os
import subprocess
import wave

SR = 48000
samples = array.array('h')
for i in range(3 * SR):
    for frequency in (55, 440):
        samples.append(round(12000 * math.sin(2 * math.pi * frequency * i / SR)))
with wave.open('/tmp/pitch-input.wav', 'wb') as output:
    output.setparams((2, 2, SR, 0, 'NONE', 'not compressed'))
    output.writeframes(samples.tobytes())

for speed in (0.5, 0.75, 1, 1.25, 1.5):
    result = subprocess.run(['sclang', '-D', '/engine/tests/pitch.scd'],
        env={**os.environ, 'TEST_SPEED': str(speed)}, capture_output=True, timeout=60)
    assert result.returncode == 0, result.stdout.decode() + result.stderr.decode()
    with wave.open('/tmp/pitch-output.wav', 'rb') as source:
        data = array.array('h', source.readframes(source.getnframes()))
    for channel, expected in enumerate((55, 440)):
        signal = data[channel::2]
        # Exclude startup and final settling from the frequency measurement.
        middle = signal[SR // 2:int((3 / speed - 0.3) * SR)]
        crossings = [i for i in range(1, len(middle)) if middle[i-1] <= 0 < middle[i]]
        measured = (len(crossings)-1) * SR / (crossings[-1]-crossings[0])
        cents = 1200 * math.log2(measured / expected)
        assert abs(cents) < 5, (speed, channel, measured, cents)
        for offset in range(0, len(middle)-4800, 4800):
            rms = math.sqrt(sum(x*x for x in middle[offset:offset+4800])/4800)
            assert rms > 2000, (speed, channel, 'dropout', offset, rms)
        last = max(i for i, x in enumerate(signal) if abs(x) > 500) / SR
        assert abs(last - 3/speed) < 0.12, (speed, 'tail duration', last, 3/speed)
        print(f'{speed}x channel {channel}: {measured:.3f} Hz, {cents:.2f} cents, end {last:.3f}s')
print('PASS: pitch, channel separation, duration and dropout checks')
