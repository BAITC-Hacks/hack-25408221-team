"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/stores/useAuthStore"
import { useEnglishStore } from "@/stores/useEnglishStore"
import Link from "next/link"
import { Navbar } from "@/components/layout/Navbar"
import { CertificateUploadModal } from "@/components/english/CertificateUploadModal"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  MonitorCheck,
  ArrowRight,
  ShieldCheck,
  Volume2,
  BookOpen,
  PenTool,
  Mic,
  Clock,
  Award,
  UploadCloud,
  FileCheck,
} from "lucide-react"

export default function EnglishGatewayPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { skipTest } = useEnglishStore()
  const [certModalOpen, setCertModalOpen] = useState(false)

  useEffect(() => {
    if (user?.role === "admin") {
      router.replace("/admin")
    }
  }, [user, router])

  const handleSkip = async () => {
    if (confirm("Confirm that you wish to claim English exemption as a native speaker? Admissions will review your file.")) {
      await skipTest("native_speaker")
      router.push("/dashboard")
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 flex-1 space-y-10">
        <div className="text-center space-y-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#CDFA1A]/20 px-3.5 py-1 text-xs font-bold text-[#627a05] dark:text-[#CDFA1A]">
            <ShieldCheck className="h-3.5 w-3.5" /> Language Requirement
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            English Placement Assessment
          </h1>
          <p className="mx-auto max-w-2xl text-sm sm:text-base text-muted-foreground leading-relaxed">
            All academic programs at inVision University are conducted in English. Complete our 20-minute proctored CEFR placement test, verify your official IELTS results, or submit an authorized certificate.
          </p>
        </div>

        {/* Primary Placement Test Card */}
        <Card className="p-8 sm:p-10 border-border bg-card shadow-xl rounded-3xl space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#CDFA1A] text-black font-extrabold">
                <MonitorCheck className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-foreground">
                  Online Proctored CEFR Test
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Adaptive standardized language assessment with live AI proctoring
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-mono py-1 px-3 gap-1.5">
                <Clock className="h-3.5 w-3.5 text-[#84a305] dark:text-[#CDFA1A]" />
                ~20 Minutes
              </Badge>
            </div>
          </div>

          {/* 4 Skills Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-border bg-secondary/30 p-4 text-center space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background mx-auto text-[#718c06] dark:text-[#CDFA1A] shadow-sm">
                <Volume2 className="h-5 w-5" />
              </div>
              <h4 className="text-xs font-bold text-foreground">1. Listening</h4>
              <p className="text-[11px] text-muted-foreground leading-tight">Clip comprehension & questions</p>
            </div>

            <div className="rounded-2xl border border-border bg-secondary/30 p-4 text-center space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background mx-auto text-blue-500 shadow-sm">
                <BookOpen className="h-5 w-5" />
              </div>
              <h4 className="text-xs font-bold text-foreground">2. Reading</h4>
              <p className="text-[11px] text-muted-foreground leading-tight">Passages, TFNG & C-Test gaps</p>
            </div>

            <div className="rounded-2xl border border-border bg-secondary/30 p-4 text-center space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background mx-auto text-purple-500 shadow-sm">
                <PenTool className="h-5 w-5" />
              </div>
              <h4 className="text-xs font-bold text-foreground">3. Writing</h4>
              <p className="text-[11px] text-muted-foreground leading-tight">Timed structured essay</p>
            </div>

            <div className="rounded-2xl border border-border bg-secondary/30 p-4 text-center space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background mx-auto text-emerald-500 shadow-sm">
                <Mic className="h-5 w-5" />
              </div>
              <h4 className="text-xs font-bold text-foreground">4. Speaking</h4>
              <p className="text-[11px] text-muted-foreground leading-tight">Spoken response & follow-up</p>
            </div>
          </div>

          <div className="pt-2">
            <Link href="/english/test" className="block">
              <Button size="lg" className="w-full bg-[#CDFA1A] text-black font-extrabold hover:bg-[#b8e612] rounded-2xl h-14 text-base gap-2 shadow-lg transition-transform hover:scale-[1.01]">
                Begin 20-Min English Placement Test
                <ArrowRight className="h-5 w-5 stroke-[2.5]" />
              </Button>
            </Link>
          </div>
        </Card>

        {/* Alternative Exemption Options */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-center">
            Or Skip The Test With Existing Qualifications
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Option 1: Official IELTS TRF Verification */}
            <Card className="p-6 border-border bg-card shadow-md rounded-3xl flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#CDFA1A]/20 text-[#627a05] dark:text-[#CDFA1A]">
                  <Award className="h-5 w-5" />
                </div>
                <h4 className="text-base font-bold text-foreground">Official IELTS Verification</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Enter your Test Report Form (TRF) number and band scores for instant automated verification against the official IELTS Results Service.
                </p>
              </div>

              <Link href="/english/ielts" className="block pt-2">
                <Button variant="outline" className="w-full rounded-xl h-11 text-xs font-bold gap-2 border-border">
                  <FileCheck className="h-4 w-4" />
                  Verify IELTS TRF Online
                </Button>
              </Link>
            </Card>

            {/* Option 2: Upload Certificate PDF */}
            <Card className="p-6 border-border bg-card shadow-md rounded-3xl flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                  <UploadCloud className="h-5 w-5" />
                </div>
                <h4 className="text-base font-bold text-foreground">Upload Other Certificate</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Submit official PDF documentation for TOEFL iBT, Duolingo English Test, Cambridge C1/C2, or other recognized language qualifications.
                </p>
              </div>

              <div className="pt-2">
                <Button
                  variant="outline"
                  onClick={() => setCertModalOpen(true)}
                  className="w-full rounded-xl h-11 text-xs font-bold gap-2 border-border"
                >
                  <UploadCloud className="h-4 w-4" />
                  Upload Certificate Document (.pdf)
                </Button>
              </div>
            </Card>
          </div>

          <div className="text-center pt-2">
            <button
              onClick={handleSkip}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors font-semibold"
            >
              Native English speaker or requesting language waiver? Submit waiver request
            </button>
          </div>
        </div>

        <CertificateUploadModal
          open={certModalOpen}
          onOpenChange={setCertModalOpen}
          onSuccess={() => router.push("/dashboard")}
        />
      </main>
    </div>
  )
}
