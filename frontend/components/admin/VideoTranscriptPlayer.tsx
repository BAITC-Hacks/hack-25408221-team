"use client"

import { useEffect, useRef, useState } from "react"
import { api, getApiBaseUrl } from "@/lib/api"
import { getStoredToken } from "@/lib/auth"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Video,
  FileText,
  Play,
  Pause,
  Clock,
  Sparkles,
  AlertCircle,
  Volume2,
} from "lucide-react"

interface TranscriptTurn {
  role: string
  text: string
  timestamp?: number
}

export function VideoTranscriptPlayer({
  sessionId,
  transcript = [],
}: {
  sessionId: string
  transcript?: TranscriptTurn[]
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  const [videoError, setVideoError] = useState(false)

  useEffect(() => {
    if (!sessionId) return
    const token = getStoredToken()
    api
      .getRecordingUrl(sessionId)
      .then((data: { url: string }) => {
        if (data.url) setVideoSrc(data.url)
      })
      .catch(() => {
        const url = `${getApiBaseUrl()}/api/recording/${sessionId}${token ? `?token=${token}` : ""}`
        setVideoSrc(url)
      })
  }, [sessionId])

  const seekTo = (seconds?: number) => {
    if (seconds === undefined || !videoRef.current) return
    videoRef.current.currentTime = seconds
    videoRef.current.play().catch(() => {})
    setIsPlaying(true)
  }

  const formatSeconds = (secs?: number) => {
    if (secs === undefined) return "00:00"
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Video Player */}
      <div className="lg:col-span-7 space-y-3">
        <Card className="overflow-hidden border-border bg-black shadow-lg rounded-2xl">
          <div className="relative aspect-video w-full bg-zinc-950 flex items-center justify-center">
            {videoSrc && !videoError ? (
              <video
                ref={videoRef}
                src={videoSrc}
                controls
                playsInline
                onTimeUpdate={() => {
                  if (videoRef.current) setCurrentTime(videoRef.current.currentTime)
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onError={() => setVideoError(true)}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 p-6 text-center text-muted-foreground text-xs">
                <Video className="h-8 w-8 text-muted-foreground/50" />
                <span>No video recording available or processing.</span>
              </div>
            )}
          </div>
        </Card>

        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span className="flex items-center gap-1.5 font-mono">
            <Clock className="h-3.5 w-3.5" />
            Playback: {formatSeconds(currentTime)}
          </span>
          <span className="text-[11px]">Click any transcript turn to jump video</span>
        </div>
      </div>

      {/* Synchronized Transcript */}
      <div className="lg:col-span-5">
        <Card className="flex flex-col h-[460px] border-border bg-card shadow-sm rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-secondary/30 px-5 py-3">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#84a305] dark:text-[#CDFA1A]" />
              Interactive Transcript
            </span>
            <Badge variant="outline" className="text-[10px] font-mono">
              {transcript.length} turns
            </Badge>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {transcript.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No transcript captured for this interview.
              </div>
            ) : (
              transcript.map((turn, i) => {
                const isUser = turn.role === "user"
                const active =
                  turn.timestamp !== undefined &&
                  currentTime >= turn.timestamp &&
                  (i === transcript.length - 1 ||
                    (transcript[i + 1]?.timestamp !== undefined &&
                      currentTime < (transcript[i + 1].timestamp || 0)))

                return (
                  <div
                    key={i}
                    onClick={() => seekTo(turn.timestamp)}
                    className={`rounded-xl p-3 text-xs transition-all cursor-pointer border ${
                      active
                        ? "border-[#CDFA1A] bg-[#CDFA1A]/10 shadow-sm"
                        : "border-border/60 hover:bg-secondary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold mb-1">
                      <span className={isUser ? "text-foreground font-extrabold" : "text-[#718c06] dark:text-[#CDFA1A]"}>
                        {isUser ? "Candidate" : "AI Guide"}
                      </span>
                      {turn.timestamp !== undefined && (
                        <span className="text-[10px] font-mono text-muted-foreground hover:underline">
                          {formatSeconds(turn.timestamp)}
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground leading-relaxed font-sans">{turn.text}</p>
                  </div>
                )
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
