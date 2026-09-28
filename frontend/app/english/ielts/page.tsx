"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Navbar } from "@/components/layout/Navbar"
import { api } from "@/lib/api"
import type { IeltsCheckOut } from "@/lib/english/types"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Award,
} from "lucide-react"

const BAND_OPTIONS = Array.from({ length: 19 }, (_, i) => (i * 0.5).toFixed(1)) // 0.0 .. 9.0

type FieldError = { field: string; code: string }

function readableCode(code: string): string {
  const map: Record<string, string> = {
    invalid_format: "Must be a valid 15-18 character TRF number.",
    out_of_range: "Must be between 0.0 and 9.0.",
    invalid_step: "Must be in steps of 0.5.",
    arithmetic_mismatch: "Must match the rounded average of your four skill band scores.",
    in_future: "Test date cannot be in the future.",
    too_old: "Test date exceeds the 2-year validity window.",
  }
  return map[code] || code
}

function IeltsInner() {
  const router = useRouter()
  const params = useSearchParams()
  const isPending = params.get("pending") === "1"

  const [form, setForm] = useState({
    trf_number: "",
    family_name: "",
    date_of_birth: "",
    test_date: "",
    module: "academic" as "academic" | "general",
    listening: "",
    reading: "",
    writing: "",
    speaking: "",
    overall: "",
  })

  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([])
  const [result, setResult] = useState<IeltsCheckOut | null>(null)
  const [genericError, setGenericError] = useState<string | null>(null)

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function errorFor(field: string): string | null {
    const e = fieldErrors.find((fe) => fe.field === field)
    return e ? readableCode(e.code) : null
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFieldErrors([])
    setGenericError(null)

    try {
      const payload = {
        ...form,
        listening: Number(form.listening),
        reading: Number(form.reading),
        writing: Number(form.writing),
        speaking: Number(form.speaking),
        overall: Number(form.overall),
      }
      const res = await api.verifyIelts(payload)
      setResult(res)
    } catch (e: unknown) {
      const err = e as { detail?: unknown; message?: string }
      if (Array.isArray(err?.detail)) {
        setFieldErrors(err.detail as FieldError[])
      } else {
        setGenericError(err?.message || "Failed to verify IELTS details with official records.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="mx-auto max-w-2xl px-4 py-8 flex-1 w-full space-y-6">
        <Link
          href="/english"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to English Options
        </Link>

        {result ? (
          <Card className="p-8 sm:p-10 border-border bg-card shadow-2xl rounded-3xl space-y-6 text-center">
            {result.verdict === "VERIFIED" && (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mx-auto">
                  <CheckCircle2 className="h-10 w-10 stroke-[2.5]" />
                </div>
                <div className="space-y-2">
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold">
                    VERIFIED · IELTS {result.overall}
                  </Badge>
                  <h1 className="text-2xl sm:text-3xl font-black text-foreground">
                    English Requirement Satisfied
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
                    Your IELTS overall score of <strong>{result.overall}</strong> has been officially confirmed via the Test Report Form. You are exempted from taking the online CEFR placement test.
                  </p>
                </div>
                <Button
                  onClick={() => router.push("/dashboard")}
                  className="bg-[#CDFA1A] text-black font-extrabold hover:bg-[#b8e612] rounded-2xl h-14 px-8 text-sm gap-2"
                >
                  Return to Candidate Dashboard
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </>
            )}

            {result.verdict === "EXPIRED" && (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 mx-auto">
                  <Clock className="h-10 w-10 stroke-[2.5]" />
                </div>
                <div className="space-y-2">
                  <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold">
                    EXPIRED CERTIFICATE
                  </Badge>
                  <h1 className="text-2xl font-black text-foreground">IELTS Validity Window Expired</h1>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
                    This IELTS score is more than two years old and cannot be accepted for official academic admissions. Please take our complimentary 20-minute online placement assessment instead.
                  </p>
                </div>
                <Link href="/english/test" className="block">
                  <Button className="bg-[#CDFA1A] text-black font-extrabold hover:bg-[#b8e612] rounded-2xl h-14 px-8 text-sm gap-2 w-full sm:w-auto">
                    Take 20-Min Online Placement Test
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </>
            )}

            {result.verdict === "NOT_VERIFIED" && (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mx-auto">
                  <AlertCircle className="h-10 w-10 stroke-[2.5]" />
                </div>
                <div className="space-y-2">
                  <Badge variant="destructive" className="font-bold">NOT VERIFIED</Badge>
                  <h1 className="text-2xl font-black text-foreground">Verification Unsuccessful</h1>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
                    We could not confirm this certificate
                    {result.reason === "not_found" && " — no matching Test Report Form (TRF) was found."}
                    {result.reason === "identity_mismatch" && " — candidate name or date of birth does not match."}
                    {result.reason === "scores_mismatch" && " — individual band scores do not match official archives."}
                    . You may retry entering your scores or complete our 20-minute online test.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setResult(null)}
                    className="rounded-xl h-11 text-xs px-6"
                  >
                    Edit & Retry Form
                  </Button>
                  <Link href="/english/test">
                    <Button className="bg-[#CDFA1A] text-black font-extrabold hover:bg-[#b8e612] rounded-xl h-11 text-xs px-6">
                      Take 20-Min Placement Test
                    </Button>
                  </Link>
                </div>
              </>
            )}

            {result.verdict === "PENDING" && (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-500 mx-auto">
                  <Loader2 className="h-10 w-10 animate-spin" />
                </div>
                <div className="space-y-2">
                  <Badge variant="outline" className="font-bold text-blue-500 border-blue-500/30">PENDING</Badge>
                  <h1 className="text-2xl font-black text-foreground">Verification Pending</h1>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
                    The external IELTS verification service is momentarily queued. We will automatically recheck in the background. You can wait or take the online test immediately.
                  </p>
                </div>
                <Link href="/english/test">
                  <Button className="bg-[#CDFA1A] text-black font-extrabold hover:bg-[#b8e612] rounded-2xl h-14 px-8 text-sm gap-2">
                    Take Placement Test Now
                  </Button>
                </Link>
              </>
            )}
          </Card>
        ) : (
          <Card className="p-6 sm:p-10 border-border bg-card shadow-xl rounded-3xl space-y-6">
            <div className="space-y-2 border-b border-border pb-5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#CDFA1A]/20 px-3 py-0.5 text-xs font-bold text-[#627a05] dark:text-[#CDFA1A]">
                  <Award className="h-3.5 w-3.5" /> Instant Verification
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                Official IELTS Verification
              </h1>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Provide your Test Report Form (TRF) number and official band scores for instant automated verification against the IELTS Results Service.
              </p>
            </div>

            {isPending && (
              <div className="flex items-center gap-2.5 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3.5 text-xs text-blue-600 dark:text-blue-400">
                <Clock className="h-4 w-4 shrink-0" />
                <span>Your previous submission is pending automated verification. You can re-submit below.</span>
              </div>
            )}

            {genericError && (
              <div className="flex items-center gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{genericError}</span>
              </div>
            )}

            <form onSubmit={submit} className="space-y-5">
              {/* TRF Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">
                  Test Report Form (TRF) Number *
                </label>
                <Input
                  required
                  placeholder="e.g. 23KZ001234SMIT001A"
                  value={form.trf_number}
                  onChange={(e) => update("trf_number", e.target.value)}
                  className="font-mono text-xs uppercase"
                />
                {errorFor("trf_number") && (
                  <p className="text-[11px] text-destructive">{errorFor("trf_number")}</p>
                )}
              </div>

              {/* Name & DOB */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    Family Name (as printed on TRF) *
                  </label>
                  <Input
                    required
                    placeholder="Surname"
                    value={form.family_name}
                    onChange={(e) => update("family_name", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    Date of Birth *
                  </label>
                  <Input
                    required
                    type="date"
                    value={form.date_of_birth}
                    onChange={(e) => update("date_of_birth", e.target.value)}
                  />
                </div>
              </div>

              {/* Test Date & Module */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    Exam Date *
                  </label>
                  <Input
                    required
                    type="date"
                    value={form.test_date}
                    onChange={(e) => update("test_date", e.target.value)}
                  />
                  {errorFor("test_date") && (
                    <p className="text-[11px] text-destructive">{errorFor("test_date")}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    IELTS Module *
                  </label>
                  <select
                    value={form.module}
                    onChange={(e) => update("module", e.target.value as "academic" | "general")}
                    className="w-full h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#CDFA1A]"
                  >
                    <option value="academic">Academic</option>
                    <option value="general">General Training</option>
                  </select>
                </div>
              </div>

              {/* 4 Skill Bands */}
              <div className="space-y-2 pt-2 border-t border-border">
                <label className="text-xs font-bold text-foreground block">
                  Individual Skill Bands (0.0 – 9.0) *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(["listening", "reading", "writing", "speaking"] as const).map((skill) => (
                    <div key={skill} className="space-y-1">
                      <span className="text-[11px] font-semibold text-muted-foreground capitalize block">
                        {skill}
                      </span>
                      <select
                        required
                        value={form[skill]}
                        onChange={(e) => update(skill, e.target.value)}
                        className="w-full h-10 rounded-xl border border-input bg-background px-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#CDFA1A]"
                      >
                        <option value="" disabled>Band</option>
                        {BAND_OPTIONS.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Overall Band */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">
                  Overall Band Score *
                </label>
                <select
                  required
                  value={form.overall}
                  onChange={(e) => update("overall", e.target.value)}
                  className="w-full h-10 rounded-xl border border-input bg-background px-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#CDFA1A]"
                >
                  <option value="" disabled>Select Overall Band</option>
                  {BAND_OPTIONS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                {errorFor("overall") && (
                  <p className="text-[11px] text-destructive">{errorFor("overall")}</p>
                )}
              </div>

              <div className="pt-4 flex flex-col sm:flex-row items-center gap-3">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:flex-1 bg-[#CDFA1A] text-black font-extrabold hover:bg-[#b8e612] rounded-xl h-12 text-xs gap-2"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <FileCheck className="h-4 w-4" />
                      Verify Official TRF
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/english/test")}
                  className="w-full sm:w-auto rounded-xl h-12 text-xs"
                >
                  Skip & Take Placement Test
                </Button>
              </div>
            </form>
          </Card>
        )}
      </main>
    </div>
  )
}

export default function IeltsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <IeltsInner />
    </Suspense>
  )
}
