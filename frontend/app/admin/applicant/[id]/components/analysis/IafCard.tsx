"use client"

import { Brain } from "lucide-react"
import { DimensionRow } from "../ScoreMeter"

export function IafCard({ iafScore }: { iafScore: any }) {
  if (!iafScore) return null

  return (
    <div className="rounded-xl border border-border bg-background p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-purple-500" />
          <h3 className="font-semibold">IAF Competency Score</h3>
        </div>
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold ${
            iafScore.iaf_score >= 70
              ? "bg-green-500 text-white"
              : iafScore.iaf_score >= 50
                ? "bg-[#CDFA1A] text-black"
                : "bg-red-500 text-white"
          }`}
        >
          {iafScore.iaf_score}
        </div>
      </div>
      <div className="space-y-3">
        {iafScore.dimensions &&
          Object.entries(iafScore.dimensions).map(([key, dim]: [string, any]) => (
            <DimensionRow
              key={key}
              label={key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              score={dim.score}
            />
          ))}
      </div>
      {iafScore.top_dimensions?.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {iafScore.top_dimensions.map((d: string) => (
            <span
              key={d}
              className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800"
            >
              {d.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}
      {iafScore.dimensions_needing_attention?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {iafScore.dimensions_needing_attention.map((d: string) => (
            <span
              key={d}
              className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800"
            >
              {d.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
