"use client"

import { Check, Loader2, ArrowLeft, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { AppHeader } from "@/components/app-header"

export function InterviewCompleted({
  showConfetti,
  uploading,
  uploadError,
  uploaded,
  onRetryUpload,
  onBackToForm,
  onReturnHome,
}: {
  showConfetti: boolean
  uploading: boolean
  uploadError: string | null
  uploaded: boolean
  onRetryUpload: () => void
  onBackToForm: () => void
  onReturnHome: () => void
}) {
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
                <Button size="sm" variant="outline" onClick={onRetryUpload} disabled={uploading}>
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
              <h2 className="mb-4 text-lg font-semibold">📋 What&apos;s Next?</h2>
              <div className="space-y-3 text-left text-muted-foreground">
                <p>✓ Our team will review your responses</p>
                <p>✓ You&apos;ll receive updates via email</p>
                <p>✓ The review process takes 2-3 business days</p>
              </div>
            </div>

            <div className="rounded-lg bg-primary/10 p-4">
              <p className="text-lg font-medium text-primary">⏳ Stay Tuned!</p>
              <p className="text-sm text-muted-foreground">We&apos;ll be in touch soon with the next steps.</p>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 sm:flex-row">
            <Button
              onClick={onBackToForm}
              className="flex-1 h-12 text-base"
              size="lg"
            >
              <ArrowLeft className="mr-2 h-5 w-5" />
              Back to Application
            </Button>
            <Button
              variant="outline"
              onClick={onReturnHome}
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
