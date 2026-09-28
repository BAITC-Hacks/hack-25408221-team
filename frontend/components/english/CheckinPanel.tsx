"use client"

import { useEffect, useRef, useState } from "react"
import { confirmSingleFace } from "@/lib/english/faceDetector"
import type { ProctorResources, Screens } from "@/lib/english/useProctor"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Camera,
  Monitor,
  Maximize2,
  UserCheck,
  Globe,
  Loader2,
  ArrowRight,
} from "lucide-react"

export interface Gates {
  browser_ok: boolean
  camera_mic_ok: boolean
  screen_share_monitor: boolean
  not_extended: boolean
  fullscreen: boolean
  single_face_confirmed: boolean
}

type WindowManagementSupport = "supported" | "unsupported" | "denied"

interface CheckinPanelProps {
  onPassed: (gates: Gates) => Promise<void>
  onResources: (resources: ProctorResources) => void
}

export function CheckinPanel({ onPassed, onResources }: CheckinPanelProps) {
  const camera = useRef<MediaStream | null>(null)
  const screen = useRef<MediaStream | null>(null)
  const displays = useRef<Screens | null>(null)
  const handedOff = useRef(false)

  useEffect(() => {
    return () => {
      if (!handedOff.current) {
        camera.current?.getTracks().forEach((t) => t.stop())
        screen.current?.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  const [consent, setConsent] = useState(false)
  const [gates, setGates] = useState<Gates>(() => ({
    browser_ok: typeof navigator !== "undefined" && !!navigator.mediaDevices,
    camera_mic_ok: false,
    screen_share_monitor: false,
    not_extended: false,
    fullscreen: false,
    single_face_confirmed: false,
  }))

  const [busy, setBusy] = useState<keyof Gates | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [windowMgmt, setWindowMgmt] = useState<WindowManagementSupport | null>(null)
  const [screenCount, setScreenCount] = useState<number | null>(null)

  // 1. Browser Check
  const checkBrowser = () => {
    const isOk = typeof navigator !== "undefined" && !!navigator.mediaDevices
    setGates((g) => ({ ...g, browser_ok: isOk }))
  }

  // 2. Camera & Mic Check
  const checkCameraMic = async () => {
    setBusy("camera_mic_ok")
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })
      camera.current?.getTracks().forEach((t) => t.stop())
      camera.current = stream
      setGates((g) => ({ ...g, camera_mic_ok: true }))
    } catch {
      setError("Camera or microphone permission was denied. Please allow device access.")
    } finally {
      setBusy(null)
    }
  }

  // 3. Fullscreen Check
  const checkFullscreen = async () => {
    setBusy("fullscreen")
    setError(null)
    try {
      await document.documentElement.requestFullscreen()
      setGates((g) => ({ ...g, fullscreen: true }))
    } catch {
      setError("Couldn't enter fullscreen. Please click again to activate browser gesture.")
    } finally {
      setBusy(null)
    }
  }

  // 4. Single Monitor Check (Chrome / Edge Window Management API)
  const checkMonitors = async () => {
    setBusy("not_extended")
    setError(null)
    try {
      if (typeof window === "undefined" || !("getScreenDetails" in window)) {
        setWindowMgmt("unsupported")
        // Graceful pass for unsupported browsers with visual notice
        setGates((g) => ({ ...g, not_extended: true }))
        return
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const details = await (window as any).getScreenDetails()
      displays.current = details
      const count: number = details.screens?.length ?? 0
      setWindowMgmt("supported")
      setScreenCount(count)

      if (count !== 1) {
        setError(`${count} displays detected. Please disconnect external monitors.`)
        setGates((g) => ({ ...g, not_extended: false }))
      } else {
        setGates((g) => ({ ...g, not_extended: true }))
      }
    } catch {
      setWindowMgmt("denied")
      setError("Screen detection permission denied. Please allow display access or disconnect second monitor.")
      setGates((g) => ({ ...g, not_extended: false }))
    } finally {
      setBusy(null)
    }
  }

  // 5. Entire Screen Share Check
  const checkScreenShare = async () => {
    setBusy("screen_share_monitor")
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor" } as MediaTrackConstraints,
        // @ts-expect-error Chrome/Edge feature
        monitorTypeSurfaces: "include",
      })

      const track = stream.getVideoTracks()[0]
      const settings = track.getSettings() as MediaTrackSettings & {
        displaySurface?: string
      }

      if (settings.displaySurface === "monitor") {
        setGates((g) => ({ ...g, screen_share_monitor: true }))
        screen.current?.getTracks().forEach((t) => t.stop())
        screen.current = stream
      } else {
        stream.getTracks().forEach((t) => t.stop())
        setError('You shared an application window or browser tab. Please select "Entire Screen".')
      }
    } catch {
      setError("Screen sharing was cancelled or denied. Entire-screen sharing is required.")
    } finally {
      setBusy(null)
    }
  }

  // 6. MediaPipe Single Face Verification (3 seconds)
  const checkFace = async () => {
    setBusy("single_face_confirmed")
    setError(null)
    try {
      const result = await confirmSingleFace(3000, camera.current || undefined)
      if (result.ok) {
        setGates((g) => ({ ...g, single_face_confirmed: true }))
        return
      }

      const messages: Record<string, string> = {
        camera_denied: "Camera access is required for face verification.",
        no_face: "No face detected. Please position yourself clearly in front of the camera.",
        multiple_faces: "Multiple faces detected. Only the registered applicant may be visible.",
        detector_failed: "Face detector module could not load. Check network connection.",
      }
      setError(messages[result.reason || "detector_failed"] || "Face verification failed.")
    } finally {
      setBusy(null)
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      if (!camera.current) {
        throw new Error("Camera stream is not active. Please grant camera permission.")
      }
      if (!screen.current) {
        throw new Error("Screen sharing is not active. Please share your entire screen.")
      }
      if (!consent) {
        throw new Error("Please agree to the testing and proctoring consent.")
      }

      const activeDisplays: Screens = displays.current || (Object.assign(new EventTarget(), { screens: [{}] }) as Screens)

      onResources({
        camera: camera.current,
        screen: screen.current,
        displays: activeDisplays,
      })

      handedOff.current = true
      try {
        await onPassed(gates)
      } catch (e) {
        handedOff.current = false
        throw e
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check-in failed.")
    } finally {
      setSubmitting(false)
    }
  }

  const passedCount = Object.values(gates).filter(Boolean).length
  const allPassed = passedCount === 6

  return (
    <Card className="max-w-2xl mx-auto p-6 sm:p-10 border-border bg-card shadow-xl space-y-8 rounded-3xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#CDFA1A]/20 text-[#627a05] dark:text-[#CDFA1A]">
            <ShieldCheck className="h-7 w-7 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-foreground">
              Hardware & Integrity Check-in
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Verify your setup before launching the 20-minute proctored assessment
            </p>
          </div>
        </div>

        <Badge variant={allPassed ? "default" : "outline"} className="text-xs font-mono py-1 px-3 w-fit">
          {passedCount} of 6 Verified
        </Badge>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      {/* 6 Gates Checklist */}
      <div className="space-y-3">
        {/* Gate 1: Browser */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl border border-border bg-secondary/20">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs font-bold text-foreground">Supported Desktop Browser</p>
              <p className="text-[11px] text-muted-foreground">Chrome, Edge or modern Chromium environment</p>
            </div>
          </div>
          {gates.browser_ok ? (
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 gap-1 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5" /> Verified
            </Badge>
          ) : (
            <Button size="sm" variant="outline" onClick={checkBrowser} className="rounded-xl h-9 text-xs">
              Verify
            </Button>
          )}
        </div>

        {/* Gate 2: Camera & Mic */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl border border-border bg-secondary/20">
          <div className="flex items-center gap-3">
            <Camera className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs font-bold text-foreground">Camera & Microphone Access</p>
              <p className="text-[11px] text-muted-foreground">Allows continuous video and audio proctoring</p>
            </div>
          </div>
          {gates.camera_mic_ok ? (
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 gap-1 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5" /> Connected
            </Badge>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={busy === "camera_mic_ok"}
              onClick={checkCameraMic}
              className="rounded-xl h-9 text-xs"
            >
              {busy === "camera_mic_ok" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Allow Access"}
            </Button>
          )}
        </div>

        {/* Gate 3: Entire Screen Share */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl border border-border bg-secondary/20">
          <div className="flex items-center gap-3">
            <Monitor className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs font-bold text-foreground">Entire Screen Share</p>
              <p className="text-[11px] text-muted-foreground">Select &quot;Entire Screen&quot; (individual tabs are rejected)</p>
            </div>
          </div>
          {gates.screen_share_monitor ? (
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 gap-1 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5" /> Sharing Monitor
            </Badge>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={busy === "screen_share_monitor"}
              onClick={checkScreenShare}
              className="rounded-xl h-9 text-xs"
            >
              {busy === "screen_share_monitor" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Share Screen"}
            </Button>
          )}
        </div>

        {/* Gate 4: Single Monitor */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl border border-border bg-secondary/20">
          <div className="flex items-center gap-3">
            <Monitor className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs font-bold text-foreground">Single Display Verification</p>
              <p className="text-[11px] text-muted-foreground">
                {screenCount !== null
                  ? `${screenCount} display(s) detected`
                  : windowMgmt === "unsupported"
                  ? "Screen detection API not supported on this browser; manual pass granted"
                  : "External secondary monitors must be disconnected"}
              </p>
            </div>
          </div>
          {gates.not_extended ? (
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 gap-1 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5" /> 1 Screen
            </Badge>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={busy === "not_extended"}
              onClick={checkMonitors}
              className="rounded-xl h-9 text-xs"
            >
              {busy === "not_extended" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Check Displays"}
            </Button>
          )}
        </div>

        {/* Gate 5: Fullscreen */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl border border-border bg-secondary/20">
          <div className="flex items-center gap-3">
            <Maximize2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs font-bold text-foreground">Full-Screen Focus Mode</p>
              <p className="text-[11px] text-muted-foreground">Test locks down browser focus into full-screen view</p>
            </div>
          </div>
          {gates.fullscreen ? (
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 gap-1 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5" /> Fullscreen
            </Badge>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={busy === "fullscreen"}
              onClick={checkFullscreen}
              className="rounded-xl h-9 text-xs"
            >
              {busy === "fullscreen" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Enter Fullscreen"}
            </Button>
          )}
        </div>

        {/* Gate 6: MediaPipe Face Verification */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl border border-border bg-secondary/20">
          <div className="flex items-center gap-3">
            <UserCheck className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs font-bold text-foreground">Single Candidate Face Scan</p>
              <p className="text-[11px] text-muted-foreground">MediaPipe AI scan (3 seconds) ensures exactly 1 face is visible</p>
            </div>
          </div>
          {gates.single_face_confirmed ? (
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 gap-1 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5" /> Face Confirmed
            </Badge>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={busy === "single_face_confirmed"}
              onClick={checkFace}
              className="rounded-xl h-9 text-xs"
            >
              {busy === "single_face_confirmed" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Scan Face (3s)"}
            </Button>
          )}
        </div>
      </div>

      {/* Consent Checkbox */}
      <div className="rounded-2xl border border-border bg-secondary/10 p-4">
        <label className="flex items-start gap-3 cursor-pointer text-xs leading-relaxed text-muted-foreground select-none">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-input text-[#CDFA1A] focus:ring-[#CDFA1A]"
          />
          <span>
            I acknowledge and agree that my webcam, microphone, screen share, and browser focus will be monitored during this assessment. All camera frames are analyzed client-side, and recorded answers will be reviewed by the inVision Admissions Committee.
          </span>
        </label>
      </div>

      <Button
        size="lg"
        disabled={!allPassed || !consent || submitting}
        onClick={handleSubmit}
        className="w-full bg-[#CDFA1A] text-black font-extrabold hover:bg-[#b8e612] rounded-2xl h-14 text-base gap-2 shadow-lg disabled:opacity-50"
      >
        {submitting ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            Start 20-Minute Assessment
            <ArrowRight className="h-5 w-5 stroke-[2.5]" />
          </>
        )}
      </Button>
    </Card>
  )
}
