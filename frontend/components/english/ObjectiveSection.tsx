"use client"

import { useEffect, useRef, useState } from "react"
import { useSessionDraft } from "@/lib/english/useSessionDraft"
import { api } from "@/lib/api"
import type { ClientItem } from "@/lib/english/types"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Volume2, VolumeX, BookOpen, ArrowRight, Loader2, Play, CheckCircle2 } from "lucide-react"

type AnswerMap = Record<string, Record<string, unknown>>

interface ObjectiveSectionProps {
  section: string
  items: ClientItem[]
  onSubmit: (answers: { item_id: string; answer: unknown }[]) => void
  submitting: boolean
  sessionId?: string | null
}

export function ObjectiveSection({
  section,
  items,
  onSubmit,
  submitting,
  sessionId,
}: ObjectiveSectionProps) {
  const [answers, setAnswers] = useSessionDraft<AnswerMap>(
    `${section}:${items.map((i) => i.id).join(",")}`,
    {},
    sessionId
  )

  const autoSubmit = useRef(() => {})

  useEffect(() => {
    autoSubmit.current = () => {
      if (!submitting) submit()
    }
  })

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

  function setSegment(
    itemId: string,
    index: number,
    value: string,
    totalGaps: number
  ) {
    setAnswers((a) => {
      const current =
        (a[itemId]?.segments as string[]) || Array(totalGaps).fill("")
      const next = [...current]
      next[index] = value
      return { ...a, [itemId]: { ...(a[itemId] || {}), segments: next } }
    })
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
      {items.map((item, idx) => (
        <Card key={item.id} className="p-6 sm:p-8 border-border bg-card shadow-md space-y-6 rounded-3xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#CDFA1A]/20 text-[#627a05] dark:text-[#CDFA1A] text-xs font-black">
                {idx + 1}
              </span>
              <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                {section === "listening" ? "Listening Comprehension" : "Reading Passage"}
              </span>
            </div>
            {item.cefr && (
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-secondary text-muted-foreground border border-border">
                Level {item.cefr}
              </span>
            )}
          </div>

          {/* Listening Audio Track */}
          {section === "listening" && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-foreground">Listening Clip</p>
              {item.audio || item.media_path ? (
                <ListeningPlayer path={item.audio || item.media_path || ""} />
              ) : (
                <p className="text-xs text-muted-foreground italic">No audio track provided for this item.</p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Listen carefully once, then answer the questions below. Check your speaker volume before starting.
              </p>
            </div>
          )}

          {/* C-Test Missing Letters */}
          {item.type === "ctest" && item.segments && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Fill in the Missing Letters
              </h4>
              <div className="rounded-2xl border border-border bg-secondary/20 p-5 text-sm leading-loose font-serif">
                {(() => {
                  let gapIndex = -1
                  const totalGaps = item.segments.filter((s) => typeof s !== "string").length
                  return item.segments.map((seg, i) => {
                    if (typeof seg === "string") {
                      return <span key={i}>{seg}</span>
                    }
                    gapIndex += 1
                    const idx = gapIndex
                    const currentVal = ((answers[item.id]?.segments as string[]) || [])[idx] || ""
                    return (
                      <input
                        key={i}
                        type="text"
                        maxLength={12}
                        value={currentVal}
                        onChange={(e) => setSegment(item.id, idx, e.target.value, totalGaps)}
                        className="inline-block mx-1 w-16 h-8 text-center font-mono font-bold text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-[#CDFA1A]"
                      />
                    )
                  })
                })()}
              </div>
            </div>
          )}

          {/* Reading Text Passage */}
          {item.text && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-blue-500" /> Passage Text
              </h4>
              <div className="rounded-2xl border border-border bg-secondary/20 p-5 text-sm leading-relaxed whitespace-pre-line font-serif text-foreground/90">
                {item.text}
              </div>
            </div>
          )}

          {/* Item Questions */}
          {item.questions && item.questions.length > 0 && (
            <div className="space-y-5 pt-2">
              {item.questions.map((q, qIndex) => (
                <div key={q.id} className="space-y-3 rounded-2xl border border-border/80 bg-secondary/10 p-5">
                  <p className="text-xs font-bold text-foreground leading-snug">
                    <span className="text-muted-foreground mr-1.5">{qIndex + 1}.</span> {q.prompt}
                  </p>

                  {/* MCQ */}
                  {q.type === "mcq" && q.options && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {q.options.map((opt, optIdx) => {
                        const isSelected = answers[item.id]?.[q.id] === optIdx
                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => setQ(item.id, q.id, optIdx)}
                            className={`rounded-xl border p-3.5 text-left text-xs font-medium transition-all ${
                              isSelected
                                ? "border-[#CDFA1A] bg-[#CDFA1A]/20 font-bold text-foreground shadow-sm"
                                : "border-border hover:bg-secondary/60 text-muted-foreground"
                            }`}
                          >
                            <span className="font-mono text-muted-foreground mr-2 font-bold">
                              {String.fromCharCode(65 + optIdx)}.
                            </span>
                            {opt}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* True / False / Not Given */}
                  {q.type === "tfng" && (
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "True", val: "true" },
                        { label: "False", val: "false" },
                        { label: "Not Given", val: "not_given" },
                      ].map((itemChoice) => {
                        const isSelected = answers[item.id]?.[q.id] === itemChoice.val
                        return (
                          <button
                            key={itemChoice.val}
                            type="button"
                            onClick={() => setQ(item.id, q.id, itemChoice.val)}
                            className={`rounded-xl border py-2.5 px-3 text-center text-xs font-semibold transition-all ${
                              isSelected
                                ? "border-[#CDFA1A] bg-[#CDFA1A]/20 font-bold text-foreground shadow-sm"
                                : "border-border hover:bg-secondary/60 text-muted-foreground"
                            }`}
                          >
                            {itemChoice.label}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Text Gap */}
                  {(!q.type || q.type === "gap") && (
                    <input
                      type="text"
                      placeholder="Type your response…"
                      value={(answers[item.id]?.[q.id] as string) || ""}
                      onChange={(e) => setQ(item.id, q.id, e.target.value)}
                      className="w-full h-11 rounded-xl border border-input bg-background px-4 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#CDFA1A]"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}

      <Button
        size="lg"
        onClick={submit}
        disabled={submitting}
        className="w-full bg-[#CDFA1A] text-black font-extrabold hover:bg-[#b8e612] rounded-2xl h-14 text-base gap-2 shadow-lg"
      >
        {submitting ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            Submit Section & Continue
            <ArrowRight className="h-5 w-5 stroke-[2.5]" />
          </>
        )}
      </Button>
    </div>
  )
}

function ListeningPlayer({ path }: { path: string }) {
  const audio = useRef<HTMLAudioElement>(null)
  const [state, setState] = useState<"ready" | "playing" | "done" | "error">("ready")

  const resolvedUrl = api.getEnglishMediaUrl(path)

  return (
    <div className="flex flex-col sm:flex-row items-center gap-3 p-3.5 rounded-2xl border border-border bg-secondary/30">
      <audio
        ref={audio}
        src={resolvedUrl}
        preload="auto"
        onEnded={() => setState("done")}
        onError={() => setState("error")}
      />

      <Button
        type="button"
        size="sm"
        disabled={state === "playing" || state === "done"}
        onClick={async () => {
          try {
            await audio.current?.play()
            setState("playing")
          } catch {
            setState("error")
          }
        }}
        className={`rounded-xl px-5 text-xs font-bold gap-2 ${
          state === "done"
            ? "bg-secondary text-muted-foreground"
            : "bg-[#CDFA1A] text-black hover:bg-[#b8e612]"
        }`}
      >
        {state === "playing" ? (
          <>
            <Volume2 className="h-4 w-4 animate-pulse text-black" />
            Playing Track…
          </>
        ) : state === "done" ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Playback Completed
          </>
        ) : state === "error" ? (
          <>
            <VolumeX className="h-4 w-4 text-destructive" />
            Retry Audio
          </>
        ) : (
          <>
            <Play className="h-4 w-4 fill-black" />
            Play Audio (Once)
          </>
        )}
      </Button>

      <span className="text-[11px] text-muted-foreground">
        {state === "playing"
          ? "Audio track playing — take notes as needed."
          : state === "done"
          ? "Single playback limit reached."
          : state === "error"
          ? "Audio playback failed. Please check your speaker setup."
          : "Track will play once from start to finish."}
      </span>
    </div>
  )
}
