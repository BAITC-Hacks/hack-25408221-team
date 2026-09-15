"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Mic, MicOff, PhoneOff, Video, AlertCircle, Loader2, Home, ArrowLeft, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { AppHeader } from "@/components/app-header"
import { getToken, api } from "@/lib/api"

type Status = "idle" | "connecting" | "active" | "ended" | "error"
type ScreenState = "instructions" | "active" | "completed"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export default function VideoPresentationPage() {
  const router = useRouter()
  const [screenState, setScreenState] = useState<ScreenState>("instructions")
  const [status, setStatus] = useState<Status>("idle")
  const [timerSecs, setTimerSecs] = useState(0)
  const [hasRecording, setHasRecording] = useState(false)
  const [showCheckIn, setShowCheckIn] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [totalQuestions] = useState(6)
  const [showConfetti, setShowConfetti] = useState(false)

  const [userId, setUserId] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [creatingSession, setCreatingSession] = useState(false)
  const [sessionError, setSessionError] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const [uploaded, setUploaded] = useState(false)

  const [micDenied, setMicDenied] = useState(false)
  const [noCamera, setNoCamera] = useState(false)
  const [checkingMedia, setCheckingMedia] = useState(false)
  const [audioOnly, setAudioOnly] = useState(false)

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

  useEffect(() => {
    const uid = localStorage.getItem("userId")
    if (!uid || uid === "undefined" || uid === "null") {
      localStorage.removeItem("userId")
      localStorage.removeItem("userName")
      localStorage.removeItem("userEmail")
      router.replace("/signin")
      return
    }
    setUserId(uid)
    setAuthChecked(true)
  }, [router])

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

  useEffect(() => {
    if (!hasRecording || !recordedBlobRef.current || !sessionId || uploaded || uploading) return
    setUploading(true)
    setUploadError("")
    api.uploadRecording(sessionId, recordedBlobRef.current)
      .then(() => setUploaded(true))
      .catch(() => setUploadError("Recording upload failed. Your interview was completed but the video could not be saved."))
      .finally(() => setUploading(false))
  }, [hasRecording, sessionId, uploaded, uploading])

  useEffect(() => {
    if (status === "ended" && screenState === "active") {
      setScreenState("completed")
      setShowConfetti(true)
      localStorage.setItem("videoSubmitted", "true")
    }
  }, [status])

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
        setScreenState("completed")
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

  const checkMediaPermissions = useCallback(async () => {
    setCheckingMedia(true)
    setMicDenied(false)
    setNoCamera(false)

    let hasAudio = false
    let hasVideo = false

    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      hasAudio = true
      audioStream.getTracks().forEach((t) => t.stop())
    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : ""
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setMicDenied(true)
      }
    }

    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: true })
      hasVideo = true
      videoStream.getTracks().forEach((t) => t.stop())
    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : ""
      if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "NotReadableError") {
        setNoCamera(true)
      }
    }

    setCheckingMedia(false)
    return { hasAudio, hasVideo }
  }, [])

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
        const msg = err instanceof Error ? err.message : "Unknown error"
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
  }, [startTimer, stopTimer, playPCM, endSession, stopCapture, createSession, checkMediaPermissions, playCheckInSound])

  useEffect(() => {
    return () => { endSession(true) }
  }, [])

  const mm = String(Math.floor(timerSecs / 60)).padStart(2, "0")
  const ss = String(timerSecs % 60).padStart(2, "0")
  const timerColor =
    timerSecs >= 270 ? "text-red-500" : timerSecs >= 210 ? "text-yellow-500" : "text-foreground"

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // PRE-CALL INSTRUCTIONS SCREEN
  if (screenState === "instructions") {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        
        <main className="container mx-auto px-4 py-8">
          <Card className="mx-auto max-w-2xl">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Video className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Before We Begin</CardTitle>
              <CardDescription>
                Please review the following guidelines to ensure a fair screening process
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg bg-green-50 p-4 dark:bg-green-950">
                <Check className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">Quiet, private location</p>
                  <p className="text-sm text-green-700 dark:text-green-300">Ensure you're in a space without background noise or interruptions</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg bg-green-50 p-4 dark:bg-green-950">
                <Check className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">Face clearly visible</p>
                  <p className="text-sm text-green-700 dark:text-green-300">Position your camera so your entire face is visible throughout the call</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg bg-green-50 p-4 dark:bg-green-950">
                <Check className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">No other devices nearby</p>
                  <p className="text-sm text-green-700 dark:text-green-300">Keep phones and other devices away from your testing area</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg bg-green-50 p-4 dark:bg-green-950">
                <Check className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">No notes or references</p>
                  <p className="text-sm text-green-700 dark:text-green-300">Do not have any notes, books, or reference materials visible</p>
                </div>
              </div>

              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Important Warning</AlertTitle>
                <AlertDescription>
                  Any suspicious behavior or cheating attempts will result in automatic disqualification
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button 
                onClick={() => setScreenState("active")} 
                className="w-full h-12 text-base"
                size="lg"
              >
                I Understand - Start Screening Call
              </Button>
              <Button
                variant="ghost"
                onClick={() => router.push("/apply/form")}
                className="w-full"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Application
              </Button>
            </CardFooter>
          </Card>
        </main>
      </div>
    )
  }

  // POST-CALL COMPLETED SCREEN
  if (screenState === "completed") {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        
        <main className="container mx-auto px-4 py-8">
          {showConfetti && (
            <div className="confetti-container">
              {[...Array(50)].map((_, i) => (
                <div
                  key={i}
                  className="confetti"
                  style={{
                    left: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 3}s`,
                    backgroundColor: ['#CDFA1A', '#6B8E23', '#00AFCA', '#FFD700', '#FF6B6B'][Math.floor(Math.random() * 5)]
                  }}
                />
              ))}
            </div>
          )}

          <Card className="mx-auto max-w-2xl text-center">
            <CardHeader>
              <div className="mx-auto mb-4 relative">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
                  <Check className="h-12 w-12 text-primary" />
                </div>
                <span className="absolute -right-2 -top-2 text-4xl">🎉</span>
              </div>
              
              <CardTitle className="text-3xl text-green-600 dark:text-green-400">
                Screening Call Completed!
              </CardTitle>
              <CardDescription className="text-lg">
                Thank you for completing your screening call. Your responses have been recorded successfully.
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {uploading && (
                <div className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  Uploading your recording…
                </div>
              )}
              {uploadError && (
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                  {uploadError}
                </div>
              )}
              {uploaded && (
                <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
                  <Check className="mr-2 inline h-4 w-4" />
                  Recording saved successfully.
                </div>
              )}
              <div className="my-6 border-y py-6">
                <h2 className="mb-4 text-lg font-semibold">📋 What's Next?</h2>
                <div className="space-y-3 text-left text-muted-foreground">
                  <p>✓ Our team will review your responses</p>
                  <p>✓ You'll receive updates via email</p>
                  <p>✓ The review process takes 2-3 business days</p>
                </div>
              </div>

              <div className="rounded-lg bg-primary/10 p-4">
                <p className="text-lg font-medium text-primary">⏳ Stay Tuned!</p>
                <p className="text-sm text-muted-foreground">We'll be in touch soon with the next steps.</p>
              </div>
            </CardContent>
            
            <CardFooter className="flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={() => router.push("/apply/form")}
                className="flex-1 h-12 text-base"
                size="lg"
              >
                <ArrowLeft className="mr-2 h-5 w-5" />
                Back to Application
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/")}
                className="flex-1 h-12 text-base"
                size="lg"
              >
                <Home className="mr-2 h-5 w-5" />
                Return to Home
              </Button>
            </CardFooter>
          </Card>
        </main>

        <style jsx>{`
          .confetti-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            overflow: hidden;
            z-index: 100;
          }
          .confetti {
            position: absolute;
            width: 10px;
            height: 10px;
            top: -10px;
            border-radius: 50%;
            animation: fall 3s ease-in-out forwards;
          }
          @keyframes fall {
            0% {
              transform: translateY(0) rotate(0deg);
              opacity: 1;
            }
            100% {
              transform: translateY(100vh) rotate(720deg);
              opacity: 0;
            }
          }
        `}</style>
      </div>
    )
  }

  // ACTIVE CALL SCREEN
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold md:text-4xl">Screening Call</h1>
            <p className="mt-3 text-lg text-muted-foreground">
              Answer questions asked by our AI guide. The interview takes approximately 5 minutes.
            </p>
          </div>

          {micDenied && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Microphone access denied</AlertTitle>
              <AlertDescription>
                Please allow microphone access in your browser settings, then refresh the page.
              </AlertDescription>
            </Alert>
          )}

          {noCamera && !micDenied && (
            <Alert>
              <Video className="h-4 w-4" />
              <AlertTitle>No camera detected</AlertTitle>
              <AlertDescription>
                The interview will continue in audio-only mode.
              </AlertDescription>
            </Alert>
          )}

          {checkingMedia && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>Checking microphone and camera access…</AlertTitle>
            </Alert>
          )}

          {sessionError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Session Error</AlertTitle>
              <AlertDescription>{sessionError}</AlertDescription>
            </Alert>
          )}

          {creatingSession && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>Creating interview session…</AlertTitle>
            </Alert>
          )}

          <div className="space-y-6">
            {/* Camera View */}
            <div className="relative overflow-hidden rounded-xl bg-black aspect-video shadow-lg">
              {status !== "idle" && !audioOnly ? (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                  style={{ transform: "scaleX(-1)" }}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center text-white/60">
                    {audioOnly ? (
                      <>
                        <Mic className="mx-auto mb-4 h-20 w-20" />
                        <p className="text-lg">Audio-only mode — microphone active</p>
                        <p className="mt-2 text-sm text-white/40">Your camera is off</p>
                      </>
                    ) : (
                      <>
                        <Video className="mx-auto mb-4 h-20 w-20" />
                        <p className="text-lg">Camera preview will appear here</p>
                        <p className="mt-2 text-sm text-white/40">When you start the interview</p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {status === "active" && (
                <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-red-600 px-3 py-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
                  <span className="text-xs font-bold text-white">REC</span>
                </div>
              )}

              {status === "active" && (
                <div className="absolute right-4 top-4 rounded-full bg-black/60 px-4 py-1.5 text-sm font-bold text-white">
                  {mm}:{ss}
                </div>
              )}

              <div className="absolute bottom-4 left-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  status === "active" ? "bg-green-500" : "bg-gray-700"
                }`}>
                  {status === "active" ? (
                    <Mic className="h-5 w-5 text-white" />
                  ) : (
                    <MicOff className="h-5 w-5 text-white" />
                  )}
                </div>
              </div>
            </div>

            {/* Status Bar */}
            <Card>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <span className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${
                    status === "active"
                      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                      : status === "connecting"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                        : status === "error"
                          ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                          : "bg-muted text-muted-foreground"
                  }`}>
                    {status === "idle" && "Ready to start"}
                    {status === "connecting" && "Connecting…"}
                    {status === "active" && "Interview in progress"}
                    {status === "ended" && "Interview completed"}
                    {status === "error" && "Connection error"}
                  </span>
                  
                  {status === "active" && currentQuestion > 0 && (
                    <span className="text-sm font-medium text-muted-foreground">
                      Question {currentQuestion} of {totalQuestions}
                    </span>
                  )}
                </div>
                <span className={`font-mono text-lg font-bold ${timerColor}`}>{mm}:{ss}</span>
              </CardContent>
            </Card>

            {/* Controls */}
            <div className="flex flex-wrap justify-center gap-4">
              {(status === "idle" || status === "error") && (
                <Button
                  size="lg"
                  onClick={async () => {
                    await checkMediaPermissions()
                    startPresentation()
                  }}
                  className="h-12 px-8 text-base"
                >
                  <Video className="mr-2 h-5 w-5" />
                  Start Interview
                </Button>
              )}

              {(status === "active" || status === "connecting") && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    endSession(true)
                    setStatus("ended")
                  }}
                  className="h-12 px-8 text-base"
                >
                  <PhoneOff className="mr-2 h-5 w-5" />
                  End Interview
                </Button>
              )}

              <Button
                variant="ghost"
                size="lg"
                onClick={() => router.push("/apply/form")}
                className="h-12 px-8 text-base"
              >
                Back to Application
              </Button>
            </div>
          </div>
        </div>
      </main>

      {showCheckIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="mx-4 w-full max-w-md text-center">
            <CardHeader>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
                <AlertCircle className="h-8 w-8 text-yellow-600" />
              </div>
              <CardTitle className="text-2xl">Are you still there?</CardTitle>
              <CardDescription>
                Please speak or click continue to resume your interview.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button
                onClick={() => setShowCheckIn(false)}
                className="w-full h-12 text-base"
                size="lg"
              >
                I'm here, continue
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  )
}
