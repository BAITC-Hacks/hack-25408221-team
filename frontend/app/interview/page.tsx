"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/stores/useAuthStore"
import { useInterviewStore } from "@/stores/useInterviewStore"
import { PreFlightModal } from "@/components/interview/PreFlightModal"
import { ActiveCallView } from "@/components/interview/ActiveCallView"
import { UploadReceipt } from "@/components/interview/UploadReceipt"
import { Loader2 } from "lucide-react"

export default function InterviewPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading, initialize, program } = useAuthStore()
  const { status, startInterview } = useInterviewStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (!isLoading && user?.role === "admin") {
      router.replace("/admin")
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-[#84a305] dark:text-[#CDFA1A]" />
      </div>
    )
  }

  const handleStart = () => {
    const candidateId = user?.id || "demo-candidate"
    const targetProgram = program || "Undergraduate"
    startInterview(candidateId, targetProgram)
  }

  return (
    <main className="min-h-screen bg-background flex flex-col justify-center p-4">
      {status === "idle" || status === "preflight" ? (
        <PreFlightModal onStart={handleStart} />
      ) : status === "connecting" || status === "active" ? (
        <ActiveCallView />
      ) : status === "ended" ? (
        <UploadReceipt />
      ) : (
        <PreFlightModal onStart={handleStart} />
      )}
    </main>
  )
}
