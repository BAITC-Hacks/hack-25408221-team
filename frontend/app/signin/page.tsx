"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { decodeToken, isTokenValid } from "@/lib/auth"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export default function SignInPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({ email: "", password: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email, password: formData.password }),
      })
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.detail || data.error || "Login failed. Please try again.")
        setLoading(false)
        return
      }

      if (!data.accessToken || !data.userId) {
        setError("Invalid response from server")
        setLoading(false)
        return
      }
      
      if (!isTokenValid(data.accessToken)) {
        setError("Invalid token received. Please contact support.")
        setLoading(false)
        return
      }
      
      const decoded = decodeToken(data.accessToken)
      const role = decoded?.role || "user"
      
      login(data.userId, data.name, data.accessToken, formData.email, role)
      
      if (role === "admin") {
        router.push("/admin")
      } else {
        router.push("/apply")
      }
    } catch (err) {
      console.error("Login error:", err)
      setError("Could not connect to server. Is the backend running?")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#CDFA1A]">
      <header className="border-b border-foreground/10 bg-background">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 md:px-8">
          <Link href="/" className="flex items-center gap-1">
            <span className="text-xl font-bold tracking-tight">inVision U</span>
            <span className="text-xs text-muted-foreground">
              <span className="block text-[10px] leading-tight">by inDrive</span>
            </span>
          </Link>
        </div>
      </header>

      <main className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-lg bg-background p-8 shadow-lg">
          <h1 className="mb-8 text-center text-3xl font-bold">Sign In</h1>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium">Email</label>
              <input
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm outline-none focus:border-foreground focus:ring-1 focus:ring-foreground transition-colors"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-4 py-3 pr-12 text-sm outline-none focus:border-foreground focus:ring-1 focus:ring-foreground transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-foreground py-4 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>

            <div className="text-center">
              <p className="text-sm text-muted-foreground">Don&apos;t have an account?</p>
              <Link href="/signup" className="text-sm font-medium text-foreground underline">
                Sign Up
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
