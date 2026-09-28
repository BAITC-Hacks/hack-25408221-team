"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AlertCircle, Maximize2, RefreshCw } from "lucide-react"

interface ProctorOverlayProps {
  reasons: string[]
  onReconnect?: () => void
}

export function ProctorOverlay({ reasons, onReconnect }: ProctorOverlayProps) {
  if (reasons.length === 0) return null

  const handleFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen()
    } catch (e) {
      console.error("Fullscreen error:", e)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
      role="alertdialog"
      aria-modal="true"
      aria-label="Test paused"
    >
      <Card className="max-w-md w-full p-6 sm:p-8 border-destructive/40 bg-card shadow-2xl space-y-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mx-auto">
          <AlertCircle className="h-8 w-8 stroke-[2.5]" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-black text-foreground">Return to Your Assessment</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Test questions are concealed while integrity requirements are unresolved. Your official timer continues to run.
          </p>
        </div>

        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-left">
          <ul className="space-y-2 text-xs font-semibold text-destructive">
            {reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive mt-1.5 shrink-0" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Button
            onClick={handleFullscreen}
            className="w-full bg-[#CDFA1A] text-black font-extrabold hover:bg-[#b8e612] rounded-xl h-11 text-xs gap-2"
          >
            <Maximize2 className="h-4 w-4" />
            Restore Fullscreen
          </Button>

          {onReconnect && (
            <Button
              variant="outline"
              onClick={onReconnect}
              className="w-full rounded-xl h-11 text-xs gap-2 border-border"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reconnect Devices
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
