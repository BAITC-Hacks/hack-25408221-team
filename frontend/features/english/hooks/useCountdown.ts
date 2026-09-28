"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Counts down to an ISO deadline, ticking every second.
 * The server enforces the real deadline; this is for applicant UI feedback.
 */
export function useCountdown(deadlineIso: string | undefined, onExpire?: () => void) {
  const [remainingMs, setRemainingMs] = useState<number>(() =>
    deadlineIso ? new Date(deadlineIso).getTime() - Date.now() : 0
  )
  const callback = useRef(onExpire)
  callback.current = onExpire
  const firedRef = useRef(false)

  useEffect(() => {
    firedRef.current = false
    if (!deadlineIso) return

    const deadline = new Date(deadlineIso).getTime()
    const tick = () => {
      const remaining = deadline - Date.now()
      setRemainingMs(remaining)
      if (remaining <= 0 && !firedRef.current) {
        firedRef.current = true
        callback.current?.()
      }
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [deadlineIso])

  const seconds = Math.max(0, Math.ceil(remainingMs / 1000))
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0")
  const ss = String(seconds % 60).padStart(2, "0")

  return { seconds, label: `${mm}:${ss}`, low: seconds <= 30 }
}
