"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/stores/useAuthStore"
import { ArrowRight, Sparkles } from "lucide-react"

export default function HomePage() {
  const router = useRouter()
  const { startDemo, isAuthenticated, user } = useAuthStore()

  const handleDemo = async () => {
    try {
      await startDemo()
      router.push("/dashboard")
    } catch (e) {
      console.error(e)
    }
  }

  const isAdmin = user?.role === "admin"

  return (
    <div className="min-h-screen bg-[#CDFA1A] text-black selection:bg-black selection:text-[#CDFA1A] flex flex-col justify-between">
      {/* Header */}
      <header className="flex items-center justify-between px-6 sm:px-12 py-8 max-w-7xl mx-auto w-full">
        <div>
          <Link href="/" className="group block">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-none text-black">
              inVision U
            </h1>
            <p className="text-xs font-semibold text-black/70 mt-1">by inDrive</p>
          </Link>
        </div>

        <nav className="flex items-center gap-4 sm:gap-8 text-sm font-bold">
          {!isAdmin && (
            <button
              onClick={handleDemo}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-black/30 bg-black/10 px-4 py-2 text-xs font-bold text-black hover:bg-black/20 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              1-Click Demo Sandbox
            </button>
          )}

          {isAuthenticated ? (
            <Link
              href={isAdmin ? "/admin" : "/dashboard"}
              className="rounded-full bg-black px-6 py-2.5 text-sm font-bold text-[#CDFA1A] hover:bg-black/90 transition-transform active:scale-95"
            >
              {isAdmin ? "Admissions Directory" : "Candidate Portal"}
            </Link>
          ) : (
            <>
              <Link href="/signin" className="text-black/80 hover:text-black hover:underline">
                Sign In
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-black px-6 py-2.5 text-sm font-bold text-[#CDFA1A] hover:bg-black/90 transition-transform active:scale-95 shadow-sm"
              >
                Apply Now
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* Hero Content */}
      <main className="flex flex-col items-center justify-center px-4 sm:px-8 py-12 max-w-5xl mx-auto w-full text-center">
        <div className="max-w-3xl space-y-6">
          <h2 className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tight leading-[1.05] text-black">
            Applications <br />
            are now open
          </h2>

          <p className="text-lg sm:text-2xl font-medium text-black/80 max-w-2xl mx-auto">
            Apply for the <span className="font-extrabold underline decoration-black/40 decoration-2 underline-offset-4">Undergraduate</span> and{" "}
            <span className="font-extrabold underline decoration-black/40 decoration-2 underline-offset-4">Foundation</span> programs
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href={isAuthenticated ? (isAdmin ? "/admin" : "/dashboard") : "/signup"}
              className="flex items-center gap-3 rounded-full bg-black px-9 py-4 text-base sm:text-lg font-bold text-[#CDFA1A] transition-all hover:bg-black/90 hover:scale-105 shadow-xl"
            >
              {isAdmin ? "Open Admissions Directory" : "Start Application"}
              <ArrowRight className="h-5 w-5 stroke-[2.5]" />
            </Link>

            {!isAdmin && (
              <button
                onClick={handleDemo}
                className="rounded-full border-2 border-black px-8 py-4 text-base sm:text-lg font-bold text-black transition-colors hover:bg-black hover:text-[#CDFA1A]"
              >
                Explore Demo Mode
              </button>
            )}
          </div>
        </div>

        {/* The Two University Programs */}
        <div className="mt-20 grid w-full max-w-4xl gap-6 md:grid-cols-2 text-left">
          {/* Program 1 */}
          <div className="rounded-3xl bg-white p-8 sm:p-10 shadow-xl border border-black/5 flex flex-col justify-between hover:shadow-2xl transition-shadow">
            <div>
              <div className="inline-block rounded-full bg-[#CDFA1A]/40 px-3 py-1 text-xs font-black uppercase tracking-wider text-black mb-4">
                Bachelor Degree
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-black">
                Undergraduate
              </h3>
              <p className="mt-2 text-sm text-neutral-600 leading-relaxed font-medium">
                Innovative IT Product Design and Development program with hands-on venture creation.
              </p>

              <ul className="mt-6 space-y-3 text-sm text-neutral-800 font-medium">
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-[#CDFA1A] ring-2 ring-black/20 shrink-0" />
                  <span>Project-based learning with industry mentors</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-[#CDFA1A] ring-2 ring-black/20 shrink-0" />
                  <span>Teamwork skills & real-world product delivery</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-[#CDFA1A] ring-2 ring-black/20 shrink-0" />
                  <span>Full English language instruction</span>
                </li>
              </ul>
            </div>

            <div className="mt-8 pt-6 border-t border-neutral-100 flex items-center justify-between text-xs font-bold text-neutral-500">
              <span>Standard Track · 4 Years</span>
              <span className="text-black">Learn more →</span>
            </div>
          </div>

          {/* Program 2 */}
          <div className="rounded-3xl bg-white p-8 sm:p-10 shadow-xl border border-black/5 flex flex-col justify-between hover:shadow-2xl transition-shadow">
            <div>
              <div className="inline-block rounded-full bg-neutral-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-black mb-4">
                Preparatory Year
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-black">
                Foundation Year
              </h3>
              <p className="mt-2 text-sm text-neutral-600 leading-relaxed font-medium">
                Prepare for undergraduate studies with intensive language and academic skill building.
              </p>

              <ul className="mt-6 space-y-3 text-sm text-neutral-800 font-medium">
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-[#CDFA1A] ring-2 ring-black/20 shrink-0" />
                  <span>Intensive English language preparation</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-[#CDFA1A] ring-2 ring-black/20 shrink-0" />
                  <span>Academic writing & computing fundamentals</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-[#CDFA1A] ring-2 ring-black/20 shrink-0" />
                  <span>Direct progression pathway to Undergraduate</span>
                </li>
              </ul>
            </div>

            <div className="mt-8 pt-6 border-t border-neutral-100 flex items-center justify-between text-xs font-bold text-neutral-500">
              <span>Prep Track · 1 Year</span>
              <span className="text-black">Learn more →</span>
            </div>
          </div>
        </div>

        {/* Deadline Notice Pill */}
        <div className="mt-14 inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 shadow-lg border border-black/5 text-sm font-bold text-black">
          <span className="text-red-500 font-black">MAY 30</span>
          <span className="text-neutral-300">·</span>
          <span>Standard admission deadline for academic year</span>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-6 text-center text-xs font-semibold text-black/60 max-w-7xl mx-auto w-full">
        inVision University © {new Date().getFullYear()} · Powered by inDrive
      </footer>
    </div>
  )
}
