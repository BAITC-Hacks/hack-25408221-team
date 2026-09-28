"use client"

import { Video, Check, Loader2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { AppHeader } from "@/components/app-header"

export function InterviewPreFlight({
  checkingMedia,
  creatingSession,
  onStart,
  onBack,
}: {
  checkingMedia: boolean
  creatingSession: boolean
  onStart: () => void
  onBack: () => void
}) {
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
                <p className="text-sm text-green-700 dark:text-green-300">
                  Ensure you&apos;re in a space without background noise or interruptions
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg bg-green-50 p-4 dark:bg-green-950">
              <Check className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">No other people present</p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  You must be alone during the entire screening call
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg bg-green-50 p-4 dark:bg-green-950">
              <Check className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">No notes or external assistance</p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Speak naturally from your own thoughts and experiences
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg bg-green-50 p-4 dark:bg-green-950">
              <Check className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">Working camera and microphone</p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Ensure your camera and microphone are connected and permissions are granted
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
              <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                <strong>Notice:</strong> Your video and audio responses will be recorded and analyzed
                by our automated admissions screening platform to evaluate communication clarity and competency.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="outline"
              onClick={onBack}
              className="flex-1 h-12 text-base"
              size="lg"
            >
              <ArrowLeft className="mr-2 h-5 w-5" />
              Back to Form
            </Button>
            <Button
              onClick={onStart}
              disabled={checkingMedia || creatingSession}
              className="flex-1 h-12 text-base bg-[#CDFA1A] text-foreground hover:bg-[#CDFA1A]/90 font-semibold"
              size="lg"
            >
              {checkingMedia ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Checking camera & mic…
                </>
              ) : creatingSession ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Starting session…
                </>
              ) : (
                "I Understand, Let's Begin"
              )}
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  )
}
