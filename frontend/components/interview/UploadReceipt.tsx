"use client"

import Link from "next/link"
import { useInterviewStore } from "@/stores/useInterviewStore"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  CheckCircle2,
  UploadCloud,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  Home,
  FileCheck,
} from "lucide-react"

export function UploadReceipt() {
  const {
    sessionId,
    uploading,
    uploaded,
    uploadError,
    retryUpload,
    reset,
  } = useInterviewStore()

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <Card className="border-border bg-card p-8 sm:p-10 shadow-xl space-y-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#CDFA1A]/20 text-[#678105] dark:text-[#CDFA1A] mx-auto">
          <CheckCircle2 className="h-9 w-9 stroke-[2.5]" />
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Interview Presentation Completed!
          </h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Thank you for completing your video presentation. Your answers have been recorded for the admissions committee review.
          </p>
        </div>

        {/* Upload Status Card */}
        <div className="rounded-xl border border-border bg-secondary/50 p-5 text-left space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="flex items-center gap-2 text-foreground">
              <UploadCloud className="h-4 w-4 text-[#84a305] dark:text-[#CDFA1A]" />
              Video Recording Sync
            </span>
            <span>
              {uploaded ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">Uploaded</span>
              ) : uploading ? (
                <span className="text-amber-600 dark:text-amber-400 font-bold">Uploading...</span>
              ) : uploadError ? (
                <span className="text-destructive font-bold">Action Needed</span>
              ) : (
                <span className="text-muted-foreground">Ready</span>
              )}
            </span>
          </div>

          {uploading && (
            <div className="space-y-1">
              <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-[#CDFA1A] animate-pulse w-2/3" />
              </div>
              <p className="text-[11px] text-muted-foreground">Compressing & storing secure WebM video stream…</p>
            </div>
          )}

          {uploadError && (
            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-xs text-destructive flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" />
                {uploadError}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={retryUpload}
                className="h-8 gap-1.5 rounded-lg text-xs"
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </Button>
            </div>
          )}

          {uploaded && (
            <p className="text-xs text-muted-foreground">
              Your video interview recording has been securely deposited to cloud storage and linked to your admission file.
            </p>
          )}

          {sessionId && (
            <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground font-mono">
              <span>Session ID:</span>
              <span className="font-semibold text-foreground truncate max-w-[200px]">{sessionId}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row pt-2">
          <Link href="/dashboard" className="flex-1" onClick={reset}>
            <Button className="w-full bg-[#CDFA1A] text-black font-bold hover:bg-[#b8e612] gap-2 rounded-xl">
              Candidate Mission Control
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>

          <Link href="/" onClick={reset}>
            <Button variant="outline" className="rounded-xl gap-2 w-full sm:w-auto">
              <Home className="h-4 w-4" />
              Home
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
