"use client"

import { TrendingUp, AlertTriangle } from "lucide-react"
import { ScoreMeter } from "../ScoreMeter"

export function DataQualityCard({ dataQuality }: { dataQuality: any }) {
  if (!dataQuality) return null

  return (
    <div className="rounded-xl border border-border bg-background p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-4 w-4 text-orange-500" />
        <h3 className="font-semibold">Data Quality</h3>
      </div>
      <ScoreMeter
        value={dataQuality.overall_score}
        label="Overall Quality Score"
      />
      <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm">
        {dataQuality.completeness && (
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="text-muted-foreground">Completeness</p>
            <p className="font-semibold">{dataQuality.completeness.score}/100</p>
            <p className="text-xs text-muted-foreground">
              {dataQuality.completeness.answered_questions}/
              {dataQuality.completeness.total_questions} questions answered
            </p>
          </div>
        )}
        {dataQuality.transcript_quality && (
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="text-muted-foreground">Transcript</p>
            <p className="font-semibold">
              {dataQuality.transcript_quality.score}/100
            </p>
            <p className="text-xs text-muted-foreground">
              {dataQuality.transcript_quality.word_count} words ·{" "}
              {dataQuality.transcript_quality.user_turns} turns
            </p>
          </div>
        )}
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-muted-foreground">Has Evaluation</p>
          <p
            className={`font-semibold ${
              dataQuality.has_evaluation ? "text-green-600" : "text-yellow-600"
            }`}
          >
            {dataQuality.has_evaluation ? "Yes" : "No"}
          </p>
        </div>
      </div>
      {dataQuality.missing_answers?.has_issues && (
        <div className="mt-3 space-y-1">
          {dataQuality.missing_answers.issues.map((issue: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <AlertTriangle
                className={`h-3.5 w-3.5 ${
                  issue.severity === "high" ? "text-red-500" : "text-yellow-500"
                }`}
              />
              <span className="text-muted-foreground">
                {issue.label}: {issue.type.replace(/_/g, " ")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
