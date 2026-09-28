"use client"

import { useEffect, useRef, useState } from "react"
import { api } from "@/lib/api"
import type { AnswersResult, ClientItem } from "@/lib/english/types"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Mic,
  MicOff,
  AlertCircle,
  Loader2,
  RotateCcw,
} from "lucide-react"

interface SpeakingSectionProps {
  sessionId: string
  initialItems: ClientItem[]
  onSectionComplete: (result: AnswersResult) => void
  token?: string | null
}

export function SpeakingSection({
  sessionId,
  initialItems,
  onSectionComplete,
  token,
}: SpeakingSectionProps) {
  const [queue, setQueue] = useState<ClientItem[]>(initialItems)
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<"ready" | "recording" | "uploading" | "error">("ready")
  const [remaining, setRemaining] = useState(60)
  const [error, setError] = useState("")

  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const saved = useRef<Blob | null>(null)
  const mounted = useRef(true)

  const item = queue[index]

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (timer.current) clearInterval(timer.current)
      if (recorder.current) {
        recorder.current.onstop = null
        if (recorder.current.state === "recording") recorder.current.stop()
      }
      stream.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  useEffect(() => {
    const expire = () => stop()
    window.addEventListener("assessment-expired", expire)
    return () => window.removeEventListener("assessment-expired", expire)
  }, [])

  function stop() {
    if (timer.current) clearInterval(timer.current)
    if (recorder.current?.state === "recording") {
      recorder.current.stop()
    }
  }

  async function start() {
    if (phase === "recording" || phase === "uploading") return
    setError("")
    setPhase("uploading") // interim preparing state
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!mounted.current) {
        mic.getTracks().forEach((t) => t.stop())
        return
      }
      stream.current = mic

      const type = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
        "audio/webm",
      ].find((t) => MediaRecorder.isTypeSupported(t))

      const rec = new MediaRecorder(mic, type ? { mimeType: type } : undefined)
      recorder.current = rec
      const chunks: BlobPart[] = []

      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data)
      }

      rec.onstop = () => {
        mic.getTracks().forEach((t) => t.stop())
        saved.current = new Blob(chunks, { type: rec.mimeType })
        if (mounted.current) void upload()
      }

      rec.start(500)
      setPhase("recording")
      const durationSeconds = item?.answer_s || item?.speak_seconds || 60
      const end = Date.now() + durationSeconds * 1000
      setRemaining(durationSeconds)

      timer.current = setInterval(() => {
        const secs = Math.max(0, Math.ceil((end - Date.now()) / 1000))
        setRemaining(secs)
        if (!secs) stop()
      }, 250)
    } catch {
      setError("Microphone access unavailable. Please grant microphone permission.")
      setPhase("ready")
    }
  }

  async function upload() {
    if (!saved.current || !item) return
    setPhase("uploading")
    setError("")

    try {
      const result = await api.uploadSpeakingMedia(sessionId, item.id, saved.current, token || undefined)
      if (!mounted.current) return

      if (result.section_complete) {
        onSectionComplete(result)
        return
      }

      // Authoritative task list refresh (splicing dynamic follow-up questions if any)
      const current = await api.getEnglishSection(sessionId, token || undefined)
      setQueue(current.items)
      setIndex((prev) => prev + 1)
      setPhase("ready")
      saved.current = null
    } catch (e) {
      if (mounted.current) {
        setError(e instanceof Error ? e.message : "Audio upload failed.")
        setPhase("error")
      }
    }
  }

  if (!item) {
    return (
      <Card className="p-8 text-center border-border bg-card shadow-md space-y-4 rounded-3xl">
        <Loader2 className="h-8 w-8 animate-spin text-[#84a305] dark:text-[#CDFA1A] mx-auto" />
        <h3 className="text-base font-bold">Processing Spoken Responses…</h3>
        <p className="text-xs text-muted-foreground">All speaking tasks submitted. Finalizing section evaluation.</p>
      </Card>
    )
  }

  return (
    <Card className="p-6 sm:p-10 border-border bg-card shadow-xl space-y-8 rounded-3xl">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Mic className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-foreground">
              Speaking · Task {index + 1} of {queue.length}
            </h3>
            <p className="text-xs text-muted-foreground">Live oral fluency and grammar evaluation</p>
          </div>
        </div>

        <Badge variant="outline" className="text-xs font-mono py-1 px-3">
          Max: {item.answer_s || item.speak_seconds || 60}s
        </Badge>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Speaking Prompt Card */}
      <div className="rounded-2xl border border-border bg-secondary/20 p-6 space-y-3">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
          Spoken Prompt
        </span>
        <h2 className="text-lg font-bold text-foreground leading-snug">
          {item.prompt || item.text}
        </h2>
        <p className="text-xs text-muted-foreground">
          Take a moment to prepare your thoughts. Speak clearly and concisely into your microphone.
        </p>
      </div>

      {/* Visual stimulus if present */}
      {item.image && (
        <div className="rounded-2xl border border-border bg-secondary/20 p-4 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={api.getEnglishMediaUrl(item.image)}
            alt="Speaking Task Stimulus"
            className="max-h-72 mx-auto rounded-xl object-contain shadow-sm"
          />
        </div>
      )}

      {/* Recording Area */}
      <div className="flex flex-col items-center justify-center py-6 space-y-5">
        {phase === "recording" ? (
          <div className="text-center space-y-4">
            <div className="relative flex h-32 w-32 items-center justify-center rounded-full border-4 border-red-500 bg-red-500/10 shadow-[0_0_50px_rgba(239,68,68,0.4)] animate-pulse mx-auto">
              <Mic className="h-12 w-12 text-red-500" />
            </div>

            <div>
              <div className="text-2xl font-mono font-black text-foreground">
                00:{remaining.toString().padStart(2, "0")} remaining
              </div>
              <p className="text-xs text-muted-foreground mt-1">Recording active · audio streaming</p>
            </div>

            <Button
              variant="destructive"
              size="lg"
              onClick={stop}
              className="rounded-2xl px-8 h-12 text-xs font-bold gap-2 shadow-md"
            >
              <MicOff className="h-4 w-4" />
              Finish & Submit Response
            </Button>
          </div>
        ) : phase === "uploading" ? (
          <div className="text-center space-y-3 py-4">
            <Loader2 className="h-10 w-10 animate-spin text-[#84a305] dark:text-[#CDFA1A] mx-auto" />
            <p className="text-sm font-bold text-foreground">Processing audio response…</p>
            <p className="text-xs text-muted-foreground">Transcribing via Whisper ASR and grading metrics.</p>
          </div>
        ) : phase === "error" ? (
          <div className="text-center space-y-3">
            <Button
              size="lg"
              onClick={upload}
              className="bg-[#CDFA1A] text-black font-extrabold hover:bg-[#b8e612] rounded-2xl h-14 px-8 text-sm gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Retry Saved Recording Upload
            </Button>
          </div>
        ) : (
          <Button
            size="lg"
            onClick={start}
            className="bg-[#CDFA1A] text-black font-extrabold hover:bg-[#b8e612] rounded-2xl h-14 px-10 text-base gap-2.5 shadow-xl transition-transform hover:scale-[1.02]"
          >
            <Mic className="h-5 w-5 stroke-[2.5]" />
            Start Recording Spoken Answer
          </Button>
        )}
      </div>
    </Card>
  )
}
