"use client"

import { useState, useRef } from "react"
import { useEnglishStore } from "@/stores/useEnglishStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileCheck,
  X,
  Sparkles,
} from "lucide-react"

export function CertificateUploadModal({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}) {
  const { submitCertificate, submitting, errorMessage } = useEnglishStore()

  const [certType, setCertType] = useState("IELTS")
  const [score, setScore] = useState("")
  const [testDate, setTestDate] = useState("")
  const [certNumber, setCertNumber] = useState("")
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [success, setSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        setPdfFile(file)
      } else {
        alert("Please upload a PDF document (.pdf)")
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!score) return

    const ok = await submitCertificate({
      cert_type: certType,
      score,
      test_date: testDate || undefined,
      cert_number: certNumber || undefined,
      pdf: pdfFile,
    })

    if (ok) {
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        onOpenChange(false)
        onSuccess?.()
      }, 1500)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-6 sm:p-8">
        <DialogHeader className="mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#CDFA1A]/20 text-[#627a05] dark:text-[#CDFA1A] mb-2">
            <FileText className="h-6 w-6 stroke-[2.5]" />
          </div>
          <DialogTitle className="text-xl font-black">
            Submit English Certificate
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Provide your certificate details and upload your official PDF document to be exempted from the 20-minute online placement test.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center space-y-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mx-auto">
              <CheckCircle2 className="h-8 w-8 stroke-[2.5]" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Certificate Accepted!</h3>
            <p className="text-xs text-muted-foreground">
              Your language requirement is satisfied. Placement awarded: <strong>Bachelor Direct</strong>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMessage && (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  Certificate Type *
                </label>
                <select
                  value={certType}
                  onChange={(e) => setCertType(e.target.value)}
                  className="w-full h-11 rounded-xl border border-input bg-background px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#CDFA1A]"
                >
                  <option value="IELTS">IELTS (Academic / General)</option>
                  <option value="TOEFL">TOEFL iBT</option>
                  <option value="Duolingo">Duolingo English Test</option>
                  <option value="Cambridge">Cambridge English (C1/C2)</option>
                  <option value="Other">Other Certificate</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  Overall Score / Band *
                </label>
                <Input
                  required
                  placeholder="e.g. 7.5 (IELTS) or 105 (TOEFL)"
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  Test / Issue Date
                </label>
                <Input
                  type="date"
                  value={testDate}
                  onChange={(e) => setTestDate(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  TRF / Verification Number
                </label>
                <Input
                  placeholder="Optional reference ID"
                  value={certNumber}
                  onChange={(e) => setCertNumber(e.target.value)}
                />
              </div>
            </div>

            {/* PDF File Picker */}
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                Certificate Document (.pdf) *
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={handleFileChange}
              />

              {pdfFile ? (
                <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-foreground">
                  <div className="flex items-center gap-2.5 truncate">
                    <FileCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div className="truncate">
                      <div className="font-bold truncate">{pdfFile.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {(pdfFile.size / 1024 / 1024).toFixed(2)} MB · PDF ready
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPdfFile(null)}
                    className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-secondary/20 p-6 text-center cursor-pointer hover:border-[#CDFA1A] transition-colors"
                >
                  <UploadCloud className="h-8 w-8 text-muted-foreground/60 mb-2" />
                  <p className="text-xs font-bold text-foreground">Click to upload Certificate PDF</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Maximum size: 15MB</p>
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="rounded-xl h-11 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || !score}
                className="bg-[#CDFA1A] text-black font-extrabold hover:bg-[#b8e612] rounded-xl h-11 text-xs gap-2 px-6"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <FileCheck className="h-4 w-4" />
                    Submit & Skip Online Test
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
