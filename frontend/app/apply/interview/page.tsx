"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Mic, MicOff, PhoneOff, Video, AlertCircle, Loader2, Home, ArrowLeft, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AppHeader } from "@/components/app-header"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { useInterviewCall } from "@/hooks/use-interview-call"

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
    sessionId,
    creatingSession,
    sessionError,
    errorMessage,
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
  }, [status])

  const mm = String(Math.floor(timerSecs / 60)).padStart(2, "0")
  const ss = String(timerSecs % 60).padStart(2, "0")
  const timerColor =
    timerSecs >= 270 ? "text-red-500" : timerSecs >= 210 ? "text-yellow-500" : "text-foreground"

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // PRE-CALL INSTRUCTIONS SCREEN
  if (screenState === "instructions") {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />

        <main className="container mx-auto px-4 py-8">
          <Card className="mx-auto max-w-2xl">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Video className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Before We Begin</CardTitle>
              <CardDescription>
                Please review the following guidelines to ensure a fair screening process
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg bg-green-50 p-4 dark:bg-green-950">
                <Check className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">Quiet, private location</p>
                  <p className="text-sm text-green-700 dark:text-green-300">Ensure you're in a space without background noise or interruptions</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg bg-green-50 p-4 dark:bg-green-950">
                <Check className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">Face clearly visible</p>
                  <p className="text-sm text-green-700 dark:text-green-300">Position your camera so your entire face is visible throughout the call</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg bg-green-50 p-4 dark:bg-green-950">
                <Check className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">No other devices nearby</p>
                  <p className="text-sm text-green-700 dark:text-green-300">Keep phones and other devices away from your testing area</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg bg-green-50 p-4 dark:bg-green-950">
                <Check className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">No notes or references</p>
                  <p className="text-sm text-green-700 dark:text-green-300">Do not have any notes, books, or reference materials visible</p>
                </div>
              </div>

              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Important Warning</AlertTitle>
                <AlertDescription>
                  Any suspicious behavior or cheating attempts will result in automatic disqualification
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button
                onClick={() => setScreenState("active")}
                className="w-full h-12 text-base"
                size="lg"
              >
                I Understand - Start Screening Call
              </Button>
              <Button
                variant="ghost"
                onClick={() => router.push("/apply/form")}
                className="w-full"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Application
              </Button>
            </CardFooter>
          </Card>
        </main>
      </div>
    )
  }

  // POST-CALL COMPLETED SCREEN
  if (screenState === "completed") {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />

        <main className="container mx-auto px-4 py-8">
          {showConfetti && (
            <div className="confetti-container">
              {[...Array(50)].map((_, i) => (
                <div
                  key={i}
                  className="confetti"
                  style={{
                    left: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 3}s`,
                    backgroundColor: ['#CDFA1A', '#6B8E23', '#00AFCA', '#FFD700', '#FF6B6B'][Math.floor(Math.random() * 5)]
                  }}
                />
              ))}
            </div>
          )}

          <Card className="mx-auto max-w-2xl text-center">
            <CardHeader>
              <div className="mx-auto mb-4 relative">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
                  <Check className="h-12 w-12 text-primary" />
                </div>
                <span className="absolute -right-2 -top-2 text-4xl">🎉</span>
              </div>

              <CardTitle className="text-3xl text-green-600 dark:text-green-400">
                Screening Call Completed!
              </CardTitle>
              <CardDescription className="text-lg">
                Thank you for completing your screening call. Your responses have been recorded successfully.
              </CardDescription>
            </CardHeader>

            <CardContent>
              {uploading && (
                <div className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  Uploading your recording…
                </div>
              )}
              {uploadError && (
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                  <p className="mb-2">{uploadError}</p>
                  <Button size="sm" variant="outline" onClick={retryUpload} disabled={uploading}>
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Retrying…
                      </>
                    ) : (
                      "Retry upload"
                    )}
                  </Button>
                </div>
              )}
              {uploaded && (
                <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
                  <Check className="mr-2 inline h-4 w-4" />
                  Recording saved successfully.
                </div>
              )}
              <div className="my-6 border-y py-6">
                <h2 className="mb-4 text-lg font-semibold">📋 What's Next?</h2>
                <div className="space-y-3 text-left text-muted-foreground">
                  <p>✓ Our team will review your responses</p>
                  <p>✓ You'll receive updates via email</p>
                  <p>✓ The review process takes 2-3 business days</p>
                </div>
              </div>

              <div className="rounded-lg bg-primary/10 p-4">
                <p className="text-lg font-medium text-primary">⏳ Stay Tuned!</p>
                <p className="text-sm text-muted-foreground">We'll be in touch soon with the next steps.</p>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={() => router.push("/apply/form")}
                className="flex-1 h-12 text-base"
                size="lg"
              >
                <ArrowLeft className="mr-2 h-5 w-5" />
                Back to Application
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/")}
                className="flex-1 h-12 text-base"
                size="lg"
              >
                <Home className="mr-2 h-5 w-5" />
                Return to Home
              </Button>
            </CardFooter>
          </Card>
        </main>

        <style jsx>{`
          .confetti-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            overflow: hidden;
            z-index: 100;
          }
          .confetti {
            position: absolute;
            width: 10px;
            height: 10px;
            top: -10px;
            border-radius: 50%;
            animation: fall 3s ease-in-out forwards;
          }
          @keyframes fall {
            0% {
              transform: translateY(0) rotate(0deg);
              opacity: 1;
            }
            100% {
              transform: translateY(100vh) rotate(720deg);
              opacity: 0;
            }
          }
        `}</style>
      </div>
    )
  }

  // ACTIVE CALL SCREEN
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold md:text-4xl">Screening Call</h1>
            <p className="mt-3 text-lg text-muted-foreground">
              Answer questions asked by our AI guide. The interview takes approximately 5 minutes.
            </p>
          </div>

          {micDenied && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Microphone access denied</AlertTitle>
              <AlertDescription>
                Please allow microphone access in your browser settings, then refresh the page.
              </AlertDescription>
            </Alert>
          )}

          {noCamera && !micDenied && (
            <Alert>
              <Video className="h-4 w-4" />
              <AlertTitle>No camera detected</AlertTitle>
              <AlertDescription>
                The interview will continue in audio-only mode.
              </AlertDescription>
            </Alert>
          )}

          {cameraDenied && !micDenied && (
            <Alert>
              <Video className="h-4 w-4" />
              <AlertTitle>Camera access denied</AlertTitle>
              <AlertDescription>
                The interview will continue in audio-only mode. To be seen on camera, allow
                camera access in your browser settings and refresh the page.
              </AlertDescription>
            </Alert>
          )}

          {checkingMedia && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>Checking microphone and camera access…</AlertTitle>
            </Alert>
          )}

          {sessionError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Session Error</AlertTitle>
              <AlertDescription>{sessionError}</AlertDescription>
            </Alert>
          )}

          {status === "error" && errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Interview interrupted</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {creatingSession && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>Creating interview session…</AlertTitle>
            </Alert>
          )}

          <div className="space-y-6">
            {/* Camera View */}
            <div className="relative overflow-hidden rounded-xl bg-black aspect-video shadow-lg">
              {status !== "idle" && !audioOnly ? (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                  style={{ transform: "scaleX(-1)" }}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center text-white/60">
                    {audioOnly ? (
                      <>
                        <Mic className="mx-auto mb-4 h-20 w-20" />
                        <p className="text-lg">Audio-only mode — microphone active</p>
                        <p className="mt-2 text-sm text-white/40">Your camera is off</p>
                      </>
                    ) : (
                      <>
                        <Video className="mx-auto mb-4 h-20 w-20" />
                        <p className="text-lg">Camera preview will appear here</p>
                        <p className="mt-2 text-sm text-white/40">When you start the interview</p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {status === "active" && (
                <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-red-600 px-3 py-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
                  <span className="text-xs font-bold text-white">REC</span>
                </div>
              )}

              {status === "active" && (
                <div className="absolute right-4 top-4 rounded-full bg-black/60 px-4 py-1.5 text-sm font-bold text-white">
                  {mm}:{ss}
                </div>
              )}

              <div className="absolute bottom-4 left-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  status === "active" ? "bg-green-500" : "bg-gray-700"
                }`}>
                  {status === "active" ? (
                    <Mic className="h-5 w-5 text-white" />
                  ) : (
                    <MicOff className="h-5 w-5 text-white" />
                  )}
                </div>
              </div>
            </div>

            {/* Status Bar */}
            <Card>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <span className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${
                    status === "active"
                      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                      : status === "connecting"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                        : status === "error"
                          ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                          : "bg-muted text-muted-foreground"
                  }`}>
                    {status === "idle" && "Ready to start"}
                    {status === "connecting" && "Connecting…"}
                    {status === "active" && "Interview in progress"}
                    {status === "ended" && "Interview completed"}
                    {status === "error" && "Connection error"}
                  </span>

                  {status === "active" && currentQuestion > 0 && (
                    <span className="text-sm font-medium text-muted-foreground">
                      Question {currentQuestion} of {totalQuestions}
                    </span>
                  )}
                </div>
                <span className={`font-mono text-lg font-bold ${timerColor}`}>{mm}:{ss}</span>
              </CardContent>
            </Card>

            {/* Controls */}
            <div className="flex flex-wrap justify-center gap-4">
              {(status === "idle" || status === "error") && (
                <Button
                  size="lg"
                  onClick={async () => {
                    await checkMediaPermissions()
                    startPresentation()
                  }}
                  className="h-12 px-8 text-base"
                >
                  <Video className="mr-2 h-5 w-5" />
                  Start Interview
                </Button>
              )}

              {(status === "active" || status === "connecting") && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    endSession(true)
                    setStatus("ended")
                  }}
                  className="h-12 px-8 text-base"
                >
                  <PhoneOff className="mr-2 h-5 w-5" />
                  End Interview
                </Button>
              )}

              <Button
                variant="ghost"
                size="lg"
                onClick={() => router.push("/apply/form")}
                className="h-12 px-8 text-base"
              >
                Back to Application
              </Button>
            </div>
          </div>
        </div>
      </main>

      {showCheckIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="mx-4 w-full max-w-md text-center">
            <CardHeader>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
                <AlertCircle className="h-8 w-8 text-yellow-600" />
              </div>
              <CardTitle className="text-2xl">Are you still there?</CardTitle>
              <CardDescription>
                Please speak or click continue to resume your interview.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button
                onClick={() => setShowCheckIn(false)}
                className="w-full h-12 text-base"
                size="lg"
              >
                I'm here, continue
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  )
}
