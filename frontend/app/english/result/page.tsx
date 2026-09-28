"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CheckCircle2, Clock, Loader2, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppHeader } from "@/components/app-header"
import { getMe, MeOut } from "@/features/english"

export default function EnglishResultPage() {
  const [me, setMe] = useState<MeOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getMe()
      .then(setMe)
      .catch(() => setError("Could not retrieve assessment result."))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-2xl px-4 py-16">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#6B8E23]" />
            <p className="text-sm text-muted-foreground">Loading assessment results…</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-card p-8 text-center space-y-4">
            <p className="text-sm text-red-600">{error}</p>
            <Link href="/english">
              <Button variant="outline">Back to Overview</Button>
            </Link>
          </div>
        ) : me?.state === "needs_review" ? (
          <div className="rounded-2xl border border-border bg-card p-8 md:p-12 text-center space-y-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 mx-auto">
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
            <div>
              <span className="inline-flex rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800 uppercase tracking-wide">
                Under Admissions Review
              </span>
              <h1 className="text-2xl font-bold mt-3">Assessment Under Evaluation</h1>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Your responses have been recorded and sent to the admissions committee for review.
                You will be notified once your final English placement decision is confirmed.
              </p>
            </div>
            <Link href="/apply">
              <Button variant="outline">Return to Application</Button>
            </Link>
          </div>
        ) : me?.placement ? (
          <div className="rounded-2xl border border-border bg-card p-8 md:p-12 text-center space-y-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mx-auto">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                  me.placement === "BACHELOR"
                    ? "bg-green-100 text-green-800"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {me.placement} Placement
              </span>
              <h1 className="text-2xl font-bold mt-3">Your English Placement Decision</h1>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {me.placement === "BACHELOR"
                  ? "Congratulations! Your English proficiency satisfies the requirements for direct entry into the Bachelor's degree program."
                  : "You have been placed into the Foundation Year program, designed to advance your academic English skills to degree level."}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-muted/30 border border-border text-xs text-muted-foreground">
              Confirmed via:{" "}
              <span className="font-semibold text-foreground uppercase">
                {me.placement_source || "assessment"}
              </span>
            </div>

            <Link href="/apply">
              <Button className="bg-[#CDFA1A] text-foreground hover:bg-[#CDFA1A]/90 font-semibold gap-2">
                Continue Application Flow
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-4">
            <h1 className="text-xl font-bold">No Completed Assessment Yet</h1>
            <p className="text-sm text-muted-foreground">
              You haven&apos;t completed the English placement test yet.
            </p>
            <Link href="/english/test">
              <Button className="bg-[#CDFA1A] text-foreground hover:bg-[#CDFA1A]/90 font-semibold">
                Start Test Now
              </Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
