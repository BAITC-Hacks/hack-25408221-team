"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Navbar } from "@/components/layout/Navbar"
import { useAuthStore } from "@/stores/useAuthStore"
import { useEnglishStore } from "@/stores/useEnglishStore"
import { api } from "@/lib/api"
import { CertificateUploadModal } from "@/components/english/CertificateUploadModal"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Video,
  GraduationCap,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileCheck,
  FileText,
  Loader2,
  Sparkles,
} from "lucide-react"

export default function CandidateDashboardPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading, initialize, program, setProgram } = useAuthStore()
  const { placement, placementSource, skipTest } = useEnglishStore()

  const [englishRecord, setEnglishRecord] = useState<any>(null)
  const [candidateSession, setCandidateSession] = useState<any>(null)
  const [certModalOpen, setCertModalOpen] = useState(false)
  const [skipping, setSkipping] = useState(false)

  const reloadData = async () => {
    if (!user) return
    try {
      const eng = await api.getEnglishAuthLink().catch(() => null)
      if (eng) setEnglishRecord(eng)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.replace("/signin")
      } else if (user?.role === "admin") {
        router.replace("/admin")
      }
    }
  }, [isAuthenticated, isLoading, user, router])

  useEffect(() => {
    if (user) {
      reloadData()
    }
  }, [user])

  const handleSkipEnglish = async () => {
    setSkipping(true)
    await skipTest("native_speaker_or_waiver")
    await reloadData()
    setSkipping(false)
  }

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-[#84a305] dark:text-[#CDFA1A]" />
      </div>
    )
  }

  const effectivePlacement = englishRecord?.placement || placement
  const effectiveSource = englishRecord?.placement_source || placementSource
  const englishSatisfied = Boolean(effectivePlacement)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 flex-1 w-full space-y-8">
        {/* Welcome Header */}
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Admissions Portal
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground">
              Welcome, {user?.name || "Applicant"}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Program Track:{" "}
              <span className="font-bold text-foreground">
                {program || "Undergraduate (IT Product Design)"}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={program}
              onChange={(e) => setProgram(e.target.value)}
              className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#CDFA1A]"
            >
              <option value="Undergraduate">Undergraduate (4 Years)</option>
              <option value="Foundation">Foundation Year (1 Year)</option>
            </select>
          </div>
        </div>

        {/* 2 Core Requirements */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Requirement 1: Video Interview Presentation */}
          <Card className="p-6 sm:p-8 border-border bg-card shadow-sm rounded-3xl flex flex-col justify-between hover:border-[#CDFA1A]/60 transition-all space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#CDFA1A]/20 text-[#627a05] dark:text-[#CDFA1A]">
                  <Video className="h-6 w-6 stroke-[2.5]" />
                </div>
                <Badge variant="outline" className="text-xs font-bold">
                  Step 1 of 2
                </Badge>
              </div>

              <div>
                <h3 className="text-xl font-bold text-foreground">
                  Video Interview Presentation
                </h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  A 5-minute video conversation with our admissions guide. Answer 6 structured questions covering your motivation, leadership experience, and background.
                </p>
              </div>

              <div className="space-y-2 rounded-2xl border border-border bg-secondary/30 p-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Format:</span>
                  <span className="font-semibold text-foreground">Live WebM Video + Voice</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Time limit:</span>
                  <span className="font-semibold text-foreground">5 minutes total</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Questions:</span>
                  <span className="font-semibold text-foreground">6 questions (in English)</span>
                </div>
              </div>
            </div>

            <div>
              <Link href="/interview" className="block">
                <Button className="w-full bg-[#CDFA1A] text-black font-extrabold hover:bg-[#b8e612] rounded-xl h-12 gap-2 shadow-sm text-sm">
                  Launch Video Interview
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </Card>

          {/* Requirement 2: English Proficiency */}
          <Card className="p-6 sm:p-8 border-border bg-card shadow-sm rounded-3xl flex flex-col justify-between hover:border-[#CDFA1A]/60 transition-all space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-foreground">
                  <GraduationCap className="h-6 w-6 text-[#84a305] dark:text-[#CDFA1A]" />
                </div>
                <Badge
                  variant={englishSatisfied ? "default" : "outline"}
                  className="text-xs font-bold"
                >
                  Step 2 of 2
                </Badge>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-foreground">
                    English Language Proficiency
                  </h3>
                  {englishSatisfied && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      Satisfied
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Provide an existing English certificate (IELTS, TOEFL, Duolingo, etc.) to skip the test, or take our 20-minute online placement test.
                </p>
              </div>

              {englishSatisfied ? (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-1 text-xs">
                  <div className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Language Requirement Met
                  </div>
                  <p className="text-muted-foreground">
                    Placement: <strong>{effectivePlacement} Direct</strong> · Source:{" "}
                    <span className="capitalize">{effectiveSource?.replace(/_/g, " ")}</span>
                  </p>
                </div>
              ) : (
                <div className="space-y-2 rounded-2xl border border-border bg-secondary/30 p-4 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Certificate Exemption:</span>
                    <span className="font-semibold text-foreground">IELTS / TOEFL / Duolingo</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Alternative:</span>
                    <span className="font-semibold text-foreground">20-min Online Test</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Benchmark:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">CEFR B2 Level</span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {!englishSatisfied ? (
                <>
                  <Button
                    onClick={() => setCertModalOpen(true)}
                    className="w-full bg-[#CDFA1A] text-black font-extrabold hover:bg-[#b8e612] rounded-xl h-11 gap-2 shadow-sm text-xs"
                  >
                    <FileCheck className="h-4 w-4" />
                    I Have an English Certificate (PDF)
                  </Button>

                  <Link href="/english/test" className="block">
                    <Button variant="outline" className="w-full rounded-xl h-11 text-xs font-bold gap-2">
                      Take 20-Min Online Test
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>

                  <div className="text-center pt-1">
                    <button
                      onClick={handleSkipEnglish}
                      disabled={skipping}
                      className="text-[11px] text-muted-foreground hover:text-foreground underline transition-colors"
                    >
                      {skipping ? "Processing…" : "Native speaker or need exemption? Skip for now →"}
                    </button>
                  </div>
                </>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setCertModalOpen(true)}
                  className="w-full rounded-xl h-11 text-xs font-semibold gap-2"
                >
                  Update Certificate Document
                </Button>
              )}
            </div>
          </Card>
        </div>
      </main>

      {/* Certificate Upload Modal */}
      <CertificateUploadModal
        open={certModalOpen}
        onOpenChange={setCertModalOpen}
        onSuccess={reloadData}
      />
    </div>
  )
}
