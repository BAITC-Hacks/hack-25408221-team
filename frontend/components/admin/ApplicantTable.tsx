"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useAdminStore } from "@/stores/useAdminStore"
import { ApiUser } from "@/lib/api"
import { Input } from "@/components/ui/input"
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
  Search,
  Video,
  ArrowRight,
  User,
  GraduationCap,
  Sparkles,
} from "lucide-react"

export function ApplicantTable() {
  const { applicants, searchQuery, filterProgram, setSearchQuery, setFilterProgram } =
    useAdminStore()

  const filtered = useMemo(() => {
    return applicants.filter((a) => {
      if (a.role === "admin") return false
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q)

      const matchesProgram =
        filterProgram === "all" ||
        (a.session?.program && a.session.program.toLowerCase().includes(filterProgram.toLowerCase()))

      return matchesSearch && matchesProgram
    })
  }, [applicants, searchQuery, filterProgram])

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search candidate name, email, or ID…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-xl h-10 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterProgram}
            onChange={(e) => setFilterProgram(e.target.value)}
            className="h-10 rounded-xl border border-input bg-background px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#CDFA1A]"
          >
            <option value="all">All Programs</option>
            <option value="undergraduate">Undergraduate</option>
            <option value="foundation">Foundation Year</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader className="bg-secondary/40">
            <TableRow>
              <TableHead className="font-bold text-foreground text-xs">Applicant</TableHead>
              <TableHead className="font-bold text-foreground text-xs">Program Track</TableHead>
              <TableHead className="font-bold text-foreground text-xs">Video Presentation</TableHead>
              <TableHead className="font-bold text-foreground text-xs">AI Recommendation</TableHead>
              <TableHead className="font-bold text-foreground text-xs">Language Status</TableHead>
              <TableHead className="text-right font-bold text-foreground text-xs">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-xs text-muted-foreground">
                  No applicants matching current filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((a) => {
                const evalData = a.session?.evaluation
                const score = evalData?.overall_score
                const rec = evalData?.recommendation

                return (
                  <TableRow key={a.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-xs font-black text-foreground">
                          {a.name ? a.name[0].toUpperCase() : <User className="h-4 w-4" />}
                        </div>
                        <div>
                          <div className="font-bold text-foreground text-sm">{a.name}</div>
                          <div className="text-xs text-muted-foreground">{a.email}</div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className="text-[11px] font-semibold">
                        {a.session?.program || "Undergraduate"}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      {a.has_recording ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            <Video className="h-3 w-3" />
                            {score ? `${score}/10` : "WebM Ready"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Pending Call</span>
                      )}
                    </TableCell>

                    <TableCell>
                      {rec ? (
                        <Badge
                          variant={
                            rec.includes("strongly") || rec === "recommended"
                              ? "default"
                              : rec === "needs_review"
                              ? "secondary"
                              : "destructive"
                          }
                          className="capitalize text-[11px] font-bold"
                        >
                          {rec.replace(/_/g, " ")}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Pending Review</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium">
                        <GraduationCap className="h-3.5 w-3.5 text-[#84a305] dark:text-[#CDFA1A]" />
                        Active Profile
                      </span>
                    </TableCell>

                    <TableCell className="text-right">
                      <Link href={`/admin/applicant/${a.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 rounded-lg text-xs font-semibold hover:bg-[#CDFA1A]/20 hover:text-black dark:hover:text-[#CDFA1A]"
                        >
                          Review Dossier
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
