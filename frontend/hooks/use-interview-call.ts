import { useCallback, useEffect, useRef, useState } from "react"
import { getToken, api } from "@/lib/api"
import { useMediaPermissions } from "@/hooks/use-media-permissions"
import { useRecordingUpload } from "@/hooks/use-recording-upload"

export type CallStatus = "idle" | "connecting" | "active" | "ended" | "error"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
const TOTAL_QUESTIONS = 6

/** Owns session creation, the Gemini Live websocket, audio capture/playback,
 * on-device recording, and the interview timer. */
export function useInterviewCall(userId: string | null) {
  const [status, setStatus] = useState<CallStatus>("idle")
  const [timerSecs, setTimerSecs] = useState(0)
  const [hasRecording, setHasRecording] = useState(false)
  const [showCheckIn, setShowCheckIn] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState(0)

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [creatingSession, setCreatingSession] = useState(false)
  const [sessionError, setSessionError] = useState("")

  const {
    micDenied,
    setMicDenied,
    noCamera,
    setNoCamera,
    checkingMedia,
    audioOnly,
    setAudioOnly,
    checkMediaPermissions,
  } = useMediaPermissions()

  const wsRef = useRef<WebSocket | null>(null)
  const captureCtxRef = useRef<AudioContext | null>(null)
  const playbackCtxRef = useRef<AudioContext | null>(null)
  const workletRef = useRef<AudioWorkletNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const nextPlayAtRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const recordedBlobRef = useRef<Blob | null>(null)
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null)

  const { uploading, uploadError, uploaded } = useRecordingUpload(
    sessionId,
    hasRecording,
    recordedBlobRef,
  )

  useEffect(() => {
    if (status === "ended" && !hasRecording && chunksRef.current.length > 0) {
      const t = setTimeout(() => {
        if (!recordedBlobRef.current && chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: "video/webm" })
          recordedBlobRef.current = blob
          setHasRecording(true)
        }
      }, 1500)
      return () => clearTimeout(t)
    }
  }, [status, hasRecording])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startTimer = useCallback(() => {
    stopTimer()
    setTimerSecs(0)
    let secs = 0
    timerRef.current = setInterval(() => {
      secs++
      setTimerSecs(secs)
    }, 1000)
  }, [stopTimer])

  const stopCapture = useCallback(() => {
    workletRef.current?.disconnect()
    workletRef.current = null
    captureCtxRef.current?.close()
    captureCtxRef.current = null
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    playbackCtxRef.current?.close()
    playbackCtxRef.current = null
    audioDestRef.current = null
  }, [])

  const playPCM = useCallback((arrayBuffer: ArrayBuffer) => {
    let ctx = playbackCtxRef.current
    if (!ctx || ctx.state === "closed") {
      ctx = new AudioContext({ sampleRate: 24000 })
      playbackCtxRef.current = ctx
      nextPlayAtRef.current = 0
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
    } catch {
      // Audio not available
    }
  }, [])

  const endSession = useCallback(
    (closeWs = true) => {
      stopTimer()
      stopCapture()
      if (closeWs) {
        wsRef.current?.close()
        wsRef.current = null
      }
      nextPlayAtRef.current = 0
    },
    [stopTimer, stopCapture],
  )

  const createSession = useCallback(async (): Promise<string | null> => {
    const program = localStorage.getItem("program") || "General"
    const token = getToken()

    if (!token) {
      setSessionError("Not logged in. Please sign in again.")
      return null
    }

    setCreatingSession(true)
    setSessionError("")
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      }

      const res = await fetch(`${API_URL}/api/sessions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ userId, program }),
        credentials: "include",
      })

      const text = await res.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
        data = { detail: "Invalid response" }
      }

      if (data.sessionId) {
        setSessionId(data.sessionId)
        return data.sessionId
      }
      if (res.status === 409) {
        setSessionError("You have already completed your interview. Only one submission is allowed.")
        setStatus("ended")
        return null
      }
      setSessionError(data.detail || "Failed to create session")
      return null
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      setSessionError(`Session creation failed: ${msg}`)
      return null
    } finally {
      setCreatingSession(false)
    }
  }, [userId])

  const startPresentation = useCallback(async () => {
    setHasRecording(false)
    setShowCheckIn(false)
    setCurrentQuestion(0)
    recordedBlobRef.current = null
    chunksRef.current = []
    setStatus("connecting")
    setTimerSecs(0)

    const sid = await createSession()
    if (!sid) {
      setStatus("error")
      return
    }

    const media = await checkMediaPermissions()
    if (!media.hasAudio) {
      setMicDenied(true)
      setStatus("error")
      return
    }
    if (!media.hasVideo) {
      setAudioOnly(true)
      setNoCamera(true)
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const host = API_URL.replace(/.*\/\//, "").replace(/\/.*$/, "")
    const token = getToken()
    const ws = new WebSocket(`${protocol}//${host}/ws/${sid}${token ? `?token=${token}` : ""}`)
    ws.binaryType = "arraybuffer"
    wsRef.current = ws

    ws.onopen = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: media.hasVideo
            ? { facingMode: "user", width: { ideal: 1280 } }
            : false,
        })
        streamRef.current = stream

        if (videoRef.current && media.hasVideo) {
          videoRef.current.srcObject = stream
        }

        playbackCtxRef.current = new AudioContext({ sampleRate: 24000 })
        nextPlayAtRef.current = 0
        audioDestRef.current = playbackCtxRef.current.createMediaStreamDestination()

        const micSource = playbackCtxRef.current.createMediaStreamSource(stream)
        micSource.connect(audioDestRef.current)

        const mixedStream = new MediaStream([
          ...stream.getVideoTracks(),
          ...audioDestRef.current.stream.getAudioTracks(),
        ])

        const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
          ? "video/webm;codecs=vp9,opus"
          : "video/webm"
        const mr = new MediaRecorder(mixedStream, { mimeType })
        mediaRecorderRef.current = mr
        mr.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data)
        }
        mr.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: "video/webm" })
          recordedBlobRef.current = blob
          setHasRecording(true)
        }
        mr.start(1000)

        captureCtxRef.current = new AudioContext({ sampleRate: 16000 })
        await captureCtxRef.current.audioWorklet.addModule("/pcm-processor.js")
        const source = captureCtxRef.current.createMediaStreamSource(stream)
        workletRef.current = new AudioWorkletNode(captureCtxRef.current, "pcm-processor")
        workletRef.current.port.onmessage = (e) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(e.data)
        }
        source.connect(workletRef.current)

        startTimer()
        setStatus("active")
      } catch (err: unknown) {
        setStatus("error")
        ws.close()
      }
    }

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        playPCM(event.data)
        setShowCheckIn(false)
      } else {
        try {
          const msg = JSON.parse(event.data as string)

          if (msg.type === "status") {
            const questionMatch = msg.message?.match(/Question (\d+)/i)
            if (questionMatch) {
              setCurrentQuestion(parseInt(questionMatch[1]))
            }
            setShowCheckIn(false)
          } else if (msg.type === "check_in") {
            setShowCheckIn(true)
            playCheckInSound()
          } else if (msg.type === "error") {
            setStatus("error")
          } else if (msg.type === "interview_ended") {
            setShowCheckIn(false)
            setStatus("ended")
            endSession(false)
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    ws.onclose = () => {
      stopTimer()
      stopCapture()
      setStatus((s) => (s === "active" || s === "connecting" ? "ended" : s))
    }

    ws.onerror = () => {
      setStatus("error")
    }
  }, [startTimer, stopTimer, playPCM, endSession, stopCapture, createSession, checkMediaPermissions, playCheckInSound, setMicDenied, setAudioOnly, setNoCamera])

  useEffect(() => {
    return () => { endSession(true) }
  }, [])

  return {
    status,
    setStatus,
    timerSecs,
    showCheckIn,
    setShowCheckIn,
    currentQuestion,
    totalQuestions: TOTAL_QUESTIONS,
    sessionId,
    creatingSession,
    sessionError,
    micDenied,
    noCamera,
    checkingMedia,
    audioOnly,
    checkMediaPermissions,
    videoRef,
    startPresentation,
    endSession,
    uploading,
    uploadError,
    uploaded,
  }
}
