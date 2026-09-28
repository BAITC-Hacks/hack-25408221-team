"use client"

import { useEffect, useRef, useState } from "react"
import { useInterviewStore } from "@/stores/useInterviewStore"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Camera,
  Mic,
  Volume2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

export function PreFlightModal({ onStart }: { onStart: () => void }) {
  const {
    localStream,
    audioLevel,
    audioOnly,
    initPreflight,
    errorMessage,
  } = useInterviewStore()

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [testingAudio, setTestingAudio] = useState(false)

  useEffect(() => {
    initPreflight()
  }, [initPreflight])

  useEffect(() => {
    if (videoRef.current && localStream && !audioOnly) {
      videoRef.current.srcObject = localStream
    }
  }, [localStream, audioOnly])

  const testSpeaker = () => {
    setTestingAudio(true)
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(440, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3)
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
      osc.start()
      osc.stop(ctx.currentTime + 0.4)
      setTimeout(() => {
        setTestingAudio(false)
        ctx.close()
      }, 500)
    } catch {
      setTestingAudio(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#CDFA1A]/20 px-3.5 py-1 text-xs font-bold text-[#627a05] dark:text-[#CDFA1A]">
          <Sparkles className="h-3.5 w-3.5" /> AI Presentation Setup
        </span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
          Device & Audio Pre-Flight Check
        </h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-xl mx-auto">
          Ensure your camera and microphone are working. You will converse live with an AI admissions guide for about 5 minutes across 6 questions.
        </p>
      </div>

      {errorMessage && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Video Preview */}
        <Card className="overflow-hidden border-border bg-card p-0 shadow-lg">
          <div className="relative aspect-video w-full bg-black/95 flex items-center justify-center">
            {!audioOnly && localStream ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover -scale-x-100"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-muted-foreground p-6 text-center">
                <Camera className="h-10 w-10 text-muted-foreground/60" />
                <p className="text-xs">Camera unavailable or permission denied. Running in audio-only mode.</p>
              </div>
            )}
            <div className="absolute top-3 left-3 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-[11px] font-semibold text-white flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Webcam Feed
            </div>
          </div>
          <div className="p-5">
            <h3 className="font-bold text-foreground">Video Frame Check</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Center your face, look at the camera, and ensure adequate front lighting.
            </p>
          </div>
        </Card>

        {/* Audio & Readiness Diagnostics */}
        <div className="space-y-6 flex flex-col justify-between">
          <Card className="p-6 border-border bg-card shadow-sm space-y-5">
            <div>
              <div className="flex items-center justify-between text-sm font-semibold mb-2">
                <span className="flex items-center gap-2 text-foreground">
                  <Mic className="h-4 w-4 text-[#84a305] dark:text-[#CDFA1A]" />
                  Microphone Input Level
                </span>
                <span className="text-xs font-mono text-muted-foreground">
                  {audioLevel}%
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-[#CDFA1A] transition-all duration-75"
                  style={{ width: `${audioLevel}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Speak aloud to verify the green bar moves with your voice.
              </p>
            </div>

            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-[#84a305] dark:text-[#CDFA1A]" />
                    Speaker Output
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Test that you can hear the AI agent guide speak.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={testSpeaker}
                  disabled={testingAudio}
                  className="rounded-xl"
                >
                  {testingAudio ? "Playing..." : "Test Audio"}
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-6 border-border bg-card shadow-sm space-y-4">
            <div className="space-y-2.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Conversational Gemini Live 2.0 streaming via WebSocket</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Automatic on-device video & audio recording</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>6 structured interview presentation questions (~5 min)</span>
              </div>
            </div>

            <Button
              size="lg"
              onClick={onStart}
              className="w-full bg-[#CDFA1A] text-black font-extrabold hover:bg-[#b8e612] text-base gap-2 rounded-2xl shadow-md transition-transform hover:scale-[1.01]"
            >
              Start AI Interview
              <ArrowRight className="h-5 w-5 stroke-[2.5]" />
            </Button>
          </Card>
        </div>
      </div>
    </div>
  )
}
