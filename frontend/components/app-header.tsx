"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { LogOut, User, ChevronDown } from "lucide-react"
import { useState, useRef, useEffect } from "react"

export function AppHeader() {
  const pathname = usePathname()
  const { user, isAuthenticated, logout } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleLogout = () => {
    logout()
    setDropdownOpen(false)
    window.location.href = "/"
  }

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-1">
            <span className="text-xl font-bold tracking-tight">inVision U</span>
            <span className="text-xs text-muted-foreground">
              <span className="block text-[10px] leading-tight">by inDrive</span>
            </span>
          </Link>
          <div className="h-6 w-px bg-border" />
        </div>

        <nav className="flex items-center gap-6">
          <Link
            href="/apply"
            className={`text-sm font-medium transition-colors ${
              pathname?.startsWith("/apply") ? "text-[#6B8E23]" : "text-foreground hover:text-foreground/80"
            }`}
          >
            Application
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          {isAuthenticated && user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/80"
              >
                <User className="h-4 w-4" />
                <span className="max-w-[100px] truncate">{user.name || "User"}</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-lg border border-border bg-background py-2 shadow-lg">
                  <div className="border-b border-border px-4 py-2">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                    {user.role && (
                      <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-xs capitalize">
                        {user.role}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Link
                href="/signin"
                className="text-sm font-medium text-foreground hover:text-foreground/80"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
