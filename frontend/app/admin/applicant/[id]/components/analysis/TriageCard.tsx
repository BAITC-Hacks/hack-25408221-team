"use client"

import { Zap } from "lucide-react"
import { TIER_COLORS, TIER_LABELS } from "@/components/admin/types"

export function TriageCard({ triage }: { triage: any }) {
  if (!triage?.priority) return null

  return (
    <div className="rounded-xl border border-border bg-background p-5">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="h-4 w-4 text-yellow-500" />
        <h3 className="font-semibold">Triage Priority</h3>
      </div>
      <div className="flex items-center gap-3 mb-3">
        <span
          className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
            TIER_COLORS[triage.priority.tier] || "bg-muted text-foreground"
          }`}
        >
          Tier {triage.priority.tier} —{" "}
          {triage.priority.label || TIER_LABELS[triage.priority.tier]}
        </span>
        {triage.priority.estimated_review_minutes && (
          <span className="text-sm text-muted-foreground">
            ~{triage.priority.estimated_review_minutes} min review
          </span>
        )}
      </div>
      {triage.priority.reasons?.length > 0 && (
        <ul className="space-y-1">
          {triage.priority.reasons.map((r: string, i: number) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
              {r}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
