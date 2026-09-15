"use client"

import { ChevronUp, ChevronDown, Clock, Check } from "lucide-react"
import { useState, useEffect } from "react"

const stages = [
  { id: 1, name: "Application Stage", status: "in-progress" },
  { id: 2, name: "Screening Interview", status: "pending" },
  { id: 3, name: "Initial Screening", status: "pending" },
  { id: 4, name: "Application Review", status: "pending" },
  { id: 5, name: "Committee Review", status: "pending" },
  { id: 6, name: "Decision", status: "pending" },
]

const documents = [
  "Passport / ID",
  "Presentation",
  "English Proficiency Test Results",
  "UNT Results / NIS Grade 12 Certificate",
  "Certificate of Parents' Income",
]

export function ApplicationSidebar() {
  const [stagesOpen, setStagesOpen] = useState(true)
  const [documentsOpen, setDocumentsOpen] = useState(true)
  const [datesOpen, setDatesOpen] = useState(true)
  const [timeRemaining, setTimeRemaining] = useState("")

  useEffect(() => {
    const deadline = new Date("2026-05-30T23:59:59")

    const updateTimer = () => {
      const now = new Date()
      const diff = deadline.getTime() - now.getTime()

      if (diff <= 0) {
        setTimeRemaining("Deadline passed")
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

      setTimeRemaining(`${days} d. ${hours} h. ${minutes} m.`)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 60000)
    return () => clearInterval(interval)
  }, [])

  return (
    <aside className="hidden w-80 border-l border-border bg-card p-6 lg:block">
      {/* Deadline */}
      <div className="mb-6 rounded-lg bg-[#CDFA1A]/20 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#6B8E23]">
            <Clock className="h-5 w-5 text-[#6B8E23]" />
          </div>
          <div>
            <p className="text-sm font-medium">Time remaining until application deadline:</p>
            <p className="flex items-center gap-1 text-sm text-[#6B8E23]">
              <Clock className="h-3 w-3" />
              {timeRemaining || "Loading..."}
            </p>
          </div>
        </div>
      </div>

      {/* Stages */}
      <div className="mb-6">
        <div className="flex w-full items-center justify-between py-2">
          <h3 className="font-semibold">Stages</h3>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
            </span>
            <button onClick={() => setStagesOpen(!stagesOpen)} className="text-muted-foreground hover:text-foreground">
              {stagesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {stagesOpen && (
          <div className="mt-4 space-y-4">
            {stages.map((stage, index) => (
              <div key={stage.id} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full ${
                      stage.status === "in-progress"
                        ? "bg-[#CDFA1A]"
                        : "border border-muted-foreground"
                    }`}
                  >
                    {stage.status === "completed" && <Check className="h-3 w-3 text-muted-foreground" />}
                  </div>
                  {index < stages.length - 1 && (
                    <div className="mt-1 h-6 w-px border-l border-dashed border-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className={`text-sm ${stage.status === "in-progress" ? "font-medium" : "text-muted-foreground"}`}>
                    {stage.name}
                  </p>
                  {stage.status === "in-progress" && (
                    <span className="mt-1 inline-block rounded border border-border px-2 py-0.5 text-xs text-muted-foreground">
                      In progress
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Documents */}
      <div className="mb-6">
        <button
          onClick={() => setDocumentsOpen(!documentsOpen)}
          className="flex w-full items-center justify-between py-2"
        >
          <h3 className="font-semibold">Documents</h3>
          {documentsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {documentsOpen && (
          <div className="mt-4 flex flex-wrap gap-2">
            {documents.map((doc) => (
              <span
                key={doc}
                className="rounded border border-border px-3 py-1 text-xs text-muted-foreground"
              >
                {doc}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Important dates */}
      <div>
        <button
          onClick={() => setDatesOpen(!datesOpen)}
          className="flex w-full items-center justify-between py-2"
        >
          <h3 className="font-semibold">Important dates</h3>
          {datesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {datesOpen && (
          <div className="mt-4">
            <div className="flex items-center gap-3">
              <div className="rounded bg-red-500 px-2 py-1 text-xs font-medium text-white">
                MAY
              </div>
              <div>
                <span className="text-2xl font-bold">30</span>
              </div>
              <div>
                <p className="font-medium">Standard admission</p>
                <p className="text-xs text-muted-foreground">Deadline</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
