"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { Download, X, Maximize2, Minimize2 } from "lucide-react"
import { ApiUser } from "./types"

export function RecordingModal({
  applicant,
  videoSrc,
  onClose,
}: {
  applicant: ApiUser
  videoSrc: string
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleEsc)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handleEsc)
      document.body.style.overflow = ""
    }
  }, [onClose])

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", handleFsChange)
    return () => document.removeEventListener("fullscreenchange", handleFsChange)
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        className="relative w-full max-w-5xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold text-white">{applicant.name}</h3>
            <p className="text-sm text-white/60">
              {applicant.session?.program} · {applicant.session?.completed_at
                ? new Date(applicant.session.completed_at).toLocaleDateString()
                : "Interview Recording"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleFullscreen}
              className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </button>
            <a
              href={videoSrc}
              download
              className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
              title="Download recording"
            >
              <Download className="h-5 w-5" />
            </a>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="rounded-xl overflow-hidden bg-black aspect-video">
          <video
            ref={videoRef}
            src={videoSrc}
            controls
            autoPlay
            className="w-full h-full object-contain"
          />
        </div>

        <div className="flex items-center justify-between mt-3 text-sm text-white/60">
          <div className="flex items-center gap-4">
            {applicant.session?.evaluation && (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                ["strongly_recommended", "recommended"].includes(applicant.session.evaluation.recommendation)
                  ? "bg-green-500/20 text-green-400"
                  : applicant.session.evaluation.recommendation === "not_recommended"
                    ? "bg-red-500/20 text-red-400"
                    : "bg-yellow-500/20 text-yellow-400"
              }`}>
                {applicant.session.evaluation.recommendation === "strongly_recommended"
                  ? "Strongly Recommended"
                  : applicant.session.evaluation.recommendation === "recommended"
                    ? "Recommended"
                    : applicant.session.evaluation.recommendation === "not_recommended"
                      ? "Not Recommended"
                      : applicant.session.evaluation.recommendation === "needs_review"
                        ? "Needs Review"
                        : "Pending"}
                {(applicant.session.evaluation.overall_score ?? 0) > 0 && (
                  <span>· Score: {applicant.session.evaluation.overall_score}/10</span>
                )}
              </span>
            )}
          </div>
          <Link
            href={`/admin/applicant/${applicant.id}`}
            className="text-[#CDFA1A] hover:underline"
            onClick={(e) => {
              e.preventDefault()
              onClose()
            }}
          >
            Close Player
          </Link>
        </div>
      </div>
    </div>
  )
}
