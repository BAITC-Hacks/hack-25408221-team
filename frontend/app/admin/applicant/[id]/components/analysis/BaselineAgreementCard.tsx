"use client"

import { TrendingUp } from "lucide-react"

export function BaselineAgreementCard({
  baselineEvaluation,
  agreement,
}: {
  baselineEvaluation: any
  agreement: any
}) {
  if (!baselineEvaluation || !agreement) return null

  return (
    <div className="rounded-xl border border-border bg-background p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-4 w-4 text-indigo-500" />
        <h3 className="font-semibold">Baseline Evaluation & AI Agreement</h3>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg bg-muted/40 p-4">
          <p className="text-xs text-muted-foreground mb-2">Baseline Score</p>
          <p className="text-2xl font-bold">{baselineEvaluation.score}/10</p>
          <p className="text-sm capitalize mt-1">
            {(baselineEvaluation.recommendation || "").replace(/_/g, " ")}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {baselineEvaluation.reasoning}
          </p>
        </div>
        <div className="rounded-lg bg-muted/40 p-4">
          <p className="text-xs text-muted-foreground mb-2">AI vs Baseline Agreement</p>
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              agreement.agreement === "exact"
                ? "bg-green-100 text-green-800"
                : agreement.agreement === "adjacent"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-red-100 text-red-800"
            }`}
          >
            {(agreement.agreement || "unknown").toUpperCase()}
          </span>
          <p className="text-xs text-muted-foreground mt-2">{agreement.explanation}</p>
        </div>
      </div>
    </div>
  )
}
