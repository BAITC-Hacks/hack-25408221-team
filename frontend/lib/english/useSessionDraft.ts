"use client";

import { useEffect, useState } from "react";

/** Keep unfinished answers in this tab across reloads and device rechecks. */
export function useSessionDraft<T>(itemKey: string, initial: T, sessionId?: string | null) {
  const sid = sessionId || (typeof window !== "undefined" ? localStorage.getItem("invision_english_session_id") || "current" : "current");
  const key = `draft:${sid}:${itemKey}`;

  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const saved = sessionStorage.getItem(key);
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch {
      // Storage fallback
    }
    return initial;
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Keep in memory if storage quota exceeded
    }
  }, [key, value]);

  return [value, setValue] as const;
}
