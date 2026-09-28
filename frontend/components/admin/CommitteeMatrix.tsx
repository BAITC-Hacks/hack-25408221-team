"use client"

import { useEffect, useState } from "react"
import { useAdminStore } from "@/stores/useAdminStore"
import { CommitteeGridRow, RatingEvent } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { CheckCircle2, XCircle, Sparkles, User, Quote, ArrowRight } from "lucide-react"

const INDICATORS = [
  { key: "motivation_university" as const, label: "Motivation" },
  { key: "leadership" as const, label: "Leadership" },
  { key: "prior_experience" as const, label: "Prior Experience" },
]

export function CommitteeMatrix() {
  const {
    committeeRows,
    committeeContext,
    fetchCommitteeGrid,
    fetchCommitteeContext,
    decideRatingEvent,
    createRatingEvent,
    loading,
  } = useAdminStore()

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [addingForIndicator, setAddingForIndicator] = useState<string | null>(null)
  const [newBand, setNewBand] = useState<"emerging" | "developing" | "strong">("strong")
  const [newQuote, setNewQuote] = useState("")
  const [submittingRating, setSubmittingRating] = useState(false)

  useEffect(() => {
    fetchCommitteeGrid()
  }, [fetchCommitteeGrid])

  const openEvidenceModal = async (sessionId: string) => {
    setSelectedSessionId(sessionId)
    setAddingForIndicator(null)
    setNewQuote("")
    await fetchCommitteeContext(sessionId)
    setModalOpen(true)
  }

  const handleDecision = async (
    eventId: string,
    status: "accepted" | "rejected",
    band?: string
  ) => {
    if (!selectedSessionId) return
    await decideRatingEvent(selectedSessionId, eventId, status, band)
  }

  const handleAddRating = async (indicator: string) => {
    if (!selectedSessionId || !newQuote.trim()) return
    setSubmittingRating(true)
    await createRatingEvent(selectedSessionId, {
      indicator,
      band: newBand,
      quote: newQuote.trim(),
      status: "accepted",
    })
    setSubmittingRating(false)
    setAddingForIndicator(null)
    setNewQuote("")
  }

  const getBandBadge = (cell: any) => {
    if (!cell) return <span className="text-muted-foreground text-xs">—</span>
    const bandColors: Record<string, string> = {
      emerging: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
      developing: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
      strong: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold",
    }
    return (
      <div className="flex flex-col gap-1 items-start">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold capitalize ${
            bandColors[cell.band] || "bg-secondary text-foreground"
          }`}
        >
          {cell.band}
        </span>
        <span className="text-[10px] text-muted-foreground capitalize">
          {cell.status} · {cell.rater_type}
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader className="bg-secondary/40">
            <TableRow>
              <TableHead className="text-xs font-bold text-foreground">Candidate</TableHead>
              <TableHead className="text-xs font-bold text-foreground">Program Track</TableHead>
              <TableHead className="text-xs font-bold text-foreground">1. Motivation</TableHead>
              <TableHead className="text-xs font-bold text-foreground">2. Leadership</TableHead>
              <TableHead className="text-xs font-bold text-foreground">3. Experience</TableHead>
              <TableHead className="text-right text-xs font-bold text-foreground">Review Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {committeeRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-xs text-muted-foreground">
                  No committee ratings proposed yet.
                </TableCell>
              </TableRow>
            ) : (
              committeeRows.map((row) => (
                <TableRow key={row.session_id} className="hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <div className="font-bold text-sm text-foreground">{row.user_name || "Applicant"}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">{row.session_id.slice(0, 8)}…</div>
                  </TableCell>

                  <TableCell>
                    <Badge variant="outline" className="text-[10px] font-semibold">
                      {row.program}
                    </Badge>
                  </TableCell>

                  <TableCell>{getBandBadge(row.indicators.motivation_university)}</TableCell>
                  <TableCell>{getBandBadge(row.indicators.leadership)}</TableCell>
                  <TableCell>{getBandBadge(row.indicators.prior_experience)}</TableCell>

                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEvidenceModal(row.session_id)}
                      className="rounded-xl text-xs gap-1.5 font-semibold hover:border-[#CDFA1A]"
                    >
                      <Quote className="h-3 w-3 text-[#84a305] dark:text-[#CDFA1A]" />
                      Verify Quotes
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Verbatim Quote Evidence & Human Decision Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#84a305] dark:text-[#CDFA1A]" />
              Committee Evidence Review: {committeeContext?.user_name || "Applicant"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Review model-extracted verbatim applicant quotes and approve/reject rating events.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            {INDICATORS.map(({ key, label }) => {
              const events: RatingEvent[] = committeeContext?.rating_events?.[key] || []

              return (
                <div key={key} className="space-y-3 rounded-2xl border border-border bg-secondary/20 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-foreground">{label}</h4>
                      <span className="text-[11px] text-muted-foreground">{events.length} event(s)</span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAddingForIndicator(addingForIndicator === key ? null : key)}
                      className="h-8 text-xs font-semibold rounded-xl hover:border-[#CDFA1A]"
                    >
                      {addingForIndicator === key ? "Cancel" : "+ Add Committee Rating"}
                    </Button>
                  </div>

                  {/* Add Rating Form */}
                  {addingForIndicator === key && (
                    <div className="rounded-xl border border-[#CDFA1A]/40 bg-card p-4 space-y-3 shadow-md">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">
                          Propose Human Rating for {label}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground">Band:</span>
                          <select
                            value={newBand}
                            onChange={(e) => setNewBand(e.target.value as any)}
                            className="h-8 rounded-lg border border-input bg-background px-2 text-xs font-bold capitalize focus:ring-1 focus:ring-[#CDFA1A]"
                          >
                            <option value="emerging">Emerging</option>
                            <option value="developing">Developing</option>
                            <option value="strong">Strong</option>
                          </select>
                        </div>
                      </div>

                      <textarea
                        rows={2}
                        placeholder="Paste applicant verbatim quote or write committee observation notes…"
                        value={newQuote}
                        onChange={(e) => setNewQuote(e.target.value)}
                        className="w-full rounded-xl border border-input bg-background p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#CDFA1A]"
                      />

                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setAddingForIndicator(null)
                            setNewQuote("")
                          }}
                          className="h-8 rounded-lg text-xs"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          disabled={submittingRating || !newQuote.trim()}
                          onClick={() => handleAddRating(key)}
                          className="h-8 rounded-lg text-xs bg-[#CDFA1A] text-black font-extrabold hover:bg-[#b8e612]"
                        >
                          {submittingRating ? "Saving…" : "Save Committee Rating"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {events.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No quote proposed for this indicator.</p>
                  ) : (
                    events.map((ev) => (
                      <div
                        key={ev.id}
                        className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              Band:
                            </span>
                            <Badge variant="outline" className="font-bold uppercase text-[10px]">
                              {ev.band}
                            </Badge>
                          </div>
                          <Badge
                            variant={
                              ev.status === "accepted"
                                ? "default"
                                : ev.status === "rejected"
                                ? "destructive"
                                : "secondary"
                            }
                            className="capitalize text-[10px]"
                          >
                            {ev.status} ({ev.rater_type})
                          </Badge>
                        </div>

                        {/* Verbatim Quote */}
                        <div className="rounded-lg border-l-2 border-[#CDFA1A] bg-secondary/40 p-3 italic text-xs leading-relaxed text-foreground">
                          “{ev.quote}”
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <select
                            defaultValue={ev.band}
                            id={`band-${ev.id}`}
                            className="h-8 rounded-lg border border-input bg-background px-2 text-xs font-semibold capitalize"
                          >
                            <option value="emerging">Emerging</option>
                            <option value="developing">Developing</option>
                            <option value="strong">Strong</option>
                          </select>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={ev.status === "rejected"}
                            onClick={() => handleDecision(ev.id, "rejected")}
                            className="h-8 rounded-lg text-xs gap-1 hover:bg-destructive/10 hover:text-destructive"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            disabled={ev.status === "accepted"}
                            onClick={() => {
                              const sel = document.getElementById(`band-${ev.id}`) as HTMLSelectElement
                              handleDecision(ev.id, "accepted", sel?.value || ev.band)
                            }}
                            className="h-8 rounded-lg text-xs gap-1 bg-[#CDFA1A] text-black font-bold hover:bg-[#b8e612]"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Accept Rating
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
