"use client"

import { useEffect, useRef } from "react"
import { useSessionDraft } from "@/lib/english/useSessionDraft"
import type { ClientItem } from "@/lib/english/types"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PenTool, ArrowRight, Loader2, CheckCircle2 } from "lucide-react"

interface WritingSectionProps {
  item: ClientItem
  onSubmit: (text: string) => void
  submitting: boolean
  sessionId?: string | null
}

export function WritingSection({
  item,
  onSubmit,
  submitting,
  sessionId,
}: WritingSectionProps) {
  const [text, setText] = useSessionDraft(`writing:${item.id}`, "", sessionId)

  const autoSubmit = useRef(() => {})

  useEffect(() => {
    autoSubmit.current = () => {
      if (!submitting) onSubmit(text)
    }
  })

  useEffect(() => {
    const expire = () => autoSubmit.current()
    window.addEventListener("assessment-expired", expire)
    return () => window.removeEventListener("assessment-expired", expire)
  }, [])

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0
  const minWords = item.min_words || 100
  const maxWords = item.max_words || 250

  return (
    <Card className="p-6 sm:p-10 border-border bg-card shadow-xl space-y-6 rounded-3xl">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <PenTool className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-foreground">Section: Writing</h3>
            <p className="text-xs text-muted-foreground">Timed structured academic essay</p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[11px] font-mono text-muted-foreground block">
            Target: {minWords} – {maxWords} words
          </span>
          <span
            className={`text-xs font-black ${
              wordCount >= minWords ? "text-emerald-500" : "text-muted-foreground"
            }`}
          >
            Current: {wordCount} words
          </span>
        </div>
      </div>

      {/* Essay Prompt Card */}
      <div className="rounded-2xl border border-border bg-secondary/20 p-5 space-y-2">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
          Essay Assignment Prompt
        </span>
        <p className="text-sm font-semibold leading-relaxed text-foreground font-serif">
          {item.prompt || item.text}
        </p>
        {item.image && (
          <p className="text-xs text-muted-foreground italic">
            [Visual stimulus referenced in essay prompt]
          </p>
        )}
      </div>

      {/* Drafting Textarea */}
      <div className="space-y-2">
        <textarea
          rows={12}
          spellCheck={false}
          autoComplete="off"
          maxLength={10000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Compose your structured essay response here. Formulate a clear thesis, support with arguments, and conclude effectively…"
          className="w-full rounded-2xl border border-input bg-background p-5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#CDFA1A] font-sans resize-y"
        />

        <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
          <span>Draft autosaves continuously to local session storage.</span>
          <span>
            {wordCount >= minWords ? (
              <span className="text-emerald-500 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="h-3 w-3" /> Target length satisfied
              </span>
            ) : (
              <span>Need {Math.max(0, minWords - wordCount)} more words to meet recommendation</span>
            )}
          </span>
        </div>
      </div>

      <Button
        size="lg"
        onClick={() => onSubmit(text)}
        disabled={submitting || wordCount < 15}
        className="w-full bg-[#CDFA1A] text-black font-extrabold hover:bg-[#b8e612] rounded-2xl h-14 text-base gap-2 shadow-lg disabled:opacity-50"
      >
        {submitting ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            Submit Essay & Proceed
            <ArrowRight className="h-5 w-5 stroke-[2.5]" />
          </>
        )}
      </Button>
    </Card>
  )
}
