"use client"

import { useState, useEffect } from "react"
import { ChevronDown, AlertCircle } from "lucide-react"

interface ContactInfoTabProps {
  formData: Record<string, unknown>
  updateFormData: (data: Record<string, unknown>) => void
  showErrors?: boolean
}

export function ContactInfoTab({ formData, updateFormData, showErrors }: ContactInfoTabProps) {
  const [email, setEmail] = useState((formData.email as string) || "")
  const [phone, setPhone] = useState((formData.phone as string) || "")
  const [country, setCountry] = useState((formData.country as string) || "Kazakhstan")
  const [region, setRegion] = useState((formData.region as string) || "")
  const [city, setCity] = useState((formData.city as string) || "")
  const [address, setAddress] = useState((formData.address as string) || "")
  const [postalCode, setPostalCode] = useState((formData.postalCode as string) || "")
  const [emergencyName, setEmergencyName] = useState((formData.emergencyName as string) || "")
  const [emergencyRelationship, setEmergencyRelationship] = useState((formData.emergencyRelationship as string) || "")
  const [emergencyPhone, setEmergencyPhone] = useState((formData.emergencyPhone as string) || "")
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const storedEmail = localStorage.getItem("userEmail")
    const storedPhone = localStorage.getItem("userPhone")
    if (storedEmail && !formData.email) setEmail(storedEmail)
    if (storedPhone && !formData.phone) setPhone(storedPhone)
  }, [])

  useEffect(() => {
    const newErrors: Record<string, string> = {}
    if (showErrors && !email) newErrors.email = "Required"
    if (showErrors && !phone) newErrors.phone = "Required"
    if (showErrors && !region) newErrors.region = "Required"
    if (showErrors && !city) newErrors.city = "Required"
    if (showErrors && !address) newErrors.address = "Required"
    if (showErrors && !emergencyName) newErrors.emergencyName = "Required"
    if (showErrors && !emergencyRelationship) newErrors.emergencyRelationship = "Required"
    if (showErrors && !emergencyPhone) newErrors.emergencyPhone = "Required"
    setErrors(newErrors)
  }, [showErrors, email, phone, region, city, address, emergencyName, emergencyRelationship, emergencyPhone])

  useEffect(() => {
    updateFormData({
      email,
      phone,
      country,
      region,
      city,
      address,
      postalCode,
      emergencyName,
      emergencyRelationship,
      emergencyPhone,
    })
  }, [email, phone, country, region, city, address, postalCode, emergencyName, emergencyRelationship, emergencyPhone])

  const inputClasses = (hasError: boolean) =>
    `w-full rounded-lg border bg-background px-4 py-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-offset-1 ${
      hasError
        ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
        : "border-input focus:border-foreground focus:ring-foreground/20"
    }`

  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-4 text-lg font-semibold">Contact details</h3>
        <div className="h-px bg-border" />

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClasses(!!errors.email)}
              placeholder="email@example.com"
            />
            {errors.email && (
              <p className="mt-1 flex items-center gap-1 text-sm text-red-500">
                <AlertCircle className="h-3 w-3" /> {errors.email}
              </p>
            )}
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">
              Mobile phone number <span className="text-red-500">*</span>
            </label>
            <div className="flex">
              <button
                type="button"
                className="flex items-center gap-1 rounded-l-lg border border-r-0 border-input bg-muted px-3 py-3 text-sm"
              >
                <span className="flex h-4 w-6 items-center justify-center rounded bg-[#00AFCA] text-[10px] text-white">KZ</span>
                <ChevronDown className="h-3 w-3" />
              </button>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClasses(!!errors.phone)}
                placeholder="7771234567"
              />
            </div>
            {errors.phone && (
              <p className="mt-1 flex items-center gap-1 text-sm text-red-500">
                <AlertCircle className="h-3 w-3" /> {errors.phone}
              </p>
            )}
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-4 text-lg font-semibold">Address</h3>
        <div className="h-px bg-border" />

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Country <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-lg border border-input bg-background px-4 py-3 text-left text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-4 w-6 items-center justify-center rounded bg-[#00AFCA] text-[8px] text-white">KZ</span>
                {country}
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">
              Region <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="Select region"
              className={inputClasses(!!errors.region)}
            />
            {errors.region && (
              <p className="mt-1 flex items-center gap-1 text-sm text-red-500">
                <AlertCircle className="h-3 w-3" /> {errors.region}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">
              City <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={inputClasses(!!errors.city)}
              placeholder="Enter city"
            />
            {errors.city && (
              <p className="mt-1 flex items-center gap-1 text-sm text-red-500">
                <AlertCircle className="h-3 w-3" /> {errors.city}
              </p>
            )}
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">
              Address <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={inputClasses(!!errors.address)}
              placeholder="Street address"
            />
            {errors.address && (
              <p className="mt-1 flex items-center gap-1 text-sm text-red-500">
                <AlertCircle className="h-3 w-3" /> {errors.address}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-medium">Postal code</label>
          <input
            type="text"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            className={inputClasses(false)}
            placeholder="000000"
          />
        </div>
      </div>

      <div>
        <h3 className="mb-4 text-lg font-semibold">Emergency contact</h3>
        <div className="h-px bg-border" />

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Contact name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={emergencyName}
              onChange={(e) => setEmergencyName(e.target.value)}
              className={inputClasses(!!errors.emergencyName)}
              placeholder="Emergency contact name"
            />
            {errors.emergencyName && (
              <p className="mt-1 flex items-center gap-1 text-sm text-red-500">
                <AlertCircle className="h-3 w-3" /> {errors.emergencyName}
              </p>
            )}
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">
              Relationship <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={emergencyRelationship}
              onChange={(e) => setEmergencyRelationship(e.target.value)}
              placeholder="e.g., Parent, Sibling"
              className={inputClasses(!!errors.emergencyRelationship)}
            />
            {errors.emergencyRelationship && (
              <p className="mt-1 flex items-center gap-1 text-sm text-red-500">
                <AlertCircle className="h-3 w-3" /> {errors.emergencyRelationship}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-medium">
            Contact phone number <span className="text-red-500">*</span>
          </label>
          <div className="flex max-w-md">
            <button
              type="button"
              className="flex items-center gap-1 rounded-l-lg border border-r-0 border-input bg-muted px-3 py-3 text-sm"
            >
              <span className="flex h-4 w-6 items-center justify-center rounded bg-[#00AFCA] text-[10px] text-white">KZ</span>
              <ChevronDown className="h-3 w-3" />
            </button>
            <input
              type="tel"
              value={emergencyPhone}
              onChange={(e) => setEmergencyPhone(e.target.value)}
              className={inputClasses(!!errors.emergencyPhone)}
              placeholder="Emergency contact phone"
            />
          </div>
          {errors.emergencyPhone && (
            <p className="mt-1 flex items-center gap-1 text-sm text-red-500">
              <AlertCircle className="h-3 w-3" /> {errors.emergencyPhone}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
