"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useEnglishStore } from "@/stores/useEnglishStore"
import { useProctor } from "@/lib/english/useProctor"
import { useCountdown } from "@/lib/english/useCountdown"
import { CheckinPanel, Gates } from "./CheckinPanel"
import { ProctorOverlay } from "./ProctorOverlay"
import { ObjectiveSection } from "./ObjectiveSection"
import { WritingSection } from "./WritingSection"
import { SpeakingSection } from "./SpeakingSection"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Volume2,
  BookOpen,
  PenTool,
  Mic,
  Clock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from "lucide-react"

const SECTION_LABELS: Record<string, string> = {
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  speaking: "Speaking",
}

const SECTION_ORDER = ["listening", "reading", "writing", "speaking"]

export function ProctoredTestRunner() {
  const router = useRouter()
  const {
    phase,
    sessionId,
    token,
    currentSection,
    stage,
    items,
    deadline,
    submitting,
    errorMessage,
    placement,
    proctorResources,
    setProctorResources,
    initTestSession,
    submitCheckin,
    submitAnswers,
    afterAnswer,
    handleSectionExpiry,
  } = useEnglishStore()

  const bootstrapped = useRef(false)

  useEffect(() => {
    if (bootstrapped.current) return
    bootstrapped.current = true
    void initTestSession()
  }, [initTestSession])

  // Continuous live proctoring
  const proctor = useProctor(
    sessionId,
    currentSection,
    phase === "section",
    proctorResources,
    token
  )

  // Countdown timer
  const handleDeadlineExpired = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("assessment-expired"))
    }
  }

  const countdown = useCountdown(deadline, handleDeadlineExpired)

  // Deadline auto-expire watcher: if time runs out, ping backend /expire
  useEffect(() => {
    if (phase !== "section" || !deadline || !sessionId) return
    let busy = false
    const timer = setInterval(async () => {
      if (busy || Date.now() < new Date(deadline).getTime() + 4000) return
      busy = true
      try {
        await handleSectionExpiry()
      } finally {
        busy = false
      }
    }, 1500)
    return () => clearInterval(timer)
  }, [phase, deadline, sessionId, handleSectionExpiry])

  // Check-in Gate Handler
  const handlePassCheckin = async (gates: Gates) => {
    await submitCheckin(gates, true)
  }

  if (phase === "idle") {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-[#84a305] dark:text-[#CDFA1A]" />
        <p className="text-sm font-semibold text-muted-foreground">Preparing proctored testing environment…</p>
      </div>
    )
  }

  if (phase === "error") {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-destructive/20 bg-card p-8 sm:p-10 text-center space-y-5 shadow-xl">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mx-auto">
          <AlertCircle className="h-8 w-8 stroke-[2.5]" />
        </div>
        <h3 className="text-xl font-black text-foreground">Assessment Notice</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {errorMessage || "Unable to proceed with assessment. You may have already completed your attempt."}
        </p>
        <Button
          onClick={() => router.push("/dashboard")}
          variant="outline"
          className="rounded-xl h-11 text-xs px-6"
        >
          Return to Candidate Dashboard
        </Button>
      </div>
    )
  }

  if (phase === "checkin") {
    return (
      <div className="py-4">
        <CheckinPanel
          onPassed={handlePassCheckin}
          onResources={(res) => setProctorResources(res)}
        />
      </div>
    )
  }

  if (phase === "finishing" || phase === "grading") {
    return (
      <Card className="mx-auto max-w-lg p-10 border-border bg-card shadow-2xl text-center space-y-6 rounded-3xl">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#CDFA1A]/20 text-[#627a05] dark:text-[#CDFA1A] mx-auto animate-pulse">
          <Loader2 className="h-9 w-9 animate-spin" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-foreground">Evaluating CEFR Performance</h2>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
            Scoring listening and reading items, evaluating essay syntax via LanguageTool & Gemini LLM rubric, and analyzing spoken fluency via Whisper ASR…
          </p>
        </div>
      </Card>
    )
  }

  if (phase === "done") {
    return (
      <Card className="mx-auto max-w-xl p-8 sm:p-12 border-border bg-card shadow-2xl text-center space-y-6 rounded-3xl">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mx-auto">
          <CheckCircle2 className="h-10 w-10 stroke-[2.5]" />
        </div>

        <div className="space-y-2">
          <span className="text-[10px] uppercase font-extrabold tracking-wider text-muted-foreground">
            Official Placement Confirmed
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
            {placement ? `${placement} Direct Entry` : "Placement Recorded"}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
            Your CEFR score has been validated across all four skills and saved directly to your university admissions file.
          </p>
        </div>

        <Button
          onClick={() => router.push("/dashboard")}
          className="bg-[#CDFA1A] text-black font-extrabold hover:bg-[#b8e612] rounded-2xl h-14 px-8 text-sm gap-2 shadow-lg"
        >
          Return to Candidate Dashboard
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Card>
    )
  }

  const sectionIndex = currentSection ? SECTION_ORDER.indexOf(currentSection) : 0
  const progressPercent = Math.round(((sectionIndex + 1) / SECTION_ORDER.length) * 100)

  return (
    <div className="space-y-6">
      {/* Proctoring Interruption Blocker Modal */}
      <ProctorOverlay
        reasons={proctor.reasons}
        onReconnect={() => useEnglishStore.setState({ phase: "checkin" })}
      />

      {/* Test Section Header Card */}
      <Card className="p-5 sm:p-6 border-border bg-card shadow-md space-y-4 rounded-3xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#CDFA1A]/20 text-[#627a05] dark:text-[#CDFA1A]">
              {currentSection === "listening" && <Volume2 className="h-6 w-6 stroke-[2.5]" />}
              {currentSection === "reading" && <BookOpen className="h-6 w-6 stroke-[2.5]" />}
              {currentSection === "writing" && <PenTool className="h-6 w-6 stroke-[2.5]" />}
              {currentSection === "speaking" && <Mic className="h-6 w-6 stroke-[2.5]" />}
            </div>
            <div>
              <h2 className="text-lg font-black capitalize text-foreground flex items-center gap-2">
                Section: {currentSection ? SECTION_LABELS[currentSection] : ""}
                {stage && stage !== "single" && stage !== "routing" && (
                  <Badge variant="outline" className="text-[10px] font-mono capitalize">
                    {stage} Stage
                  </Badge>
                )}
              </h2>
              <p className="text-xs text-muted-foreground">inVision CEFR Standardized Placement Exam</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {deadline && (
              <Badge
                variant={countdown.low ? "destructive" : "outline"}
                className="text-xs font-mono font-bold py-1.5 px-3 gap-1.5"
              >
                <Clock className="h-3.5 w-3.5" />
                {countdown.label}
              </Badge>
            )}

            <Badge variant="outline" className="text-xs font-semibold gap-1.5 py-1 px-3 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Proctoring
            </Badge>
          </div>
        </div>

        {/* Section Progress Track */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] font-bold text-muted-foreground">
            <span>Progress: Skill {sectionIndex + 1} of 4</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-[#CDFA1A] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </Card>

      {/* Network Warning Banner */}
      {!proctor.networkOk && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Connection interrupted. Activity logs will retry automatically. Your timer continues.</span>
        </div>
      )}

      {/* Main Section Content Area */}
      <div
        inert={proctor.reasons.length > 0}
        style={{ visibility: proctor.reasons.length > 0 ? "hidden" : "visible" }}
      >
        {/* Sections 1 & 2: Listening & Reading */}
        {(currentSection === "listening" || currentSection === "reading") && (
          <ObjectiveSection
            key={`${currentSection}-${items.map((i) => i.id).join(",")}`}
            section={currentSection}
            items={items}
            submitting={submitting}
            onSubmit={(formatted) => submitAnswers(formatted)}
            sessionId={sessionId}
          />
        )}

        {/* Section 3: Writing */}
        {currentSection === "writing" && items[0] && (
          <WritingSection
            key={items[0].id}
            item={items[0]}
            submitting={submitting}
            onSubmit={(text) => submitAnswers([{ item_id: items[0].id, answer: text }])}
            sessionId={sessionId}
          />
        )}

        {/* Section 4: Speaking */}
        {currentSection === "speaking" && sessionId && (
          <SpeakingSection
            key={sessionId}
            sessionId={sessionId}
            initialItems={items}
            onSectionComplete={(res) => afterAnswer(res)}
            token={token}
          />
        )}
      </div>
    </div>
  )
}
