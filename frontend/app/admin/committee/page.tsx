"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useAuth } from "@/contexts/AuthContext"
import { api } from "@/lib/api"
import { AdminHeader } from "@/components/admin/AdminHeader"
import type { CommitteeGridRow, CommitteeContext, RatingIndicatorKey } from "@/lib/api"

const INDICATORS: { key: RatingIndicatorKey; label: string }[] = [
  { key: "motivation_university", label: "Motivation" },
  { key: "leadership", label: "Leadership" },
  { key: "prior_experience", label: "Prior Experience" },
]

const BAND_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  emerging: "outline",
  developing: "secondary",
  strong: "default",
}

function IndicatorCell({ cell }: { cell: CommitteeGridRow["indicators"][RatingIndicatorKey] }) {
  if (!cell) {
    return <span className="text-sm text-muted-foreground">—</span>
  }
  return (
    <div className="flex flex-col gap-1">
      <Badge variant={BAND_VARIANT[cell.band] ?? "outline"} className="capitalize">
        {cell.band}
      </Badge>
      <span className="text-xs capitalize text-muted-foreground">
        {cell.status} · {cell.rater_type}
      </span>
    </div>
  )
}

export default function CommitteePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [authChecked, setAuthChecked] = useState(false)
  const [rows, setRows] = useState<CommitteeGridRow[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [fetchError, setFetchError] = useState("")
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [context, setContext] = useState<CommitteeContext | null>(null)
  const [contextLoading, setContextLoading] = useState(false)
  const [decidingEventId, setDecidingEventId] = useState<string | null>(null)

  useEffect(() => {
    if (!user || user.role !== "admin") {
      router.replace("/signin")
      return
    }
    setAuthChecked(true)
  }, [router, user])

  const loadGrid = () => {
    setLoadingData(true)
    api
      .adminGetCommitteeGrid()
      .then((data) => {
        setRows(data.items || [])
        setLoadingData(false)
      })
      .catch((err) => {
        setFetchError(`Could not load committee grid — ${err instanceof Error ? err.message : "unknown error"}`)
        setLoadingData(false)
      })
  }

  useEffect(() => {
    if (!authChecked) return
    loadGrid()
  }, [authChecked])

  const openContext = (sessionId: string) => {
    setSelectedSessionId(sessionId)
    setContext(null)
    setContextLoading(true)
    api
      .adminGetCommitteeContext(sessionId)
      .then((data) => setContext(data))
      .catch(() => setContext(null))
      .finally(() => setContextLoading(false))
  }

  const decide = (eventId: string, status: "accepted" | "rejected") => {
    if (!selectedSessionId) return
    setDecidingEventId(eventId)
    api
      .adminDecideRatingEvent(selectedSessionId, eventId, { status })
      .then(() => {
        openContext(selectedSessionId)
        loadGrid()
      })
      .finally(() => setDecidingEventId(null))
  }

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <p className="text-lg font-medium">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <AdminHeader />

      <main className="p-8">
        {fetchError && <p className="mb-4 text-red-600">{fetchError}</p>}

        {loadingData ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading committee grid…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">No sessions yet.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Applicant</TableHead>
                <TableHead>Program</TableHead>
                {INDICATORS.map((ind) => (
                  <TableHead key={ind.key}>{ind.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.session_id}
                  className="cursor-pointer"
                  onClick={() => openContext(row.session_id)}
                >
                  <TableCell className="font-medium">{row.user_name ?? row.user_id}</TableCell>
                  <TableCell>{row.program}</TableCell>
                  {INDICATORS.map((ind) => (
                    <TableCell key={ind.key}>
                      <IndicatorCell cell={row.indicators[ind.key]} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </main>

      <Dialog open={selectedSessionId !== null} onOpenChange={(open) => !open && setSelectedSessionId(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{context?.user_name ?? "Applicant"}</DialogTitle>
            <DialogDescription>{context?.program}</DialogDescription>
          </DialogHeader>

          {contextLoading && <p className="text-muted-foreground">Loading…</p>}

          {!contextLoading && context && (
            <div className="flex flex-col gap-6">
              {INDICATORS.map((ind) => {
                const events = context.rating_events[ind.key] || []
                return (
                  <div key={ind.key} className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold">{ind.label}</h3>
                    {events.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No proposals yet.</p>
                    ) : (
                      events.map((event) => (
                        <div key={event.id} className="rounded-md border p-3">
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant={BAND_VARIANT[event.band] ?? "outline"} className="capitalize">
                              {event.band}
                            </Badge>
                            <span className="text-xs capitalize text-muted-foreground">
                              {event.status} · {event.rater_type}
                            </span>
                          </div>
                          <p className="mt-2 text-sm italic">&ldquo;{event.quote}&rdquo;</p>
                          {event.status === "proposed" && (
                            <div className="mt-3 flex gap-2">
                              <Button
                                size="sm"
                                disabled={decidingEventId === event.id}
                                onClick={() => decide(event.id, "accepted")}
                              >
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={decidingEventId === event.id}
                                onClick={() => decide(event.id, "rejected")}
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )
              })}

              <details>
                <summary className="cursor-pointer text-sm font-semibold">Transcript</summary>
                <div className="mt-2 flex flex-col gap-2">
                  {(context.transcript || []).map((entry, i) => (
                    <p key={i} className="text-sm">
                      <span className="font-medium capitalize">{entry.role}:</span> {entry.text}
                    </p>
                  ))}
                </div>
              </details>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
