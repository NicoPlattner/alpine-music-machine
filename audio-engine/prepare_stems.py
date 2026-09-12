"""Pack stereo stems as linked channels; never mix or normalize the sources."""
from contextlib import ExitStack
from pathlib import Path

import numpy as np
import soundfile as sf

STEMS = ("Backing", "Bass", "Drums", "Guitar", "Vocals")


def prepare(source=Path('/music'), target=Path('/tmp/linked-stems.wav')):
    Path('/tmp/mixer-ready').unlink(missing_ok=True)
    with ExitStack() as stack:
        inputs = [stack.enter_context(sf.SoundFile(source / f'Shape of You {stem}.flac'))
                  for stem in STEMS]
        reference = inputs[0]
        for stem, audio in zip(STEMS, inputs):
            if audio.channels != 2 or audio.samplerate != 48000 or len(audio) != len(reference):
                raise ValueError(f'{stem}: stems must be stereo, 48 kHz and equal length')
        output = stack.enter_context(sf.SoundFile(target, mode='w', samplerate=48000,
                                                  channels=2 * len(inputs), subtype='FLOAT'))
        for offset in range(0, len(reference), 65536):
            blocks = [audio.read(min(65536, len(reference) - offset), dtype='float32',
                                 always_2d=True) for audio in inputs]
            output.write(np.concatenate(blocks, axis=1))
    print(f'Prepared {len(STEMS)} linked stereo stems: {target}', flush=True)


if __name__ == '__main__':
    prepare()
