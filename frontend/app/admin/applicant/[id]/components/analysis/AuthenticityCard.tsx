"use client"

import { Shield } from "lucide-react"
import { ScoreMeter } from "../ScoreMeter"

export function AuthenticityCard({ authenticity }: { authenticity: any }) {
  if (!authenticity) return null

  return (
    <div className="rounded-xl border border-border bg-background p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-blue-500" />
          <h3 className="font-semibold">Authenticity Analysis</h3>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            authenticity.risk_level === "low"
              ? "bg-green-100 text-green-800"
              : authenticity.risk_level === "medium"
                ? "bg-yellow-100 text-yellow-800"
                : "bg-red-100 text-red-800"
          }`}
        >
          {(authenticity.risk_level || "").toUpperCase()} RISK
        </span>
      </div>
      <ScoreMeter value={authenticity.authenticity_score} label="Authenticity Score" />
      <div className="mt-4 grid gap-3 md:grid-cols-2 text-sm">
        {authenticity.specificity && (
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="text-muted-foreground mb-1">Specificity</p>
            <p className="font-medium capitalize">{authenticity.specificity.level}</p>
            <p className="text-xs text-muted-foreground">
              {authenticity.specificity.specific_hits} specific /{" "}
              {authenticity.specificity.generic_hits} generic signals
            </p>
          </div>
        )}
        {authenticity.contribution_orientation && (
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="text-muted-foreground mb-1">Orientation</p>
            <p className="font-medium capitalize">
              {(authenticity.contribution_orientation.orientation || "").replace(/_/g, " ")}
            </p>
          </div>
        )}
        {authenticity.linguistic_signals && (
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="text-muted-foreground mb-1">Naturalness</p>
            <p className="font-medium">
              {authenticity.linguistic_signals.naturalness_score}/100
            </p>
          </div>
        )}
        {authenticity.cross_session_similarity && (
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="text-muted-foreground mb-1">Cross-session match</p>
            <p
              className={`font-medium ${
                authenticity.cross_session_similarity.flag ? "text-red-600" : "text-green-600"
              }`}
            >
              {authenticity.cross_session_similarity.flag ? "Flagged" : "Clean"}
            </p>
          </div>
        )}
      </div>
      {authenticity.flags?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {authenticity.flags.map((f: string) => (
            <span
              key={f}
              className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700"
            >
              {f.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
