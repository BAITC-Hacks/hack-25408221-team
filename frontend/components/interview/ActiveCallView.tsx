"use client"

import { useEffect, useRef, useState } from "react"
import { useInterviewStore } from "@/stores/useInterviewStore"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  AlertCircle,
  Clock,
  Sparkles,
  HelpCircle,
} from "lucide-react"

export function ActiveCallView() {
  const {
    status,
    timerSecs,
    maxDurationSecs,
    currentQuestion,
    totalQuestions,
    agentSpeaking,
    userSpeaking,
    audioLevel,
    showCheckIn,
    audioOnly,
    localStream,
    endInterview,
    errorMessage,
  } = useInterviewStore()

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [micMuted, setMicMuted] = useState(false)
  const [camOff, setCamOff] = useState(false)

  useEffect(() => {
    if (videoRef.current && localStream && !audioOnly) {
      videoRef.current.srcObject = localStream
    }
  }, [localStream, audioOnly])

  const toggleMic = () => {
    if (!localStream) return
    const audioTrack = localStream.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled
      setMicMuted(!audioTrack.enabled)
    }
  }

  const toggleCam = () => {
    if (!localStream || audioOnly) return
    const videoTrack = localStream.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled
      setCamOff(!videoTrack.enabled)
    }
  }

  // Format timer into mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  }

  const progressPercent = Math.min(100, Math.round((timerSecs / maxDurationSecs) * 100))

  return (
    <div className="relative flex h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-3xl bg-[#090a0d] text-white shadow-2xl border border-white/10 m-auto max-w-6xl">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/40 backdrop-blur-md z-20">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#CDFA1A] text-black font-extrabold text-sm">
            in
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              inVision AI Guide
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live Call
              </span>
            </h2>
            <p className="text-[11px] text-white/50">Gemini Live · Voice Model Aoede</p>
          </div>
        </div>

        {/* Center Timer & Question Pacing */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-full bg-white/5 px-4 py-1.5 border border-white/10 text-xs font-mono">
            <Clock className="h-3.5 w-3.5 text-[#CDFA1A]" />
            <span className="font-semibold text-white">
              {formatTime(timerSecs)}
            </span>
            <span className="text-white/40">/ {formatTime(maxDurationSecs)}</span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 border border-white/10 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5 text-[#CDFA1A]" />
            <span>Paced Presentation</span>
          </div>
        </div>

        {/* End Button */}
        <div>
          <Button
            variant="destructive"
            size="sm"
            onClick={endInterview}
            className="rounded-xl gap-2 font-semibold text-xs shadow-lg hover:bg-destructive/80"
          >
            <PhoneOff className="h-4 w-4" />
            End Call
          </Button>
        </div>
      </header>

      {/* Main Call Stage */}
      <div className="relative flex flex-1 items-center justify-center p-6">
        {/* Silence Check-in Alert Overlay */}
        {showCheckIn && (
          <div className="absolute top-8 z-30 flex items-center gap-3 rounded-2xl border-2 border-[#CDFA1A] bg-black/90 px-6 py-3.5 shadow-2xl backdrop-blur-md animate-bounce">
            <HelpCircle className="h-5 w-5 text-[#CDFA1A]" />
            <div>
              <p className="text-sm font-bold text-white">Are you still there?</p>
              <p className="text-xs text-white/70">
                Take your time to answer. Please speak when you are ready.
              </p>
            </div>
          </div>
        )}

        {/* Central AI Guide Orb & Pulsating Waveform */}
        <div className="flex flex-col items-center justify-center text-center">
          <div className="relative flex items-center justify-center">
            {/* Outer pulsating rings when agent is speaking */}
            {agentSpeaking && (
              <>
                <div className="absolute h-56 w-56 rounded-full bg-[#CDFA1A]/10 animate-ping" />
                <div className="absolute h-48 w-48 rounded-full bg-[#CDFA1A]/20 blur-xl animate-pulse" />
              </>
            )}

            <div
              className={`relative flex h-36 w-36 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                agentSpeaking
                  ? "border-[#CDFA1A] bg-[#CDFA1A]/25 shadow-[0_0_50px_rgba(205,250,26,0.4)] scale-105"
                  : "border-white/15 bg-white/5 shadow-inner"
              }`}
            >
              <div className="flex items-center gap-1.5 h-12">
                <span
                  className={`w-1.5 rounded-full transition-all duration-150 ${
                    agentSpeaking ? "bg-[#CDFA1A] animate-soundwave-1" : "bg-white/40 h-2"
                  }`}
                />
                <span
                  className={`w-1.5 rounded-full transition-all duration-150 ${
                    agentSpeaking ? "bg-[#CDFA1A] animate-soundwave-2" : "bg-white/40 h-3"
                  }`}
                />
                <span
                  className={`w-1.5 rounded-full transition-all duration-150 ${
                    agentSpeaking ? "bg-[#CDFA1A] animate-soundwave-3" : "bg-white/40 h-5"
                  }`}
                />
                <span
                  className={`w-1.5 rounded-full transition-all duration-150 ${
                    agentSpeaking ? "bg-[#CDFA1A] animate-soundwave-4" : "bg-white/40 h-3"
                  }`}
                />
                <span
                  className={`w-1.5 rounded-full transition-all duration-150 ${
                    agentSpeaking ? "bg-[#CDFA1A] animate-soundwave-5" : "bg-white/40 h-2"
                  }`}
                />
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-xl font-bold text-white">
              {agentSpeaking ? "AI Guide Speaking…" : "Listening to you…"}
            </h3>
            <p className="mt-1 text-xs text-white/50 max-w-sm">
              {agentSpeaking
                ? "Listen carefully to the question or feedback from your guide."
                : "Speak clearly into your microphone. You can take a breath anytime."}
            </p>
          </div>
        </div>

        {/* Picture-in-Picture Candidate Webcam (Bottom-Right) */}
        <div className="absolute bottom-6 right-6 z-20 w-64 overflow-hidden rounded-2xl border-2 border-white/20 bg-black shadow-2xl sm:w-72">
          <div className="relative aspect-video w-full bg-zinc-900">
            {!camOff && !audioOnly && localStream ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover -scale-x-100"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-zinc-950 text-white/50 text-xs">
                Camera off
              </div>
            )}

            {/* Candidate Name & Live Mic Level */}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between rounded-lg bg-black/60 backdrop-blur-md px-2.5 py-1 text-[11px]">
              <span className="font-semibold text-white truncate max-w-[120px]">
                You
              </span>
              <div className="flex items-center gap-1.5">
                <Mic className="h-3 w-3 text-[#CDFA1A]" />
                <div className="h-2 w-16 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full bg-[#CDFA1A] transition-all duration-75"
                    style={{ width: `${audioLevel}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Controls Bar */}
      <footer className="flex items-center justify-center gap-4 border-t border-white/10 bg-black/50 px-6 py-4 backdrop-blur-md z-20">
        <Button
          variant="outline"
          size="icon"
          onClick={toggleMic}
          className={`h-12 w-12 rounded-2xl border-white/20 bg-white/5 text-white hover:bg-white/10 ${
            micMuted ? "border-destructive/80 bg-destructive/20 text-destructive" : ""
          }`}
          title={micMuted ? "Unmute Microphone" : "Mute Microphone"}
        >
          {micMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={toggleCam}
          disabled={audioOnly}
          className={`h-12 w-12 rounded-2xl border-white/20 bg-white/5 text-white hover:bg-white/10 ${
            camOff ? "border-destructive/80 bg-destructive/20 text-destructive" : ""
          }`}
          title={camOff ? "Turn Camera On" : "Turn Camera Off"}
        >
          {camOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
        </Button>
      </footer>
    </div>
  )
}
