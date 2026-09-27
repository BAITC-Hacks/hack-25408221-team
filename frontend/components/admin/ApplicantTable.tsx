"use client"

import Link from "next/link"
import { Play, MoreVertical, Eye, Mail, CheckCircle2, Clock, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ApiUser } from "./types"

function ScoreBar({ score, maxScore = 10 }: { score: number; maxScore?: number }) {
  const percentage = (score / maxScore) * 100
  const getColor = () => {
    if (percentage >= 80) return "bg-green-500"
    if (percentage >= 60) return "bg-[#CDFA1A]"
    if (percentage >= 40) return "bg-yellow-500"
    return "bg-red-500"
  }

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 rounded-full bg-muted">
        <div
          className={`h-2 rounded-full ${getColor()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs font-medium">{score}/10</span>
    </div>
  )
}

export function ApplicantTable({
  applicants,
  loading,
  error,
  onPlayRecording,
}: {
  applicants: ApiUser[]
  loading: boolean
  error?: string | null
  onPlayRecording: (applicant: ApiUser) => void
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-background p-12 text-center">
        <p className="text-muted-foreground">Loading applicants…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-background p-12 text-center">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  if (applicants.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-background p-12 text-center">
        <p className="text-muted-foreground">No applicants found matching your filters.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-background overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                Applicant
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                Program
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                Status
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                Score
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                Recommendation
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {applicants.map((applicant) => {
              const evaluation = applicant.session?.evaluation
              const hasRecording = applicant.has_recording

              return (
                <tr
                  key={applicant.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#CDFA1A]/20 text-sm font-medium">
                        {applicant.name
                          .split(" ")
                          .map((n: string) => n[0])
                          .join("")}
                      </div>
                      <div>
                        <p className="font-medium">{applicant.name}</p>
                        <p className="text-sm text-muted-foreground">{applicant.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                        applicant.session?.program === "Undergraduate"
                          ? "bg-[#CDFA1A]/20 text-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {applicant.session?.program || "—"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                        hasRecording
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {hasRecording ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" />
                          Has Recording
                        </>
                      ) : (
                        <>
                          <Clock className="h-3 w-3" />
                          Pending
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {evaluation?.overall_score ? (
                      <ScoreBar score={evaluation.overall_score} />
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {evaluation ? (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                          ["strongly_recommended", "recommended"].includes(
                            evaluation.recommendation
                          )
                            ? "bg-green-100 text-green-700"
                            : evaluation.recommendation === "not_recommended"
                              ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {["strongly_recommended", "recommended"].includes(
                          evaluation.recommendation
                        ) ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : evaluation.recommendation === "not_recommended" ? (
                          <XCircle className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        {evaluation.recommendation === "strongly_recommended"
                          ? "Strongly Recommended"
                          : evaluation.recommendation === "recommended"
                            ? "Recommended"
                            : evaluation.recommendation === "not_recommended"
                              ? "Not Recommended"
                              : evaluation.recommendation === "needs_review"
                                ? "Needs Review"
                                : "Pending"}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {hasRecording && applicant.session && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => onPlayRecording(applicant)}
                        >
                          <Play className="h-3.5 w-3.5" />
                          Play
                        </Button>
                      )}
                      <Link href={`/admin/applicant/${applicant.id}`}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/applicant/${applicant.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Mail className="mr-2 h-4 w-4" />
                            Send Email
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
