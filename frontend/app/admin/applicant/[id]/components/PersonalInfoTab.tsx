"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, Mail, Phone } from "lucide-react"
import { ApiUser } from "@/components/admin/types"

export function PersonalInfoTab({ applicant }: { applicant: ApiUser }) {
  const [expandedSections, setExpandedSections] = useState<string[]>(["personal", "contact"])

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-background">
        <button
          onClick={() => toggleSection("personal")}
          className="flex w-full items-center justify-between p-4 text-left"
        >
          <h3 className="font-semibold">Personal Information</h3>
          {expandedSections.includes("personal") ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        {expandedSections.includes("personal") && (
          <div className="border-t border-border p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Full Name</p>
                <p className="font-medium">{applicant.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Program</p>
                <p className="font-medium">{applicant.session?.program || "—"}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-background">
        <button
          onClick={() => toggleSection("contact")}
          className="flex w-full items-center justify-between p-4 text-left"
        >
          <h3 className="font-semibold">Contact Information</h3>
          {expandedSections.includes("contact") ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        {expandedSections.includes("contact") && (
          <div className="border-t border-border p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{applicant.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{applicant.phone || "—"}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
