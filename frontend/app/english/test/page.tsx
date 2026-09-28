"use client"

import Link from "next/link"
import { EnglishAssessmentFlow } from "@/features/english"

export default function EnglishTestPage() {
  return (
    <div className="min-h-screen bg-muted/20">
      {/* Minimal Test Header */}
      <header className="border-b border-border bg-background px-6 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="flex items-center gap-1">
            <span className="text-lg font-bold tracking-tight">inVision U</span>
            <span className="text-[10px] text-muted-foreground ml-1 font-semibold uppercase tracking-wider">
              Secure Assessment
            </span>
          </Link>
          <span className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-700">
            Live Proctoring Active
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <EnglishAssessmentFlow />
      </main>
    </div>
  )
}
