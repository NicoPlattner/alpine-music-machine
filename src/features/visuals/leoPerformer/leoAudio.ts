export interface LeoAudioSignal { beat: number; level: number }
export interface LeoAudioDriver { signal: LeoAudioSignal; update: () => void }

interface Smoothed { beat: number; level: number }

function updateSignalFromAnalyser(analyser: AnalyserNode, data: Uint8Array<ArrayBuffer>, smoothed: Smoothed, signal: LeoAudioSignal) {
  analyser.getByteFrequencyData(data)
  const bassBins = Math.max(1, Math.floor(data.length * 0.12))
  let bass = 0
  for (let index = 0; index < bassBins; index += 1) bass += data[index]
  bass /= bassBins * 255
  bass = Math.max(0, (bass - 0.5) / 0.5)
  smoothed.beat += (bass - smoothed.beat) * 0.09
  signal.beat = Math.min(1, smoothed.beat * 3)

  let overall = 0
  for (let index = 0; index < data.length; index += 1) overall += data[index]
  overall /= data.length * 255
  smoothed.level += (overall - smoothed.level) * 0.12
  signal.level = Math.min(1, smoothed.level * 2.2)
}

/** Leo's foreground (the singer's point-cloud) reacts to the karaoke microphone. */
export class LeoMicrophoneAudioController {
  readonly signal: LeoAudioSignal
  private readonly context = new AudioContext()
  private readonly analyser = this.context.createAnalyser()
  private readonly data: Uint8Array<ArrayBuffer>
  private readonly smoothed: Smoothed = { beat: 0, level: 0 }

  constructor(private readonly stream: MediaStream, signal: LeoAudioSignal = { beat: 0, level: 0 }) {
    this.signal = signal
    this.analyser.fftSize = 256
    this.analyser.smoothingTimeConstant = 0.84
    this.data = new Uint8Array(this.analyser.frequencyBinCount)
    this.context.createMediaStreamSource(stream).connect(this.analyser)
  }

  async start() { await this.context.resume() }

  update() { updateSignalFromAnalyser(this.analyser, this.data, this.smoothed, this.signal) }

  dispose() {
    this.stream.getTracks().forEach((track) => track.stop())
    void this.context.close()
  }
}

/** Leo's mountain background reacts to the backend's song stream, independent of the singer's mic. */
export class LeoSongAudioController {
  readonly signal: LeoAudioSignal
  private readonly context = new AudioContext()
  private readonly analyser = this.context.createAnalyser()
  private readonly data: Uint8Array<ArrayBuffer>
  private readonly smoothed: Smoothed = { beat: 0, level: 0 }

  constructor(element: HTMLMediaElement, signal: LeoAudioSignal = { beat: 0, level: 0 }) {
    this.signal = signal
    this.analyser.fftSize = 256
    this.analyser.smoothingTimeConstant = 0.84
    this.data = new Uint8Array(this.analyser.frequencyBinCount)
    const source = this.context.createMediaElementSource(element)
    source.connect(this.analyser)
    // A MediaElementAudioSourceNode reroutes the element's output entirely
    // through the Web Audio graph, so it must be reconnected to speakers.
    this.analyser.connect(this.context.destination)
  }

  async start() { await this.context.resume() }

  update() { updateSignalFromAnalyser(this.analyser, this.data, this.smoothed, this.signal) }

  dispose() { void this.context.close() }
}
