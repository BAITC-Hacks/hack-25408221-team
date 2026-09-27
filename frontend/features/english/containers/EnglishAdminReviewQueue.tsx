"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Users,
  CheckCircle2,
  AlertCircle,
  Eye,
  Volume2,
  Loader2,
  X,
  FileText,
  Shield,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Candidate, Dashboard, CandidateDetail, CEFR_LABELS } from "../types"
import {
  adminGetDashboard,
  adminGetCandidateDetail,
  adminSubmitDecision,
  getMediaUrl,
} from "../api/endpoints"

export function EnglishAdminReviewQueue() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  const [detail, setDetail] = useState<CandidateDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [decisionNotes, setDecisionNotes] = useState("")
  const [submittingDecision, setSubmittingDecision] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminGetDashboard()
      setDashboard(data)
    } catch {
      setError("Failed to load English assessment review queue from server.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function openDetail(candidateId: string) {
    setSelectedCandidateId(candidateId)
    setLoadingDetail(true)
    setDecisionNotes("")
    try {
      const data = await adminGetCandidateDetail(candidateId)
      setDetail(data)
    } catch {
      setDetail(null)
    } finally {
      setLoadingDetail(false)
    }
  }

  async function handleDecision(placement: "BACHELOR" | "FOUNDATION", sessionId: string) {
    setSubmittingDecision(true)
    try {
      await adminSubmitDecision(sessionId, { placement, notes: decisionNotes })
      setSelectedCandidateId(null)
      setDetail(null)
      await loadData()
    } catch {
      alert("Failed to submit placement decision. Please try again.")
    } finally {
      setSubmittingDecision(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground space-x-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading English review queue…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-card p-8 text-center space-y-3">
        <p className="text-red-600 font-medium">{error}</p>
        <Button variant="outline" size="sm" onClick={loadData}>
          Retry
        </Button>
      </div>
    )
  }

  const applicants = dashboard?.applicants || []

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs uppercase font-medium text-muted-foreground">Total In Queue</p>
          <p className="text-2xl font-bold mt-1">{applicants.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs uppercase font-medium text-muted-foreground">Needs Review</p>
          <p className="text-2xl font-bold mt-1 text-amber-600">
            {applicants.filter((a) => a.state === "needs_review").length}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs uppercase font-medium text-muted-foreground">Placed</p>
          <p className="text-2xl font-bold mt-1 text-green-600">
            {applicants.filter((a) => a.state === "placed").length}
          </p>
        </div>
      </div>

      {/* Review Queue Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                <th className="px-6 py-4">Candidate</th>
                <th className="px-6 py-4">State</th>
                <th className="px-6 py-4">Skill Levels (CEFR)</th>
                <th className="px-6 py-4">Integrity</th>
                <th className="px-6 py-4">Placement</th>
                <th className="px-6 py-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {applicants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    No English candidates found in review queue.
                  </td>
                </tr>
              ) : (
                applicants.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold">{c.full_name}</p>
                      <p className="text-xs text-muted-foreground">{c.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium uppercase">
                        {c.state.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1.5 flex-wrap">
                        {["listening", "reading", "writing", "speaking"].map((skill) => {
                          const lvl = c.levels[skill]
                          return (
                            <span
                              key={skill}
                              className="rounded px-1.5 py-0.5 text-[11px] font-mono bg-muted text-foreground"
                            >
                              {skill[0].toUpperCase()}:{" "}
                              {lvl !== null && lvl !== undefined ? CEFR_LABELS[lvl] || `L${lvl}` : "—"}
                            </span>
                          )
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          c.integrity === "critical"
                            ? "bg-red-100 text-red-700"
                            : c.integrity === "flagged"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-green-100 text-green-700"
                        }`}
                      >
                        <Shield className="h-3 w-3" />
                        {c.integrity || "Clean"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {c.placement ? (
                        <span className="font-bold text-xs uppercase px-2 py-0.5 rounded bg-[#CDFA1A]/20">
                          {c.placement}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => openDetail(c.id)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Review
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Candidate Review Modal */}
      {selectedCandidateId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setSelectedCandidateId(null)}
        >
          <div
            className="relative w-full max-w-4xl rounded-xl border border-border bg-card p-6 md:p-8 space-y-6 shadow-2xl my-8 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-xl font-bold">{detail?.full_name || "Candidate Assessment"}</h3>
                <p className="text-xs text-muted-foreground">{detail?.email}</p>
              </div>
              <button
                onClick={() => setSelectedCandidateId(null)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loadingDetail ? (
              <div className="py-16 text-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                <span>Loading full assessment record…</span>
              </div>
            ) : !detail ? (
              <p className="text-red-500 text-sm">Failed to load candidate details.</p>
            ) : (
              <div className="space-y-6">
                {/* Responses Log */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Section Responses & Evidence
                  </h4>
                  {detail.responses.map((resp, i) => (
                    <div key={resp.id || i} className="rounded-lg border border-border p-4 space-y-3 bg-muted/10">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold uppercase text-[#6B8E23]">
                          {resp.section} · Item {resp.item_id}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{resp.prompt}</p>

                      {/* Text answer */}
                      {typeof resp.answer?.value === "string" && (
                        <div className="p-3 rounded bg-background border border-border text-sm font-serif leading-relaxed">
                          {resp.answer.value}
                        </div>
                      )}

                      {/* Audio response player */}
                      {resp.media_path && (
                        <div className="flex items-center gap-3 p-3 rounded bg-background border border-border">
                          <Volume2 className="h-4 w-4 text-[#6B8E23]" />
                          <audio controls src={getMediaUrl(resp.media_path)} className="w-full h-8" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Placement Decision Form */}
                <div className="rounded-xl border border-border bg-muted/20 p-5 space-y-4">
                  <h4 className="text-sm font-bold">Admissions Final Placement Decision</h4>
                  <textarea
                    rows={2}
                    value={decisionNotes}
                    onChange={(e) => setDecisionNotes(e.target.value)}
                    placeholder="Optional reviewer notes or justification…"
                    className="w-full rounded-lg border border-input bg-background p-3 text-sm outline-none focus:border-foreground"
                  />
                  <div className="flex gap-3">
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold"
                      disabled={submittingDecision}
                      onClick={() => handleDecision("BACHELOR", selectedCandidateId)}
                    >
                      Place as Direct Bachelor
                    </Button>
                    <Button
                      className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                      disabled={submittingDecision}
                      onClick={() => handleDecision("FOUNDATION", selectedCandidateId)}
                    >
                      Place into Foundation Year
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
