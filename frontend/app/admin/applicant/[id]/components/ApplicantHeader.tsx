"use client"

import { ApiUser } from "@/components/admin/types"

export function ApplicantHeader({ applicant }: { applicant: ApiUser }) {
  const initials = applicant.name
    .split(" ")
    .map((n: string) => n[0])
    .join("")

  const recommendation = applicant.session?.evaluation?.recommendation

  return (
    <div className="rounded-xl border border-border bg-background p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#CDFA1A] text-xl font-bold">
            {initials}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{applicant.name}</h1>
            <p className="text-muted-foreground">{applicant.email}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex rounded-full bg-[#CDFA1A]/20 px-3 py-1 text-sm font-medium">
                {applicant.session?.program || "—"}
              </span>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
                  applicant.has_recording
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {applicant.has_recording ? "Has Recording" : "No Recording"}
              </span>
              {recommendation && (
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
                    ["strongly_recommended", "recommended"].includes(recommendation)
                      ? "bg-green-100 text-green-700"
                      : recommendation === "not_recommended"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {recommendation === "strongly_recommended"
                    ? "Strongly Recommended"
                    : recommendation === "recommended"
                      ? "Recommended"
                      : recommendation === "not_recommended"
                        ? "Not Recommended"
                        : recommendation === "needs_review"
                          ? "Needs Review"
                          : "Pending"}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">User ID</p>
          <p className="font-mono text-xs font-medium">{applicant.id.slice(0, 8)}…</p>
        </div>
      </div>
    </div>
  )
}
