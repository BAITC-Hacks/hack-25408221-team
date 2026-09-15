"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#CDFA1A]">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-6">
        <div>
          <h1 className="text-2xl font-bold">inVision U</h1>
          <p className="text-xs text-foreground/70">by inDrive</p>
        </div>
        <nav className="flex items-center gap-8">
          <Link href="/signup" className="text-sm font-medium hover:underline">
            Sign Up
          </Link>
          <Link href="/apply" className="text-sm font-medium hover:underline">
            Apply Now
          </Link>
        </nav>
      </header>

      {/* Main content */}
      <main className="flex flex-col items-center justify-center px-8 py-20">
        <div className="max-w-3xl text-center">
          <h2 className="text-5xl font-bold leading-tight md:text-7xl">
            Applications are now open
          </h2>
          <p className="mt-6 text-xl text-foreground/80">
            Apply for the <span className="font-semibold underline">Undergraduate</span> and{" "}
            <span className="font-semibold underline">Foundation</span> programs
          </p>
          
          <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/apply"
              className="flex items-center gap-2 rounded-full bg-foreground px-8 py-4 text-lg font-medium text-background transition-transform hover:scale-105"
            >
              Start Application
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/signup"
              className="rounded-full border-2 border-foreground px-8 py-4 text-lg font-medium transition-colors hover:bg-foreground hover:text-background"
            >
              Create Account
            </Link>
          </div>
        </div>

        {/* Program cards */}
        <div className="mt-20 grid w-full max-w-4xl gap-6 md:grid-cols-2">
          <div className="rounded-2xl bg-background p-8 shadow-lg">
            <h3 className="text-2xl font-bold">Undergraduate</h3>
            <p className="mt-2 text-muted-foreground">
              Innovative IT Product Design and Development program
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#CDFA1A]" />
                Project-based learning
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#CDFA1A]" />
                Teamwork skills and real-world projects
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#CDFA1A]" />
                English language instruction
              </li>
            </ul>
          </div>
          
          <div className="rounded-2xl bg-background p-8 shadow-lg">
            <h3 className="text-2xl font-bold">Foundation Year</h3>
            <p className="mt-2 text-muted-foreground">
              Prepare for undergraduate studies
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#CDFA1A]" />
                Intensive English preparation
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#CDFA1A]" />
                Academic skills development
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#CDFA1A]" />
                Pathway to undergraduate program
              </li>
            </ul>
          </div>
        </div>

        {/* Deadline notice */}
        <div className="mt-16 rounded-full bg-background px-8 py-4 shadow-lg">
          <p className="text-center font-medium">
            <span className="text-red-500">MAY 30</span> - Standard admission deadline
          </p>
        </div>
      </main>
    </div>
  )
}
