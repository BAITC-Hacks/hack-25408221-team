"use client"

import { CheckCircle2, XCircle, Mail, Video, Award } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ApiUser, CEFR_COLORS, TIER_COLORS, TIER_LABELS } from "@/components/admin/types"

export function ApplicantSidebar({
  applicant,
  metrics,
  onViewAnalysis,
}: {
  applicant: ApiUser
  metrics: any
  onViewAnalysis: () => void
}) {
  return (
    <div className="space-y-6">
      {/* ML Quick Metrics */}
      {metrics && (
        <div className="rounded-xl border border-border bg-background p-6">
          <h3 className="font-semibold mb-4">ML Signals</h3>
          <div className="space-y-3 text-sm">
            {metrics.iaf_score && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">IAF Score</span>
                <span
                  className={`font-semibold ${
                    metrics.iaf_score.iaf_score >= 70
                      ? "text-green-600"
                      : metrics.iaf_score.iaf_score >= 50
                        ? "text-yellow-600"
                        : "text-red-600"
                  }`}
                >
                  {metrics.iaf_score.iaf_score}/100
                </span>
              </div>
            )}
            {metrics.authenticity && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Authenticity</span>
                <span
                  className={`font-semibold capitalize ${
                    metrics.authenticity.risk_level === "low"
                      ? "text-green-600"
                      : metrics.authenticity.risk_level === "medium"
                        ? "text-yellow-600"
                        : "text-red-600"
                  }`}
                >
                  {metrics.authenticity.risk_level} risk
                </span>
              </div>
            )}
            {metrics.language_proficiency && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Language</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    CEFR_COLORS[metrics.language_proficiency.cefr_level] || "bg-muted"
                  }`}
                >
                  {metrics.language_proficiency.cefr_level}
                </span>
              </div>
            )}
            {metrics.data_quality && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Data Quality</span>
                <span className="font-semibold">{metrics.data_quality.overall_score}/100</span>
              </div>
            )}
            {metrics.triage?.priority && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Triage</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    TIER_COLORS[metrics.triage.priority.tier] || "bg-muted"
                  }`}
                >
                  T{metrics.triage.priority.tier} {TIER_LABELS[metrics.triage.priority.tier]}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onViewAnalysis}
            className="mt-4 w-full rounded-lg border border-border py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            View Full Analysis →
          </button>
        </div>
      )}

      {/* Quick Actions */}
      <div className="rounded-xl border border-border bg-background p-6">
        <h3 className="font-semibold mb-4">Quick Actions</h3>
        <div className="space-y-2">
          <Button className="w-full justify-start bg-green-600 hover:bg-green-700 text-white">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Approve Application
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50"
          >
            <XCircle className="mr-2 h-4 w-4" />
            Reject Application
          </Button>
          <Button variant="outline" className="w-full justify-start">
            <Mail className="mr-2 h-4 w-4" />
            Send Email
          </Button>
        </div>
      </div>

      {/* Application Timeline */}
      <div className="rounded-xl border border-border bg-background p-6">
        <h3 className="font-semibold mb-4">Application Timeline</h3>
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#CDFA1A]">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div className="w-0.5 flex-1 bg-[#CDFA1A]" />
            </div>
            <div className="pb-4">
              <p className="font-medium">Application Submitted</p>
              <p className="text-sm text-muted-foreground">
                {applicant.session?.created_at
                  ? new Date(applicant.session.created_at).toLocaleDateString()
                  : "—"}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  applicant.has_recording ? "bg-green-500" : "bg-muted"
                }`}
              >
                <Video
                  className={`h-4 w-4 ${
                    applicant.has_recording ? "text-white" : "text-muted-foreground"
                  }`}
                />
              </div>
              {applicant.session?.completed_at && <div className="w-0.5 flex-1 bg-[#CDFA1A]" />}
            </div>
            <div className="pb-4">
              <p className="font-medium">Interview Completed</p>
              <p className="text-sm text-muted-foreground">
                {applicant.session?.completed_at
                  ? new Date(applicant.session.completed_at).toLocaleDateString()
                  : applicant.has_recording
                    ? "Recording submitted"
                    : "Pending"}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  applicant.session?.evaluation ? "bg-green-500" : "bg-muted"
                }`}
              >
                <Award
                  className={`h-4 w-4 ${
                    applicant.session?.evaluation ? "text-white" : "text-muted-foreground"
                  }`}
                />
              </div>
            </div>
            <div>
              <p className="font-medium">AI Evaluation</p>
              <p className="text-sm text-muted-foreground">
                {applicant.session?.evaluation
                  ? "Completed"
                  : applicant.has_recording
                    ? "Processing"
                    : "Waiting for interview"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
