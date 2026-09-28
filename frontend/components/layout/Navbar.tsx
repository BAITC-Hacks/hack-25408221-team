"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuthStore } from "@/stores/useAuthStore"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sparkles, LogOut, User, Shield } from "lucide-react"

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isAuthenticated, logout, startDemo } = useAuthStore()

  const isInterview = pathname.startsWith("/interview")
  if (isInterview) return null // Interview page has its own minimal in-call header

  const isAdmin = user?.role === "admin"

  const handleDemo = async () => {
    try {
      await startDemo()
      router.push("/dashboard")
    } catch (e) {
      console.error("Failed to start demo:", e)
    }
  }

  const handleLogout = () => {
    logout()
    router.push("/signin")
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CDFA1A] text-black font-extrabold text-lg shadow-sm transition-transform group-hover:scale-105">
              in
            </div>
            <div>
              <span className="font-extrabold tracking-tight text-foreground text-lg">
                inVision <span className="text-[#84a305] dark:text-[#CDFA1A]">U</span>
              </span>
              <span className="ml-1.5 hidden text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:inline-block">
                Admissions Platform
              </span>
            </div>
          </Link>

          {isAuthenticated && (
            <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
              {!isAdmin ? (
                <>
                  <Link
                    href="/dashboard"
                    className={`rounded-lg px-3 py-1.5 transition-colors ${
                      pathname === "/dashboard"
                        ? "bg-secondary text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Candidate Portal
                  </Link>
                  <Link
                    href="/interview"
                    className={`rounded-lg px-3 py-1.5 transition-colors ${
                      pathname.startsWith("/interview")
                        ? "bg-secondary text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Video Interview
                  </Link>
                  <Link
                    href="/english"
                    className={`rounded-lg px-3 py-1.5 transition-colors ${
                      pathname.startsWith("/english")
                        ? "bg-secondary text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    English Requirement
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/admin"
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors ${
                      pathname === "/admin"
                        ? "bg-secondary text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Shield className="h-3.5 w-3.5 text-[#84a305] dark:text-[#CDFA1A]" />
                    Admissions Directory
                  </Link>
                  <Link
                    href="/admin/committee"
                    className={`rounded-lg px-3 py-1.5 transition-colors ${
                      pathname === "/admin/committee"
                        ? "bg-secondary text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Committee Consensus Grid
                  </Link>
                </>
              )}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          {!isAuthenticated ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDemo}
                className="hidden border-[#CDFA1A]/40 bg-[#CDFA1A]/10 text-foreground hover:bg-[#CDFA1A]/20 sm:inline-flex"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#84a305] dark:text-[#CDFA1A]" />
                1-Click Demo Sandbox
              </Button>
              <Link href="/signin">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm" className="bg-[#CDFA1A] text-black font-semibold hover:bg-[#b8e612]">
                  Get Started
                </Button>
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-bold text-foreground">
                  {user?.name ? user.name[0].toUpperCase() : <User className="h-4 w-4" />}
                </div>
                <div className="text-left text-xs leading-tight">
                  <div className="font-semibold text-foreground">{user?.name}</div>
                  <div className="text-muted-foreground capitalize">{user?.role || "Applicant"}</div>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} title="Sign Out">
                <LogOut className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
