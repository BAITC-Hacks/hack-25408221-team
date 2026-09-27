"use client"

import {
  BarChart3,
  Zap,
  Brain,
  Shield,
  Globe,
  TrendingUp,
  AlertTriangle,
} from "lucide-react"
import {
  CEFR_COLORS,
  TIER_COLORS,
  TIER_LABELS,
  QUESTION_LABELS,
} from "@/components/admin/types"
import { ScoreMeter, DimensionRow } from "./ScoreMeter"

export function AnalysisTab({
  metrics,
  metricsLoading,
}: {
  metrics: any
  metricsLoading: boolean
}) {
  if (metricsLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Loading analysis…
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="rounded-xl border border-border bg-background p-6 text-center">
        <BarChart3 className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">No analysis data yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Analysis is generated after the interview session completes.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Triage Tier */}
      {metrics.triage?.priority && (
        <div className="rounded-xl border border-border bg-background p-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-yellow-500" />
            <h3 className="font-semibold">Triage Priority</h3>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <span
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                TIER_COLORS[metrics.triage.priority.tier] || "bg-muted text-foreground"
              }`}
            >
              Tier {metrics.triage.priority.tier} —{" "}
              {metrics.triage.priority.label || TIER_LABELS[metrics.triage.priority.tier]}
            </span>
            {metrics.triage.priority.estimated_review_minutes && (
              <span className="text-sm text-muted-foreground">
                ~{metrics.triage.priority.estimated_review_minutes} min review
              </span>
            )}
          </div>
          {metrics.triage.priority.reasons?.length > 0 && (
            <ul className="space-y-1">
              {metrics.triage.priority.reasons.map((r: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* IAF Score */}
      {metrics.iaf_score && (
        <div className="rounded-xl border border-border bg-background p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-500" />
              <h3 className="font-semibold">IAF Competency Score</h3>
            </div>
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold ${
                metrics.iaf_score.iaf_score >= 70
                  ? "bg-green-500 text-white"
                  : metrics.iaf_score.iaf_score >= 50
                    ? "bg-[#CDFA1A] text-black"
                    : "bg-red-500 text-white"
              }`}
            >
              {metrics.iaf_score.iaf_score}
            </div>
          </div>
          <div className="space-y-3">
            {metrics.iaf_score.dimensions &&
              Object.entries(metrics.iaf_score.dimensions).map(([key, dim]: [string, any]) => (
                <DimensionRow
                  key={key}
                  label={key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  score={dim.score}
                />
              ))}
          </div>
          {metrics.iaf_score.top_dimensions?.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {metrics.iaf_score.top_dimensions.map((d: string) => (
                <span
                  key={d}
                  className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800"
                >
                  {d.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}
          {metrics.iaf_score.dimensions_needing_attention?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {metrics.iaf_score.dimensions_needing_attention.map((d: string) => (
                <span
                  key={d}
                  className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800"
                >
                  {d.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Authenticity Analysis */}
      {metrics.authenticity && (
        <div className="rounded-xl border border-border bg-background p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-500" />
              <h3 className="font-semibold">Authenticity Analysis</h3>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                metrics.authenticity.risk_level === "low"
                  ? "bg-green-100 text-green-800"
                  : metrics.authenticity.risk_level === "medium"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-red-100 text-red-800"
              }`}
            >
              {(metrics.authenticity.risk_level || "").toUpperCase()} RISK
            </span>
          </div>
          <ScoreMeter value={metrics.authenticity.authenticity_score} label="Authenticity Score" />
          <div className="mt-4 grid gap-3 md:grid-cols-2 text-sm">
            {metrics.authenticity.specificity && (
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-muted-foreground mb-1">Specificity</p>
                <p className="font-medium capitalize">{metrics.authenticity.specificity.level}</p>
                <p className="text-xs text-muted-foreground">
                  {metrics.authenticity.specificity.specific_hits} specific /{" "}
                  {metrics.authenticity.specificity.generic_hits} generic signals
                </p>
              </div>
            )}
            {metrics.authenticity.contribution_orientation && (
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-muted-foreground mb-1">Orientation</p>
                <p className="font-medium capitalize">
                  {(metrics.authenticity.contribution_orientation.orientation || "").replace(
                    /_/g,
                    " "
                  )}
                </p>
              </div>
            )}
            {metrics.authenticity.linguistic_signals && (
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-muted-foreground mb-1">Naturalness</p>
                <p className="font-medium">
                  {metrics.authenticity.linguistic_signals.naturalness_score}/100
                </p>
              </div>
            )}
            {metrics.authenticity.cross_session_similarity && (
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-muted-foreground mb-1">Cross-session match</p>
                <p
                  className={`font-medium ${
                    metrics.authenticity.cross_session_similarity.flag
                      ? "text-red-600"
                      : "text-green-600"
                  }`}
                >
                  {metrics.authenticity.cross_session_similarity.flag ? "Flagged" : "Clean"}
                </p>
              </div>
            )}
          </div>
          {metrics.authenticity.flags?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {metrics.authenticity.flags.map((f: string) => (
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
      )}

      {/* Language Proficiency */}
      {metrics.language_proficiency && (
        <div className="rounded-xl border border-border bg-background p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-teal-500" />
              <h3 className="font-semibold">Language Proficiency</h3>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-sm font-bold ${
                  CEFR_COLORS[metrics.language_proficiency.cefr_level] || "bg-muted"
                }`}
              >
                {metrics.language_proficiency.cefr_level}
              </span>
              {metrics.language_proficiency.ielts_equivalent && (
                <span className="text-sm text-muted-foreground">
                  IELTS ~{metrics.language_proficiency.ielts_equivalent}
                </span>
              )}
            </div>
          </div>
          <ScoreMeter
            value={metrics.language_proficiency.composite_score}
            label="Composite Score"
            className="mb-4"
          />
          <div className="mt-4 space-y-3">
            {metrics.language_proficiency.dimensions &&
              Object.entries(metrics.language_proficiency.dimensions).map(
                ([key, dim]: [string, any]) => (
                  <ScoreMeter
                    key={key}
                    value={dim.score}
                    label={key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    color={
                      dim.score >= 70
                        ? "bg-green-500"
                        : dim.score >= 50
                          ? "bg-[#CDFA1A]"
                          : "bg-red-500"
                    }
                  />
                )
              )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {metrics.language_proficiency.disclaimer}
          </p>
        </div>
      )}

      {/* Data Quality */}
      {metrics.data_quality && (
        <div className="rounded-xl border border-border bg-background p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-orange-500" />
            <h3 className="font-semibold">Data Quality</h3>
          </div>
          <ScoreMeter
            value={metrics.data_quality.overall_score}
            label="Overall Quality Score"
          />
          <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm">
            {metrics.data_quality.completeness && (
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-muted-foreground">Completeness</p>
                <p className="font-semibold">{metrics.data_quality.completeness.score}/100</p>
                <p className="text-xs text-muted-foreground">
                  {metrics.data_quality.completeness.answered_questions}/
                  {metrics.data_quality.completeness.total_questions} questions answered
                </p>
              </div>
            )}
            {metrics.data_quality.transcript_quality && (
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-muted-foreground">Transcript</p>
                <p className="font-semibold">
                  {metrics.data_quality.transcript_quality.score}/100
                </p>
                <p className="text-xs text-muted-foreground">
                  {metrics.data_quality.transcript_quality.word_count} words ·{" "}
                  {metrics.data_quality.transcript_quality.user_turns} turns
                </p>
              </div>
            )}
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-muted-foreground">Has Evaluation</p>
              <p
                className={`font-semibold ${
                  metrics.data_quality.has_evaluation ? "text-green-600" : "text-yellow-600"
                }`}
              >
                {metrics.data_quality.has_evaluation ? "Yes" : "No"}
              </p>
            </div>
          </div>
          {metrics.data_quality.missing_answers?.has_issues && (
            <div className="mt-3 space-y-1">
              {metrics.data_quality.missing_answers.issues.map((issue: any, i: number) => (
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
      )}

      {/* Baseline vs AI Agreement */}
      {metrics.baseline_evaluation && metrics.agreement && (
        <div className="rounded-xl border border-border bg-background p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-indigo-500" />
            <h3 className="font-semibold">Baseline Evaluation & AI Agreement</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg bg-muted/40 p-4">
              <p className="text-xs text-muted-foreground mb-2">Baseline Score</p>
              <p className="text-2xl font-bold">{metrics.baseline_evaluation.score}/10</p>
              <p className="text-sm capitalize mt-1">
                {(metrics.baseline_evaluation.recommendation || "").replace(/_/g, " ")}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {metrics.baseline_evaluation.reasoning}
              </p>
            </div>
            <div className="rounded-lg bg-muted/40 p-4">
              <p className="text-xs text-muted-foreground mb-2">AI vs Baseline Agreement</p>
              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ${
                  metrics.agreement.agreement === "exact"
                    ? "bg-green-100 text-green-800"
                    : metrics.agreement.agreement === "adjacent"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800"
                }`}
              >
                {(metrics.agreement.agreement || "unknown").toUpperCase()}
              </span>
              <p className="text-xs text-muted-foreground mt-2">{metrics.agreement.explanation}</p>
            </div>
          </div>
        </div>
      )}

      {/* Explainability */}
      {metrics.explainability?.explanation && (
        <div className="rounded-xl border border-border bg-background p-5">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="h-4 w-4 text-violet-500" />
            <h3 className="font-semibold">AI Decision Explanation</h3>
          </div>
          <p className="text-sm font-medium mb-2">
            {metrics.explainability.explanation.short_summary}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            {metrics.explainability.explanation.explanation}
          </p>

          {metrics.explainability.explanation.factors?.length > 0 && (
            <div className="space-y-2 mb-4">
              {metrics.explainability.explanation.factors.map((f: any, i: number) => (
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

          {metrics.explainability.explanation.key_quotes?.length > 0 && (
            <div className="space-y-2 mb-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Key Quotes
              </p>
              {metrics.explainability.explanation.key_quotes.map((q: any, i: number) => (
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

          {metrics.explainability.explanation.uncertainty && (
            <div className="rounded-lg bg-muted/40 p-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Confidence</span>
              <span
                className={`font-semibold ${
                  metrics.explainability.explanation.uncertainty.verdict === "high_confidence"
                    ? "text-green-600"
                    : metrics.explainability.explanation.uncertainty.verdict === "medium_confidence"
                      ? "text-yellow-600"
                      : "text-red-600"
                }`}
              >
                {metrics.explainability.explanation.uncertainty.confidence_pct}% —{" "}
                {(metrics.explainability.explanation.uncertainty.verdict || "").replace(/_/g, " ")}
              </span>
            </div>
          )}

          {metrics.explainability.feature_importance?.features && (
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                Feature Importance
              </p>
              <div className="space-y-2">
                {Object.entries(metrics.explainability.feature_importance.features)
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
      )}

      {/* Error Analysis */}
      {metrics.error_analysis && (
        <div className="rounded-xl border border-border bg-background p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="font-semibold">Error & Edge Case Analysis</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Inconsistencies
              </p>
              {metrics.error_analysis.inconsistencies?.inconsistencies?.length > 0 ? (
                <div className="space-y-2">
                  {metrics.error_analysis.inconsistencies.inconsistencies.map(
                    (inc: any, i: number) => (
                      <div
                        key={i}
                        className={`rounded-lg p-2 text-xs ${
                          inc.severity === "high"
                            ? "bg-red-50 text-red-800"
                            : "bg-yellow-50 text-yellow-800"
                        }`}
                      >
                        {inc.detail}
                      </div>
                    )
                  )}
                </div>
              ) : (
                <p className="text-sm text-green-600">No inconsistencies detected</p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Edge Cases
              </p>
              {metrics.error_analysis.edge_cases?.edge_cases?.length > 0 ? (
                <div className="space-y-2">
                  {metrics.error_analysis.edge_cases.edge_cases.map((ec: any, i: number) => (
                    <div
                      key={i}
                      className={`rounded-lg p-2 text-xs ${
                        ec.severity === "critical" || ec.severity === "high"
                          ? "bg-red-50 text-red-800"
                          : "bg-yellow-50 text-yellow-800"
                      }`}
                    >
                      {ec.detail}
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Reliability:{" "}
                    <span className="font-medium capitalize">
                      {metrics.error_analysis.edge_cases.reliability}
                    </span>
                  </p>
                </div>
              ) : (
                <p className="text-sm text-green-600">No edge cases flagged</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
