export interface LeoAudioSignal { beat: number; level: number }
export interface LeoAudioDriver { signal: LeoAudioSignal; update: () => void }

/** Leo's foreground uses microphone bass independently from the music-driven mountains. */
export class LeoMicrophoneAudioController {
  readonly signal: LeoAudioSignal
  private readonly context = new AudioContext()
  private readonly analyser = this.context.createAnalyser()
  private readonly data: Uint8Array<ArrayBuffer>
  private smoothedBeat = 0

  constructor(private readonly stream: MediaStream, signal: LeoAudioSignal = { beat: 0, level: 0 }) {
    this.signal = signal
    this.analyser.fftSize = 256
    this.analyser.smoothingTimeConstant = 0.84
    this.data = new Uint8Array(this.analyser.frequencyBinCount)
    this.context.createMediaStreamSource(stream).connect(this.analyser)
  }

  async start() { await this.context.resume() }

  update() {
    this.analyser.getByteFrequencyData(this.data)
    const bassBins = Math.max(1, Math.floor(this.data.length * 0.12))
    let bass = 0
    for (let index = 0; index < bassBins; index += 1) bass += this.data[index]
    bass /= bassBins * 255
    bass = Math.max(0, (bass - 0.5) / 0.5)
    this.smoothedBeat += (bass - this.smoothedBeat) * 0.09
    this.signal.beat = Math.min(1, this.smoothedBeat * 3)
  }

  dispose() {
    this.stream.getTracks().forEach((track) => track.stop())
    void this.context.close()
  }
}
