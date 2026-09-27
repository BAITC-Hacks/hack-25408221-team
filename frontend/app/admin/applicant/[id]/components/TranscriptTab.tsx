"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ApiUser } from "@/components/admin/types"

export function TranscriptTab({ applicant }: { applicant: ApiUser }) {
  const [expandedTranscript, setExpandedTranscript] = useState(false)
  const transcript = applicant.session?.transcript

  if (!transcript || transcript.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-background p-6 text-center">
        <FileText className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">No transcript available</p>
        <p className="text-sm text-muted-foreground mt-1">
          The interview transcript will appear here after the session.
        </p>
      </div>
    )
  }

  // Merge consecutive messages from the same role into one bubble
  const merged: { role: string; text: string; timestamp: string }[] = []
  for (const entry of transcript) {
    const last = merged[merged.length - 1]
    if (last && last.role === entry.role) {
      last.text = last.text.trimEnd() + " " + entry.text.trimStart()
    } else {
      merged.push({ ...entry })
    }
  }

  const visible = expandedTranscript ? merged : merged.slice(0, 6)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{merged.length} messages</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpandedTranscript(!expandedTranscript)}
        >
          {expandedTranscript ? "Collapse" : "Expand All"}
          {expandedTranscript ? (
            <ChevronUp className="ml-1 h-4 w-4" />
          ) : (
            <ChevronDown className="ml-1 h-4 w-4" />
          )}
        </Button>
      </div>

      <div className="space-y-3">
        {visible.map((entry, i) => (
          <div
            key={i}
            className={`rounded-lg p-4 ${
              entry.role === "assistant"
                ? "bg-[#CDFA1A]/10 border border-[#CDFA1A]/30"
                : "bg-background border border-border"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`text-xs font-medium ${
                  entry.role === "assistant" ? "text-green-700" : "text-muted-foreground"
                }`}
              >
                {entry.role === "assistant" ? "AI Guide" : "Applicant"}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <p className="text-sm leading-relaxed">{entry.text}</p>
          </div>
        ))}
      </div>

      {!expandedTranscript && merged.length > 6 && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setExpandedTranscript(true)}
        >
          Show all {merged.length} messages
        </Button>
      )}
    </div>
  )
}
