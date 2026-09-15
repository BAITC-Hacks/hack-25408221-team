"use client"

import { useState, useEffect } from "react"
import { ChevronDown, Upload, AlertCircle } from "lucide-react"

interface PersonalInfoTabProps {
  formData: Record<string, unknown>
  updateFormData: (data: Record<string, unknown>) => void
  showErrors?: boolean
}

export function PersonalInfoTab({ formData, updateFormData, showErrors }: PersonalInfoTabProps) {
  const [gender, setGender] = useState<"male" | "female">((formData.gender as "male" | "female") || "male")
  const [documentType, setDocumentType] = useState<"passport" | "id">((formData.documentType as "passport" | "id") || "passport")
  const [citizenship, setCitizenship] = useState((formData.citizenship as string) || "Kazakhstan")
  const [firstName, setFirstName] = useState((formData.firstName as string) || "")
  const [lastName, setLastName] = useState((formData.lastName as string) || "")
  const [patronymic, setPatronymic] = useState((formData.patronymic as string) || "")
  const [dateOfBirth, setDateOfBirth] = useState((formData.dateOfBirth as string) || "")
  const [iin, setIin] = useState((formData.iin as string) || "")
  const [documentNo, setDocumentNo] = useState((formData.documentNo as string) || "")
  const [authority, setAuthority] = useState((formData.authority as string) || "")
  const [dateOfIssue, setDateOfIssue] = useState((formData.dateOfIssue as string) || "")
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const fullName = localStorage.getItem("userName") || ""
    const parts = fullName.trim().split(" ")
    if (parts.length >= 2) {
      const first = parts[0]
      const last = parts.slice(1).join(" ")
      if (!formData.firstName) setFirstName(first)
      if (!formData.lastName) setLastName(last)
    } else {
      if (!formData.firstName) setFirstName(parts[0] || "")
    }
  }, [])

  useEffect(() => {
    const newErrors: Record<string, string> = {}
    if (showErrors && !lastName) newErrors.lastName = "Required"
    if (showErrors && !firstName) newErrors.firstName = "Required"
    if (showErrors && !dateOfBirth) newErrors.dateOfBirth = "Required"
    if (showErrors && !iin) newErrors.iin = "Required"
    if (showErrors && !documentNo) newErrors.documentNo = "Required"
    if (showErrors && !authority) newErrors.authority = "Required"
    if (showErrors && !dateOfIssue) newErrors.dateOfIssue = "Required"
    setErrors(newErrors)
  }, [showErrors, lastName, firstName, dateOfBirth, iin, documentNo, authority, dateOfIssue])

  useEffect(() => {
    updateFormData({
      gender,
      documentType,
      citizenship,
      firstName,
      lastName,
      patronymic,
      dateOfBirth,
      iin,
      documentNo,
      authority,
      dateOfIssue,
    })
  }, [gender, documentType, citizenship, firstName, lastName, patronymic, dateOfBirth, iin, documentNo, authority, dateOfIssue])

  const inputClasses = (hasError: boolean) =>
    `w-full rounded-lg border bg-background px-4 py-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-offset-1 ${
      hasError
        ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
        : "border-input focus:border-foreground focus:ring-foreground/20"
    }`

  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-4 text-lg font-semibold">Applicant details</h3>
        <div className="h-px bg-border" />

        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={inputClasses(!!errors.lastName)}
              placeholder="Enter last name"
            />
            {errors.lastName && (
              <p className="mt-1 flex items-center gap-1 text-sm text-red-500">
                <AlertCircle className="h-3 w-3" /> {errors.lastName}
              </p>
            )}
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputClasses(!!errors.firstName)}
              placeholder="Enter first name"
            />
            {errors.firstName && (
              <p className="mt-1 flex items-center gap-1 text-sm text-red-500">
                <AlertCircle className="h-3 w-3" /> {errors.firstName}
              </p>
            )}
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Patronymic</label>
            <input
              type="text"
              value={patronymic}
              onChange={(e) => setPatronymic(e.target.value)}
              className={inputClasses(false)}
              placeholder="Enter patronymic (optional)"
            />
          </div>
        </div>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-medium">
            Date of Birth <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            placeholder="DD.MM.YYYY"
            className={inputClasses(!!errors.dateOfBirth)}
          />
          {errors.dateOfBirth && (
            <p className="mt-1 flex items-center gap-1 text-sm text-red-500">
              <AlertCircle className="h-3 w-3" /> {errors.dateOfBirth}
            </p>
          )}
        </div>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-medium">
            Gender <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setGender("male")}
              className={`rounded-full px-6 py-2 text-sm font-medium transition-colors ${
                gender === "male"
                  ? "bg-[#CDFA1A] text-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Male
            </button>
            <button
              type="button"
              onClick={() => setGender("female")}
              className={`rounded-full px-6 py-2 text-sm font-medium transition-colors ${
                gender === "female"
                  ? "bg-[#CDFA1A] text-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Female
            </button>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-4 text-lg font-semibold">Nationality and passport details</h3>
        <div className="h-px bg-border" />

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Citizenship <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-lg border border-input bg-background px-4 py-3 text-left text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-4 w-6 items-center justify-center rounded bg-[#00AFCA] text-[8px] text-white">
                    KZ
                  </span>
                  {citizenship}
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">
              Individual Identification Number (IIN) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={iin}
              onChange={(e) => setIin(e.target.value)}
              className={inputClasses(!!errors.iin)}
              placeholder="12 digits"
              maxLength={12}
            />
            {errors.iin && (
              <p className="mt-1 flex items-center gap-1 text-sm text-red-500">
                <AlertCircle className="h-3 w-3" /> {errors.iin}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-medium">
            Type of identity document <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDocumentType("passport")}
              className={`rounded-full px-6 py-2 text-sm font-medium transition-colors ${
                documentType === "passport"
                  ? "bg-[#CDFA1A] text-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Passport
            </button>
            <button
              type="button"
              onClick={() => setDocumentType("id")}
              className={`rounded-full px-6 py-2 text-sm font-medium transition-colors ${
                documentType === "id"
                  ? "bg-[#CDFA1A] text-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              ID
            </button>
          </div>
        </div>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-medium">
            Document No. <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={documentNo}
            onChange={(e) => setDocumentNo(e.target.value)}
            className={inputClasses(!!errors.documentNo)}
            placeholder="AB1234567"
          />
          {errors.documentNo && (
            <p className="mt-1 flex items-center gap-1 text-sm text-red-500">
              <AlertCircle className="h-3 w-3" /> {errors.documentNo}
            </p>
          )}
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Authority <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={authority}
              onChange={(e) => setAuthority(e.target.value)}
              className={inputClasses(!!errors.authority)}
              placeholder="Issuing authority"
            />
            {errors.authority && (
              <p className="mt-1 flex items-center gap-1 text-sm text-red-500">
                <AlertCircle className="h-3 w-3" /> {errors.authority}
              </p>
            )}
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">
              Date of issue <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={dateOfIssue}
              onChange={(e) => setDateOfIssue(e.target.value)}
              placeholder="DD.MM.YYYY"
              className={inputClasses(!!errors.dateOfIssue)}
            />
            {errors.dateOfIssue && (
              <p className="mt-1 flex items-center gap-1 text-sm text-red-500">
                <AlertCircle className="h-3 w-3" /> {errors.dateOfIssue}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-medium">
            Copy of your passport <span className="text-red-500">*</span>
          </label>
          <p className="mb-4 text-sm text-muted-foreground">
            Please upload the first page of your passport
          </p>
          <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#CDFA1A] bg-[#CDFA1A]/5 px-6 py-10 transition-colors hover:bg-[#CDFA1A]/10 cursor-pointer">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-border">
              <Upload className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm">
              <span className="cursor-pointer text-[#6B8E23] hover:underline">Click to upload</span>
              {" "}or drag and drop
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Formats: JPG, JPEG, PNG, HEIC. Max 10 MB.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
