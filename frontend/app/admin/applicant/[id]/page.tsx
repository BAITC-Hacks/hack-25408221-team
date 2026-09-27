"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  User,
  ClipboardList,
  Award,
  FileText,
  Video,
  BarChart3,
  ChevronDown,
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
import { api } from "@/lib/api"
import { ApiUser } from "@/components/admin/types"
import { RecordingModal } from "@/components/admin/RecordingModal"
import { ApplicantHeader } from "./components/ApplicantHeader"
import { ApplicantSidebar } from "./components/ApplicantSidebar"
import { PersonalInfoTab } from "./components/PersonalInfoTab"
import { AnswersTab } from "./components/AnswersTab"
import { EvaluationTab } from "./components/EvaluationTab"
import { TranscriptTab } from "./components/TranscriptTab"
import { RecordingTab } from "./components/RecordingTab"
import { AnalysisTab } from "./components/AnalysisTab"

const TABS = [
  { id: "personal", label: "Personal Info", icon: User },
  { id: "answers", label: "Interview Answers", icon: ClipboardList },
  { id: "evaluation", label: "Evaluation", icon: Award },
  { id: "transcript", label: "Transcript", icon: FileText },
  { id: "recording", label: "Recording", icon: Video },
  { id: "analysis", label: "Deep Analysis", icon: BarChart3 },
] as const

type TabId = (typeof TABS)[number]["id"]

export default function ApplicantDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const [activeTab, setActiveTab] = useState<TabId>("personal")
  const [applicant, setApplicant] = useState<ApiUser | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [metrics, setMetrics] = useState<any>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [showRecordingModal, setShowRecordingModal] = useState(false)

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.role !== "admin")) {
      router.replace("/signin")
    }
  }, [isAuthenticated, isLoading, user, router])

  useEffect(() => {
    if (!id || !isAuthenticated) return

    setLoadingData(true)
    api
      .getUser(id)
      .then((data: ApiUser) => {
        setApplicant(data)
        if (data.session?.id) {
          setMetricsLoading(true)
          api
            .getSessionMetrics(data.session.id)
            .then(setMetrics)
            .catch(() => setMetrics(null))
            .finally(() => setMetricsLoading(false))
        }
      })
      .catch(() => setApplicant(null))
      .finally(() => setLoadingData(false))
  }, [id, isAuthenticated])

  if (isLoading || (!isAuthenticated && !user)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <p className="text-muted-foreground">Checking authorization…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Top Bar */}
      <header className="border-b border-border bg-background">
        <div className="flex h-16 items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Applicants
            </Link>
            <div className="h-6 w-px bg-border" />
            <span className="font-semibold text-foreground">
              {applicant?.name || "Applicant Details"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  {user?.name || "Admin"}
                  <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-red-600 gap-2 cursor-pointer"
                  onClick={() => {
                    logout()
                    router.push("/signin")
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
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
              <ApplicantHeader applicant={applicant} />

              {/* Tabs */}
              <div className="flex gap-2 border-b border-border pb-2 overflow-x-auto">
                {TABS.map((tab) => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                        isActive
                          ? "bg-[#CDFA1A] text-foreground"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  )
                })}
              </div>

              {/* Tab Contents */}
              {activeTab === "personal" && <PersonalInfoTab applicant={applicant} />}
              {activeTab === "answers" && <AnswersTab applicant={applicant} />}
              {activeTab === "evaluation" && <EvaluationTab applicant={applicant} />}
              {activeTab === "transcript" && <TranscriptTab applicant={applicant} />}
              {activeTab === "recording" && (
                <RecordingTab
                  applicant={applicant}
                  onOpenModal={() => setShowRecordingModal(true)}
                />
              )}
              {activeTab === "analysis" && (
                <AnalysisTab metrics={metrics} metricsLoading={metricsLoading} />
              )}
            </div>

            {/* Right Column - Sidebar */}
            <ApplicantSidebar
              applicant={applicant}
              metrics={metrics}
              onViewAnalysis={() => setActiveTab("analysis")}
            />
          </div>
        )}
      </main>

      {/* Recording Fullscreen Modal */}
      {showRecordingModal && applicant?.session && (
        <RecordingModal
          applicant={applicant}
          videoSrc={`/api/recording/${applicant.session.id}`}
          onClose={() => setShowRecordingModal(false)}
        />
      )}
    </div>
  )
}
