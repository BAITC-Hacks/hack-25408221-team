"use client"

import { useState } from "react"
import { CheckCircle2, AlertCircle, Clock, Loader2, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { IeltsCheckOut } from "../types"
import { submitIelts } from "../api/endpoints"
import { EnglishApiError } from "../api/client"

const BAND_OPTIONS = Array.from({ length: 19 }, (_, i) => (i * 0.5).toFixed(1))

type FieldError = { field: string; code: string }

function readableCode(code: string): string {
  const map: Record<string, string> = {
    invalid_format: "Must be a valid 15-18 character TRF number.",
    out_of_range: "Score must be between 0.0 and 9.0.",
    invalid_step: "Score must be in increments of 0.5.",
    arithmetic_mismatch: "Overall band does not match the computed average of the 4 sections.",
    in_future: "Date cannot be in the future.",
    too_old: "Test date is more than 2 years in the past (IELTS scores expire after 2 years).",
  }
  return map[code] || code
}

export function IeltsForm({
  token,
  onVerified,
  onProceedToTest,
}: {
  token?: string
  onVerified?: (result: IeltsCheckOut) => void
  onProceedToTest?: () => void
}) {
  const [form, setForm] = useState({
    trf_number: "",
    family_name: "",
    date_of_birth: "",
    test_date: "",
    module: "academic",
    listening: "",
    reading: "",
    writing: "",
    speaking: "",
    overall: "",
  })
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([])
  const [result, setResult] = useState<IeltsCheckOut | null>(null)
  const [genericError, setGenericError] = useState<string | null>(null)

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function errorFor(field: string): string | null {
    const e = fieldErrors.find((fe) => fe.field === field)
    return e ? readableCode(e.code) : null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFieldErrors([])
    setGenericError(null)

    try {
      const payload = {
        ...form,
        listening: Number(form.listening),
        reading: Number(form.reading),
        writing: Number(form.writing),
        speaking: Number(form.speaking),
        overall: Number(form.overall),
      }
      const res = await submitIelts(payload, token)
      setResult(res)
      if (res.verdict === "VERIFIED") {
        onVerified?.(res)
      }
    } catch (err) {
      if (err instanceof EnglishApiError && Array.isArray(err.detail)) {
        setFieldErrors(err.detail as FieldError[])
      } else {
        setGenericError(err instanceof EnglishApiError ? String(err.detail) : "Submission failed.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">IELTS Certificate Verification</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your Test Report Form (TRF) number and official scores. Results will be verified
          instantly against the IELTS Results Service.
        </p>
      </div>

      {result ? (
        <div className="space-y-6">
          <div
            className={`rounded-xl border p-6 space-y-3 ${
              result.verdict === "VERIFIED"
                ? "border-green-500/30 bg-green-500/10 text-green-800 dark:text-green-300"
                : result.verdict === "PENDING"
                  ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-800 dark:text-yellow-300"
                  : "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-300"
            }`}
          >
            <div className="flex items-center gap-3">
              {result.verdict === "VERIFIED" ? (
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              ) : result.verdict === "PENDING" ? (
                <Clock className="h-6 w-6 text-yellow-600" />
              ) : (
                <AlertCircle className="h-6 w-6 text-red-600" />
              )}
              <h2 className="text-lg font-bold">
                {result.verdict === "VERIFIED"
                  ? "IELTS Score Verified"
                  : result.verdict === "PENDING"
                    ? "Verification Pending Manual Review"
                    : "Certificate Could Not Be Verified"}
              </h2>
            </div>

            <p className="text-sm leading-relaxed">
              {result.verdict === "VERIFIED"
                ? `Your official IELTS score of Band ${result.overall.toFixed(1)} has been successfully confirmed.`
                : result.reason ||
                  "The details provided do not match records on the IELTS Results Service or the certificate has expired."}
            </p>
          </div>

          <div className="flex gap-4">
            {result.verdict !== "VERIFIED" && onProceedToTest && (
              <Button
                className="bg-[#CDFA1A] text-foreground hover:bg-[#CDFA1A]/90 font-semibold gap-2"
                onClick={onProceedToTest}
              >
                Take the Online English Placement Test Instead
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            <Button variant="outline" onClick={() => setResult(null)}>
              Check Another Score
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {genericError && (
            <div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{genericError}</span>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Test Report Form (TRF) Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.trf_number}
                onChange={(e) => set("trf_number", e.target.value.toUpperCase().trim())}
                placeholder="e.g. 23KZ001234SMITA001A"
                className="w-full rounded-lg border border-input bg-background p-3 text-sm font-mono outline-none focus:border-foreground"
                required
              />
              {errorFor("trf_number") && (
                <p className="mt-1 text-xs text-red-500">{errorFor("trf_number")}</p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Family Name (as on passport) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.family_name}
                onChange={(e) => set("family_name", e.target.value)}
                placeholder="Family name"
                className="w-full rounded-lg border border-input bg-background p-3 text-sm outline-none focus:border-foreground"
                required
              />
              {errorFor("family_name") && (
                <p className="mt-1 text-xs text-red-500">{errorFor("family_name")}</p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Date of Birth <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.date_of_birth}
                onChange={(e) => set("date_of_birth", e.target.value)}
                className="w-full rounded-lg border border-input bg-background p-3 text-sm outline-none focus:border-foreground"
                required
              />
              {errorFor("date_of_birth") && (
                <p className="mt-1 text-xs text-red-500">{errorFor("date_of_birth")}</p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Test Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.test_date}
                onChange={(e) => set("test_date", e.target.value)}
                className="w-full rounded-lg border border-input bg-background p-3 text-sm outline-none focus:border-foreground"
                required
              />
              {errorFor("test_date") && (
                <p className="mt-1 text-xs text-red-500">{errorFor("test_date")}</p>
              )}
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <h3 className="text-sm font-semibold mb-4">Band Scores</h3>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
              <div>
                <label className="mb-2 block text-xs font-medium text-muted-foreground">
                  Listening <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.listening}
                  onChange={(e) => set("listening", e.target.value)}
                  className="w-full rounded-lg border border-input bg-background p-2.5 text-sm outline-none focus:border-foreground"
                  required
                >
                  <option value="">Select</option>
                  {BAND_OPTIONS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                {errorFor("listening") && (
                  <p className="mt-1 text-xs text-red-500">{errorFor("listening")}</p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-muted-foreground">
                  Reading <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.reading}
                  onChange={(e) => set("reading", e.target.value)}
                  className="w-full rounded-lg border border-input bg-background p-2.5 text-sm outline-none focus:border-foreground"
                  required
                >
                  <option value="">Select</option>
                  {BAND_OPTIONS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                {errorFor("reading") && (
                  <p className="mt-1 text-xs text-red-500">{errorFor("reading")}</p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-muted-foreground">
                  Writing <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.writing}
                  onChange={(e) => set("writing", e.target.value)}
                  className="w-full rounded-lg border border-input bg-background p-2.5 text-sm outline-none focus:border-foreground"
                  required
                >
                  <option value="">Select</option>
                  {BAND_OPTIONS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                {errorFor("writing") && (
                  <p className="mt-1 text-xs text-red-500">{errorFor("writing")}</p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-muted-foreground">
                  Speaking <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.speaking}
                  onChange={(e) => set("speaking", e.target.value)}
                  className="w-full rounded-lg border border-input bg-background p-2.5 text-sm outline-none focus:border-foreground"
                  required
                >
                  <option value="">Select</option>
                  {BAND_OPTIONS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                {errorFor("speaking") && (
                  <p className="mt-1 text-xs text-red-500">{errorFor("speaking")}</p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-muted-foreground">
                  Overall Band <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.overall}
                  onChange={(e) => set("overall", e.target.value)}
                  className="w-full rounded-lg border border-input bg-background p-2.5 text-sm font-semibold outline-none focus:border-foreground"
                  required
                >
                  <option value="">Select</option>
                  {BAND_OPTIONS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                {errorFor("overall") && (
                  <p className="mt-1 text-xs text-red-500">{errorFor("overall")}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border">
            {onProceedToTest ? (
              <Button
                type="button"
                variant="ghost"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={onProceedToTest}
              >
                No IELTS certificate? Take placement test →
              </Button>
            ) : (
              <div />
            )}

            <Button
              type="submit"
              size="lg"
              className="bg-[#CDFA1A] text-foreground hover:bg-[#CDFA1A]/90 font-semibold px-8"
              disabled={submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify IELTS Certificate
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
