"use client"

import { AppHeader } from "@/components/app-header"
import { IeltsVerificationFlow } from "@/features/english"

export default function EnglishIeltsPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 md:py-12">
        <IeltsVerificationFlow testRedirectUrl="/english/test" />
      </main>
    </div>
  )
}
