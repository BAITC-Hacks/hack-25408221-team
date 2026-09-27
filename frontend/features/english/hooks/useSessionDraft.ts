"use client"

import { useEffect, useState } from "react"
import { getLocalSessionId } from "../api/client"

/**
 * Retains unfinished answers in sessionStorage across accidental reloads or device rechecks.
 */
export function useSessionDraft<T>(itemKey: string, initial: T, explicitSessionId?: string | null) {
  const [value, setValue] = useState(initial)
  const [ready, setReady] = useState(false)

  const sid = explicitSessionId ?? getLocalSessionId() ?? "default"
  const key = `draft:${sid}:${itemKey}`

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(key)
      if (saved) setValue(JSON.parse(saved))
    } catch {
      // Storage access may fail in private mode
    }
    setReady(true)
  }, [key])

  useEffect(() => {
    if (ready) {
      try {
        sessionStorage.setItem(key, JSON.stringify(value))
      } catch {
        // Storage is full or disabled
      }
    }
  }, [key, ready, value])

  return [value, setValue] as const
}
