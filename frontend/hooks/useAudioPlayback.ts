import { useRef, useCallback } from "react"

export function useAudioPlayback() {
  const playbackCtxRef = useRef<AudioContext | null>(null)
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null)
  const scheduledSourcesRef = useRef<AudioBufferSourceNode[]>([])
  const nextPlayAtRef = useRef(0)

  const initPlayback = useCallback(async () => {
    if (!playbackCtxRef.current || playbackCtxRef.current.state === "closed") {
      playbackCtxRef.current = new AudioContext({ sampleRate: 24000 })
    }
    if (playbackCtxRef.current.state === "suspended") {
      await playbackCtxRef.current.resume()
    }
    nextPlayAtRef.current = 0
  }, [])

  const flushPlayback = useCallback(() => {
    scheduledSourcesRef.current.forEach((src) => {
      try {
        src.stop()
      } catch {
        // Already stopped/finished
      }
    })
    scheduledSourcesRef.current = []
    nextPlayAtRef.current = playbackCtxRef.current?.currentTime ?? 0
  }, [])

  const playPCM = useCallback((arrayBuffer: ArrayBuffer) => {
    let ctx = playbackCtxRef.current
    if (!ctx || ctx.state === "closed") {
      ctx = new AudioContext({ sampleRate: 24000 })
      playbackCtxRef.current = ctx
      nextPlayAtRef.current = 0
    }
    if (ctx.state === "suspended") {
      ctx.resume()
    }
    const int16 = new Int16Array(arrayBuffer)
    if (!int16.length) return
    const f32 = new Float32Array(int16.length)
    for (let i = 0; i < int16.length; i++) f32[i] = int16[i] / 32768
    const buf = ctx.createBuffer(1, f32.length, 24000)
    buf.getChannelData(0).set(f32)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    if (audioDestRef.current) {
      src.connect(audioDestRef.current)
    }
    src.onended = () => {
      scheduledSourcesRef.current = scheduledSourcesRef.current.filter((s) => s !== src)
    }
    scheduledSourcesRef.current.push(src)
    const t = Math.max(ctx.currentTime, nextPlayAtRef.current)
    src.start(t)
    nextPlayAtRef.current = t + buf.duration
  }, [])

  const playCheckInSound = useCallback(() => {
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      gain.gain.value = 0.15
      osc.start()
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      osc.stop(ctx.currentTime + 0.5)
      osc.onended = () => {
        ctx.close()
      }
    } catch {
      // Audio not available
    }
  }, [])

  const stopPlayback = useCallback(() => {
    audioDestRef.current?.stream.getTracks().forEach((t) => t.stop())
    playbackCtxRef.current?.close()
    playbackCtxRef.current = null
    audioDestRef.current = null
    scheduledSourcesRef.current = []
  }, [])

  return {
    playbackCtxRef,
    audioDestRef,
    initPlayback,
    flushPlayback,
    playPCM,
    playCheckInSound,
    stopPlayback,
  }
}
