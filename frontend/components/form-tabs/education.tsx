"use client"

import { useState } from "react"
import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

interface EducationTabProps {
  formData: Record<string, unknown>
  updateFormData: (data: Record<string, unknown>) => void
  showErrors?: boolean
}

export function EducationTab({ formData, updateFormData, showErrors }: EducationTabProps) {
  const [examType, setExamType] = useState<"ielts" | "toefl">(formData.examType as "ielts" | "toefl" || "ielts")
  const [certificateType, setCertificateType] = useState<"unt" | "nis">(formData.certificateType as "unt" | "nis" || "unt")
  const [privacyConsent, setPrivacyConsent] = useState(formData.eduPrivacyConsent as boolean || false)
  const [minorConsent, setMinorConsent] = useState(formData.eduMinorConsent as boolean || false)

  return (
    <div className="space-y-8">
      {/* English proficiency results */}
      <div className="rounded-lg bg-background p-6 shadow-sm">
        <h3 className="text-lg font-semibold">English proficiency results</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Please submit the results of your English proficiency test.
        </p>
        <div className="mt-2 h-px bg-border" />

        <div className="mt-4 p-4 rounded-lg bg-muted/30 border border-border flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-semibold">Online English Placement Gateway</p>
            <p className="text-xs text-muted-foreground">
              Verify your official IELTS TRF number or complete our 20-minute online placement test.
            </p>
          </div>
          <div className="flex gap-2">
            <a href="/english/ielts" target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" type="button">
                Verify IELTS
              </Button>
            </a>
            <a href="/english/test" target="_blank" rel="noopener noreferrer">
              <Button
                size="sm"
                className="bg-[#CDFA1A] text-foreground hover:bg-[#CDFA1A]/90 font-medium"
                type="button"
              >
                Take Placement Test
              </Button>
            </a>
          </div>
        </div>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-medium">Exam</label>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setExamType("ielts")
                updateFormData({ examType: "ielts" })
              }}
              className={`rounded-full px-6 py-2 text-sm font-medium transition-colors ${
                examType === "ielts"
                  ? "bg-[#CDFA1A] text-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              IELTS 6.0
            </button>
            <button
              onClick={() => {
                setExamType("toefl")
                updateFormData({ examType: "toefl" })
              }}
              className={`rounded-full px-6 py-2 text-sm font-medium transition-colors ${
                examType === "toefl"
                  ? "bg-[#CDFA1A] text-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              TOEFL iBT 60-78
            </button>
          </div>
        </div>

        {/* Upload area */}
        <div className="mt-6">
          <label className="mb-2 block text-sm font-medium">
            Copy of your results <span className="text-red-500">*</span>
          </label>
          <div className="flex min-h-[150px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#CDFA1A] bg-[#CDFA1A]/5 px-6 py-8">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-border">
              <Upload className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm">
              <span className="cursor-pointer text-[#6B8E23] hover:underline">Click to upload</span>
              {" "}or drag and drop
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Formats allowed: JPG, JPEG, PNG, HEIC, PDF. File size must be less than 10 MB.
            </p>
          </div>
          {showErrors && (
            <p className="mt-2 text-sm text-red-500">Field is required</p>
          )}
        </div>
      </div>

      {/* Certificate */}
      <div className="rounded-lg bg-background p-6 shadow-sm">
        <h3 className="text-lg font-semibold">Certificate</h3>
        <div className="mt-2 h-px bg-border" />

        <div className="mt-6">
          <label className="mb-2 block text-sm font-medium">Certificate type</label>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setCertificateType("unt")
                updateFormData({ certificateType: "unt" })
              }}
              className={`rounded-full px-6 py-2 text-sm font-medium transition-colors ${
                certificateType === "unt"
                  ? "bg-[#CDFA1A] text-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              UNT
            </button>
            <button
              onClick={() => {
                setCertificateType("nis")
                updateFormData({ certificateType: "nis" })
              }}
              className={`rounded-full px-6 py-2 text-sm font-medium transition-colors ${
                certificateType === "nis"
                  ? "bg-[#CDFA1A] text-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              NIS 12 Grade Certificate
            </button>
          </div>
        </div>

        {/* Upload area */}
        <div className="mt-6">
          <label className="mb-2 block text-sm font-medium">
            Copy of your certificate
          </label>
          <div className="flex min-h-[150px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#CDFA1A] bg-[#CDFA1A]/5 px-6 py-8">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-border">
              <Upload className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm">
              <span className="cursor-pointer text-[#6B8E23] hover:underline">Click to upload</span>
              {" "}or drag and drop
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Formats allowed: JPG, JPEG, PNG, HEIC, PDF. File size must be less than 10 MB.
            </p>
          </div>
        </div>
      </div>

      {/* Additional documents */}
      <div className="rounded-lg bg-background p-6 shadow-sm">
        <h3 className="text-lg font-semibold">Additional documents</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          If you have any additional information about your educational background, you can upload it here
        </p>
        <div className="mt-2 h-px bg-border" />

        <div className="mt-6">
          <label className="mb-2 block text-sm font-medium">Documents</label>
          <div className="flex min-h-[150px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#CDFA1A] bg-[#CDFA1A]/5 px-6 py-8">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-border">
              <Upload className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm">
              <span className="cursor-pointer text-[#6B8E23] hover:underline">Click to upload</span>
              {" "}or drag and drop
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Formats allowed: PDF, JPG, JPEG, PNG, HEIC. File size must be less than 10 MB.
            </p>
          </div>
        </div>
      </div>

      {/* Consent checkboxes */}
      <div className="rounded-lg bg-background p-6 shadow-sm">
        <div className="space-y-4">
          <label className="flex items-start gap-3">
            <Checkbox
              checked={privacyConsent}
              onCheckedChange={(checked) => {
                setPrivacyConsent(checked as boolean)
                updateFormData({ eduPrivacyConsent: checked })
              }}
              className="mt-0.5"
            />
            <span className="text-sm">
              By submitting this form, you agree to the processing of your personal data in accordance with our{" "}
              <a href="#" className="text-foreground underline">Privacy Policy</a>
              <span className="text-red-500"> *</span>
            </span>
          </label>
          {showErrors && !privacyConsent && (
            <p className="ml-7 text-sm text-red-500">Field is required</p>
          )}

          <label className="flex items-start gap-3">
            <Checkbox
              checked={minorConsent}
              onCheckedChange={(checked) => {
                setMinorConsent(checked as boolean)
                updateFormData({ eduMinorConsent: checked })
              }}
              className="mt-0.5"
            />
            <span className="text-sm">
              If the participant is under the age of 18, this questionnaire must be completed by their parent or legal guardian. 
              By proceeding, you confirm that you are either (a) the participant aged 18 or older, or (b) the parent or legal guardian 
              completing this form on behalf of a minor.
              <span className="text-red-500"> *</span>
            </span>
          </label>
          {showErrors && !minorConsent && (
            <p className="ml-7 text-sm text-red-500">Field is required</p>
          )}
        </div>
      </div>
    </div>
  )
}
