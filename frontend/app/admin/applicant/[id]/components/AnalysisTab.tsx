"use client"

import { BarChart3 } from "lucide-react"
import { TriageCard } from "./analysis/TriageCard"
import { IafCard } from "./analysis/IafCard"
import { AuthenticityCard } from "./analysis/AuthenticityCard"
import { LanguageCard } from "./analysis/LanguageCard"
import { DataQualityCard } from "./analysis/DataQualityCard"
import { BaselineAgreementCard } from "./analysis/BaselineAgreementCard"
import { ExplainabilityCard } from "./analysis/ExplainabilityCard"
import { AnomaliesCard } from "./analysis/AnomaliesCard"

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
      <TriageCard triage={metrics.triage} />
      <IafCard iafScore={metrics.iaf_score} />
      <AuthenticityCard authenticity={metrics.authenticity} />
      <LanguageCard languageProficiency={metrics.language_proficiency} />
      <DataQualityCard dataQuality={metrics.data_quality} />
      <BaselineAgreementCard
        baselineEvaluation={metrics.baseline_evaluation}
        agreement={metrics.agreement}
      />
      <ExplainabilityCard explainability={metrics.explainability} />
      <AnomaliesCard errorAnalysis={metrics.error_analysis} />
    </div>
  )
}
