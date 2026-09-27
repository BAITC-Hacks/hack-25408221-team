"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getMe, setLocalToken } from "@/features/english"

function StartHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = searchParams.get("token")
    if (!token) {
      setError("No token provided in the assessment link. Please check your invitation email.")
      return
    }

    setLocalToken(token)

    getMe(token)
      .then((me) => {
        switch (me.state) {
          case "new":
            router.replace("/english/ielts")
            break
          case "ielts_pending":
            router.replace("/english/ielts?pending=1")
            break
          case "needs_test":
          case "testing":
            router.replace("/english/test")
            break
          case "placed":
          case "needs_review":
            router.replace("/english/result")
            break
          default:
            router.replace("/english/ielts")
        }
      })
      .catch(() => {
        setError("Could not load your assessment details. Your link may be invalid or expired.")
      })
  }, [searchParams, router])

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-card p-8 text-center space-y-4 max-w-md mx-auto my-12">
        <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
        <h2 className="text-lg font-bold">Assessment Link Error</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{error}</p>
        <Link href="/english">
          <Button variant="outline">Back to Overview</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 space-y-4">
      <Loader2 className="h-8 w-8 animate-spin text-[#6B8E23]" />
      <p className="text-sm text-muted-foreground">Connecting to your assessment session…</p>
    </div>
  )
}

export default function StartPage() {
  return (
    <div className="min-h-screen bg-background px-4">
      <Suspense
        fallback={
          <div className="flex justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-[#6B8E23]" />
          </div>
        }
      >
        <StartHandler />
      </Suspense>
    </div>
  )
}
