"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { api } from "@/lib/api"
import { ApiUser } from "@/components/admin/types"
import { AdminHeader } from "@/components/admin/AdminHeader"
import { StatsCards } from "@/components/admin/StatsCards"
import { ApplicantFilters } from "@/components/admin/ApplicantFilters"
import { ApplicantTable } from "@/components/admin/ApplicantTable"
import { RecordingModal } from "@/components/admin/RecordingModal"

export default function AdminPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()

  const [applicants, setApplicants] = useState<ApiUser[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState("")
  const [filterProgram, setFilterProgram] = useState("all")
  const [filterRecording, setFilterRecording] = useState("all")
  const [selectedApplicant, setSelectedApplicant] = useState<ApiUser | null>(null)

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.role !== "admin")) {
      router.replace("/signin")
    }
  }, [isAuthenticated, isLoading, user, router])

  useEffect(() => {
    if (!isAuthenticated) return

    setLoadingData(true)
    setFetchError(null)

    api
      .getUsers()
      .then((data: ApiUser[]) => {
        setApplicants(data || [])
      })
      .catch((err) => {
        console.error("Failed to load applicants:", err)
        setFetchError("Failed to load applicants from server.")
      })
      .finally(() => setLoadingData(false))
  }, [isAuthenticated])

  const programs = useMemo(() => {
    const set = new Set<string>()
    applicants.forEach((a) => {
      if (a.session?.program) set.add(a.session.program)
    })
    return Array.from(set)
  }, [applicants])

  const filteredApplicants = useMemo(() => {
    return applicants
      .filter((u) => {
        const q = searchQuery.toLowerCase()
        const matchesSearch =
          !q ||
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q)

        const matchesProgram = filterProgram === "all" || u.session?.program === filterProgram
        const matchesRecording =
          filterRecording === "all" ||
          (filterRecording === "true" && u.has_recording) ||
          (filterRecording === "false" && !u.has_recording)

        return matchesSearch && matchesProgram && matchesRecording
      })
      .sort((a, b) => {
        const aTime = a.session?.completed_at ?? a.session?.created_at ?? ""
        const bTime = b.session?.completed_at ?? b.session?.created_at ?? ""
        return bTime.localeCompare(aTime)
      })
  }, [applicants, searchQuery, filterProgram, filterRecording])

  const stats = useMemo(() => {
    return {
      total: applicants.length,
      withRecording: applicants.filter((a) => a.has_recording).length,
      withoutRecording: applicants.filter((a) => !a.has_recording).length,
      recommended: applicants.filter((a) =>
        ["strongly_recommended", "recommended"].includes(
          a.session?.evaluation?.recommendation ?? ""
        )
      ).length,
    }
  }, [applicants])

  if (isLoading || (!isAuthenticated && !user)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <p className="text-muted-foreground">Checking authorization…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <AdminHeader />

      <main className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Applicants</h1>
          <p className="mt-1 text-muted-foreground">
            Manage and review all student applications
          </p>
        </div>

        <StatsCards stats={stats} />

        <ApplicantFilters
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterProgram={filterProgram}
          setFilterProgram={setFilterProgram}
          filterRecording={filterRecording}
          setFilterRecording={setFilterRecording}
          programs={programs}
        />

        <ApplicantTable
          applicants={filteredApplicants}
          loading={loadingData}
          error={fetchError}
          onPlayRecording={(app) => setSelectedApplicant(app)}
        />
      </main>

      {selectedApplicant && selectedApplicant.session && (
        <RecordingModal
          applicant={selectedApplicant}
          videoSrc={`/api/recording/${selectedApplicant.session.id}`}
          onClose={() => setSelectedApplicant(null)}
        />
      )}
    </div>
  )
}
