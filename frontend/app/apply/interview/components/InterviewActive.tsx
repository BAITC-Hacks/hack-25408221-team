"use client"

import { RefObject } from "react"
import { Mic, MicOff, PhoneOff, Video, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AppHeader } from "@/components/app-header"

export function InterviewActive({
  status,
  setStatus,
  timerSecs,
  maxDurationSecs,
  currentQuestion,
  totalQuestions,
  micDenied,
  noCamera,
  cameraDenied,
  checkingMedia,
  sessionError,
  errorMessage,
  creatingSession,
  audioOnly,
  videoRef,
  showCheckIn,
  setShowCheckIn,
  onCheckMediaPermissions,
  onStartPresentation,
  onEndSession,
  onBackToForm,
}: {
  status: string
  setStatus: (s: any) => void
  timerSecs: number
  maxDurationSecs: number
  currentQuestion: number
  totalQuestions: number
  micDenied: boolean
  noCamera: boolean
  cameraDenied: boolean
  checkingMedia: boolean
  sessionError: string | null
  errorMessage: string | null
  creatingSession: boolean
  audioOnly: boolean
  videoRef: RefObject<HTMLVideoElement | null>
  showCheckIn: boolean
  setShowCheckIn: (s: boolean) => void
  onCheckMediaPermissions: () => Promise<any>
  onStartPresentation: () => void
  onEndSession: (explicit?: boolean) => void
  onBackToForm: () => void
}) {
  const mm = String(Math.floor(timerSecs / 60)).padStart(2, "0")
  const ss = String(timerSecs % 60).padStart(2, "0")
  const timerColor =
    timerSecs >= maxDurationSecs * 0.9
      ? "text-red-500"
      : timerSecs >= maxDurationSecs * 0.7
        ? "text-yellow-500"
        : "text-foreground"

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold md:text-4xl">Screening Call</h1>
            <p className="mt-3 text-lg text-muted-foreground">
              Answer questions asked by our AI guide. The interview takes approximately{" "}
              {Math.round(maxDurationSecs / 60)} minutes.
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

          {status === "reconnecting" && errorMessage && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>Reconnecting</AlertTitle>
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

              {(status === "active" || status === "reconnecting") && (
                <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-red-600 px-3 py-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
                  <span className="text-xs font-bold text-white">REC</span>
                </div>
              )}

              {(status === "active" || status === "reconnecting") && (
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
                        : status === "reconnecting"
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                          : status === "error"
                            ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                            : "bg-muted text-muted-foreground"
                  }`}>
                    {status === "idle" && "Ready to start"}
                    {status === "connecting" && "Connecting…"}
                    {status === "reconnecting" && "Reconnecting…"}
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
                    await onCheckMediaPermissions()
                    onStartPresentation()
                  }}
                  className="h-12 px-8 text-base bg-[#CDFA1A] text-foreground hover:bg-[#CDFA1A]/90 font-semibold"
                >
                  <Video className="mr-2 h-5 w-5" />
                  Start Interview
                </Button>
              )}

              {(status === "active" || status === "connecting" || status === "reconnecting") && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    onEndSession(true)
                    setStatus("ended")
                  }}
                  className="h-12 px-8 text-base text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <PhoneOff className="mr-2 h-5 w-5" />
                  End Interview
                </Button>
              )}

              <Button
                variant="ghost"
                size="lg"
                onClick={onBackToForm}
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
                className="w-full h-12 text-base bg-[#CDFA1A] text-foreground hover:bg-[#CDFA1A]/90 font-semibold"
                size="lg"
              >
                I&apos;m here, continue
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  )
}
