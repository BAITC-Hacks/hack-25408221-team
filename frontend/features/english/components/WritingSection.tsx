"use client"

import { useEffect, useRef } from "react"
import { Loader2, PenLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ClientItem } from "../types"
import { useSessionDraft } from "../hooks/useSessionDraft"

export function WritingSection({
  item,
  onSubmit,
  submitting,
}: {
  item: ClientItem
  onSubmit: (answer: string) => void
  submitting: boolean
}) {
  const [text, setText] = useSessionDraft(`writing:${item.id}`, "")

  const autoSubmit = useRef(() => {})
  autoSubmit.current = () => {
    if (!submitting) onSubmit(text)
  }

  useEffect(() => {
    const expire = () => autoSubmit.current()
    window.addEventListener("assessment-expired", expire)
    return () => window.removeEventListener("assessment-expired", expire)
  }, [])

  const words = text.trim() ? text.trim().split(/\s+/).length : 0

  return (
    <div className="rounded-xl border border-border bg-card p-6 md:p-8 space-y-6">
      <div className="border-b border-border pb-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <PenLine className="h-4 w-4" /> WRITING ASSESSMENT
        </span>
        <h2 className="text-xl font-bold mt-2">Writing Prompt</h2>
        <p className="mt-2 text-sm leading-relaxed text-foreground/90 whitespace-pre-line bg-muted/20 p-4 rounded-lg border border-border">
          {item.prompt}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <label htmlFor="writing-textarea" className="font-medium">
            Your Response (Aim for 100–150 words)
          </label>
          <span className={words < 50 ? "text-amber-600 font-medium" : "text-green-600 font-medium"}>
            {words} words
          </span>
        </div>

        <textarea
          id="writing-textarea"
          rows={10}
          maxLength={10000}
          spellCheck={false}
          autoComplete="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Begin typing your response here..."
          className="w-full rounded-lg border border-input bg-background p-4 text-sm outline-none focus:border-foreground focus:ring-1 focus:ring-foreground leading-relaxed resize-y"
        />
      </div>

      <div className="flex justify-end pt-2">
        <Button
          size="lg"
          className="bg-[#CDFA1A] text-foreground hover:bg-[#CDFA1A]/90 font-semibold px-8"
          disabled={submitting || words === 0}
          onClick={() => onSubmit(text)}
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit Writing & Continue
        </Button>
      </div>
    </div>
  )
}
