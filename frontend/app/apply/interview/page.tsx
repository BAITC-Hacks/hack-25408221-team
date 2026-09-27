"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { useInterviewCall } from "@/hooks/use-interview-call"
import { InterviewPreFlight } from "./components/InterviewPreFlight"
import { InterviewCompleted } from "./components/InterviewCompleted"
import { InterviewActive } from "./components/InterviewActive"

type ScreenState = "instructions" | "active" | "completed"

export default function VideoPresentationPage() {
  const router = useRouter()
  const [screenState, setScreenState] = useState<ScreenState>("instructions")
  const [showConfetti, setShowConfetti] = useState(false)

  const { userId, authChecked } = useAuthGuard()

  const {
    status,
    setStatus,
    timerSecs,
    showCheckIn,
    setShowCheckIn,
    currentQuestion,
    totalQuestions,
    creatingSession,
    sessionError,
    errorMessage,
    maxDurationSecs,
    micDenied,
    noCamera,
    cameraDenied,
    checkingMedia,
    audioOnly,
    checkMediaPermissions,
    videoRef,
    startPresentation,
    endSession,
    uploading,
    uploadError,
    uploaded,
    retryUpload,
  } = useInterviewCall(userId)

  useEffect(() => {
    if (status === "ended" && screenState === "active") {
      setScreenState("completed")
      setShowConfetti(true)
      localStorage.setItem("videoSubmitted", "true")
    }
  }, [status, screenState])

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (screenState === "instructions") {
    return (
      <InterviewPreFlight
        checkingMedia={checkingMedia}
        creatingSession={creatingSession}
        onStart={async () => {
          const ok = await checkMediaPermissions()
          if (ok) {
            setScreenState("active")
            startPresentation()
          }
        }}
        onBack={() => router.push("/apply/form")}
      />
    )
  }

  if (screenState === "completed") {
    return (
      <InterviewCompleted
        showConfetti={showConfetti}
        uploading={uploading}
        uploadError={uploadError}
        uploaded={uploaded}
        onRetryUpload={retryUpload}
        onBackToForm={() => router.push("/apply/form")}
        onReturnHome={() => router.push("/")}
      />
    )
  }

  return (
    <InterviewActive
      status={status}
      setStatus={setStatus}
      timerSecs={timerSecs}
      maxDurationSecs={maxDurationSecs}
      currentQuestion={currentQuestion}
      totalQuestions={totalQuestions}
      micDenied={micDenied}
      noCamera={noCamera}
      cameraDenied={cameraDenied}
      checkingMedia={checkingMedia}
      sessionError={sessionError}
      errorMessage={errorMessage}
      creatingSession={creatingSession}
      audioOnly={audioOnly}
      videoRef={videoRef}
      showCheckIn={showCheckIn}
      setShowCheckIn={setShowCheckIn}
      onCheckMediaPermissions={checkMediaPermissions}
      onStartPresentation={startPresentation}
      onEndSession={endSession}
      onBackToForm={() => router.push("/apply/form")}
    />
  )
}
