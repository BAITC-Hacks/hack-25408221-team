"use client"

import Link from "next/link"
import { Navbar } from "@/components/layout/Navbar"
import { CommitteeMatrix } from "@/components/admin/CommitteeMatrix"
import { ArrowLeft, Sparkles, Shield } from "lucide-react"

export default function CommitteeReviewGridPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 flex-1 w-full space-y-6">
        <div className="border-b border-border pb-6 space-y-2">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Admissions Directory
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-foreground">
              Admissions Committee Consensus Matrix
            </h1>
            <span className="flex items-center gap-1.5 rounded-full bg-[#CDFA1A]/20 px-3 py-0.5 text-xs font-bold text-[#627a05] dark:text-[#CDFA1A]">
              <Sparkles className="h-3 w-3" /> 3 Core Indicators
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-3xl">
            Audit AI-extracted ratings across <strong>Motivation</strong>, <strong>Leadership</strong>, and <strong>Prior Experience</strong>. Every proposed rating is anchored to a verbatim applicant quote from the interview transcript.
          </p>
        </div>

        <CommitteeMatrix />
      </main>
    </div>
  )
}
