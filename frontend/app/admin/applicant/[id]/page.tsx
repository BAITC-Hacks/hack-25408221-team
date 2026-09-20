"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ArrowLeft,
  Download,
  Mail,
  Phone,
  FileText,
  Video,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  User,
  ClipboardList,
  Award,
  Play,
  X,
  Maximize2,
  Minimize2,
  LogOut,
  BarChart3,
  Shield,
  Globe,
  Zap,
  AlertTriangle,
  TrendingUp,
  Brain,
  SkipForward,
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

const TIER_LABELS: Record<number, string> = {
  1: "Fast Track",
  2: "Standard Review",
  3: "Hold Queue",
  4: "Manual Required",
}
const TIER_COLORS: Record<number, string> = {
  1: "bg-green-100 text-green-800",
  2: "bg-blue-100 text-blue-800",
  3: "bg-yellow-100 text-yellow-800",
  4: "bg-red-100 text-red-800",
}
const CEFR_COLORS: Record<string, string> = {
  A1: "bg-red-100 text-red-800",
  A2: "bg-orange-100 text-orange-800",
  B1: "bg-yellow-100 text-yellow-800",
  B2: "bg-blue-100 text-blue-800",
  C1: "bg-green-100 text-green-800",
  C2: "bg-purple-100 text-purple-800",
}

function ScoreMeter({ value, max = 100, label, color = "bg-[#CDFA1A]" }: { value: number; max?: number; label?: string; color?: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div className="space-y-1">
      {label && <div className="flex justify-between text-xs"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}/{max}</span></div>}
      <div className="h-2 rounded-full bg-muted"><div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

function DimensionRow({ label, score, max = 5 }: { label: string; score: number; max?: number }) {
  const pct = Math.min(100, (score / max) * 100)
  const color = pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-[#CDFA1A]" : pct >= 40 ? "bg-yellow-500" : "bg-red-500"
  return (
    <div className="flex items-center gap-3">
      <span className="w-44 shrink-0 text-sm text-muted-foreground">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-muted"><div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} /></div>
      <span className="w-10 text-right text-sm font-medium">{score}/{max}</span>
    </div>
  )
}

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

const questionLabels: Record<string, string> = {
  q1_why_applying: "Why are you applying to inVision U?",
  q2_program_choice: "Which program are you applying to, and why?",
  q3_challenge_overcome: "Tell me about a major challenge you overcame.",
  q4_long_term_goals: "What are your long-term goals?",
  q5_leadership: "What does leadership mean to you?",
  q6_family_support: "Does your family support your decision?",
}

function RecordingModal({
  applicant,
  videoSrc,
  onClose,
}: {
  applicant: ApiUser
  videoSrc: string
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

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
            <a
              href={videoSrc}
              download
              className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            >
              <Download className="h-5 w-5" />
            </a>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="rounded-xl overflow-hidden bg-black aspect-video">
          <video
            ref={videoRef}
            src={videoSrc}
            controls
            autoPlay
            className="w-full h-full object-contain"
          />
        </div>

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
            onClick={(e) => {
              e.preventDefault()
              onClose()
            }}
          >
            Close Player
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function ApplicantDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user, logout } = useAuth()
  const [authChecked, setAuthChecked] = useState(false)
  const [activeTab, setActiveTab] = useState<"personal" | "answers" | "evaluation" | "transcript" | "recording" | "analysis">("personal")
  const [metrics, setMetrics] = useState<any>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [expandedSections, setExpandedSections] = useState<string[]>(["personal", "contact"])
  const [applicant, setApplicant] = useState<ApiUser | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [expandedTranscript, setExpandedTranscript] = useState(false)
  const [showRecordingModal, setShowRecordingModal] = useState(false)
  const inlineVideoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!user || user.role !== "admin") {
      router.replace("/signin")
      return
    }
    setAuthChecked(true)
  }, [router, user])

  useEffect(() => {
    if (!authChecked) return

    api.getUser(params.id as string)
      .then((data) => {
        setApplicant(data)
        setLoadingData(false)
        if (data?.session?.id && data?.session?.recording_url) {
          setMetricsLoading(true)
          api.getSessionMetrics(data.session.id)
            .then((m) => setMetrics(m))
            .catch(() => {})
            .finally(() => setMetricsLoading(false))
        }
      })
      .catch(() => setLoadingData(false))
  }, [authChecked, params.id])


  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    )
  }

  const tabs = [
    { id: "personal", label: "Personal Info", icon: User },
    { id: "answers", label: "Interview Answers", icon: ClipboardList },
    { id: "evaluation", label: "AI Evaluation", icon: Award },
    { id: "analysis", label: "Deep Analysis", icon: BarChart3 },
    { id: "transcript", label: "Transcript", icon: FileText },
    { id: "recording", label: "Recording", icon: Video },
  ]

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
            <Link href="/admin" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Back to Applicants
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
            <Button variant="outline" size="sm">
              <Mail className="mr-2 h-4 w-4" />
              Send Email
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  Change Status
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem className="text-green-600">Approve</DropdownMenuItem>
                <DropdownMenuItem className="text-red-600">Reject</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="p-8">
        {loadingData && (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading applicant…</p>
          </div>
        )}

        {!loadingData && !applicant && (
          <div className="flex items-center justify-center py-12">
            <p className="text-red-600">Applicant not found.</p>
          </div>
        )}

        {!loadingData && applicant && (
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Left Column - Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Applicant Header */}
              <div className="rounded-xl border border-border bg-background p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#CDFA1A] text-xl font-bold">
                      {applicant.name.split(" ").map((n: string) => n[0]).join("")}
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold">{applicant.name}</h1>
                      <p className="text-muted-foreground">{applicant.email}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="inline-flex rounded-full bg-[#CDFA1A]/20 px-3 py-1 text-sm font-medium">
                          {applicant.session?.program || "—"}
                        </span>
                        <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
                          applicant.has_recording ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                        }`}>
                          {applicant.has_recording ? "Has Recording" : "No Recording"}
                        </span>
                        {applicant.session?.evaluation && (
                          <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
                            ["strongly_recommended", "recommended"].includes(applicant.session.evaluation.recommendation)
                              ? "bg-green-100 text-green-700"
                              : applicant.session.evaluation.recommendation === "not_recommended"
                                ? "bg-red-100 text-red-700"
                                : "bg-yellow-100 text-yellow-700"
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

              {/* Tabs */}
              <div className="flex gap-2 border-b border-border pb-2 overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? "bg-[#CDFA1A] text-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Personal Info Tab */}
              {activeTab === "personal" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-border bg-background">
                    <button
                      onClick={() => toggleSection("personal")}
                      className="flex w-full items-center justify-between p-4 text-left"
                    >
                      <h3 className="font-semibold">Personal Information</h3>
                      {expandedSections.includes("personal") ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                    {expandedSections.includes("personal") && (
                      <div className="border-t border-border p-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <p className="text-sm text-muted-foreground">Full Name</p>
                            <p className="font-medium">{applicant.name}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Program</p>
                            <p className="font-medium">{applicant.session?.program || "—"}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-border bg-background">
                    <button
                      onClick={() => toggleSection("contact")}
                      className="flex w-full items-center justify-between p-4 text-left"
                    >
                      <h3 className="font-semibold">Contact Information</h3>
                      {expandedSections.includes("contact") ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                    {expandedSections.includes("contact") && (
                      <div className="border-t border-border p-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="flex items-center gap-3">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm text-muted-foreground">Email</p>
                              <p className="font-medium">{applicant.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm text-muted-foreground">Phone</p>
                              <p className="font-medium">{applicant.phone || "—"}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Interview Answers Tab */}
              {activeTab === "answers" && (
                <div className="space-y-4">
                  {applicant.session?.applicant_data ? (
                    <>
                      {Object.entries(questionLabels).map(([key, label]) => (
                        <div key={key} className="rounded-xl border border-border bg-background p-5">
                          <p className="text-sm font-medium text-muted-foreground mb-2">{label}</p>
                          <p className="text-sm leading-relaxed">
                            {(applicant.session!.applicant_data as Record<string, string>)[key] || "No answer provided."}
                          </p>
                        </div>
                      ))}
                      <div className="grid gap-4 md:grid-cols-3 rounded-xl border border-border bg-background p-5">
                        <div>
                          <p className="text-sm text-muted-foreground">Language</p>
                          <p className="font-medium">{applicant.session.applicant_data.language_used || "—"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Confidence</p>
                          <p className="font-medium capitalize">{applicant.session.applicant_data.confidence_level || "—"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Communication</p>
                          <p className="font-medium capitalize">{applicant.session.applicant_data.communication_quality || "—"}</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border border-border bg-background p-6 text-center">
                      <ClipboardList className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
                      <p className="text-muted-foreground">No interview answers available yet.</p>
                    </div>
                  )}
                </div>
              )}

              {/* AI Evaluation Tab */}
              {activeTab === "evaluation" && (
                <div className="space-y-4">
                  {applicant.session?.evaluation ? (
                    <div className="rounded-xl border border-[#CDFA1A] bg-[#CDFA1A]/10 p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="font-semibold text-lg">AI Evaluation</h3>
                        {(applicant.session.evaluation.overall_score ?? 0) > 0 && (
                          <div className={`flex h-20 w-20 items-center justify-center rounded-full text-3xl font-bold ${
                            (applicant.session.evaluation.overall_score ?? 0) >= 8
                              ? "bg-green-500 text-white"
                              : (applicant.session.evaluation.overall_score ?? 0) >= 6
                                ? "bg-[#CDFA1A] text-foreground"
                                : "bg-red-500 text-white"
                          }`}>
                            {applicant.session.evaluation.overall_score}/10
                          </div>
                        )}
                      </div>

                      {applicant.session.evaluation.strengths.length > 0 && (
                        <div className="mb-5">
                          <p className="text-sm font-medium mb-2 flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            Strengths
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {applicant.session.evaluation.strengths.map((s, i) => (
                              <span key={i} className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {(applicant.session.evaluation.areas_for_improvement ?? applicant.session.evaluation.concerns ?? []).length > 0 && (
                        <div className="mb-5">
                          <p className="text-sm font-medium mb-2 flex items-center gap-2">
                            <Award className="h-4 w-4 text-yellow-600" />
                            Areas for Improvement
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {(applicant.session.evaluation.areas_for_improvement ?? applicant.session.evaluation.concerns ?? []).map((a, i) => (
                              <span key={i} className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">
                                {a}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3 mb-4">
                        <p className="text-sm font-medium">Recommendation:</p>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${
                          ["strongly_recommended", "recommended"].includes(applicant.session.evaluation.recommendation)
                            ? "bg-green-100 text-green-800"
                            : applicant.session.evaluation.recommendation === "not_recommended"
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                        }`}>
                          {["strongly_recommended", "recommended"].includes(applicant.session.evaluation.recommendation) ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : applicant.session.evaluation.recommendation === "not_recommended" ? (
                            <XCircle className="h-4 w-4" />
                          ) : (
                            <Clock className="h-4 w-4" />
                          )}
                          {applicant.session.evaluation.recommendation === "strongly_recommended"
                            ? "Strongly Recommended"
                            : applicant.session.evaluation.recommendation === "recommended"
                              ? "Recommended"
                              : applicant.session.evaluation.recommendation === "not_recommended"
                                ? "Not Recommended"
                                : applicant.session.evaluation.recommendation === "needs_review"
                                  ? "Needs Review"
                                  : "Pending"}
                        </span>
                      </div>

                      {(applicant.session.evaluation.notes || applicant.session.evaluation.overall_impression) && (
                        <div className="rounded-lg bg-background p-4">
                          <p className="text-sm font-medium mb-1">Notes</p>
                          <p className="text-sm text-muted-foreground">
                            {applicant.session.evaluation.notes || applicant.session.evaluation.overall_impression}
                          </p>
                        </div>
                      )}

                      {applicant.session.applicant_data && (
                        <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm">
                          <div className="rounded-lg bg-background p-3">
                            <p className="text-muted-foreground">Language</p>
                            <p className="font-medium">{applicant.session.applicant_data.language_used || "—"}</p>
                          </div>
                          <div className="rounded-lg bg-background p-3">
                            <p className="text-muted-foreground">Confidence</p>
                            <p className="font-medium capitalize">{applicant.session.applicant_data.confidence_level || "—"}</p>
                          </div>
                          <div className="rounded-lg bg-background p-3">
                            <p className="text-muted-foreground">Communication</p>
                            <p className="font-medium capitalize">{applicant.session.applicant_data.communication_quality || "—"}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border bg-background p-6 text-center">
                      <Award className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
                      <p className="text-lg font-medium">No evaluation yet</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        AI evaluation will appear after the interview is completed and analyzed.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Transcript Tab */}
              {activeTab === "transcript" && (
                <div className="space-y-4">
                  {applicant.session?.transcript && applicant.session.transcript.length > 0 ? (
                    <>
                      {(() => {
                        // Merge consecutive messages from the same role into one bubble
                        const merged: { role: string; text: string; timestamp: string }[] = []
                        for (const entry of applicant.session.transcript) {
                          const last = merged[merged.length - 1]
                          if (last && last.role === entry.role) {
                            last.text = last.text.trimEnd() + " " + entry.text.trimStart()
                          } else {
                            merged.push({ ...entry })
                          }
                        }
                        const visible = expandedTranscript ? merged : merged.slice(0, 6)
                        return (
                          <>
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-muted-foreground">
                                {merged.length} messages
                              </p>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setExpandedTranscript(!expandedTranscript)}
                              >
                                {expandedTranscript ? "Collapse" : "Expand All"}
                                {expandedTranscript ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />}
                              </Button>
                            </div>

                            <div className="space-y-3">
                              {visible.map((entry, i) => (
                                <div
                                  key={i}
                                  className={`rounded-lg p-4 ${
                                    entry.role === "assistant"
                                      ? "bg-[#CDFA1A]/10 border border-[#CDFA1A]/30"
                                      : "bg-background border border-border"
                                  }`}
                                >
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-xs font-medium ${
                                      entry.role === "assistant" ? "text-green-700" : "text-muted-foreground"
                                    }`}>
                                      {entry.role === "assistant" ? "AI Guide" : "Applicant"}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(entry.timestamp).toLocaleTimeString()}
                                    </span>
                                  </div>
                                  <p className="text-sm leading-relaxed">{entry.text}</p>
                                </div>
                              ))}
                            </div>

                            {!expandedTranscript && merged.length > 6 && (
                              <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => setExpandedTranscript(true)}
                              >
                                Show all {merged.length} messages
                              </Button>
                            )}
                          </>
                        )
                      })()}
                    </>
                  ) : (
                    <div className="rounded-xl border border-border bg-background p-6 text-center">
                      <FileText className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
                      <p className="text-lg font-medium">No transcript available</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        The interview transcript will appear here after the session.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Recording Tab */}
              {activeTab === "recording" && (
                <div className="space-y-4">
                  {applicant.session?.recording_url ? (
                    <>
                      {/* Video card */}
                      <div className="rounded-xl border border-border bg-background p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold">Interview Recording</h3>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => setShowRecordingModal(true)}
                          >
                            <Maximize2 className="h-4 w-4" />
                            Fullscreen
                          </Button>
                        </div>

                        {/* Video player — streams via range requests */}
                        <video
                          ref={inlineVideoRef}
                          src={`/api/recording/${applicant.session.id}`}
                          controls
                          className="w-full rounded-xl"
                        />

                        <div className="mt-4 grid gap-4 md:grid-cols-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">Program</p>
                            <p className="font-medium">{applicant.session.program}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Completed</p>
                            <p className="font-medium">
                              {applicant.session.completed_at
                                ? new Date(applicant.session.completed_at).toLocaleString()
                                : "—"}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <a href={`/api/recording/${applicant.session.id}`} download={`recording-${applicant.session.id}.webm`}>
                            <Button variant="outline" className="gap-2">
                              <Download className="h-4 w-4" />
                              Download
                            </Button>
                          </a>
                          <Button
                            className="gap-2 bg-[#CDFA1A] text-black hover:bg-[#CDFA1A]/80"
                            onClick={() => setShowRecordingModal(true)}
                          >
                            <Play className="h-4 w-4" />
                            Play Recording
                          </Button>
                        </div>
                      </div>

                    </>
                  ) : (
                    <div className="rounded-xl border border-border bg-background p-6 text-center">
                      <Video className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
                      <p className="text-lg font-medium">No recording available</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        The applicant has not submitted a video recording yet.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Deep Analysis Tab */}
              {activeTab === "analysis" && (
                <div className="space-y-5">
                  {metricsLoading ? (
                    <div className="flex items-center justify-center py-12 text-muted-foreground">Loading analysis…</div>
                  ) : !metrics ? (
                    <div className="rounded-xl border border-border bg-background p-6 text-center">
                      <BarChart3 className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
                      <p className="text-lg font-medium">No analysis data yet</p>
                      <p className="text-sm text-muted-foreground mt-1">Analysis is generated after the interview session completes.</p>
                    </div>
                  ) : (
                    <>
                      {/* Triage Tier */}
                      {metrics.triage?.priority && (
                        <div className="rounded-xl border border-border bg-background p-5">
                          <div className="flex items-center gap-2 mb-3">
                            <Zap className="h-4 w-4 text-yellow-500" />
                            <h3 className="font-semibold">Triage Priority</h3>
                          </div>
                          <div className="flex items-center gap-3 mb-3">
                            <span className={`rounded-full px-4 py-1.5 text-sm font-semibold ${TIER_COLORS[metrics.triage.priority.tier] || "bg-muted text-foreground"}`}>
                              Tier {metrics.triage.priority.tier} — {metrics.triage.priority.label || TIER_LABELS[metrics.triage.priority.tier]}
                            </span>
                            {metrics.triage.priority.estimated_review_minutes && (
                              <span className="text-sm text-muted-foreground">~{metrics.triage.priority.estimated_review_minutes} min review</span>
                            )}
                          </div>
                          {metrics.triage.priority.reasons?.length > 0 && (
                            <ul className="space-y-1">
                              {metrics.triage.priority.reasons.map((r: string, i: number) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                                  {r}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}

                      {/* IAF Score */}
                      {metrics.iaf_score && (
                        <div className="rounded-xl border border-border bg-background p-5">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <Brain className="h-4 w-4 text-purple-500" />
                              <h3 className="font-semibold">IAF Competency Score</h3>
                            </div>
                            <div className={`flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold ${
                              metrics.iaf_score.iaf_score >= 70 ? "bg-green-500 text-white" :
                              metrics.iaf_score.iaf_score >= 50 ? "bg-[#CDFA1A] text-black" : "bg-red-500 text-white"
                            }`}>
                              {metrics.iaf_score.iaf_score}
                            </div>
                          </div>
                          <div className="space-y-3">
                            {metrics.iaf_score.dimensions && Object.entries(metrics.iaf_score.dimensions).map(([key, dim]: [string, any]) => (
                              <DimensionRow
                                key={key}
                                label={key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                                score={dim.score}
                              />
                            ))}
                          </div>
                          {metrics.iaf_score.top_dimensions?.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {metrics.iaf_score.top_dimensions.map((d: string) => (
                                <span key={d} className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                                  {d.replace(/_/g, " ")}
                                </span>
                              ))}
                            </div>
                          )}
                          {metrics.iaf_score.dimensions_needing_attention?.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {metrics.iaf_score.dimensions_needing_attention.map((d: string) => (
                                <span key={d} className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">
                                  {d.replace(/_/g, " ")}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Authenticity Analysis */}
                      {metrics.authenticity && (
                        <div className="rounded-xl border border-border bg-background p-5">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4 text-blue-500" />
                              <h3 className="font-semibold">Authenticity Analysis</h3>
                            </div>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              metrics.authenticity.risk_level === "low" ? "bg-green-100 text-green-800" :
                              metrics.authenticity.risk_level === "medium" ? "bg-yellow-100 text-yellow-800" :
                              "bg-red-100 text-red-800"
                            }`}>
                              {(metrics.authenticity.risk_level || "").toUpperCase()} RISK
                            </span>
                          </div>
                          <ScoreMeter value={metrics.authenticity.authenticity_score} label="Authenticity Score" />
                          <div className="mt-4 grid gap-3 md:grid-cols-2 text-sm">
                            {metrics.authenticity.specificity && (
                              <div className="rounded-lg bg-muted/40 p-3">
                                <p className="text-muted-foreground mb-1">Specificity</p>
                                <p className="font-medium capitalize">{metrics.authenticity.specificity.level}</p>
                                <p className="text-xs text-muted-foreground">{metrics.authenticity.specificity.specific_hits} specific / {metrics.authenticity.specificity.generic_hits} generic signals</p>
                              </div>
                            )}
                            {metrics.authenticity.contribution_orientation && (
                              <div className="rounded-lg bg-muted/40 p-3">
                                <p className="text-muted-foreground mb-1">Orientation</p>
                                <p className="font-medium capitalize">{(metrics.authenticity.contribution_orientation.orientation || "").replace(/_/g, " ")}</p>
                              </div>
                            )}
                            {metrics.authenticity.linguistic_signals && (
                              <div className="rounded-lg bg-muted/40 p-3">
                                <p className="text-muted-foreground mb-1">Naturalness</p>
                                <p className="font-medium">{metrics.authenticity.linguistic_signals.naturalness_score}/100</p>
                              </div>
                            )}
                            {metrics.authenticity.cross_session_similarity && (
                              <div className="rounded-lg bg-muted/40 p-3">
                                <p className="text-muted-foreground mb-1">Cross-session match</p>
                                <p className={`font-medium ${metrics.authenticity.cross_session_similarity.flag ? "text-red-600" : "text-green-600"}`}>
                                  {metrics.authenticity.cross_session_similarity.flag ? "Flagged" : "Clean"}
                                </p>
                              </div>
                            )}
                          </div>
                          {metrics.authenticity.flags?.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {metrics.authenticity.flags.map((f: string) => (
                                <span key={f} className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                                  {f.replace(/_/g, " ")}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Language Proficiency */}
                      {metrics.language_proficiency && (
                        <div className="rounded-xl border border-border bg-background p-5">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <Globe className="h-4 w-4 text-teal-500" />
                              <h3 className="font-semibold">Language Proficiency</h3>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`rounded-full px-3 py-1 text-sm font-bold ${CEFR_COLORS[metrics.language_proficiency.cefr_level] || "bg-muted"}`}>
                                {metrics.language_proficiency.cefr_level}
                              </span>
                              {metrics.language_proficiency.ielts_equivalent && (
                                <span className="text-sm text-muted-foreground">IELTS ~{metrics.language_proficiency.ielts_equivalent}</span>
                              )}
                            </div>
                          </div>
                          <ScoreMeter value={metrics.language_proficiency.composite_score} label="Composite Score" className="mb-4" />
                          <div className="mt-4 space-y-3">
                            {metrics.language_proficiency.dimensions && Object.entries(metrics.language_proficiency.dimensions).map(([key, dim]: [string, any]) => (
                              <ScoreMeter
                                key={key}
                                value={dim.score}
                                label={key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                                color={dim.score >= 70 ? "bg-green-500" : dim.score >= 50 ? "bg-[#CDFA1A]" : "bg-red-500"}
                              />
                            ))}
                          </div>
                          <p className="mt-3 text-xs text-muted-foreground">{metrics.language_proficiency.disclaimer}</p>
                        </div>
                      )}

                      {/* Data Quality */}
                      {metrics.data_quality && (
                        <div className="rounded-xl border border-border bg-background p-5">
                          <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="h-4 w-4 text-orange-500" />
                            <h3 className="font-semibold">Data Quality</h3>
                          </div>
                          <ScoreMeter value={metrics.data_quality.overall_score} label="Overall Quality Score" />
                          <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm">
                            {metrics.data_quality.completeness && (
                              <div className="rounded-lg bg-muted/40 p-3">
                                <p className="text-muted-foreground">Completeness</p>
                                <p className="font-semibold">{metrics.data_quality.completeness.score}/100</p>
                                <p className="text-xs text-muted-foreground">{metrics.data_quality.completeness.answered_questions}/{metrics.data_quality.completeness.total_questions} questions answered</p>
                              </div>
                            )}
                            {metrics.data_quality.transcript_quality && (
                              <div className="rounded-lg bg-muted/40 p-3">
                                <p className="text-muted-foreground">Transcript</p>
                                <p className="font-semibold">{metrics.data_quality.transcript_quality.score}/100</p>
                                <p className="text-xs text-muted-foreground">{metrics.data_quality.transcript_quality.word_count} words · {metrics.data_quality.transcript_quality.user_turns} turns</p>
                              </div>
                            )}
                            <div className="rounded-lg bg-muted/40 p-3">
                              <p className="text-muted-foreground">Has Evaluation</p>
                              <p className={`font-semibold ${metrics.data_quality.has_evaluation ? "text-green-600" : "text-yellow-600"}`}>
                                {metrics.data_quality.has_evaluation ? "Yes" : "No"}
                              </p>
                            </div>
                          </div>
                          {metrics.data_quality.missing_answers?.has_issues && (
                            <div className="mt-3 space-y-1">
                              {metrics.data_quality.missing_answers.issues.map((issue: any, i: number) => (
                                <div key={i} className="flex items-center gap-2 text-sm">
                                  <AlertTriangle className={`h-3.5 w-3.5 ${issue.severity === "high" ? "text-red-500" : "text-yellow-500"}`} />
                                  <span className="text-muted-foreground">{issue.label}: {issue.type.replace(/_/g, " ")}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Baseline vs AI Agreement */}
                      {metrics.baseline_evaluation && metrics.agreement && (
                        <div className="rounded-xl border border-border bg-background p-5">
                          <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="h-4 w-4 text-indigo-500" />
                            <h3 className="font-semibold">Baseline Evaluation & AI Agreement</h3>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-lg bg-muted/40 p-4">
                              <p className="text-xs text-muted-foreground mb-2">Baseline Score</p>
                              <p className="text-2xl font-bold">{metrics.baseline_evaluation.score}/10</p>
                              <p className="text-sm capitalize mt-1">{(metrics.baseline_evaluation.recommendation || "").replace(/_/g, " ")}</p>
                              <p className="text-xs text-muted-foreground mt-2">{metrics.baseline_evaluation.reasoning}</p>
                            </div>
                            <div className="rounded-lg bg-muted/40 p-4">
                              <p className="text-xs text-muted-foreground mb-2">AI vs Baseline Agreement</p>
                              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${
                                metrics.agreement.agreement === "exact" ? "bg-green-100 text-green-800" :
                                metrics.agreement.agreement === "adjacent" ? "bg-yellow-100 text-yellow-800" :
                                "bg-red-100 text-red-800"
                              }`}>
                                {(metrics.agreement.agreement || "unknown").toUpperCase()}
                              </span>
                              <p className="text-xs text-muted-foreground mt-2">{metrics.agreement.explanation}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Explainability */}
                      {metrics.explainability?.explanation && (
                        <div className="rounded-xl border border-border bg-background p-5">
                          <div className="flex items-center gap-2 mb-4">
                            <Brain className="h-4 w-4 text-violet-500" />
                            <h3 className="font-semibold">AI Decision Explanation</h3>
                          </div>
                          <p className="text-sm font-medium mb-2">{metrics.explainability.explanation.short_summary}</p>
                          <p className="text-sm text-muted-foreground mb-4">{metrics.explainability.explanation.explanation}</p>

                          {metrics.explainability.explanation.factors?.length > 0 && (
                            <div className="space-y-2 mb-4">
                              {metrics.explainability.explanation.factors.map((f: any, i: number) => (
                                <div key={i} className="flex items-start gap-2 text-sm">
                                  <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                                    f.impact === "positive" ? "bg-green-500" : f.impact === "negative" ? "bg-red-500" : "bg-gray-400"
                                  }`} />
                                  <span>{f.factor}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {metrics.explainability.explanation.key_quotes?.length > 0 && (
                            <div className="space-y-2 mb-4">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Key Quotes</p>
                              {metrics.explainability.explanation.key_quotes.map((q: any, i: number) => (
                                <blockquote key={i} className={`border-l-2 pl-3 text-sm italic ${q.impact === "positive" ? "border-green-500" : "border-red-400"}`}>
                                  "{q.quote}"
                                </blockquote>
                              ))}
                            </div>
                          )}

                          {metrics.explainability.explanation.uncertainty && (
                            <div className="rounded-lg bg-muted/40 p-3 flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Confidence</span>
                              <span className={`font-semibold ${
                                metrics.explainability.explanation.uncertainty.verdict === "high_confidence" ? "text-green-600" :
                                metrics.explainability.explanation.uncertainty.verdict === "medium_confidence" ? "text-yellow-600" : "text-red-600"
                              }`}>
                                {metrics.explainability.explanation.uncertainty.confidence_pct}% — {(metrics.explainability.explanation.uncertainty.verdict || "").replace(/_/g, " ")}
                              </span>
                            </div>
                          )}

                          {metrics.explainability.feature_importance?.features && (
                            <div className="mt-4">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Feature Importance</p>
                              <div className="space-y-2">
                                {Object.entries(metrics.explainability.feature_importance.features)
                                  .sort(([, a]: any, [, b]: any) => b.importance - a.importance)
                                  .map(([key, feat]: [string, any]) => (
                                    <div key={key} className="flex items-center gap-3">
                                      <span className="w-36 shrink-0 text-xs text-muted-foreground">{questionLabels[key] || key}</span>
                                      <div className="flex-1 h-2 rounded-full bg-muted">
                                        <div
                                          className={`h-2 rounded-full ${feat.signal === "positive" ? "bg-green-500" : feat.signal === "negative" ? "bg-red-500" : "bg-gray-400"}`}
                                          style={{ width: `${Math.round((feat.normalized_importance || feat.importance) * 100)}%` }}
                                        />
                                      </div>
                                      <span className="w-8 text-right text-xs">{Math.round((feat.normalized_importance || feat.importance) * 100)}%</span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Error Analysis */}
                      {metrics.error_analysis && (
                        <div className="rounded-xl border border-border bg-background p-5">
                          <div className="flex items-center gap-2 mb-4">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            <h3 className="font-semibold">Error & Edge Case Analysis</h3>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Inconsistencies</p>
                              {metrics.error_analysis.inconsistencies?.inconsistencies?.length > 0 ? (
                                <div className="space-y-2">
                                  {metrics.error_analysis.inconsistencies.inconsistencies.map((inc: any, i: number) => (
                                    <div key={i} className={`rounded-lg p-2 text-xs ${inc.severity === "high" ? "bg-red-50 text-red-800" : "bg-yellow-50 text-yellow-800"}`}>
                                      {inc.detail}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-green-600">No inconsistencies detected</p>
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Edge Cases</p>
                              {metrics.error_analysis.edge_cases?.edge_cases?.length > 0 ? (
                                <div className="space-y-2">
                                  {metrics.error_analysis.edge_cases.edge_cases.map((ec: any, i: number) => (
                                    <div key={i} className={`rounded-lg p-2 text-xs ${ec.severity === "critical" || ec.severity === "high" ? "bg-red-50 text-red-800" : "bg-yellow-50 text-yellow-800"}`}>
                                      {ec.detail}
                                    </div>
                                  ))}
                                  <p className="text-xs text-muted-foreground">Reliability: <span className="font-medium capitalize">{metrics.error_analysis.edge_cases.reliability}</span></p>
                                </div>
                              ) : (
                                <p className="text-sm text-green-600">No edge cases flagged</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Right Column - Sidebar */}
            <div className="space-y-6">
              {/* ML Quick Metrics */}
              {metrics && (
                <div className="rounded-xl border border-border bg-background p-6">
                  <h3 className="font-semibold mb-4">ML Signals</h3>
                  <div className="space-y-3 text-sm">
                    {metrics.iaf_score && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">IAF Score</span>
                        <span className={`font-semibold ${metrics.iaf_score.iaf_score >= 70 ? "text-green-600" : metrics.iaf_score.iaf_score >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                          {metrics.iaf_score.iaf_score}/100
                        </span>
                      </div>
                    )}
                    {metrics.authenticity && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Authenticity</span>
                        <span className={`font-semibold capitalize ${metrics.authenticity.risk_level === "low" ? "text-green-600" : metrics.authenticity.risk_level === "medium" ? "text-yellow-600" : "text-red-600"}`}>
                          {metrics.authenticity.risk_level} risk
                        </span>
                      </div>
                    )}
                    {metrics.language_proficiency && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Language</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${CEFR_COLORS[metrics.language_proficiency.cefr_level] || "bg-muted"}`}>
                          {metrics.language_proficiency.cefr_level}
                        </span>
                      </div>
                    )}
                    {metrics.data_quality && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Data Quality</span>
                        <span className="font-semibold">{metrics.data_quality.overall_score}/100</span>
                      </div>
                    )}
                    {metrics.triage?.priority && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Triage</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TIER_COLORS[metrics.triage.priority.tier] || "bg-muted"}`}>
                          T{metrics.triage.priority.tier} {TIER_LABELS[metrics.triage.priority.tier]}
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setActiveTab("analysis")}
                    className="mt-4 w-full rounded-lg border border-border py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                  >
                    View Full Analysis →
                  </button>
                </div>
              )}

              {/* Quick Actions */}
              <div className="rounded-xl border border-border bg-background p-6">
                <h3 className="font-semibold mb-4">Quick Actions</h3>
                <div className="space-y-2">
                  <Button className="w-full justify-start bg-green-600 hover:bg-green-700 text-white">
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Approve Application
                  </Button>
                  <Button variant="outline" className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50">
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject Application
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Mail className="mr-2 h-4 w-4" />
                    Send Email
                  </Button>
                </div>
              </div>

              {/* Application Timeline */}
              <div className="rounded-xl border border-border bg-background p-6">
                <h3 className="font-semibold mb-4">Application Timeline</h3>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#CDFA1A]">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div className="w-0.5 flex-1 bg-[#CDFA1A]" />
                    </div>
                    <div className="pb-4">
                      <p className="font-medium">Application Submitted</p>
                      <p className="text-sm text-muted-foreground">
                        {applicant.session?.created_at
                          ? new Date(applicant.session.created_at).toLocaleDateString()
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        applicant.has_recording ? "bg-green-500" : "bg-muted"
                      }`}>
                        <Video className={`h-4 w-4 ${applicant.has_recording ? "text-white" : "text-muted-foreground"}`} />
                      </div>
                      {applicant.session?.completed_at && (
                        <div className="w-0.5 flex-1 bg-[#CDFA1A]" />
                      )}
                    </div>
                    <div className="pb-4">
                      <p className="font-medium">Interview Completed</p>
                      <p className="text-sm text-muted-foreground">
                        {applicant.session?.completed_at
                          ? new Date(applicant.session.completed_at).toLocaleDateString()
                          : applicant.has_recording
                            ? "Recording submitted"
                            : "Pending"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        applicant.session?.evaluation ? "bg-green-500" : "bg-muted"
                      }`}>
                        <Award className={`h-4 w-4 ${applicant.session?.evaluation ? "text-white" : "text-muted-foreground"}`} />
                      </div>
                    </div>
                    <div>
                      <p className="font-medium">AI Evaluation</p>
                      <p className="text-sm text-muted-foreground">
                        {applicant.session?.evaluation
                          ? `Score: ${applicant.session.evaluation.overall_score}/10`
                          : "Pending"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Session Info */}
              {applicant.session && (
                <div className="rounded-xl border border-border bg-background p-6">
                  <h3 className="font-semibold mb-4">Session Info</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Session ID</p>
                      <p className="font-mono text-xs">{applicant.session.id.slice(0, 12)}…</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Program</p>
                      <p className="font-medium">{applicant.session.program}</p>
                    </div>
                    {applicant.session.started_at && (
                      <div>
                        <p className="text-muted-foreground">Started</p>
                        <p className="font-medium">{new Date(applicant.session.started_at).toLocaleString()}</p>
                      </div>
                    )}
                    {applicant.session.completed_at && (
                      <div>
                        <p className="text-muted-foreground">Completed</p>
                        <p className="font-medium">{new Date(applicant.session.completed_at).toLocaleString()}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground">Transcript Entries</p>
                      <p className="font-medium">{applicant.session.transcript?.length || 0}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Recording Modal */}
      {showRecordingModal && applicant && applicant.session?.id && (
        <RecordingModal
          applicant={applicant}
          videoSrc={`/api/recording/${applicant.session.id}`}
          onClose={() => setShowRecordingModal(false)}
        />
      )}
    </div>
  )
}
