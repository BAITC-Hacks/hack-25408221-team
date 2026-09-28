"use client"

import { useRef } from "react"
import { Download, Maximize2, Play, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ApiUser } from "@/components/admin/types"

export function RecordingTab({
  applicant,
  onOpenModal,
}: {
  applicant: ApiUser
  onOpenModal: () => void
}) {
  const inlineVideoRef = useRef<HTMLVideoElement>(null)

  if (!applicant.session?.recording_url) {
    return (
      <div className="rounded-xl border border-border bg-background p-6 text-center">
        <Video className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">No recording available</p>
        <p className="text-sm text-muted-foreground mt-1">
          The applicant has not submitted a video recording yet.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-background p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Interview Recording</h3>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={onOpenModal}
          >
            <Maximize2 className="h-4 w-4" />
            Fullscreen
          </Button>
        </div>

        <video
          ref={inlineVideoRef}
          src={`/api/recording/${applicant.session.id}`}
          controls
          className="w-full rounded-xl"
        />

        <div className="mt-4 grid gap-4 md:grid-cols-2 text-sm">
          <div>
            <p className="text-muted-foreground">Program</p>
            <p className="font-medium">{applicant.session.program}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Completed</p>
            <p className="font-medium">
              {applicant.session.completed_at
                ? new Date(applicant.session.completed_at).toLocaleString()
                : "—"}
            </p>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <a
            href={`/api/recording/${applicant.session.id}`}
            download={`recording-${applicant.session.id}.webm`}
          >
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Download
            </Button>
          </a>
          <Button
            className="gap-2 bg-[#CDFA1A] text-black hover:bg-[#CDFA1A]/80"
            onClick={onOpenModal}
          >
            <Play className="h-4 w-4" />
            Play Recording
          </Button>
        </div>
      </div>
    </div>
  )
}
