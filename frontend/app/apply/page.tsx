"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/contexts/AuthContext"
import { AppHeader } from "@/components/app-header"

export default function ProgramSelectionPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/signin")
    }
  }, [isAuthenticated, isLoading, router])

  const handleSelectProgram = (program: string) => {
    router.push(`/apply/form?program=${program}`)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#CDFA1A]">
        <AppHeader />
        <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#CDFA1A]">
      <AppHeader />

      <main className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg rounded-lg bg-background p-8 shadow-lg">
          <div className="text-center">
            <h1 className="text-2xl font-bold md:text-3xl">
              Which program are you applying to?
            </h1>
            <p className="mt-2 text-muted-foreground">Choose your application type</p>
          </div>

          <div className="mt-8 space-y-4">
            <button
              onClick={() => handleSelectProgram("undergraduate")}
              className="w-full rounded-full bg-foreground py-4 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
            >
              Undergraduate
            </button>
            <button
              onClick={() => handleSelectProgram("foundation")}
              className="w-full rounded-full bg-foreground py-4 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
            >
              Foundation Year
            </button>
          </div>

          <div className="mt-16 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              When choosing Undergraduate, you will be able to select one of{" "}
              <Link href="/apply/form?program=undergraduate" className="underline">
                the programs
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
