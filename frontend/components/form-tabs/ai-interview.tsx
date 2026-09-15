"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Video, Clock, Loader2 } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"

interface AIInterviewTabProps {
  formData: Record<string, unknown>
  updateFormData: (data: Record<string, unknown>) => void
  showErrors?: boolean
}

export function AIInterviewTab({ formData, updateFormData, showErrors }: AIInterviewTabProps) {
  const router = useRouter()
  const [interviewStatus, setInterviewStatus] = useState<"idle" | "checking" | "completed" | "not_started">("idle")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    checkInterviewStatus()
  }, [])

  const checkInterviewStatus = async () => {
    setInterviewStatus("checking")
    const submitted = localStorage.getItem("videoSubmitted")
    if (submitted === "true") {
      setInterviewStatus("completed")
    } else {
      setInterviewStatus("not_started")
    }
  }

  const startInterview = () => {
    router.push("/apply/interview")
  }

  if (interviewStatus === "checking") {
    return (
      <Card className="py-12">
        <CardContent className="flex items-center justify-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Checking interview status...</span>
        </CardContent>
      </Card>
    )
  }

  if (interviewStatus === "completed") {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
            <svg className="h-10 w-10 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <CardTitle className="text-2xl">Screening Call Completed</CardTitle>
          <CardDescription className="text-base">
            You have successfully completed your screening call. Your responses are being reviewed as part of your application.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
            Completed
          </Badge>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          Screening Call
        </CardTitle>
        <CardDescription>
          Complete a video screening call to help us get to know you better. The interview takes approximately 5 minutes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress indicator */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Application Progress</span>
            <span className="text-muted-foreground">80%</span>
          </div>
          <Progress value={80} className="h-2" />
        </div>

        {/* What to expect */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold">What to expect</h4>
          <div className="grid gap-3">
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold">1</div>
              <span className="text-sm">The AI will ask you 6 questions about your motivation and goals</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold">2</div>
              <span className="text-sm">Record your responses using camera and microphone</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold">3</div>
              <span className="text-sm">The interview takes about 5 minutes to complete</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold">4</div>
              <span className="text-sm">Make sure you're in a quiet place with good lighting</span>
            </div>
          </div>
        </div>

        {/* Before you start */}
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Before you start</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Find a quiet location
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Ensure good lighting on your face
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Have a stable internet connection
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Allow camera and microphone access
                </li>
              </ul>
            </div>
          </div>
        </div>

        <Button 
          onClick={startInterview} 
          disabled={loading}
          size="lg"
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <Video className="mr-2 h-4 w-4" />
              Start Screening Call
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
