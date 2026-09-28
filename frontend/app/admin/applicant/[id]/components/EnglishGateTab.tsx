"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, AlertCircle, Volume2, Shield, GraduationCap, Loader2, ArrowRight } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { CEFR_LABELS } from "@/features/english/types"

export function EnglishGateTab({ applicantId }: { applicantId: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!applicantId) return
    setLoading(true)
    api
      .getEnglishApplicantStatus(applicantId)
      .then(setData)
      .catch((err) => {
        if (err?.message?.includes("not_found") || err?.status === 404) {
          setData(null)
        } else {
          setError("Failed to load English Gate status.")
        }
      })
      .finally(() => setLoading(false))
  }, [applicantId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading English Gate record…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <AlertCircle className="mr-2 inline h-4 w-4" />
        {error}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-border bg-background p-8 text-center">
        <GraduationCap className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">No English Gate Assessment Yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          This applicant has not yet submitted an IELTS score or taken the online placement test.
        </p>
      </div>
    )
  }

  const { placement, placement_source, state, ielts, session, responses } = data

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="rounded-xl border border-border bg-background p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              English Proficiency Result
            </span>
            <div className="mt-1 flex items-center gap-3">
              <h2 className="text-2xl font-bold">
                {placement ? (
                  <span className={placement === "BACHELOR" ? "text-green-600" : "text-blue-600"}>
                    {placement} DIRECT
                  </span>
                ) : (
                  <span className="text-amber-600">PENDING PLACEMENT</span>
                )}
              </h2>
              {placement_source && (
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium uppercase text-muted-foreground">
                  Source: {placement_source}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Candidate status: <span className="font-semibold">{state}</span>
            </p>
          </div>

          <Link href="/admin/english">
            <Button variant="outline" size="sm" className="gap-2">
              Open English Review Queue
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* IELTS Verification Details */}
      {ielts && (
        <div className="rounded-xl border border-border bg-background p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Verified IELTS Certificate
            </h3>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                ielts.verdict === "VERIFIED"
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {ielts.verdict}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5 text-sm">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Overall Band</p>
              <p className="text-xl font-bold">{ielts.overall}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Listening</p>
              <p className="text-lg font-semibold">{ielts.listening}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Reading</p>
              <p className="text-lg font-semibold">{ielts.reading}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Writing</p>
              <p className="text-lg font-semibold">{ielts.writing}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Speaking</p>
              <p className="text-lg font-semibold">{ielts.speaking}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            TRF Number: <span className="font-mono">{ielts.trf_number}</span> · Module:{" "}
            <span className="capitalize">{ielts.module}</span>
          </p>
        </div>
      )}

      {/* Proctored Test Details */}
      {session && (
        <div className="rounded-xl border border-border bg-background p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-indigo-500" />
              Proctored Placement Test
            </h3>
            {session.integrity_level && (
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  session.integrity_level === "green"
                    ? "bg-green-100 text-green-800"
                    : session.integrity_level === "amber"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800"
                }`}
              >
                Integrity: {session.integrity_level.toUpperCase()} ({session.integrity_score || 0} pts)
              </span>
            )}
          </div>

          {/* CEFR Section Breakdown */}
          {session.levels && (
            <div className="grid gap-3 sm:grid-cols-4 text-center">
              {Object.entries(session.levels).map(([sec, lvl]: [string, any]) => (
                <div key={sec} className="rounded-lg bg-muted/30 p-3 border border-border">
                  <p className="text-xs uppercase text-muted-foreground font-semibold">{sec}</p>
                  <p className="text-xl font-bold mt-1 text-primary">
                    {lvl ? CEFR_LABELS[lvl] || `Level ${lvl}` : "—"}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Responses & Speaking Audio */}
          {responses?.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-border">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Submitted Responses & Audio
              </h4>
              <div className="space-y-3">
                {responses.map((resp: any) => (
                  <div key={resp.id} className="rounded-lg border border-border p-4 space-y-2 text-sm">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-semibold uppercase">{resp.section}</span>
                      {resp.grade?.level && (
                        <span className="font-bold text-foreground">
                          Score: {CEFR_LABELS[resp.grade.level] || `Level ${resp.grade.level}`}
                        </span>
                      )}
                    </div>
                    {resp.prompt && <p className="font-medium text-foreground">{resp.prompt}</p>}
                    {resp.answer?.value && (
                      <p className="rounded bg-muted/30 p-3 text-xs leading-relaxed font-serif">
                        {resp.answer.value}
                      </p>
                    )}
                    {resp.media_path && (
                      <div className="pt-2">
                        <audio
                          controls
                          src={`/api/english/admin/responses/${resp.id}/audio`}
                          className="w-full h-8"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
