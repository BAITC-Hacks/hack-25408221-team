"use client"

import { useEffect, useRef, useState } from "react"
import { Volume2, FileText, Loader2, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ClientItem } from "../types"
import { useSessionDraft } from "../hooks/useSessionDraft"
import { getMediaUrl } from "../api/endpoints"

type AnswerMap = Record<string, Record<string, unknown>>

export function ObjectiveSection({
  section,
  items,
  onSubmit,
  submitting,
}: {
  section: string
  items: ClientItem[]
  onSubmit: (answers: { item_id: string; answer: unknown }[]) => void
  submitting: boolean
}) {
  const [answers, setAnswers] = useSessionDraft<AnswerMap>(
    `${section}:${items.map((i) => i.id).join(",")}`,
    {}
  )

  const [playsLeft, setPlaysLeft] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    items.forEach((item) => {
      if (item.audio) map[item.id] = 2
    })
    return map
  })

  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({})

  const autoSubmit = useRef(() => {})
  autoSubmit.current = () => {
    if (!submitting) submit()
  }

  useEffect(() => {
    const expire = () => autoSubmit.current()
    window.addEventListener("assessment-expired", expire)
    return () => window.removeEventListener("assessment-expired", expire)
  }, [])

  function setQ(itemId: string, qid: string, value: unknown) {
    setAnswers((a) => ({
      ...a,
      [itemId]: { ...(a[itemId] || {}), [qid]: value },
    }))
  }

  function setSegment(itemId: string, index: number, value: string, totalGaps: number) {
    setAnswers((a) => {
      const current = (a[itemId]?.segments as string[]) || Array(totalGaps).fill("")
      const next = [...current]
      next[index] = value
      return { ...a, [itemId]: { segments: next } }
    })
  }

  function playAudio(itemId: string) {
    const audio = audioRefs.current[itemId]
    if (!audio) return
    const remaining = playsLeft[itemId] ?? 2
    if (remaining <= 0) return

    audio.currentTime = 0
    audio.play().catch(() => {})
    setPlaysLeft((prev) => ({ ...prev, [itemId]: remaining - 1 }))
  }

  function submit() {
    const payload = items.map((item) => ({
      item_id: item.id,
      answer: answers[item.id] || {},
    }))
    onSubmit(payload)
  }

  return (
    <div className="space-y-6">
      {items.map((item, itemIdx) => {
        const itemAnswers = answers[item.id] || {}

        return (
          <div key={item.id} className="rounded-xl border border-border bg-card p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                {item.audio ? <Volume2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                {section.toUpperCase()} — TASK {itemIdx + 1} OF {items.length}
              </span>
              {item.audio && (
                <span className="text-xs font-medium text-muted-foreground">
                  Plays remaining: {playsLeft[item.id] ?? 2}
                </span>
              )}
            </div>

            {/* Audio player for listening */}
            {item.audio && (
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 border border-border">
                <audio
                  ref={(el) => {
                    audioRefs.current[item.id] = el
                  }}
                  src={getMediaUrl(item.audio)}
                  preload="auto"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  disabled={(playsLeft[item.id] ?? 2) <= 0}
                  onClick={() => playAudio(item.id)}
                >
                  <Play className="h-4 w-4" />
                  {(playsLeft[item.id] ?? 2) > 0 ? "Play Audio" : "No plays remaining"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Listen carefully. You can play this audio track up to 2 times.
                </p>
              </div>
            )}

            {/* Reading passage */}
            {item.text && (
              <div className="p-4 rounded-lg bg-muted/20 border border-border text-sm leading-relaxed whitespace-pre-line font-serif">
                {item.text}
              </div>
            )}

            {/* C-Test Segment gaps */}
            {item.segments && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Fill in the missing letters or words:</p>
                <div className="p-4 rounded-lg bg-background border border-border text-sm leading-loose">
                  {(() => {
                    let gapCounter = 0
                    const totalGaps = item.segments!.filter(
                      (s) => typeof s === "object" && "gap" in s
                    ).length
                    const segmentAnswers = (itemAnswers.segments as string[]) || []

                    return item.segments!.map((seg, sIdx) => {
                      if (typeof seg === "string") {
                        return <span key={sIdx}>{seg}</span>
                      }
                      const curGapIndex = gapCounter++
                      const val = segmentAnswers[curGapIndex] || ""

                      return (
                        <input
                          key={sIdx}
                          type="text"
                          value={val}
                          onChange={(e) =>
                            setSegment(item.id, curGapIndex, e.target.value, totalGaps)
                          }
                          className="mx-1 inline-block w-20 rounded border border-input px-2 py-0.5 text-center font-mono text-sm outline-none focus:border-foreground focus:ring-1 focus:ring-foreground"
                        />
                      )
                    })
                  })()}
                </div>
              </div>
            )}

            {/* Questions (MCQ / TFNG / Gap) */}
            {item.questions && item.questions.length > 0 && (
              <div className="space-y-4 pt-2">
                {item.questions.map((q, qIdx) => (
                  <div key={q.id} className="space-y-2 rounded-lg bg-background p-4 border border-border">
                    <p className="text-sm font-medium">
                      {qIdx + 1}. {q.prompt}
                    </p>

                    {q.type === "mcq" && q.options && (
                      <div className="grid gap-2 sm:grid-cols-2 pt-1">
                        {q.options.map((opt) => (
                          <label
                            key={opt}
                            className={`flex items-center gap-2.5 rounded-lg border p-3 text-sm cursor-pointer transition-colors ${
                              itemAnswers[q.id] === opt
                                ? "border-foreground bg-[#CDFA1A]/10 font-medium"
                                : "border-border hover:bg-muted/50"
                            }`}
                          >
                            <input
                              type="radio"
                              name={`${item.id}-${q.id}`}
                              value={opt}
                              checked={itemAnswers[q.id] === opt}
                              onChange={() => setQ(item.id, q.id, opt)}
                              className="text-foreground"
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {q.type === "tfng" && (
                      <div className="flex gap-2 pt-1">
                        {["TRUE", "FALSE", "NOT GIVEN"].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setQ(item.id, q.id, val)}
                            className={`flex-1 rounded-lg border py-2 px-3 text-xs font-semibold transition-colors ${
                              itemAnswers[q.id] === val
                                ? "bg-[#CDFA1A] border-[#CDFA1A] text-foreground"
                                : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    )}

                    {q.type === "gap" && (
                      <input
                        type="text"
                        placeholder="Your answer"
                        value={(itemAnswers[q.id] as string) || ""}
                        onChange={(e) => setQ(item.id, q.id, e.target.value)}
                        className="w-full rounded-lg border border-input bg-background p-2.5 text-sm outline-none focus:border-foreground"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      <div className="flex justify-end pt-2">
        <Button
          size="lg"
          className="bg-[#CDFA1A] text-foreground hover:bg-[#CDFA1A]/90 font-semibold px-8"
          disabled={submitting}
          onClick={submit}
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit Section & Continue
        </Button>
      </div>
    </div>
  )
}
