import { useCallback, useEffect, useRef, useState } from "react"
import { getToken, api } from "@/lib/api"
import { useMediaPermissions } from "@/hooks/use-media-permissions"
import { useRecordingUpload } from "@/hooks/use-recording-upload"

export type CallStatus = "idle" | "connecting" | "reconnecting" | "active" | "ended" | "error"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
const TOTAL_QUESTIONS = 6
// B10: on an unexpected mid-interview close, retry the signaling socket to
// the same session_id instead of ending the call outright. Capped and
// backed off so a persistently dead network still fails visibly.
const MAX_RECONNECT_ATTEMPTS = 3
const RECONNECT_BASE_DELAY_MS = 1000

// Fallback copy for an abnormal close that arrives with no preceding "error"
// message frame. In the normal case the server (websocket.py/handler.py)
// always sends a specific message before closing with one of these codes,
// so this map is only ever a backstop, not the primary source of truth.
const CLOSE_CODE_MESSAGES: Record<number, string> = {
  4001: "Your session expired or you're not signed in. Please sign in again.",
  4003: "You do not have access to this interview session.",
  4004: "This interview session could not be found.",
  4008: "This interview already has an active connection open elsewhere.",
  4009: "This interview has already been completed.",
}

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
  // Server-configured interview length (settings.max_interview_duration),
  // returned by POST /api/sessions -- lets the timer's warning thresholds
  // track the actual configured duration instead of a hardcoded guess.
  const [maxDurationSecs, setMaxDurationSecs] = useState(300)
  // Populated from the server's typed "error" message, a ws close code, or a
  // local getUserMedia/socket failure -- the human-readable cause shown
  // alongside status === "error", instead of a bare "Connection error" pill.
  const [errorMessage, setErrorMessage] = useState("")

  const {
    micDenied,
    setMicDenied,
    noCamera,
    setNoCamera,
    cameraDenied,
    setCameraDenied,
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
  const scheduledSourcesRef = useRef<AudioBufferSourceNode[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // B10 reconnect bookkeeping. mediaReadyRef tracks whether the local
  // capture/recording pipeline has already been set up once -- reconnects
  // only need a new signaling socket, not a fresh getUserMedia() prompt.
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mediaReadyRef = useRef(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const recordedBlobRef = useRef<Blob | null>(null)
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null)

  const { uploading, uploadError, uploaded, retryUpload } = useRecordingUpload(
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
    // Closing playbackCtxRef does not stop this node's own output track --
    // it can stay "live" and keep the recording's audio track open.
    audioDestRef.current?.stream.getTracks().forEach((t) => t.stop())
    playbackCtxRef.current?.close()
    playbackCtxRef.current = null
    audioDestRef.current = null
    scheduledSourcesRef.current = []
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
      // Safari/iOS can hand back a suspended context; without resuming here
      // the scheduled audio below is silently dropped.
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

  const endSession = useCallback(
    (closeWs = true) => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
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

  const createSocket = useCallback((sid: string): WebSocket => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const host = API_URL.replace(/.*\/\//, "").replace(/\/.*$/, "")
    const token = getToken()
    const ws = new WebSocket(`${protocol}//${host}/ws/${sid}${token ? `?token=${token}` : ""}`)
    ws.binaryType = "arraybuffer"
    wsRef.current = ws
    return ws
  }, [])

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
        if (typeof data.maxDurationSecs === "number") {
          setMaxDurationSecs(data.maxDurationSecs)
        }
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
    setErrorMessage("")
    reconnectAttemptsRef.current = 0
    mediaReadyRef.current = false
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
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
      // checkMediaPermissions already set noCamera or cameraDenied,
      // distinguishing "no device" from "permission denied" -- just add the
      // audio-only fallback on top, don't stomp that distinction here.
      setAudioOnly(true)
    }

    // Attached to both the initial socket and every reconnect attempt.
    // mediaReadyRef distinguishes the two: the first successful open runs
    // the full getUserMedia/MediaRecorder/AudioWorklet setup below; every
    // later (re)connect just resumes streaming over the new socket.
    const attachSocketHandlers = (ws: WebSocket, sid: string) => {
      ws.onopen = async () => {
        if (mediaReadyRef.current) {
          reconnectAttemptsRef.current = 0
          setErrorMessage("")
          setStatus("active")
          return
        }
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
          if (playbackCtxRef.current.state === "suspended") {
            await playbackCtxRef.current.resume()
          }
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
          if (captureCtxRef.current.state === "suspended") {
            await captureCtxRef.current.resume()
          }
          await captureCtxRef.current.audioWorklet.addModule("/pcm-processor.js")
          const source = captureCtxRef.current.createMediaStreamSource(stream)
          workletRef.current = new AudioWorkletNode(captureCtxRef.current, "pcm-processor")
          workletRef.current.port.onmessage = (e) => {
            if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(e.data)
          }
          source.connect(workletRef.current)

          startTimer()
          mediaReadyRef.current = true
          setStatus("active")
        } catch (err: unknown) {
          setErrorMessage("Could not start your camera or microphone. Please check permissions and try again.")
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
              if (typeof msg.maxDurationSecs === "number") {
                setMaxDurationSecs(msg.maxDurationSecs)
              }
              setShowCheckIn(false)
            } else if (msg.type === "check_in") {
              setShowCheckIn(true)
              playCheckInSound()
            } else if (msg.type === "interrupted") {
              // User barged in on the agent -- drop any already-queued audio
              // for the turn that just got cut off instead of talking over them.
              flushPlayback()
            } else if (msg.type === "error") {
              // Server always sends this before closing (auth failure, ownership
              // mismatch, already-completed, duplicate connection, internal
              // error, etc.) -- surface its actual message instead of a
              // generic status.
              setErrorMessage(msg.message || "An unexpected error occurred.")
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

      ws.onclose = (event) => {
        setStatus((s) => {
          // A specific cause already arrived via the "error" message above --
          // don't stomp it with a generic one. The message frame always
          // precedes the close frame, so by the time this fires `s` already
          // reflects that update.
          if (s === "ended" || s === "error") {
            stopTimer()
            stopCapture()
            return s
          }
          if (s === "active" || s === "connecting" || s === "reconnecting") {
            // B10: only retry drops that happen after the interview was
            // actually running (mediaReadyRef) -- a fresh connection that
            // never opened, or a server-classified terminal error (which
            // already moved status to "error" above), should not retry.
            if (mediaReadyRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
              const attempt = reconnectAttemptsRef.current + 1
              reconnectAttemptsRef.current = attempt
              setErrorMessage(
                `Connection lost. Reconnecting… (attempt ${attempt}/${MAX_RECONNECT_ATTEMPTS})`,
              )
              const delay = RECONNECT_BASE_DELAY_MS * 2 ** (attempt - 1)
              reconnectTimeoutRef.current = setTimeout(() => {
                const newWs = createSocket(sid)
                attachSocketHandlers(newWs, sid)
              }, delay)
              return "reconnecting"
            }
            stopTimer()
            stopCapture()
            setErrorMessage(
              CLOSE_CODE_MESSAGES[event.code] ||
                (mediaReadyRef.current
                  ? "Connection lost and we couldn't reconnect. Please check your network and try again."
                  : "Connection lost. Please check your network and try again."),
            )
            return "error"
          }
          return s
        })
      }

      ws.onerror = () => {
        // onclose always follows and carries the close code, which is what we
        // need to classify the failure -- nothing to add here.
      }
    }

    const ws = createSocket(sid)
    attachSocketHandlers(ws, sid)
  }, [startTimer, stopTimer, playPCM, flushPlayback, endSession, stopCapture, createSession, createSocket, checkMediaPermissions, playCheckInSound, setMicDenied, setAudioOnly, setNoCamera])

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
    maxDurationSecs,
    errorMessage,
    micDenied,
    noCamera,
    cameraDenied,
    checkingMedia,
    audioOnly,
    checkMediaPermissions,
    videoRef,
    startPresentation,
    endSession,
    uploading,
    uploadError,
    uploaded,
    retryUpload,
  }
}
