"use client"

import { Globe } from "lucide-react"
import { CEFR_COLORS } from "@/components/admin/types"
import { ScoreMeter } from "../ScoreMeter"

export function LanguageCard({ languageProficiency }: { languageProficiency: any }) {
  if (!languageProficiency) return null

  return (
    <div className="rounded-xl border border-border bg-background p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-teal-500" />
          <h3 className="font-semibold">Language Proficiency (Voice Interview Estimate)</h3>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-sm font-bold ${
              CEFR_COLORS[languageProficiency.cefr_level] || "bg-muted"
            }`}
          >
            {languageProficiency.cefr_level}
          </span>
          {languageProficiency.ielts_equivalent && (
            <span className="text-sm text-muted-foreground">
              IELTS ~{languageProficiency.ielts_equivalent}
            </span>
          )}
        </div>
      </div>
      <ScoreMeter
        value={languageProficiency.composite_score}
        label="Composite Score"
        className="mb-4"
      />
      <div className="mt-4 space-y-3">
        {languageProficiency.dimensions &&
          Object.entries(languageProficiency.dimensions).map(
            ([key, dim]: [string, any]) => (
              <ScoreMeter
                key={key}
                value={dim.score}
                label={key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                color={
                  dim.score >= 70
                    ? "bg-green-500"
                    : dim.score >= 50
                      ? "bg-[#CDFA1A]"
                      : "bg-red-500"
                }
              />
            )
          )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {languageProficiency.disclaimer}
      </p>
    </div>
  )
}
