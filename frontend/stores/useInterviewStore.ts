import { create } from "zustand"
import { api, getWsBaseUrl } from "@/lib/api"
import { getStoredToken } from "@/lib/auth"
import { AudioPlaybackEngine } from "@/lib/audio"

export type CallStatus =
  | "idle"
  | "preflight"
  | "connecting"
  | "reconnecting"
  | "active"
  | "ended"
  | "error"

interface InterviewState {
  status: CallStatus
  sessionId: string | null
  timerSecs: number
  maxDurationSecs: number
  currentQuestion: number
  totalQuestions: number
  errorMessage: string

  // Audio / Visualizer states
  agentSpeaking: boolean
  userSpeaking: boolean
  audioLevel: number // 0 to 100 for mic volume bar
  showCheckIn: boolean

  // Media Permissions & Streams
  micGranted: boolean
  cameraGranted: boolean
  audioOnly: boolean
  localStream: MediaStream | null

  // Recording
  recordedBlob: Blob | null
  uploading: boolean
  uploaded: boolean
  uploadError: string

  // Actions
  initPreflight: () => Promise<boolean>
  startInterview: (userId: string, program: string) => Promise<void>
  endInterview: () => void
  retryUpload: () => Promise<void>
  reset: () => void
}

let ws: WebSocket | null = null
let captureCtx: AudioContext | null = null
let workletNode: AudioWorkletNode | null = null
let mediaRecorder: MediaRecorder | null = null
let recordedChunks: BlobPart[] = []
let timerInterval: ReturnType<typeof setInterval> | null = null
let analyserNode: AnalyserNode | null = null
let preflightCtx: AudioContext | null = null
let animFrame: number | null = null
const playbackEngine = new AudioPlaybackEngine()

export const useInterviewStore = create<InterviewState>((set, get) => ({
  status: "idle",
  sessionId: null,
  timerSecs: 0,
  maxDurationSecs: 300,
  currentQuestion: 1,
  totalQuestions: 6,
  errorMessage: "",

  agentSpeaking: false,
  userSpeaking: false,
  audioLevel: 0,
  showCheckIn: false,

  micGranted: false,
  cameraGranted: false,
  audioOnly: false,
  localStream: null,

  recordedBlob: null,
  uploading: false,
  uploaded: false,
  uploadError: "",

  initPreflight: async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: { facingMode: "user", width: { ideal: 1280 } },
      }).catch(async (err) => {
        // Fallback to audio only if camera is unavailable or denied
        console.warn("Camera failed, attempting audio-only:", err)
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: false,
        })
        set({ audioOnly: true, cameraGranted: false })
        return audioStream
      })

      // Setup analyser for mic meter
      if (preflightCtx && preflightCtx.state !== "closed") {
        preflightCtx.close().catch(() => {})
      }
      const aCtx = new AudioContext()
      preflightCtx = aCtx
      const source = aCtx.createMediaStreamSource(stream)
      const analyser = aCtx.createAnalyser()
      analyser.fftSize = 64
      source.connect(analyser)
      analyserNode = analyser

      const checkVolume = () => {
        if (!analyserNode) return
        const dataArray = new Uint8Array(analyserNode.frequencyBinCount)
        analyserNode.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i]
        }
        const avg = sum / dataArray.length
        set({ audioLevel: Math.min(100, Math.round((avg / 128) * 100)) })
        animFrame = requestAnimationFrame(checkVolume)
      }
      checkVolume()

      set({
        micGranted: true,
        cameraGranted: !get().audioOnly,
        localStream: stream,
        status: "preflight",
      })
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Media device permission denied"
      set({
        errorMessage: `Could not access camera/microphone: ${msg}`,
        status: "error",
      })
      return false
    }
  },

  startInterview: async (userId: string, program: string) => {
    const { localStream, audioOnly } = get()
    if (!localStream) {
      const ok = await get().initPreflight()
      if (!ok) return
    }

    set({ status: "connecting", errorMessage: "", timerSecs: 0 })

    try {
      // 1. Create interview session on backend
      const sessionData = await api.createSession(userId, program)
      const sessionId = sessionData.sessionId
      set({
        sessionId,
        maxDurationSecs: sessionData.maxDurationSecs || 300,
      })

      // 2. Initialize Playback Engine
      await playbackEngine.init()
      const currentStream = get().localStream!
      playbackEngine.mixMicrophone(currentStream)
      const audioDest = playbackEngine.getDestination()

      // 3. Start MediaRecorder on device
      recordedChunks = []
      const mixedTracks = [
        ...currentStream.getVideoTracks(),
        ...(audioDest ? audioDest.stream.getAudioTracks() : currentStream.getAudioTracks()),
      ]
      const mixedStream = new MediaStream(mixedTracks)
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm"
      mediaRecorder = new MediaRecorder(mixedStream, { mimeType })
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data)
      }
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: "video/webm" })
        set({ recordedBlob: blob })
        // Trigger auto upload
        get().retryUpload()
      }
      mediaRecorder.start(1000)

      // 4. Setup AudioWorklet for sending 16kHz Int16 PCM to backend
      captureCtx = new AudioContext({ sampleRate: 16000 })
      if (captureCtx.state === "suspended") {
        await captureCtx.resume()
      }
      await captureCtx.audioWorklet.addModule("/pcm-processor.js")
      const micSource = captureCtx.createMediaStreamSource(currentStream)
      workletNode = new AudioWorkletNode(captureCtx, "pcm-processor")

      // 5. Connect WebSocket
      const token = getStoredToken()
      const wsUrl = `${getWsBaseUrl()}/ws/${sessionId}${token ? `?token=${token}` : ""}`
      ws = new WebSocket(wsUrl)
      ws.binaryType = "arraybuffer"

      ws.onopen = () => {
        set({ status: "active" })
        // Tell backend recording started so timestamps align
        ws?.send(JSON.stringify({ type: "recording_started" }))

        // Stream audio buffers from worklet to websocket
        if (workletNode) {
          workletNode.port.onmessage = (e) => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(e.data)
            }
          }
          micSource.connect(workletNode)
        }

        // Start timer
        if (timerInterval) clearInterval(timerInterval)
        timerInterval = setInterval(() => {
          set((s) => ({ timerSecs: s.timerSecs + 1 }))
        }, 1000)
      }

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          // Received raw 24kHz PCM from Gemini Live
          set({ agentSpeaking: true, showCheckIn: false })
          playbackEngine.playPCM(event.data)
        } else {
          try {
            const msg = JSON.parse(event.data as string)
            if (msg.type === "interrupted") {
              playbackEngine.flush()
              set({ agentSpeaking: false })
            } else if (msg.type === "check_in") {
              set({ showCheckIn: true })
              playbackEngine.playCheckInChime()
            } else if (msg.type === "interview_ended") {
              get().endInterview()
            } else if (msg.type === "error") {
              set({ errorMessage: msg.message || "An unexpected error occurred", status: "error" })
            }
          } catch {
            // ignore
          }
        }
      }

      ws.onclose = () => {
        if (get().status === "active") {
          get().endInterview()
        }
      }

      ws.onerror = () => {
        set({ errorMessage: "Connection error with interview server", status: "error" })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to initialize interview"
      set({ errorMessage: msg, status: "error" })
    }
  },

  endInterview: () => {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
    if (animFrame) {
      cancelAnimationFrame(animFrame)
      animFrame = null
    }
    if (preflightCtx && preflightCtx.state !== "closed") {
      preflightCtx.close().catch(() => {})
      preflightCtx = null
    }

    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop()
    }
    workletNode?.disconnect()
    workletNode = null
    captureCtx?.close()
    captureCtx = null
    playbackEngine.stop()

    if (ws) {
      ws.close()
      ws = null
    }

    set({ status: "ended", agentSpeaking: false, showCheckIn: false })
  },

  retryUpload: async () => {
    const { sessionId, recordedBlob } = get()
    if (!sessionId || !recordedBlob) return

    set({ uploading: true, uploadError: "" })
    try {
      await api.uploadRecording(sessionId, recordedBlob)
      set({ uploading: false, uploaded: true })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed"
      set({ uploading: false, uploadError: msg })
    }
  },

  reset: () => {
    get().endInterview()
    const { localStream } = get()
    localStream?.getTracks().forEach((t) => t.stop())
    set({
      status: "idle",
      sessionId: null,
      timerSecs: 0,
      errorMessage: "",
      agentSpeaking: false,
      audioLevel: 0,
      showCheckIn: false,
      recordedBlob: null,
      uploading: false,
      uploaded: false,
      uploadError: "",
      localStream: null,
    })
  },
}))
