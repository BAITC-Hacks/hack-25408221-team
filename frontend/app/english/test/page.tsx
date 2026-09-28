"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/stores/useAuthStore"
import Link from "next/link"
import { Navbar } from "@/components/layout/Navbar"
import { ProctoredTestRunner } from "@/components/english/ProctoredTestRunner"
import { ArrowLeft } from "lucide-react"

export default function EnglishTestPage() {
  const router = useRouter()
  const { user } = useAuthStore()

  useEffect(() => {
    if (user?.role === "admin") {
      router.replace("/admin")
    }
  }, [user, router])
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 py-8 flex-1 w-full">
        <Link
          href="/english"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Exit Test
        </Link>

        <ProctoredTestRunner />
      </main>
    </div>
  )
}
