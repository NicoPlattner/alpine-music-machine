export interface LeoAudioSignal { beat: number; level: number }
export interface LeoAudioDriver { signal: LeoAudioSignal; update: () => void }

export class LeoAudioController {
  readonly signal: LeoAudioSignal
  private readonly audio = new Audio(`${import.meta.env.BASE_URL}leo-visual/track.mp3`)
  private readonly context: AudioContext
  private readonly analyser: AnalyserNode
  private readonly data: Uint8Array<ArrayBuffer>
  private smoothedBeat = 0
  private smoothedLevel = 0
  private lastTimeReport = 0

  constructor(signal: LeoAudioSignal = { beat: 0, level: 0 }, private readonly onPlaybackTime?: (time: number) => void) {
    this.signal = signal
    this.audio.loop = true
    this.audio.preload = 'auto'
    this.context = new AudioContext()
    this.analyser = this.context.createAnalyser()
    this.analyser.fftSize = 512
    this.analyser.smoothingTimeConstant = 0.85
    this.data = new Uint8Array(this.analyser.frequencyBinCount)
    const source = this.context.createMediaElementSource(this.audio)
    source.connect(this.analyser)
    this.analyser.connect(this.context.destination)
  }

  async play() {
    await this.context.resume()
    await this.audio.play()
  }

  update() {
    this.analyser.getByteFrequencyData(this.data)
    let sum = 0
    for (const value of this.data) sum += value
    const level = sum / (this.data.length * 255)
    this.smoothedLevel += (level - this.smoothedLevel) * 0.06
    const bassBins = Math.max(1, Math.floor(this.data.length * 0.12))
    let bass = 0
    for (let index = 0; index < bassBins; index += 1) bass += this.data[index]
    bass /= bassBins * 255
    bass = Math.max(0, (bass - 0.5) / 0.5)
    this.smoothedBeat += (bass - this.smoothedBeat) * 0.09
    this.signal.level = this.smoothedLevel
    this.signal.beat = Math.min(1, this.smoothedBeat * 3)
    const now = performance.now()
    if (this.onPlaybackTime && now - this.lastTimeReport >= 100) {
      this.lastTimeReport = now
      this.onPlaybackTime(this.audio.currentTime)
    }
  }

  dispose() {
    this.audio.pause()
    this.audio.removeAttribute('src')
    this.audio.load()
    void this.context.close()
  }
}

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
