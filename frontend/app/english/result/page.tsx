"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Navbar } from "@/components/layout/Navbar"
import { api } from "@/lib/api"
import type { MeOut } from "@/lib/english/types"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Clock,
  ArrowRight,
  AlertCircle,
  Loader2,
  GraduationCap,
} from "lucide-react"

export default function EnglishResultPage() {
  const router = useRouter()
  const [me, setMe] = useState<MeOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .getEnglishMe()
      .then((data) => {
        setMe(data as MeOut)
        setLoading(false)
      })
      .catch((e: unknown) => {
        const err = e as { message?: string }
        setError(err?.message || "Failed to load placement outcome.")
        setLoading(false)
      })
  }, [])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="mx-auto max-w-xl px-4 py-16 flex-1 w-full flex items-center justify-center">
        {loading ? (
          <div className="text-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-[#84a305] dark:text-[#CDFA1A] mx-auto" />
            <p className="text-xs text-muted-foreground">Retrieving candidate evaluation records…</p>
          </div>
        ) : error ? (
          <Card className="p-8 text-center border-destructive/30 bg-card shadow-xl rounded-3xl space-y-4 w-full">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
            <h2 className="text-lg font-bold">Unable to Load Placement</h2>
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button onClick={() => router.push("/dashboard")} variant="outline" className="rounded-xl">
              Return to Dashboard
            </Button>
          </Card>
        ) : me?.state === "needs_review" ? (
          <Card className="p-8 sm:p-10 border-border bg-card shadow-2xl rounded-3xl space-y-6 text-center w-full">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 mx-auto">
              <Clock className="h-10 w-10 stroke-[2.5]" />
            </div>
            <div className="space-y-2">
              <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold">
                UNDER ADMISSIONS REVIEW
              </Badge>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">
                Evaluation Pending Committee Review
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Your English assessment responses and proctor logs have been submitted successfully. The inVision Admissions Committee is reviewing the criteria breakdown and will confirm your placement pathway shortly.
              </p>
            </div>
            <Button
              onClick={() => router.push("/dashboard")}
              className="bg-[#CDFA1A] text-black font-extrabold hover:bg-[#b8e612] rounded-2xl h-14 px-8 text-sm gap-2"
            >
              Go to Candidate Dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Card>
        ) : me?.placement ? (
          <Card className="p-8 sm:p-12 border-border bg-card shadow-2xl rounded-3xl space-y-6 text-center w-full">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mx-auto">
              <GraduationCap className="h-10 w-10 stroke-[2.5]" />
            </div>

            <div className="space-y-2">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-muted-foreground">
                Official Language Decision
              </span>
              <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
                {me.placement === "BACHELOR" ? "Bachelor Direct Entry" : "Foundation Year Entry"}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
                {me.placement === "BACHELOR"
                  ? "Congratulations! Your English proficiency satisfies university requirements for immediate enrollment into the Undergraduate Degree program."
                  : "You have been placed into the preparatory Foundation Year program, designed to advance your academic English fluency to bachelor-level readiness."}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-secondary/20 p-4 text-xs font-semibold text-muted-foreground">
              Placement determined via:{" "}
              <strong className="text-foreground capitalize">
                {me.placement_source === "ielts"
                  ? "Official IELTS Verification"
                  : me.placement_source === "human"
                  ? "Admissions Committee Review"
                  : me.placement_source?.startsWith("certificate")
                  ? "Submitted English Certificate"
                  : "Online CEFR Placement Exam"}
              </strong>
            </div>

            <Button
              onClick={() => router.push("/dashboard")}
              className="bg-[#CDFA1A] text-black font-extrabold hover:bg-[#b8e612] rounded-2xl h-14 px-8 text-sm gap-2 shadow-lg"
            >
              Continue to Candidate Dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Card>
        ) : (
          <Card className="p-8 text-center border-border bg-card shadow-xl rounded-3xl space-y-5 w-full">
            <h2 className="text-xl font-bold">Assessment Not Yet Completed</h2>
            <p className="text-xs text-muted-foreground">You have not completed the English assessment or verified your score yet.</p>
            <Link href="/english">
              <Button className="bg-[#CDFA1A] text-black font-extrabold hover:bg-[#b8e612] rounded-xl h-12 text-xs px-6">
                Start English Pathway
              </Button>
            </Link>
          </Card>
        )}
      </main>
    </div>
  )
}
