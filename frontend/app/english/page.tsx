"use client"

import Link from "next/link"
import { ArrowRight, CheckCircle2, FileText, MonitorCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppHeader } from "@/components/app-header"

export default function EnglishOverviewPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-4xl px-4 py-12 md:py-16">
        <div className="text-center space-y-4 mb-12">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#CDFA1A]/20 px-3.5 py-1 text-xs font-semibold text-[#6B8E23]">
            Admissions Requirement
          </span>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">
            English Placement Gateway
          </h1>
          <p className="mx-auto max-w-2xl text-muted-foreground text-sm md:text-base leading-relaxed">
            All programs at inVision University are taught in English. You can meet our language
            standard through official IELTS verification or by completing our online proctored English
            placement test.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-12">
          {/* Pathway 1: IELTS */}
          <div className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-5 flex flex-col justify-between hover:border-foreground/30 transition-all">
            <div className="space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#CDFA1A]/20 text-[#6B8E23]">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Have an IELTS Certificate?</h2>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  Submit your Test Report Form (TRF) number for instant online verification. A score
                  of 6.0 or higher qualifies for direct Bachelor entry.
                </p>
              </div>

              <ul className="text-xs text-muted-foreground space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Instant result verification
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Valid for certificates under 2 years old
                </li>
              </ul>
            </div>

            <Link href="/english/ielts" className="block pt-4">
              <Button className="w-full bg-[#CDFA1A] text-foreground hover:bg-[#CDFA1A]/90 font-semibold gap-2">
                Verify IELTS Certificate
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {/* Pathway 2: Placement Test */}
          <div className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-5 flex flex-col justify-between hover:border-foreground/30 transition-all">
            <div className="space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                <MonitorCheck className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Take the English Test</h2>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  No IELTS? Take our short 20-minute proctored assessment covering Listening, Reading,
                  Writing, and Speaking directly from your browser.
                </p>
              </div>

              <ul className="text-xs text-muted-foreground space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Adaptive CEFR evaluation
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Requires desktop camera and microphone
                </li>
              </ul>
            </div>

            <Link href="/english/test" className="block pt-4">
              <Button variant="outline" className="w-full font-semibold gap-2">
                Start Placement Test
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
