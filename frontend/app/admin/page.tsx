"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Search,
  Filter,
  Download,
  MoreVertical,
  Eye,
  Mail,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronDown,
  Users,
  FileText,
  TrendingUp,
  Video,
  Play,
  X,
  Maximize2,
  Minimize2,
  LogOut,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/contexts/AuthContext"
import { api, getToken } from "@/lib/api"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

type TranscriptEntry = {
  role: "user" | "assistant"
  text: string
  timestamp: string
}

type ApplicantData = {
  q1_why_applying: string
  q2_program_choice: string
  q3_challenge_overcome: string
  q4_long_term_goals: string
  q5_leadership: string
  q6_family_support: string
  language_used: string
  confidence_level: string
  communication_quality: string
}

type Evaluation = {
  overall_score?: number
  overall_impression?: string
  strengths: string[]
  areas_for_improvement?: string[]
  concerns?: string[]
  recommendation: "strongly_recommended" | "recommended" | "needs_review" | "not_recommended" | "pending"
  notes?: string
}

type Session = {
  id: string
  user_id: string
  program: string
  recording_url: string | null
  transcript: TranscriptEntry[] | null
  applicant_data: ApplicantData | null
  evaluation: Evaluation | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

type ApiUser = {
  id: string
  name: string
  email: string
  phone: string
  has_recording: boolean
  session: Session | null
}

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
      <span className="text-sm font-medium">{score}/{maxScore}</span>
    </div>
  )
}

function RecordingModal({
  applicant,
  onClose,
}: {
  applicant: ApiUser
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [videoSrc, setVideoSrc] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  const sessionId = applicant.session?.id

  useEffect(() => {
    if (!sessionId) return
    const token = getToken()
    fetch(`${API_URL}/api/recording-url/${sessionId}?token=${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.url) {
          const url = d.url.startsWith("/") ? `${API_URL}${d.url}?token=${token}` : d.url
          setVideoSrc(url)
        }
      })
      .catch(() => {})
  }, [sessionId])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleEsc)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handleEsc)
      document.body.style.overflow = ""
    }
  }, [onClose])

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", handleFsChange)
    return () => document.removeEventListener("fullscreenchange", handleFsChange)
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        className="relative w-full max-w-5xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold text-white">{applicant.name}</h3>
            <p className="text-sm text-white/60">
              {applicant.session?.program} · {applicant.session?.completed_at
                ? new Date(applicant.session.completed_at).toLocaleDateString()
                : "Interview Recording"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleFullscreen}
              className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            >
              {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </button>
            {videoSrc && (
              <a
                href={videoSrc}
                download
                className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
              >
                <Download className="h-5 w-5" />
              </a>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Video */}
        <div className="rounded-xl overflow-hidden bg-black aspect-video">
          <video
            ref={videoRef}
            src={videoSrc}
            controls
            autoPlay
            className="w-full h-full object-contain"
          />
        </div>

        {/* Quick info */}
        <div className="flex items-center justify-between mt-3 text-sm text-white/60">
          <div className="flex items-center gap-4">
            {applicant.session?.evaluation && (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                ["strongly_recommended", "recommended"].includes(applicant.session.evaluation.recommendation)
                  ? "bg-green-500/20 text-green-400"
                  : applicant.session.evaluation.recommendation === "not_recommended"
                    ? "bg-red-500/20 text-red-400"
                    : "bg-yellow-500/20 text-yellow-400"
              }`}>
                {applicant.session.evaluation.recommendation === "strongly_recommended"
                  ? "Strongly Recommended"
                  : applicant.session.evaluation.recommendation === "recommended"
                    ? "Recommended"
                    : applicant.session.evaluation.recommendation === "not_recommended"
                      ? "Not Recommended"
                      : applicant.session.evaluation.recommendation === "needs_review"
                        ? "Needs Review"
                        : "Pending"}
                {(applicant.session.evaluation.overall_score ?? 0) > 0 && (
                  <span>· Score: {applicant.session.evaluation.overall_score}/10</span>
                )}
              </span>
            )}
          </div>
          <Link
            href={`/admin/applicant/${applicant.id}`}
            className="text-[#CDFA1A] hover:underline"
            onClick={onClose}
          >
            View Full Profile →
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const { user, logout, isAuthenticated } = useAuth()
  const [authChecked, setAuthChecked] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterProgram, setFilterProgram] = useState<string>("all")
  const [filterRecording, setFilterRecording] = useState<string>("all")
  const [applicants, setApplicants] = useState<ApiUser[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [fetchError, setFetchError] = useState("")
  const [playingRecording, setPlayingRecording] = useState<ApiUser | null>(null)

  useEffect(() => {
    if (!user || user.role !== "admin") {
      router.replace("/signin")
      return
    }
    setAuthChecked(true)
  }, [router, user])

  useEffect(() => {
    if (!authChecked) return
    
    api.adminGetUsers()
      .then((data) => {
        setApplicants(data.items || [])
        setLoadingData(false)
      })
      .catch((err) => {
        setFetchError(`Could not load applicants — ${err instanceof Error ? err.message : "unknown error"}`)
        setLoadingData(false)
      })
  }, [authChecked])

  const programs = Array.from(new Set(applicants.map((u) => u.session?.program).filter((p): p is string => Boolean(p))))

  const filteredApplicants = applicants.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.id.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesProgram = filterProgram === "all" || u.session?.program === filterProgram
    const matchesRecording =
      filterRecording === "all" ||
      (filterRecording === "true" && u.has_recording) ||
      (filterRecording === "false" && !u.has_recording)

    return matchesSearch && matchesProgram && matchesRecording
  }).sort((a, b) => {
    const aTime = a.session?.completed_at ?? a.session?.created_at ?? ""
    const bTime = b.session?.completed_at ?? b.session?.created_at ?? ""
    return bTime.localeCompare(aTime)
  })

  const stats = {
    total: applicants.length,
    withRecording: applicants.filter((a) => a.has_recording).length,
    withoutRecording: applicants.filter((a) => !a.has_recording).length,
    recommended: applicants.filter(
      (a) => ["strongly_recommended", "recommended"].includes(a.session?.evaluation?.recommendation ?? "")
    ).length,
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
      {/* Header */}
      <header className="border-b border-border bg-background px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold">
              inVision U
              <span className="ml-1 text-xs font-normal text-muted-foreground">Admin</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{user?.name}</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  logout()
                  router.push("/signin")
                }}
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="p-8">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Applicants</h1>
          <p className="mt-1 text-muted-foreground">
            Manage and review all student applications
          </p>
        </div>

        {/* Stats cards */}
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-border bg-background p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Applications</p>
                <p className="mt-1 text-3xl font-bold">{stats.total}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Users className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-background p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">With Recording</p>
                <p className="mt-1 text-3xl font-bold">{stats.withRecording}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <Video className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-background p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">No Recording</p>
                <p className="mt-1 text-3xl font-bold">{stats.withoutRecording}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-background p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Recommended</p>
                <p className="mt-1 text-3xl font-bold">{stats.recommended}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters and search */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, email, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-4 text-sm outline-none focus:border-foreground"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="min-w-[140px]">
                <Filter className="mr-2 h-4 w-4" />
                {filterProgram === "all" ? "All Programs" : filterProgram}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setFilterProgram("all")}>
                All Programs
              </DropdownMenuItem>
              {programs.map((p) => (
                <DropdownMenuItem key={p} onClick={() => setFilterProgram(p)}>
                  {p}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="min-w-[160px]">
                <Filter className="mr-2 h-4 w-4" />
                {filterRecording === "all"
                  ? "All Recordings"
                  : filterRecording === "true"
                    ? "Has Recording"
                    : "No Recording"}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setFilterRecording("all")}>
                All Recordings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterRecording("true")}>
                Has Recording
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterRecording("false")}>
                No Recording
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Applicants table */}
        <div className="rounded-xl border border-border bg-background">
          {loadingData ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">Loading applicants…</p>
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-red-600">{fetchError}</p>
            </div>
          ) : (
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
                  {filteredApplicants.map((applicant) => {
                    const evaluation = applicant.session?.evaluation
                    const hasRecording = applicant.has_recording

                    return (
                      <tr key={applicant.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#CDFA1A]/20 text-sm font-medium">
                              {applicant.name.split(" ").map((n: string) => n[0]).join("")}
                            </div>
                            <div>
                              <p className="font-medium">{applicant.name}</p>
                              <p className="text-sm text-muted-foreground">{applicant.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                            applicant.session?.program === "Undergraduate"
                              ? "bg-[#CDFA1A]/20 text-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {applicant.session?.program || "—"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                              hasRecording
                                ? "bg-green-100 text-green-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}>
                              {hasRecording ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : (
                                <Clock className="h-3 w-3" />
                              )}
                              {hasRecording ? "Has Recording" : "No Recording"}
                            </span>
                            {applicant.session?.completed_at && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {new Date(applicant.session.completed_at).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {evaluation ? (
                            <ScoreBar score={evaluation.overall_score ?? 0} />
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {evaluation ? (
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                              ["strongly_recommended", "recommended"].includes(evaluation.recommendation)
                                ? "bg-green-100 text-green-800"
                                : evaluation.recommendation === "not_recommended"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-yellow-100 text-yellow-800"
                            }`}>
                              {["strongly_recommended", "recommended"].includes(evaluation.recommendation) ? (
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
                            <Link href={`/admin/applicant/${applicant.id}`}>
                              <Button variant="outline" size="sm" className="gap-1.5">
                                <Eye className="h-4 w-4" />
                                View
                              </Button>
                            </Link>
                            {hasRecording && applicant.session?.id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1.5"
                                onClick={() => setPlayingRecording(applicant)}
                              >
                                <Play className="h-4 w-4" />
                                Play
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Mail className="mr-2 h-4 w-4" />
                                  Send Email
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-green-600">
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600">
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Reject
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
          )}

          {!loadingData && !fetchError && filteredApplicants.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-lg font-medium">No applicants found</p>
              <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-border px-6 py-4">
            <p className="text-sm text-muted-foreground">
              Showing {filteredApplicants.length} of {applicants.length} applicants
            </p>
          </div>
        </div>
      </main>

      {/* Recording Modal */}
      {playingRecording && (
        <RecordingModal
          applicant={playingRecording}
          onClose={() => setPlayingRecording(null)}
        />
      )}
    </div>
  )
}
