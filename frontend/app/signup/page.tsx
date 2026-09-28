"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Navbar } from "@/components/layout/Navbar"
import { useAuthStore } from "@/stores/useAuthStore"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { AlertCircle, Loader2, Sparkles } from "lucide-react"

export default function SignUpPage() {
  const router = useRouter()
  const { register, setProgram, startDemo } = useAuthStore()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [selectedProgram, setSelectedProg] = useState("Undergraduate")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      setProgram(selectedProgram)
      await register(name, email, password)
      router.push("/dashboard")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleDemo = async () => {
    try {
      await startDemo()
      router.push("/dashboard")
    } catch (err: unknown) {
      console.error(err)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center">
      <Navbar />

      <main className="mx-auto w-full max-w-md px-4 py-12 flex-1 flex flex-col justify-center">
        <Card className="border-border bg-card p-6 sm:p-8 shadow-xl rounded-3xl">
          <CardHeader className="p-0 mb-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#CDFA1A] text-black font-extrabold text-xl mx-auto mb-3">
              in
            </div>
            <CardTitle className="text-2xl font-black">Create Applicant Profile</CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              Begin your digital admission process at inVision University.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0 space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  Full Name *
                </label>
                <Input
                  required
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  Email Address *
                </label>
                <Input
                  type="email"
                  required
                  placeholder="applicant@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  Password *
                </label>
                <Input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  Intended Program Track *
                </label>
                <select
                  value={selectedProgram}
                  onChange={(e) => setSelectedProg(e.target.value)}
                  className="w-full h-11 rounded-xl border border-input bg-background px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#CDFA1A]"
                >
                  <option value="Undergraduate">Undergraduate (IT Product Design)</option>
                  <option value="Foundation">Foundation Year Program</option>
                </select>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#CDFA1A] text-black font-extrabold hover:bg-[#b8e612] rounded-xl h-11 text-sm gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Complete Registration"}
              </Button>
            </form>

            <div className="relative py-2 text-center text-[11px] text-muted-foreground">
              <span className="bg-card px-2 relative z-10">or explore instantly</span>
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
            </div>

            <Button
              variant="outline"
              type="button"
              onClick={handleDemo}
              className="w-full rounded-xl text-xs gap-2 font-bold"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#84a305] dark:text-[#CDFA1A]" />
              Start 1-Click Demo Sandbox
            </Button>

            <div className="pt-2 text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link href="/signin" className="font-bold text-foreground underline">
                Sign In
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
