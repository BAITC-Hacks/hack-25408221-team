"use client"

import { useEffect, useRef, useState } from "react"
import {
  CheckCircle2,
  AlertCircle,
  Camera,
  Monitor,
  Maximize2,
  ScanFace,
  Globe,
  Loader2,
  ShieldAlert,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Gates, ProctorResources, Screens } from "../types"
import { confirmSingleFace } from "../hooks/useFaceDetector"

export const GATE_LABELS: Record<keyof Gates, string> = {
  browser_ok: "Using a supported desktop browser",
  camera_mic_ok: "Camera and microphone access granted",
  screen_share_monitor: "Sharing your entire screen (not just a window/tab)",
  not_extended: "No second monitor connected",
  fullscreen: "Test window is in fullscreen",
  single_face_confirmed: "Exactly one face visible on camera",
}

type WindowManagementSupport = "supported" | "unsupported" | "denied"

export function CheckinPanel({
  onPassed,
  onResources,
}: {
  onPassed: (gates: Gates) => Promise<void>
  onResources: (resources: ProctorResources) => void
}) {
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
  const [gates, setGates] = useState<Gates>({
    browser_ok: false,
    camera_mic_ok: false,
    screen_share_monitor: false,
    not_extended: false,
    fullscreen: false,
    single_face_confirmed: false,
  })

  const [busy, setBusy] = useState<keyof Gates | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [windowMgmt, setWindowMgmt] = useState<WindowManagementSupport | null>(null)

  function checkBrowser() {
    setGates((g) => ({
      ...g,
      browser_ok: typeof navigator !== "undefined" && !!navigator.mediaDevices,
    }))
  }

  async function checkCameraMic() {
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
      setError("Camera/microphone permission was denied. Please allow access and try again.")
    } finally {
      setBusy(null)
    }
  }

  async function checkFullscreen() {
    setBusy("fullscreen")
    setError(null)
    try {
      await document.documentElement.requestFullscreen()
      setGates((g) => ({ ...g, fullscreen: true }))
    } catch {
      setError("Couldn't enter fullscreen. Some browsers require a user gesture — try clicking again.")
    } finally {
      setBusy(null)
    }
  }

  async function checkMonitors() {
    setBusy("not_extended")
    setError(null)
    try {
      if (typeof window === "undefined" || !("getScreenDetails" in window)) {
        setWindowMgmt("unsupported")
        setError(
          "Your browser cannot report the number of monitors (only Chrome/Edge support this). Please use desktop Chrome or Edge."
        )
        return
      }
      const details = await (window as any).getScreenDetails()
      displays.current = details
      const count: number = details.screens?.length ?? 0
      setWindowMgmt("supported")
      if (count !== 1) {
        setError(`${count} screens detected. Please disconnect any extra monitors and try again.`)
        setGates((g) => ({ ...g, not_extended: false }))
      } else {
        setGates((g) => ({ ...g, not_extended: true }))
      }
    } catch {
      setWindowMgmt("denied")
      setError("Screen-detection permission was denied. Please allow screen detection and retry.")
    } finally {
      setBusy(null)
    }
  }

  async function checkScreenShare() {
    setBusy("screen_share_monitor")
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor" } as MediaTrackConstraints,
      })
      const track = stream.getVideoTracks()[0]
      const settings = track.getSettings() as MediaTrackSettings & { displaySurface?: string }
      if (settings.displaySurface === "monitor") {
        setGates((g) => ({ ...g, screen_share_monitor: true }))
        screen.current?.getTracks().forEach((t) => t.stop())
        screen.current = stream
      } else {
        stream.getTracks().forEach((t) => t.stop())
        setError('You shared a single window or tab. Please choose "Entire Screen" instead.')
      }
    } catch {
      setError("Screen sharing was cancelled or denied. It is required to start the test.")
    } finally {
      setBusy(null)
    }
  }

  async function checkFace() {
    setBusy("single_face_confirmed")
    setError(null)
    try {
      const result = await confirmSingleFace(3000, camera.current || undefined)
      if (result.ok) {
        setGates((g) => ({ ...g, single_face_confirmed: true }))
        return
      }
      const messages: Record<string, string> = {
        camera_denied: "Camera access is needed for this check.",
        no_face: "No face was detected. Make sure you are clearly facing the camera in good lighting.",
        multiple_faces: "More than one face was detected. Ensure only you are in view.",
        detector_failed: "Face detection failed to initialize. Check your connection and try again.",
      }
      const base = messages[result.reason || "detector_failed"]
      setError(result.detail ? `${base} (${result.detail})` : base)
    } finally {
      setBusy(null)
    }
  }

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      if (!camera.current || !screen.current || !displays.current || !consent) {
        throw new Error("Please complete all verification checks and accept the integrity pledge.")
      }
      if (
        !document.fullscreenElement ||
        ![...camera.current.getTracks(), ...screen.current.getTracks()].every(
          (t) => t.readyState === "live"
        ) ||
        displays.current.screens.length !== 1
      ) {
        throw new Error("A device check changed state. Please run the checks again.")
      }
      onResources({
        camera: camera.current,
        screen: screen.current,
        displays: displays.current,
      })
      handedOff.current = true
      await onPassed(gates)
    } catch (e) {
      handedOff.current = false
      setError(e instanceof Error ? e.message : "Check-in failed.")
    } finally {
      setSubmitting(false)
    }
  }

  const allPassed = Object.values(gates).every(Boolean)

  return (
    <div className="rounded-xl border border-border bg-card p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System & Integrity Check-in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Allow approximately 20 minutes: 5 minutes per skill. Camera, screen sharing, fullscreen,
          and window focus are monitored throughout the assessment.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-3">
        {/* Gate 1: Browser */}
        <div className="flex items-center justify-between rounded-lg border border-border p-4 bg-background">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{GATE_LABELS.browser_ok}</p>
              <p className="text-xs text-muted-foreground">Desktop Chrome, Edge, or Brave</p>
            </div>
          </div>
          {gates.browser_ok ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
              <CheckCircle2 className="h-4 w-4" /> Passed
            </span>
          ) : (
            <Button size="sm" variant="outline" onClick={checkBrowser}>
              Verify
            </Button>
          )}
        </div>

        {/* Gate 2: Camera & Mic */}
        <div className="flex items-center justify-between rounded-lg border border-border p-4 bg-background">
          <div className="flex items-center gap-3">
            <Camera className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{GATE_LABELS.camera_mic_ok}</p>
              <p className="text-xs text-muted-foreground">Required for proctoring & speaking</p>
            </div>
          </div>
          {gates.camera_mic_ok ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
              <CheckCircle2 className="h-4 w-4" /> Passed
            </span>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={busy === "camera_mic_ok"}
              onClick={checkCameraMic}
            >
              {busy === "camera_mic_ok" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Enable
            </Button>
          )}
        </div>

        {/* Gate 3: Fullscreen */}
        <div className="flex items-center justify-between rounded-lg border border-border p-4 bg-background">
          <div className="flex items-center gap-3">
            <Maximize2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{GATE_LABELS.fullscreen}</p>
              <p className="text-xs text-muted-foreground">Prevents desktop distractions</p>
            </div>
          </div>
          {gates.fullscreen ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
              <CheckCircle2 className="h-4 w-4" /> Passed
            </span>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={busy === "fullscreen"}
              onClick={checkFullscreen}
            >
              {busy === "fullscreen" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Enter Fullscreen
            </Button>
          )}
        </div>

        {/* Gate 4: Single Monitor */}
        <div className="flex items-center justify-between rounded-lg border border-border p-4 bg-background">
          <div className="flex items-center gap-3">
            <Monitor className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{GATE_LABELS.not_extended}</p>
              <p className="text-xs text-muted-foreground">Only one active display permitted</p>
            </div>
          </div>
          {gates.not_extended ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
              <CheckCircle2 className="h-4 w-4" /> Passed
            </span>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={busy === "not_extended"}
              onClick={checkMonitors}
            >
              {busy === "not_extended" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Check Display
            </Button>
          )}
        </div>

        {/* Gate 5: Screen Sharing */}
        <div className="flex items-center justify-between rounded-lg border border-border p-4 bg-background">
          <div className="flex items-center gap-3">
            <Monitor className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{GATE_LABELS.screen_share_monitor}</p>
              <p className="text-xs text-muted-foreground">Must select "Entire Screen"</p>
            </div>
          </div>
          {gates.screen_share_monitor ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
              <CheckCircle2 className="h-4 w-4" /> Passed
            </span>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={busy === "screen_share_monitor"}
              onClick={checkScreenShare}
            >
              {busy === "screen_share_monitor" && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              Share Screen
            </Button>
          )}
        </div>

        {/* Gate 6: Single Face Check */}
        <div className="flex items-center justify-between rounded-lg border border-border p-4 bg-background">
          <div className="flex items-center gap-3">
            <ScanFace className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{GATE_LABELS.single_face_confirmed}</p>
              <p className="text-xs text-muted-foreground">3-second live face detection</p>
            </div>
          </div>
          {gates.single_face_confirmed ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
              <CheckCircle2 className="h-4 w-4" /> Passed
            </span>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={busy === "single_face_confirmed" || !gates.camera_mic_ok}
              onClick={checkFace}
            >
              {busy === "single_face_confirmed" && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              Scan Face
            </Button>
          )}
        </div>
      </div>

      {/* Integrity Consent */}
      <div className="rounded-lg border border-border p-4 bg-muted/20 space-y-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-input text-foreground focus:ring-[#CDFA1A]"
          />
          <span className="text-xs text-muted-foreground leading-relaxed">
            I certify that I am the registered applicant taking this test independently without
            external assistance, dictionaries, notes, or unauthorized applications. I consent to
            continuous integrity monitoring of my camera, screen, and window focus during the session.
          </span>
        </label>
      </div>

      <Button
        className="w-full h-12 bg-[#CDFA1A] text-foreground hover:bg-[#CDFA1A]/90 font-semibold"
        disabled={!allPassed || !consent || submitting}
        onClick={submit}
      >
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Confirm Checks & Start Assessment
      </Button>
    </div>
  )
}
