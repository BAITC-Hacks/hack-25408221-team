"use client"

import { useState, useEffect } from "react"
import { Upload } from "lucide-react"

interface CertificateTabProps {
  formData: Record<string, unknown>
  updateFormData: (data: Record<string, unknown>) => void
  showErrors?: boolean
}

export function CertificateTab({ formData, updateFormData, showErrors }: CertificateTabProps) {
  const [hasSocialStatusCertificate, setHasSocialStatusCertificate] = useState(
    (formData.hasSocialStatusCertificate as string) || ""
  )
  const [additionalInfo, setAdditionalInfo] = useState(
    (formData.additionalInfo as string) || ""
  )
  const [fatherIncomeCert, setFatherIncomeCert] = useState(
    (formData.fatherIncomeCert as string) || ""
  )
  const [motherIncomeCert, setMotherIncomeCert] = useState(
    (formData.motherIncomeCert as string) || ""
  )
  const [guardianIncomeCert, setGuardianIncomeCert] = useState(
    (formData.guardianIncomeCert as string) || ""
  )

  useEffect(() => {
    updateFormData({
      hasSocialStatusCertificate,
      additionalInfo,
      fatherIncomeCert,
      motherIncomeCert,
      guardianIncomeCert,
    })
  }, [hasSocialStatusCertificate, additionalInfo, fatherIncomeCert, motherIncomeCert, guardianIncomeCert])

  return (
    <div className="space-y-8">
      {/* Social status certificate */}
      <div className="rounded-lg bg-background p-6 shadow-sm">
        <h3 className="text-lg font-semibold">Do you have a certificate of social status?</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          You can submit it here
        </p>
        <div className="mt-2 h-px bg-border" />

        {/* Document upload */}
        <div className="mt-6">
          <label className="mb-2 block text-sm font-medium">Document</label>
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

        {/* Additional information */}
        <div className="mt-6">
          <label className="mb-2 block text-sm font-medium">Additional information</label>
          <textarea
            rows={4}
            value={additionalInfo}
            onChange={(e) => setAdditionalInfo(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm outline-none focus:border-foreground"
            placeholder="Enter any additional information here..."
          />
        </div>
      </div>

      {/* Parents' income */}
      <div className="rounded-lg bg-background p-6 shadow-sm">
        <h3 className="text-lg font-semibold">Parents&apos; income (optional)</h3>
        <div className="mt-2 h-px bg-border" />

        {/* Father */}
        <div className="mt-6">
          <h4 className="text-base font-semibold">Father</h4>
          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium">
              Certificate of father&apos;s income
            </label>
            <div className="flex min-h-[120px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#CDFA1A] bg-[#CDFA1A]/5 px-6 py-6">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full border border-border">
                <Upload className="h-3 w-3 text-muted-foreground" />
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

        {/* Mother */}
        <div className="mt-8">
          <h4 className="text-base font-semibold">Mother</h4>
          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium">
              Certificate of mother&apos;s income
            </label>
            <div className="flex min-h-[120px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#CDFA1A] bg-[#CDFA1A]/5 px-6 py-6">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full border border-border">
                <Upload className="h-3 w-3 text-muted-foreground" />
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

        {/* Guardian */}
        <div className="mt-8">
          <h4 className="text-base font-semibold">Guardian</h4>
          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium">
              Certificate of guardian&apos;s income
            </label>
            <div className="flex min-h-[120px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#CDFA1A] bg-[#CDFA1A]/5 px-6 py-6">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full border border-border">
                <Upload className="h-3 w-3 text-muted-foreground" />
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
      </div>
    </div>
  )
}
