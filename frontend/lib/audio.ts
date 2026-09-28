/**
 * Audio playback utility for handling raw 24kHz Int16 PCM streamed from Gemini Live API
 */

export class AudioPlaybackEngine {
  private ctx: AudioContext | null = null
  private dest: MediaStreamAudioDestinationNode | null = null
  private scheduledSources: AudioBufferSourceNode[] = []
  private nextPlayAt = 0

  async init(): Promise<void> {
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext({ sampleRate: 24000 })
    }
    if (this.ctx.state === "suspended") {
      await this.ctx.resume()
    }
    this.dest = this.ctx.createMediaStreamDestination()
    this.nextPlayAt = 0
  }

  getDestination(): MediaStreamAudioDestinationNode | null {
    return this.dest
  }

  mixMicrophone(stream: MediaStream): void {
    if (!this.ctx || !this.dest) return
    const micSource = this.ctx.createMediaStreamSource(stream)
    micSource.connect(this.dest)
  }

  flush(): void {
    for (const src of this.scheduledSources) {
      try {
        src.stop()
      } catch {
        // already stopped
      }
    }
    this.scheduledSources = []
    this.nextPlayAt = this.ctx?.currentTime ?? 0
  }

  playPCM(arrayBuffer: ArrayBuffer): void {
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext({ sampleRate: 24000 })
      this.nextPlayAt = 0
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume()
    }

    const int16 = new Int16Array(arrayBuffer)
    if (!int16.length) return

    const f32 = new Float32Array(int16.length)
    for (let i = 0; i < int16.length; i++) {
      f32[i] = int16[i] / 32768
    }

    const buf = this.ctx.createBuffer(1, f32.length, 24000)
    buf.getChannelData(0).set(f32)

    const src = this.ctx.createBufferSource()
    src.buffer = buf
    src.connect(this.ctx.destination)
    if (this.dest) {
      src.connect(this.dest)
    }

    src.onended = () => {
      this.scheduledSources = this.scheduledSources.filter((s) => s !== src)
    }
    this.scheduledSources.push(src)

    const t = Math.max(this.ctx.currentTime, this.nextPlayAt)
    src.start(t)
    this.nextPlayAt = t + buf.duration
  }

  playCheckInChime(): void {
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880 // A5 pleasant chime
      gain.gain.value = 0.15
      osc.start()
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      osc.stop(ctx.currentTime + 0.5)
      osc.onended = () => ctx.close()
    } catch {
      // Audio autoplay restrictions or context unavailable
    }
  }

  stop(): void {
    this.dest?.stream.getTracks().forEach((t) => t.stop())
    this.ctx?.close()
    this.ctx = null
    this.dest = null
    this.scheduledSources = []
  }
}
