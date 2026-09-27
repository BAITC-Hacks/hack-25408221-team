"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { uploadSpeakingAudio } from "../api/endpoints"

export function useSpeakingRecorder(
  sessionId: string,
  itemId: string,
  maxSeconds: number,
  onUploaded: () => void
) {
  const [phase, setPhase] = useState<"ready" | "recording" | "uploading" | "error">("ready")
  const [remaining, setRemaining] = useState(maxSeconds)
  const [error, setError] = useState("")

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (timerRef.current) clearInterval(timerRef.current)
      if (recorderRef.current && recorderRef.current.state === "recording") {
        recorderRef.current.stop()
      }
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop()
    }
  }, [])

  const start = useCallback(async () => {
    if (phase === "recording" || phase === "uploading") return
    setError("")
    setPhase("uploading")

    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!mountedRef.current) {
        mic.getTracks().forEach((t) => t.stop())
        return
      }
      streamRef.current = mic

      const chunks: BlobPart[] = []
      const mr = new MediaRecorder(mic, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : undefined,
      })
      recorderRef.current = mr

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      mr.onstop = async () => {
        mic.getTracks().forEach((t) => t.stop())
        if (!mountedRef.current) return
        setPhase("uploading")

        const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" })
        try {
          await uploadSpeakingAudio(sessionId, itemId, blob)
          if (mountedRef.current) {
            setPhase("ready")
            onUploaded()
          }
        } catch {
          if (mountedRef.current) {
            setError("Upload failed. Please check your internet connection and retry.")
            setPhase("error")
          }
        }
      }

      mr.start(250)
      setPhase("recording")
      setRemaining(maxSeconds)

      let rem = maxSeconds
      timerRef.current = setInterval(() => {
        rem -= 1
        if (mountedRef.current) setRemaining(rem)
        if (rem <= 0) {
          if (timerRef.current) clearInterval(timerRef.current)
          if (mr.state === "recording") mr.stop()
        }
      }, 1000)
    } catch {
      setError("Could not access your microphone. Please grant permission.")
      setPhase("error")
    }
  }, [phase, sessionId, itemId, maxSeconds, onUploaded])

  return {
    phase,
    remaining,
    error,
    start,
    stop,
  }
}
