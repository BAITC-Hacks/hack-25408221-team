"use client"

import { Award, CheckCircle2, XCircle, Clock } from "lucide-react"
import { ApiUser } from "@/components/admin/types"

export function EvaluationTab({ applicant }: { applicant: ApiUser }) {
  const evaluation = applicant.session?.evaluation
  const applicantData = applicant.session?.applicant_data

  if (!evaluation) {
    return (
      <div className="rounded-xl border border-border bg-background p-6 text-center">
        <Award className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">No evaluation yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          AI evaluation will appear after the interview is completed and analyzed.
        </p>
      </div>
    )
  }

  const overallScore = evaluation.overall_score ?? 0
  const improvements = evaluation.areas_for_improvement ?? evaluation.concerns ?? []

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#CDFA1A] bg-[#CDFA1A]/10 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-lg">AI Evaluation</h3>
          {overallScore > 0 && (
            <div
              className={`flex h-20 w-20 items-center justify-center rounded-full text-3xl font-bold ${
                overallScore >= 8
                  ? "bg-green-500 text-white"
                  : overallScore >= 6
                    ? "bg-[#CDFA1A] text-foreground"
                    : "bg-red-500 text-white"
              }`}
            >
              {overallScore}/10
            </div>
          )}
        </div>

        {evaluation.strengths.length > 0 && (
          <div className="mb-5">
            <p className="text-sm font-medium mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Strengths
            </p>
            <div className="flex flex-wrap gap-2">
              {evaluation.strengths.map((s, i) => (
                <span
                  key={i}
                  className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {improvements.length > 0 && (
          <div className="mb-5">
            <p className="text-sm font-medium mb-2 flex items-center gap-2">
              <Award className="h-4 w-4 text-yellow-600" />
              Areas for Improvement
            </p>
            <div className="flex flex-wrap gap-2">
              {improvements.map((a, i) => (
                <span
                  key={i}
                  className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800"
                >
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 mb-4">
          <p className="text-sm font-medium">Recommendation:</p>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${
              ["strongly_recommended", "recommended"].includes(evaluation.recommendation)
                ? "bg-green-100 text-green-800"
                : evaluation.recommendation === "not_recommended"
                  ? "bg-red-100 text-red-800"
                  : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {["strongly_recommended", "recommended"].includes(evaluation.recommendation) ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : evaluation.recommendation === "not_recommended" ? (
              <XCircle className="h-4 w-4" />
            ) : (
              <Clock className="h-4 w-4" />
            )}
            {evaluation.recommendation === "strongly_recommended"
              ? "Strongly Recommended"
              : evaluation.recommendation === "recommended"
                ? "Recommended"
                : evaluation.recommendation === "not_recommended"
                  ? "Not Recommended"
                  : evaluation.recommendation === "needs_review"
                    ? "Needs Review"
                    : "Pending"}
          </span>
        </div>

        {(evaluation.notes || evaluation.overall_impression) && (
          <div className="rounded-lg bg-background p-4">
            <p className="text-sm font-medium mb-1">Notes</p>
            <p className="text-sm text-muted-foreground">
              {evaluation.notes || evaluation.overall_impression}
            </p>
          </div>
        )}

        {applicantData && (
          <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm">
            <div className="rounded-lg bg-background p-3">
              <p className="text-muted-foreground">Language</p>
              <p className="font-medium">{applicantData.language_used || "—"}</p>
            </div>
            <div className="rounded-lg bg-background p-3">
              <p className="text-muted-foreground">Confidence</p>
              <p className="font-medium capitalize">{applicantData.confidence_level || "—"}</p>
            </div>
            <div className="rounded-lg bg-background p-3">
              <p className="text-muted-foreground">Communication</p>
              <p className="font-medium capitalize">
                {applicantData.communication_quality || "—"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
