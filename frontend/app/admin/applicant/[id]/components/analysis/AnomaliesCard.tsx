"use client"

import { AlertTriangle } from "lucide-react"

export function AnomaliesCard({ errorAnalysis }: { errorAnalysis: any }) {
  if (!errorAnalysis) return null

  return (
    <div className="rounded-xl border border-border bg-background p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <h3 className="font-semibold">Error & Edge Case Analysis</h3>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Inconsistencies
          </p>
          {errorAnalysis.inconsistencies?.inconsistencies?.length > 0 ? (
            <div className="space-y-2">
              {errorAnalysis.inconsistencies.inconsistencies.map(
                (inc: any, i: number) => (
                  <div
                    key={i}
                    className={`rounded-lg p-2 text-xs ${
                      inc.severity === "high"
                        ? "bg-red-50 text-red-800"
                        : "bg-yellow-50 text-yellow-800"
                    }`}
                  >
                    {inc.detail}
                  </div>
                )
              )}
            </div>
          ) : (
            <p className="text-sm text-green-600">No inconsistencies detected</p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Edge Cases
          </p>
          {errorAnalysis.edge_cases?.edge_cases?.length > 0 ? (
            <div className="space-y-2">
              {errorAnalysis.edge_cases.edge_cases.map((ec: any, i: number) => (
                <div
                  key={i}
                  className={`rounded-lg p-2 text-xs ${
                    ec.severity === "critical" || ec.severity === "high"
                      ? "bg-red-50 text-red-800"
                      : "bg-yellow-50 text-yellow-800"
                  }`}
                >
                  {ec.detail}
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Reliability:{" "}
                <span className="font-medium capitalize">
                  {errorAnalysis.edge_cases.reliability}
                </span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-green-600">No edge cases flagged</p>
          )}
        </div>
      </div>
    </div>
  )
}
