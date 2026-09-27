"use client"

import { useEffect, useRef, useState } from "react"
import { Mic, Square, Loader2, AlertCircle, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ClientItem, AnswersResult } from "../types"
import { englishRequest, getDefaultApiUrl } from "../api/client"
import { getMediaUrl } from "../api/endpoints"

export function SpeakingSection({
  sessionId,
  initialItems,
  onSectionComplete,
}: {
  sessionId: string
  initialItems: ClientItem[]
  onSectionComplete: (result: AnswersResult) => void
}) {
  const [queue, setQueue] = useState(initialItems)
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<"ready" | "recording" | "uploading" | "error">("ready")
  const [remaining, setRemaining] = useState(0)
  const [error, setError] = useState("")

  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const savedBlob = useRef<Blob | null>(null)
  const mounted = useRef(true)

  const item = queue[index]

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (timer.current) clearInterval(timer.current)
      if (recorder.current && recorder.current.state === "recording") {
        recorder.current.onstop = null
        recorder.current.stop()
      }
      stream.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function stopRecording() {
    if (timer.current) clearInterval(timer.current)
    if (recorder.current?.state === "recording") {
      recorder.current.stop()
    }
  }

  async function startRecording() {
    if (phase === "recording" || phase === "uploading") return
    setError("")
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!mounted.current) {
        mic.getTracks().forEach((t) => t.stop())
        return
      }
      stream.current = mic

      const chunks: BlobPart[] = []
      const mr = new MediaRecorder(mic, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : undefined,
      })
      recorder.current = mr

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      mr.onstop = () => {
        mic.getTracks().forEach((t) => t.stop())
        if (!mounted.current) return
        savedBlob.current = new Blob(chunks, { type: mr.mimeType || "audio/webm" })
        void uploadAudio()
      }

      mr.start(250)
      setPhase("recording")
      const maxSecs = item?.answer_s ?? 60
      setRemaining(maxSecs)

      const endTime = Date.now() + maxSecs * 1000
      timer.current = setInterval(() => {
        const secs = Math.max(0, Math.ceil((endTime - Date.now()) / 1000))
        setRemaining(secs)
        if (secs <= 0) {
          stopRecording()
        }
      }, 250)
    } catch {
      setError("Microphone unavailable. Please grant microphone access and try again.")
      setPhase("ready")
    }
  }

  async function uploadAudio() {
    if (!savedBlob.current || !item) return
    setPhase("uploading")
    setError("")

    const form = new FormData()
    form.append("kind", "speaking")
    form.append("item_id", item.id)
    const ext = savedBlob.current.type.includes("ogg") ? "ogg" : "webm"
    form.append("file", savedBlob.current, `${item.id}.${ext}`)

    try {
      const result = await englishRequest<AnswersResult>(`/sessions/${sessionId}/media`, {
        method: "POST",
        body: form,
      })
      if (!mounted.current) return
      if (result.section_complete) {
        onSectionComplete(result)
        return
      }

      // Check if follow-up items were generated
      const current = await englishRequest<{ items: ClientItem[] }>(
        `/sessions/${sessionId}/section`,
        { method: "GET" }
      )
      setQueue(current.items)
      setIndex((i) => i + 1)
      setPhase("ready")
      savedBlob.current = null
    } catch (e) {
      if (mounted.current) {
        setError(e instanceof Error ? e.message : "Audio upload failed.")
        setPhase("error")
      }
    }
  }

  if (!item) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center space-y-3">
        <p className="font-semibold text-lg">Speaking tasks completed</p>
        <p className="text-sm text-muted-foreground">
          Waiting for the final section analysis to complete…
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 md:p-8 space-y-6">
      <div className="border-b border-border pb-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Volume2 className="h-4 w-4" /> SPEAKING ASSESSMENT · TASK {index + 1} OF {queue.length}
        </span>
        <h2 className="text-xl font-bold mt-2 leading-relaxed">{item.prompt}</h2>
        {item.image && (
          <div className="mt-4 rounded-lg overflow-hidden border border-border bg-muted/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getMediaUrl(item.image)}
              alt="Speaking task visual prompt"
              className="max-h-72 w-full object-contain"
            />
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Take a moment to prepare your thoughts. You have up to {item.answer_s ?? 60} seconds to
          record your answer.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Recording status & action */}
      <div className="flex flex-col items-center justify-center p-8 rounded-xl bg-muted/20 border border-border space-y-4">
        {phase === "recording" ? (
          <div className="flex flex-col items-center space-y-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500" />
              </span>
              <span className="font-semibold text-sm text-red-600">Recording live…</span>
            </div>
            <p className="font-mono text-3xl font-bold">{remaining}s</p>
            <Button
              variant="destructive"
              size="lg"
              className="gap-2 px-8 font-semibold mt-2"
              onClick={stopRecording}
            >
              <Square className="h-4 w-4 fill-current" />
              Finish & Submit Response
            </Button>
          </div>
        ) : phase === "uploading" ? (
          <div className="flex flex-col items-center space-y-2 py-4">
            <Loader2 className="h-8 w-8 animate-spin text-[#6B8E23]" />
            <p className="text-sm font-medium">Uploading and processing audio response…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#CDFA1A]/20">
              <Mic className="h-8 w-8 text-[#6B8E23]" />
            </div>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              When ready, press start to begin speaking. Your microphone will record until you press
              finish or time runs out.
            </p>
            <Button
              size="lg"
              className="bg-[#CDFA1A] text-foreground hover:bg-[#CDFA1A]/90 font-semibold px-8 gap-2"
              onClick={startRecording}
            >
              <Mic className="h-4 w-4" />
              Start Recording Response
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
