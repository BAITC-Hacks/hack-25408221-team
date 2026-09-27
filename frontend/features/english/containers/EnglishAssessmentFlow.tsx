"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { AlertCircle, Clock, Loader2, CheckCircle2, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  ClientItem,
  FinishResult,
  Gates,
  ProctorResources,
  AnswersResult,
  CheckinResult,
} from "../types"
import {
  getMe,
  getCurrentSession,
  createSession,
  submitCheckin,
  submitAnswers,
  finishSession,
  startDemoApplicant,
} from "../api/endpoints"
import { getLocalToken, clearLocalToken, setLocalSessionId } from "../api/client"
import { useProctor } from "../hooks/useProctor"
import { useCountdown } from "../hooks/useCountdown"
import { CheckinPanel } from "../components/CheckinPanel"
import { ObjectiveSection } from "../components/ObjectiveSection"
import { WritingSection } from "../components/WritingSection"
import { SpeakingSection } from "../components/SpeakingSection"

type Phase = "loading" | "checkin" | "section" | "finishing" | "done" | "error"

export function EnglishAssessmentFlow({
  token,
  onComplete,
}: {
  token?: string
  onComplete?: (result: FinishResult) => void
}) {
  const [phase, setPhase] = useState<Phase>("loading")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [section, setSection] = useState<string | null>(null)
  const [items, setItems] = useState<ClientItem[]>([])
  const [deadline, setDeadline] = useState<string | undefined>(undefined)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [finishResult, setFinishResult] = useState<FinishResult | null>(null)
  const [resources, setResources] = useState<ProctorResources | null>(null)

  const activeToken = token || getLocalToken() || undefined

  const proctor = useProctor(sessionId, section, phase === "section", resources)

  useEffect(() => {
    return () => {
      resources?.camera.getTracks().forEach((t) => t.stop())
      resources?.screen.getTracks().forEach((t) => t.stop())
    }
  }, [resources])

  const onDeadlineExpire = useCallback(() => {
    window.dispatchEvent(new CustomEvent("assessment-expired"))
  }, [])

  const { label: timerLabel, low: timerLow } = useCountdown(deadline, onDeadlineExpire)

  const bootstrapped = useRef(false)

  const bootstrap = useCallback(async () => {
    try {
      let currentToken = activeToken
      if (!currentToken) {
        const demo = await startDemoApplicant()
        currentToken = demo.token
      }
      try {
        await getMe(currentToken)
      } catch (err: any) {
        if (err?.status === 401 || err?.status === 404) {
          clearLocalToken()
          const demo = await startDemoApplicant()
          currentToken = demo.token
          await getMe(currentToken)
        } else {
          throw err
        }
      }

      const existing = await getCurrentSession(currentToken)
      if (existing && ["decided", "needs_review"].includes(existing.state)) {
        setPhase("done")
        return
      }

      const res = existing || (await createSession(currentToken))
      setLocalSessionId(res.session_id)
      setSessionId(res.session_id)

      if (res.state === "grading") {
        setPhase("finishing")
        const result = await finishSession(res.session_id, currentToken)
        setFinishResult(result)
        setPhase("done")
        onComplete?.(result)
      } else {
        setPhase("checkin")
      }
    } catch (e: any) {
      if (e?.status === 409) {
        setError("You have already used your assessment attempt.")
      } else {
        setError(e?.detail ? String(e.detail) : "Could not initialize assessment session.")
      }
      setPhase("error")
    }
  }, [activeToken, onComplete])

  useEffect(() => {
    if (bootstrapped.current) return
    bootstrapped.current = true
    void bootstrap()
  }, [bootstrap])

  async function handleCheckinPassed(gates: Gates) {
    if (!sessionId) return
    try {
      const res = await submitCheckin(sessionId, gates, activeToken)
      if (res.passed && res.section && res.items) {
        setSection(res.section)
        setItems(res.items)
        setDeadline(res.deadline)
        setPhase("section")
      } else {
        throw new Error("Check-in validation was not accepted by the server.")
      }
    } catch (e: any) {
      setError(e instanceof Error ? e.message : "Check-in submission failed.")
    }
  }

  async function handleObjectiveSubmit(answers: { item_id: string; answer: unknown }[]) {
    if (!sessionId) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await submitAnswers(sessionId, answers, activeToken)
      handleSectionTransition(res)
    } catch (e: any) {
      setError(e?.detail ? String(e.detail) : "Failed to submit answers.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleWritingSubmit(text: string) {
    if (!sessionId || !items[0]) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await submitAnswers(sessionId, [{ item_id: items[0].id, answer: text }], activeToken)
      handleSectionTransition(res)
    } catch (e: any) {
      setError(e?.detail ? String(e.detail) : "Failed to submit writing response.")
    } finally {
      setSubmitting(false)
    }
  }

  function handleSectionTransition(res: AnswersResult) {
    if (res.section_complete && !res.next_section) {
      setPhase("finishing")
      void finishSession(sessionId!, activeToken)
        .then((finalRes) => {
          setFinishResult(finalRes)
          setPhase("done")
          onComplete?.(finalRes)
        })
        .catch((e: any) => {
          setError(e?.detail ? String(e.detail) : "Grading pipeline encountered an error.")
          setPhase("error")
        })
      return
    }

    if (res.items && res.items.length > 0) {
      if (res.next_section) setSection(res.next_section)
      setItems(res.items)
      setDeadline(res.deadline)
    }
  }

  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#6B8E23]" />
        <p className="text-sm text-muted-foreground">Initializing secure assessment environment…</p>
      </div>
    )
  }

  if (phase === "error") {
    return (
      <div className="rounded-xl border border-red-500/20 bg-card p-8 text-center space-y-4 max-w-lg mx-auto">
        <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
        <h2 className="text-lg font-bold">Assessment Error</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    )
  }

  if (phase === "finishing") {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center space-y-4 max-w-lg mx-auto">
        <Loader2 className="h-10 w-10 animate-spin text-[#6B8E23] mx-auto" />
        <h2 className="text-xl font-bold">Evaluating Responses</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your answers are being graded against the CEFR benchmark rubric. This may take up to two
          minutes. Please do not close this window.
        </p>
      </div>
    )
  }

  if (phase === "done") {
    return (
      <div className="rounded-xl border border-border bg-card p-8 md:p-12 text-center space-y-6 max-w-xl mx-auto">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mx-auto">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Assessment Completed</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Your English assessment has been securely submitted and recorded.
          </p>
        </div>

        {finishResult?.placement && (
          <div className="p-6 rounded-xl bg-muted/30 border border-border inline-block min-w-[280px]">
            <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider mb-1">
              Official Placement
            </p>
            <p className="text-2xl font-black text-foreground">{finishResult.placement}</p>
          </div>
        )}
      </div>
    )
  }

  if (phase === "checkin") {
    return (
      <div className="max-w-2xl mx-auto">
        <CheckinPanel
          onPassed={handleCheckinPassed}
          onResources={(r) => setResources(r)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Test Banner with Proctoring & Countdown */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-background border border-border sticky top-4 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
            {section?.toUpperCase()} SECTION
          </span>
        </div>

        {deadline && (
          <div
            className={`flex items-center gap-2 font-mono text-sm font-bold px-3 py-1.5 rounded-full border ${
              timerLow
                ? "bg-red-500/10 border-red-500 text-red-600 animate-pulse"
                : "bg-muted border-border text-foreground"
            }`}
          >
            <Clock className="h-4 w-4" />
            {timerLabel}
          </div>
        )}
      </div>

      {/* Proctoring Warning Overlay / Banner */}
      {proctor.reasons.length > 0 && (
        <div className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400 space-y-2 animate-bounce">
          <div className="flex items-center gap-2 font-bold text-sm">
            <ShieldAlert className="h-5 w-5" />
            <span>Attention: Test Integrity Warning</span>
          </div>
          <ul className="text-xs space-y-1 list-disc list-inside">
            {proctor.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Section Runner */}
      {(section === "listening" || section === "reading") && (
        <ObjectiveSection
          section={section}
          items={items}
          submitting={submitting}
          onSubmit={handleObjectiveSubmit}
        />
      )}

      {section === "writing" && items[0] && (
        <WritingSection
          item={items[0]}
          submitting={submitting}
          onSubmit={handleWritingSubmit}
        />
      )}

      {section === "speaking" && sessionId && (
        <SpeakingSection
          sessionId={sessionId}
          initialItems={items}
          onSectionComplete={handleSectionTransition}
        />
      )}
    </div>
  )
}
