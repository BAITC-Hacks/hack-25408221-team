"use client"

import { useState, useEffect } from "react"
import { FileUploadDropzone } from "@/components/ui/file-upload-dropzone"

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

  useEffect(() => {
    updateFormData({
      hasSocialStatusCertificate,
      additionalInfo,
    })
  }, [hasSocialStatusCertificate, additionalInfo])

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
          <FileUploadDropzone
            label="Document"
            onFileSelect={(file) => updateFormData({ socialStatusDocName: file?.name || null })}
          />
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
            <FileUploadDropzone
              label="Certificate of father's income"
              onFileSelect={(file) => updateFormData({ fatherIncomeCertName: file?.name || null })}
            />
          </div>
        </div>

        {/* Mother */}
        <div className="mt-8">
          <h4 className="text-base font-semibold">Mother</h4>
          <div className="mt-4">
            <FileUploadDropzone
              label="Certificate of mother's income"
              onFileSelect={(file) => updateFormData({ motherIncomeCertName: file?.name || null })}
            />
          </div>
        </div>

        {/* Guardian */}
        <div className="mt-8">
          <h4 className="text-base font-semibold">Guardian</h4>
          <div className="mt-4">
            <FileUploadDropzone
              label="Certificate of guardian's income"
              onFileSelect={(file) => updateFormData({ guardianIncomeCertName: file?.name || null })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
