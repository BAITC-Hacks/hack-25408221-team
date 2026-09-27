"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { AdminHeader } from "@/components/admin/AdminHeader"
import { EnglishAdminReviewQueue } from "@/features/english"

export default function AdminEnglishPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.role !== "admin")) {
      router.replace("/signin")
    }
  }, [isAuthenticated, isLoading, user, router])

  if (isLoading || (!isAuthenticated && !user)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <p className="text-muted-foreground">Checking authorization…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <AdminHeader />

      <main className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">English Assessment Review</h1>
          <p className="mt-1 text-muted-foreground">
            Review proctoring integrity, audio responses, and make final placement decisions
          </p>
        </div>

        <EnglishAdminReviewQueue />
      </main>
    </div>
  )
}
