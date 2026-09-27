"use client"

import { useState, Suspense, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { ApplicationSidebar } from "@/components/application-sidebar"
import { PersonalInfoTab } from "@/components/form-tabs/personal-info"
import { ContactInfoTab } from "@/components/form-tabs/contact-info"
import { EducationTab } from "@/components/form-tabs/education"
import { AIInterviewTab } from "@/components/form-tabs/ai-interview"
import { CertificateTab } from "@/components/form-tabs/certificate"
import { ExternalLink, CheckCircle2, Loader2, AlertCircle, CheckCircle } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { getApiBaseUrl } from "@/lib/api"

type TabId = "personal" | "contact" | "education" | "test" | "certificate"

const tabs: { id: TabId; label: string }[] = [
  { id: "personal", label: "Personal Information" },
  { id: "contact", label: "Contact Information" },
  { id: "education", label: "Education" },
  { id: "test", label: "Screening Interview" },
  { id: "certificate", label: "Certificate of Social Status" },
]

type FormErrors = Record<string, string>

function ApplicationFormContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, token } = useAuth()
  const program = searchParams.get("program") || "foundation"
  const programLabel = program === "undergraduate"
    ? "Undergraduate | Innovative IT Product Design and Development"
    : "Foundation Year"

  const [activeTab, setActiveTab] = useState<TabId>("personal")
  const [userName, setUserName] = useState("there")

  useEffect(() => {
    if (user?.name) {
      setUserName(user.name)
    } else {
      const name = localStorage.getItem("userName")
      if (name) setUserName(name)
    }
    const programLabel = program === "undergraduate" ? "Undergraduate" : "Foundation Year"
    localStorage.setItem("program", programLabel)
  }, [program, user])

  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [errorTab, setErrorTab] = useState<TabId | null>(null)
  const [completedTabs, setCompletedTabs] = useState<Set<TabId>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState("")

  const updateFormData = (data: Record<string, unknown>) => {
    setFormData((prev) => ({ ...prev, ...data }))
  }

  const validateCurrentTab = (): boolean => {
    const newErrors: FormErrors = {}
    let isValid = true

    switch (activeTab) {
      case "personal":
        if (!formData.lastName) { newErrors.lastName = "Last name is required"; isValid = false; }
        if (!formData.firstName) { newErrors.firstName = "First name is required"; isValid = false; }
        if (!formData.dateOfBirth) { newErrors.dateOfBirth = "Date of birth is required"; isValid = false; }
        if (!formData.iin) { newErrors.iin = "IIN is required"; isValid = false; }
        if (!formData.documentNo) { newErrors.documentNo = "Document number is required"; isValid = false; }
        if (!formData.authority) { newErrors.authority = "Authority is required"; isValid = false; }
        if (!formData.dateOfIssue) { newErrors.dateOfIssue = "Date of issue is required"; isValid = false; }
        break
      case "contact":
        if (!formData.email) { newErrors.email = "Email is required"; isValid = false; }
        if (!formData.phone) { newErrors.phone = "Phone is required"; isValid = false; }
        if (!formData.region) { newErrors.region = "Region is required"; isValid = false; }
        if (!formData.city) { newErrors.city = "City is required"; isValid = false; }
        if (!formData.address) { newErrors.address = "Address is required"; isValid = false; }
        if (!formData.emergencyName) { newErrors.emergencyName = "Emergency contact name is required"; isValid = false; }
        if (!formData.emergencyRelationship) { newErrors.emergencyRelationship = "Relationship is required"; isValid = false; }
        if (!formData.emergencyPhone) { newErrors.emergencyPhone = "Emergency phone is required"; isValid = false; }
        break
      case "education":
        break
      case "test":
        break
      case "certificate":
        break
    }

    setFormErrors(newErrors)
    setErrorTab(isValid ? null : activeTab)
    return isValid
  }

  const renderTabContent = () => {
    const props = {
      formData,
      updateFormData,
      showErrors: errorTab === activeTab && Object.keys(formErrors).length > 0,
    }
    switch (activeTab) {
      case "personal":
        return <PersonalInfoTab {...props} />
      case "contact":
        return <ContactInfoTab {...props} />
      case "education":
        return <EducationTab {...props} />
      case "test":
        return <AIInterviewTab {...props} />
      case "certificate":
        return <CertificateTab {...props} />
      default:
        return <PersonalInfoTab {...props} />
    }
  }

  const handleNextStep = () => {
    if (!validateCurrentTab()) return
    
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab)
    setCompletedTabs((prev) => new Set([...prev, activeTab]))
    setFormErrors({})
    setErrorTab(null)
    
    if (currentIndex < tabs.length - 1) {
      setActiveTab(tabs[currentIndex + 1].id)
    }
  }

  const handleSubmit = async () => {
    if (!validateCurrentTab()) return

    setSubmitting(true)
    setSubmitStatus("idle")
    setErrorMessage("")

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/applications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: user?.userId,
          program,
          formData,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.detail || data.error || "Failed to submit application")
      }

      setSubmitStatus("success")
      localStorage.setItem("applicationSubmitted", "true")
    } catch (err) {
      console.error("Submit error:", err)
      setSubmitStatus("error")
      setErrorMessage(err instanceof Error ? err.message : "Failed to submit application")
    } finally {
      setSubmitting(false)
    }
  }

  const isLastTab = activeTab === "certificate"
  const progress = Math.round((completedTabs.size / tabs.length) * 100)

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      {submitStatus === "success" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
          <div className="mx-4 max-w-md rounded-lg border border-border bg-background p-8 text-center shadow-lg">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <h2 className="mb-2 text-2xl font-bold">Application Submitted!</h2>
            <p className="mb-6 text-muted-foreground">
              Your application has been successfully submitted. We will review it and get back to you soon.
            </p>
            <button
              onClick={() => router.push("/")}
              className="w-full rounded-full bg-foreground py-3 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
            >
              Return to Home
            </button>
          </div>
        </div>
      )}

      {submitStatus === "error" && (
        <div className="fixed right-4 top-20 z-50 flex max-w-sm items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 shadow-lg">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <div className="flex-1">
            <p className="font-medium text-red-800">Submission Failed</p>
            <p className="text-sm text-red-600">{errorMessage}</p>
          </div>
          <button
            onClick={() => setSubmitStatus("idle")}
            className="text-red-600 hover:text-red-800"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex">
        <div className="hidden w-4 bg-[#CDFA1A] lg:block" />

        <main className="flex-1 px-4 py-8 md:px-8">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold md:text-3xl">Dear {userName},</h1>
              <p className="mt-1 text-muted-foreground">
                Please fill out the form, upload your documents, and submit your application!
              </p>
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Send Application"
              )}
            </button>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Application Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-[#CDFA1A] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold">Application</h2>
                <span className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-sm">
                  {programLabel}
                  <ExternalLink className="h-3 w-3" />
                </span>
              </div>
              <button className="text-muted-foreground hover:text-foreground">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
              </button>
            </div>

            <div className="mb-8 flex flex-wrap gap-2">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id
                const isCompleted = completedTabs.has(tab.id)
                const hasError = tab.id === errorTab && Object.keys(formErrors).length > 0
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id)
                      setFormErrors({})
                      setErrorTab(null)
                    }}
                    className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[#CDFA1A] text-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {tab.label}
                    {isCompleted && !isActive && (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    )}
                    {hasError && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">!</span>
                    )}
                  </button>
                )
              })}
            </div>

            {renderTabContent()}
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={handleNextStep}
              className="flex items-center gap-2 rounded-full bg-foreground px-8 py-3 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
            >
              {isLastTab ? "Submit" : "Next Step"}
              {!isLastTab && (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          </div>
        </main>

        <ApplicationSidebar />
      </div>
    </div>
  )
}

export default function ApplicationFormPage() {
  const { isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <ApplicationFormContent />
    </Suspense>
  )
}
