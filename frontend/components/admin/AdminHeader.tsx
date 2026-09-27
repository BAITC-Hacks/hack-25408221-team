"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Download, LogOut, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"

export function AdminHeader({
  onExportCsv,
}: {
  onExportCsv?: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()

  const navLinks = [
    { href: "/admin", label: "Applicants", exact: true },
    { href: "/admin/committee", label: "Committee Review", exact: false },
    { href: "/admin/english", label: "English Assessment", exact: false },
  ]

  const isActive = (href: string, exact: boolean) => {
    if (exact) return pathname === href
    return pathname?.startsWith(href)
  }

  return (
    <header className="border-b border-border bg-background px-8 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-bold flex items-center gap-1.5">
            inVision U
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#CDFA1A] text-foreground">
              Admin
            </span>
          </Link>

          <nav className="flex items-center gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors ${
                  isActive(link.href, link.exact)
                    ? "text-[#6B8E23] font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {onExportCsv && (
            <Button variant="outline" size="sm" onClick={onExportCsv}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          )}

          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <User className="h-4 w-4" />
              {user?.name || "Admin"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                logout()
                router.push("/signin")
              }}
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
