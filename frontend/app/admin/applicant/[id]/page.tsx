"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Navbar } from "@/components/layout/Navbar"
import { useAdminStore } from "@/stores/useAdminStore"
import { api } from "@/lib/api"
import { VideoTranscriptPlayer } from "@/components/admin/VideoTranscriptPlayer"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  Video,
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  Sparkles,
  Loader2,
  Quote,
  XCircle,
  Mic,
  Volume2,
  PenTool,
  BookOpen,
  History,
} from "lucide-react"

export default function ApplicantDossierPage() {
  const params = useParams()
  const id = params?.id as string
  const {
    selectedApplicant,
    englishStatus,
    committeeContext,
    fetchApplicantDossier,
    fetchCommitteeContext,
    decideRatingEvent,
    createRatingEvent,
    submitPlacementDecision,
    loading,
  } = useAdminStore()

  const [activeTab, setActiveTab] = useState<"interview" | "committee" | "english" | "decision">("interview")
  const [decisionNotes, setDecisionNotes] = useState("")
  const [deciding, setDeciding] = useState(false)
  const [decidedMsg, setDecidedMsg] = useState("")
  const [addingForIndicator, setAddingForIndicator] = useState<string | null>(null)
  const [newBand, setNewBand] = useState<"emerging" | "developing" | "strong">("strong")
  const [newQuote, setNewQuote] = useState("")
  const [submittingRating, setSubmittingRating] = useState(false)

  useEffect(() => {
    if (id) fetchApplicantDossier(id)
  }, [id, fetchApplicantDossier])

  useEffect(() => {
    if (selectedApplicant?.session?.id) {
      fetchCommitteeContext(selectedApplicant.session.id)
    }
  }, [selectedApplicant, fetchCommitteeContext])

  const handleAddRating = async (indicator: string) => {
    if (!selectedApplicant?.session?.id || !newQuote.trim()) return
    setSubmittingRating(true)
    await createRatingEvent(selectedApplicant.session.id, {
      indicator,
      band: newBand,
      quote: newQuote.trim(),
      status: "accepted",
    })
    setSubmittingRating(false)
    setAddingForIndicator(null)
    setNewQuote("")
  }

  const handleDecision = async (placement: "BACHELOR" | "FOUNDATION") => {
    const targetId = englishStatus?.session?.id || id
    if (!targetId) return
    setDeciding(true)
    await submitPlacementDecision(targetId, placement, decisionNotes)
    await fetchApplicantDossier(id)
    setDeciding(false)
    setDecidedMsg(`Placement officially confirmed as ${placement} Direct Entry.`)
  }

  if (loading || !selectedApplicant) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#84a305] dark:text-[#CDFA1A]" />
        </div>
      </div>
    )
  }

  const evalData = selectedApplicant.session?.evaluation
  const score = evalData?.overall_score
  const rec = evalData?.recommendation
  const strengths = evalData?.strengths || []
  const concerns = evalData?.concerns || []

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 flex-1 w-full space-y-6">
        {/* Top Breadcrumb & Candidate Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
          <div className="space-y-1">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground mb-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Applicants
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">
                {selectedApplicant.name}
              </h1>
              <Badge variant="outline" className="text-xs font-bold">
                {selectedApplicant.session?.program || "Undergraduate"}
              </Badge>
              {rec && (
                <Badge
                  variant={rec.includes("strongly") || rec === "recommended" ? "default" : "secondary"}
                  className="capitalize font-bold text-xs"
                >
                  {rec.replace(/_/g, " ")}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              ID: {selectedApplicant.id} · {selectedApplicant.email}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === "interview" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("interview")}
              className="rounded-xl text-xs gap-1.5"
            >
              <Video className="h-3.5 w-3.5" />
              Interview Video
            </Button>
            <Button
              variant={activeTab === "committee" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("committee")}
              className="rounded-xl text-xs gap-1.5"
            >
              <Quote className="h-3.5 w-3.5 text-[#84a305] dark:text-[#CDFA1A]" />
              Committee Ratings
            </Button>
            <Button
              variant={activeTab === "english" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("english")}
              className="rounded-xl text-xs gap-1.5"
            >
              <GraduationCap className="h-3.5 w-3.5" />
              English Qualification
            </Button>
            <Button
              variant={activeTab === "decision" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("decision")}
              className="rounded-xl text-xs gap-1.5"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Final Decision
            </Button>
          </div>
        </div>

        {/* TAB 1: AI INTERVIEW & VIDEO */}
        {activeTab === "interview" && (
          <div className="space-y-6">
            {selectedApplicant.session?.id ? (
              <VideoTranscriptPlayer
                sessionId={selectedApplicant.session.id}
                transcript={selectedApplicant.session.transcript || []}
              />
            ) : (
              <Card className="p-8 text-center text-muted-foreground text-xs">
                Candidate has not completed an interview session yet.
              </Card>
            )}

            {/* AI Evaluation Summary Cards */}
            {evalData && (
              <div className="grid gap-6 md:grid-cols-3">
                <Card className="p-6 border-border bg-card shadow-sm space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    AI Guide Impression
                  </span>
                  <p className="text-xs leading-relaxed text-foreground italic">
                    “{evalData.overall_impression || "No impression notes recorded."}”
                  </p>
                  {score && (
                    <div className="pt-2 border-t border-border flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Suitability Score:</span>
                      <span className="text-xl font-black text-foreground">{score}/10</span>
                    </div>
                  )}
                </Card>

                <Card className="p-6 border-border bg-card shadow-sm space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Observed Strengths
                  </span>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    {strengths.length > 0 ? (
                      strengths.map((s, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{s}</span>
                        </li>
                      ))
                    ) : (
                      <li>No specific strengths tagged.</li>
                    )}
                  </ul>
                </Card>

                <Card className="p-6 border-border bg-card shadow-sm space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Identified Concerns / Flags
                  </span>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    {concerns.length > 0 ? (
                      concerns.map((c, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <span>{c}</span>
                        </li>
                      ))
                    ) : (
                      <li>No red flags or concerns identified.</li>
                    )}
                  </ul>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: COMMITTEE EVIDENCE & VERBATIM QUOTES */}
        {activeTab === "committee" && (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              {[
                { key: "motivation_university" as const, label: "1. Motivation & Goals" },
                { key: "leadership" as const, label: "2. Leadership & Initiative" },
                { key: "prior_experience" as const, label: "3. Prior Experience" },
              ].map(({ key, label }) => {
                const events = committeeContext?.rating_events?.[key] || []
                return (
                  <Card key={key} className="p-6 border-border bg-card shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <div>
                        <h4 className="font-bold text-sm text-foreground">{label}</h4>
                        <span className="text-[10px] text-muted-foreground font-mono">{events.length} event(s)</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAddingForIndicator(addingForIndicator === key ? null : key)}
                        className="h-7 text-[11px] font-semibold rounded-lg hover:border-[#CDFA1A]"
                      >
                        {addingForIndicator === key ? "Cancel" : "+ Rate as Admin"}
                      </Button>
                    </div>

                    {/* Inline Add Rating Form */}
                    {addingForIndicator === key && (
                      <div className="rounded-xl border border-[#CDFA1A]/40 bg-secondary/30 p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-foreground">Band:</span>
                          <select
                            value={newBand}
                            onChange={(e) => setNewBand(e.target.value as "emerging" | "developing" | "strong")}
                            className="h-7 rounded-md border border-input bg-background px-2 text-[11px] font-bold capitalize"
                          >
                            <option value="emerging">Emerging</option>
                            <option value="developing">Developing</option>
                            <option value="strong">Strong</option>
                          </select>
                        </div>
                        <textarea
                          rows={2}
                          placeholder="Candidate quote or evaluation note…"
                          value={newQuote}
                          onChange={(e) => setNewQuote(e.target.value)}
                          className="w-full rounded-lg border border-input bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#CDFA1A]"
                        />
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            disabled={submittingRating || !newQuote.trim()}
                            onClick={() => handleAddRating(key)}
                            className="h-7 rounded-lg text-xs bg-[#CDFA1A] text-black font-extrabold hover:bg-[#b8e612]"
                          >
                            {submittingRating ? "Saving…" : "Save Rating"}
                          </Button>
                        </div>
                      </div>
                    )}

                    {events.length === 0 && addingForIndicator !== key ? (
                      <p className="text-xs text-muted-foreground italic py-6 text-center">
                        No quote proposed yet. Click &quot;+ Rate as Admin&quot; to evaluate.
                      </p>
                    ) : (
                      events.map((ev) => (
                        <div key={ev.id} className="space-y-3 rounded-xl border border-border bg-secondary/20 p-4">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold uppercase text-[10px] px-2 py-0.5 rounded-full border border-border bg-background">
                              {ev.band}
                            </span>
                            <Badge
                              variant={
                                ev.status === "accepted"
                                  ? "default"
                                  : ev.status === "rejected"
                                  ? "destructive"
                                  : "secondary"
                              }
                              className="capitalize text-[10px]"
                            >
                              {ev.status} ({ev.rater_type})
                            </Badge>
                          </div>

                          <div className="rounded-lg border-l-2 border-[#CDFA1A] bg-background p-3 italic text-xs leading-relaxed text-foreground">
                            “{ev.quote}”
                          </div>

                          {selectedApplicant.session?.id && (
                            <div className="flex items-center justify-end gap-2 pt-1">
                              <select
                                defaultValue={ev.band}
                                id={`dossier-band-${ev.id}`}
                                className="h-7 rounded-md border border-input bg-background px-1.5 text-[11px] font-semibold capitalize"
                              >
                                <option value="emerging">Emerging</option>
                                <option value="developing">Developing</option>
                                <option value="strong">Strong</option>
                              </select>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={ev.status === "rejected"}
                                onClick={() => decideRatingEvent(selectedApplicant.session!.id, ev.id, "rejected")}
                                className="h-7 rounded-lg text-[11px] gap-1 hover:bg-destructive/10 hover:text-destructive"
                              >
                                <XCircle className="h-3 w-3" />
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                disabled={ev.status === "accepted"}
                                onClick={() => {
                                  const sel = document.getElementById(`dossier-band-${ev.id}`) as HTMLSelectElement
                                  decideRatingEvent(selectedApplicant.session!.id, ev.id, "accepted", sel?.value || ev.band)
                                }}
                                className="h-7 rounded-lg text-[11px] gap-1 bg-[#CDFA1A] text-black font-bold hover:bg-[#b8e612]"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                Accept
                              </Button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {/* TAB 2: ENGLISH GATEWAY AUDIT */}
        {activeTab === "english" && (
          <div className="space-y-6">
            <Card className="p-6 border-border bg-card shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Language Status
                  </span>
                  <h3 className="text-2xl font-black mt-1">
                    {englishStatus?.placement
                      ? `${englishStatus.placement} DIRECT`
                      : "Pending English Verification"}
                  </h3>
                </div>
                {englishStatus?.placement_source && (
                  <Badge variant="outline" className="uppercase text-xs font-bold">
                    Source: {englishStatus.placement_source}
                  </Badge>
                )}
              </div>

              {/* If candidate submitted an English Certificate with PDF */}
              {englishStatus?.ielts && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        Official English Certificate Provided
                      </span>
                      <h4 className="text-lg font-black text-foreground">
                        {englishStatus.ielts.module} · Score: {englishStatus.ielts.overall}
                      </h4>
                    </div>
                    <Badge variant="default" className="text-[10px] uppercase font-bold">
                      {englishStatus.ielts.verdict}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Reference: <span className="font-mono font-semibold">{englishStatus.ielts.trf_number}</span>
                  </p>

                  <div className="pt-2">
                    <a
                      href={api.getCertificateFileUrl(englishStatus.id || selectedApplicant.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl bg-card border border-border px-4 py-2 text-xs font-bold text-foreground hover:bg-muted shadow-sm transition-colors"
                    >
                      <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      View Uploaded Certificate PDF
                    </a>
                  </div>
                </div>
              )}

              {englishStatus?.session ? (
                <div className="space-y-6">
                  <div className="rounded-xl border border-border bg-secondary/30 p-5 space-y-4">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>Proctored Test Session: {englishStatus.session.id.slice(0, 8)}…</span>
                      <Badge
                        variant={englishStatus.session.integrity_level === "red" ? "destructive" : "outline"}
                        className="text-[10px] uppercase font-bold"
                      >
                        Integrity: {englishStatus.session.integrity_level || "Green"}
                      </Badge>
                    </div>
                    {englishStatus.session.levels && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center pt-2 text-xs">
                        {Object.entries(englishStatus.session.levels).map(([skill, lvl]) => (
                          <div key={skill} className="p-3 bg-card rounded-xl border border-border">
                            <div className="text-muted-foreground uppercase text-[10px] font-bold">{skill}</div>
                            <div className="font-black text-sm text-foreground mt-0.5">Level {lvl}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Candidate Test Responses & Audio */}
                  {englishStatus.responses && englishStatus.responses.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-[#84a305] dark:text-[#CDFA1A]" />
                        Assessment Responses & Spoken Audio
                      </h4>

                      <div className="space-y-3">
                        {englishStatus.responses.map((resp) => (
                          <div
                            key={resp.id}
                            className="rounded-2xl border border-border bg-secondary/20 p-4 space-y-3 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                                {resp.section === "speaking" && <Mic className="h-3.5 w-3.5 text-emerald-500" />}
                                {resp.section === "writing" && <PenTool className="h-3.5 w-3.5 text-purple-500" />}
                                {resp.section === "reading" && <BookOpen className="h-3.5 w-3.5 text-blue-500" />}
                                {resp.section === "listening" && <Volume2 className="h-3.5 w-3.5 text-[#84a305] dark:text-[#CDFA1A]" />}
                                {resp.section} Section
                              </span>
                              {resp.correct !== undefined && (
                                <Badge variant={resp.correct ? "default" : "outline"} className="text-[10px]">
                                  {resp.correct ? "Correct" : "Incorrect"}
                                </Badge>
                              )}
                            </div>

                            {resp.prompt && (
                              <p className="text-xs text-muted-foreground italic">&ldquo;{resp.prompt}&rdquo;</p>
                            )}

                            {/* Speaking Audio Player */}
                            {resp.section === "speaking" && (
                              <div className="pt-1 space-y-2">
                                <audio controls className="w-full h-10 rounded-lg">
                                  <source src={api.getEnglishSpeakingAudioUrl(resp.id)} />
                                  Audio format not supported.
                                </audio>
                                {Boolean((resp.grade as Record<string, unknown>)?.per_task) && (
                                  <div className="rounded-xl border border-border bg-card p-3 text-[11px] text-muted-foreground space-y-1">
                                    <p className="font-semibold text-foreground">Whisper ASR Analysis:</p>
                                    <p>{JSON.stringify((resp.grade as Record<string, unknown>).per_task)}</p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Writing Essay Display */}
                            {resp.section === "writing" && typeof resp.answer === "string" && (
                              <div className="rounded-xl border border-border bg-card p-3.5 text-xs whitespace-pre-line leading-relaxed">
                                {resp.answer}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Proctoring Event Audit Log */}
                  {englishStatus.events && englishStatus.events.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <History className="h-3.5 w-3.5" />
                        Proctoring Integrity Event Log ({englishStatus.events.length} Events)
                      </h4>

                      <div className="max-h-60 overflow-y-auto rounded-2xl border border-border bg-secondary/20 p-3 space-y-2 font-mono text-[11px]">
                        {englishStatus.events.map((ev, i) => (
                          <div key={i} className="flex items-center justify-between py-1 border-b border-border/50 last:border-none">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">{ev.seq}.</span>
                              <Badge
                                variant={
                                  ev.type.includes("blur") || ev.type.includes("hidden") || ev.type.includes("exit")
                                    ? "destructive"
                                    : "outline"
                                }
                                className="text-[9px] py-0 px-1.5"
                              >
                                {ev.type}
                              </Badge>
                              {ev.section && <span className="text-muted-foreground">[{ev.section}]</span>}
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(ev.ts_server).toLocaleTimeString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Candidate has not completed the English placement test yet.</p>
              )}
            </Card>
          </div>
        )}

        {/* TAB 3: FINAL ADMISSIONS DECISION */}
        {activeTab === "decision" && (
          <Card className="p-8 border-border bg-card shadow-sm max-w-2xl space-y-6">
            <div>
              <h3 className="text-xl font-bold">Confirm Official Admission Placement</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                As an admissions officer, finalize the candidate&apos;s placement into Undergraduate Bachelor or Foundation Year.
              </p>
            </div>

            {decidedMsg && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>{decidedMsg}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">
                Admissions Notes & Committee Justification
              </label>
              <textarea
                rows={4}
                placeholder="Add committee rationale, test verification notes, or interview highlights…"
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                className="w-full rounded-xl border border-input bg-background p-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#CDFA1A]"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={() => handleDecision("BACHELOR")}
                disabled={deciding}
                className="flex-1 bg-[#CDFA1A] text-black font-extrabold hover:bg-[#b8e612] rounded-xl h-11"
              >
                Place in Bachelor Degree
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDecision("FOUNDATION")}
                disabled={deciding}
                className="flex-1 rounded-xl h-11 font-semibold"
              >
                Place in Foundation Year
              </Button>
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}
