"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Navbar } from "@/components/layout/Navbar"
import { ApplicantTable } from "@/components/admin/ApplicantTable"
import { useAdminStore } from "@/stores/useAdminStore"
import { useAuthStore } from "@/stores/useAuthStore"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Users,
  Video,
  Award,
  Sparkles,
  ArrowRight,
  Shield,
  FileCheck,
} from "lucide-react"

export default function AdminDashboardPage() {
  const { applicants, fetchApplicants } = useAdminStore()
  const { user } = useAuthStore()

  useEffect(() => {
    fetchApplicants()
  }, [fetchApplicants])

  const totalCandidates = applicants.length
  const withRecordings = applicants.filter((a) => a.has_recording).length
  const recommended = applicants.filter(
    (a) =>
      a.session?.evaluation?.recommendation?.includes("recommended")
  ).length
  const evaluated = applicants.filter((a) => a.session?.evaluation?.overall_score).length

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 flex-1 w-full space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 items-center gap-1.5 rounded-full bg-[#CDFA1A]/20 px-3 text-xs font-bold text-[#627a05] dark:text-[#CDFA1A]">
                <Shield className="h-3.5 w-3.5" /> Admissions Committee
              </span>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight">
              Applicant Review Central
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              Review AI interview presentations, verify speech transcripts, and audit English placements.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/admin/committee">
              <Button className="bg-[#CDFA1A] text-black font-extrabold hover:bg-[#b8e612] rounded-xl text-xs gap-2">
                <Sparkles className="h-3.5 w-3.5" />
                Admissions Committee Grid
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* 4 KPI Metrics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5 border-border bg-card shadow-sm rounded-2xl">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-semibold">Total Applicants</span>
              <Users className="h-4 w-4 text-[#84a305] dark:text-[#CDFA1A]" />
            </div>
            <div className="text-2xl font-black text-foreground">{totalCandidates}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Platform wide</p>
          </Card>

          <Card className="p-5 border-border bg-card shadow-sm rounded-2xl">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-semibold">Video Recordings</span>
              <Video className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-foreground">{withRecordings}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Stored in Cloud/S3</p>
          </Card>

          <Card className="p-5 border-border bg-card shadow-sm rounded-2xl">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-semibold">AI Evaluated</span>
              <FileCheck className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black text-foreground">{evaluated}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Gemini Live scored</p>
          </Card>

          <Card className="p-5 border-border bg-card shadow-sm rounded-2xl">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-semibold">Recommended</span>
              <Award className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-foreground">{recommended}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Passing standard</p>
          </Card>
        </div>

        {/* Searchable Applicant Table */}
        <ApplicantTable />
      </main>
    </div>
  )
}
