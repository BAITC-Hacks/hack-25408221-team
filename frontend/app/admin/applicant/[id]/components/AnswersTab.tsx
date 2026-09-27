"use client"

import { ClipboardList } from "lucide-react"
import { ApiUser, QUESTION_LABELS } from "@/components/admin/types"

export function AnswersTab({ applicant }: { applicant: ApiUser }) {
  const applicantData = applicant.session?.applicant_data

  if (!applicantData) {
    return (
      <div className="rounded-xl border border-border bg-background p-6 text-center">
        <ClipboardList className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">No interview answers available yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {Object.entries(QUESTION_LABELS).map(([key, label]) => (
        <div key={key} className="rounded-xl border border-border bg-background p-5">
          <p className="text-sm font-medium text-muted-foreground mb-2">{label}</p>
          <p className="text-sm leading-relaxed">
            {(applicantData as unknown as Record<string, string>)[key] || "No answer provided."}
          </p>
        </div>
      ))}
      <div className="grid gap-4 md:grid-cols-3 rounded-xl border border-border bg-background p-5">
        <div>
          <p className="text-sm text-muted-foreground">Language</p>
          <p className="font-medium">{applicantData.language_used || "—"}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Confidence</p>
          <p className="font-medium capitalize">{applicantData.confidence_level || "—"}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Communication</p>
          <p className="font-medium capitalize">{applicantData.communication_quality || "—"}</p>
        </div>
      </div>
    </div>
  )
}
