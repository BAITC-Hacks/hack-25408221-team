"use client"

import { Brain } from "lucide-react"
import { QUESTION_LABELS } from "@/components/admin/types"

export function ExplainabilityCard({ explainability }: { explainability: any }) {
  if (!explainability?.explanation) return null
  const { explanation } = explainability

  return (
    <div className="rounded-xl border border-border bg-background p-5">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="h-4 w-4 text-violet-500" />
        <h3 className="font-semibold">AI Decision Explanation</h3>
      </div>
      <p className="text-sm font-medium mb-2">{explanation.short_summary}</p>
      <p className="text-sm text-muted-foreground mb-4">{explanation.explanation}</p>

      {explanation.factors?.length > 0 && (
        <div className="space-y-2 mb-4">
          {explanation.factors.map((f: any, i: number) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span
                className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                  f.impact === "positive"
                    ? "bg-green-500"
                    : f.impact === "negative"
                      ? "bg-red-500"
                      : "bg-gray-400"
                }`}
              />
              <span>{f.factor}</span>
            </div>
          ))}
        </div>
      )}

      {explanation.key_quotes?.length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Key Quotes
          </p>
          {explanation.key_quotes.map((q: any, i: number) => (
            <blockquote
              key={i}
              className={`border-l-2 pl-3 text-sm italic ${
                q.impact === "positive" ? "border-green-500" : "border-red-400"
              }`}
            >
              &ldquo;{q.quote}&rdquo;
            </blockquote>
          ))}
        </div>
      )}

      {explanation.uncertainty && (
        <div className="rounded-lg bg-muted/40 p-3 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Confidence</span>
          <span
            className={`font-semibold ${
              explanation.uncertainty.verdict === "high_confidence"
                ? "text-green-600"
                : explanation.uncertainty.verdict === "medium_confidence"
                  ? "text-yellow-600"
                  : "text-red-600"
            }`}
          >
            {explanation.uncertainty.confidence_pct}% —{" "}
            {(explanation.uncertainty.verdict || "").replace(/_/g, " ")}
          </span>
        </div>
      )}

      {explainability.feature_importance?.features && (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Feature Importance
          </p>
          <div className="space-y-2">
            {Object.entries(explainability.feature_importance.features)
              .sort(([, a]: any, [, b]: any) => b.importance - a.importance)
              .map(([key, feat]: [string, any]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-36 shrink-0 text-xs text-muted-foreground">
                    {QUESTION_LABELS[key] || key}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-muted">
                    <div
                      className={`h-2 rounded-full ${
                        feat.signal === "positive"
                          ? "bg-green-500"
                          : feat.signal === "negative"
                            ? "bg-red-500"
                            : "bg-gray-400"
                      }`}
                      style={{
                        width: `${Math.round(
                          (feat.normalized_importance || feat.importance) * 100
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs">
                    {Math.round((feat.normalized_importance || feat.importance) * 100)}%
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
