import { create } from "zustand"
import { api } from "@/lib/api"
import { getStoredToken } from "@/lib/auth"
import type { ClientItem, AnswersResult } from "@/lib/english/types"
import type { ProctorResources } from "@/lib/english/useProctor"

export type { ClientItem as EnglishItem } from "@/lib/english/types"
export type TestPhase = "idle" | "checkin" | "section" | "grading" | "finishing" | "done" | "error"

interface EnglishState {
  phase: TestPhase
  sessionId: string | null
  token: string | null
  currentSection: string | null
  stage: string | null
  items: ClientItem[]
  deadline: string | null
  submitting: boolean
  errorMessage: string
  placement: string | null
  placementSource: string | null
  certSubmitted: boolean
  certDetails: { cert_type: string; score: string; pdf_path?: string } | null
  proctorResources: ProctorResources | null

  // Actions
  setProctorResources: (res: ProctorResources | null) => void
  initTestSession: () => Promise<void>
  enterSection: (sec: string, stg: string, its: ClientItem[], dl?: string) => void
  afterAnswer: (res: AnswersResult) => void
  handleSectionExpiry: () => Promise<void>
  submitCertificate: (payload: {
    cert_type: string
    score: string
    test_date?: string
    cert_number?: string
    pdf?: File | null
  }) => Promise<boolean>
  skipTest: (reason?: string) => Promise<boolean>
  submitCheckin: (
    gates: {
      browser_ok: boolean
      camera_mic_ok: boolean
      screen_share_monitor: boolean
      not_extended: boolean
      fullscreen: boolean
      single_face_confirmed: boolean
    },
    consent: boolean
  ) => Promise<boolean>
  submitAnswers: (answers: { item_id: string; answer: unknown }[]) => Promise<void>
  submitWriting: (itemId: string, text: string) => Promise<void>
  uploadSpeaking: (itemId: string, audioBlob: Blob) => Promise<void>
  finishSession: () => Promise<void>
  reset: () => void
}

export const useEnglishStore = create<EnglishState>((set, get) => ({
  phase: "idle",
  sessionId: null,
  token: null,
  currentSection: null,
  stage: null,
  items: [],
  deadline: null,
  submitting: false,
  errorMessage: "",
  placement: null,
  placementSource: null,
  certSubmitted: false,
  certDetails: null,
  proctorResources: null,

  setProctorResources: (res) => {
    set({ proctorResources: res })
  },

  enterSection: (sec, stg, its, dl) => {
    set({
      currentSection: sec,
      stage: stg,
      items: its,
      deadline: dl || null,
      phase: "section",
      errorMessage: "",
    })
  },

  afterAnswer: (res: AnswersResult) => {
    if (!res.section_complete) {
      set({
        stage: res.stage || null,
        items: res.items || [],
        deadline: res.deadline || get().deadline,
      })
      return
    }

    if (!res.next_section) {
      void get().finishSession()
      return
    }

    get().enterSection(
      res.next_section,
      res.stage || "single",
      res.items || [],
      res.deadline
    )
  },

  handleSectionExpiry: async () => {
    const { sessionId, currentSection, token } = get()
    if (!sessionId || !currentSection) return
    try {
      const res = await api.expireEnglishSection(sessionId, currentSection, token || undefined)
      get().afterAnswer(res)
    } catch (err: unknown) {
      console.warn("Section expire error:", err)
    }
  },

  initTestSession: async () => {
    set({ phase: "idle", errorMessage: "" })
    try {
      const activeToken = getStoredToken()
      let englishToken =
        typeof window !== "undefined"
          ? localStorage.getItem("invision_english_token")
          : null

      if (!englishToken) {
        if (activeToken) {
          try {
            const link = await api.getEnglishAuthLink()
            englishToken = link.token
            if (typeof window !== "undefined") {
              localStorage.setItem("invision_english_token", englishToken)
            }
            set({ placement: link.placement, placementSource: link.placement_source })
            if (link.placement) {
              set({ phase: "done", token: englishToken })
              return
            }
          } catch {
            englishToken = activeToken
          }
        } else {
          const demo = await api.demoStart()
          englishToken = demo.token
          if (typeof window !== "undefined") {
            localStorage.setItem("invision_english_token", englishToken)
          }
        }
      }

      set({ token: englishToken })

      // Check for current active test session
      const existing = await api.getCurrentEnglishSession(englishToken || undefined)
      if (existing && ["decided", "needs_review"].includes(existing.state)) {
        set({ phase: "done" })
        return
      }

      if (
        existing &&
        ["listening", "reading", "writing", "speaking"].includes(existing.state)
      ) {
        try {
          const sec = await api.getEnglishSection(
            existing.session_id,
            englishToken || undefined
          )
          if (typeof window !== "undefined") {
            localStorage.setItem("invision_english_session_id", existing.session_id)
          }
          set({
            sessionId: existing.session_id,
            phase: "section",
            currentSection: sec.section,
            stage: sec.stage || null,
            items: sec.items,
            deadline: sec.deadline || null,
          })
          return
        } catch {
          // fallback to checkin
        }
      }

      const session =
        existing || (await api.createEnglishSession(englishToken || undefined))
      if (typeof window !== "undefined") {
        localStorage.setItem("invision_english_session_id", session.session_id)
      }
      set({ sessionId: session.session_id })

      if (session.state === "grading") {
        set({ phase: "grading" })
        await get().finishSession()
      } else {
        set({ phase: "checkin" })
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to initialize test session"
      set({ errorMessage: msg, phase: "error" })
    }
  },

  submitCertificate: async (payload) => {
    const { token } = get()
    set({ submitting: true, errorMessage: "" })
    try {
      const res = await api.submitCertificate(payload, token || undefined)
      set({
        submitting: false,
        phase: "done",
        placement: res.placement,
        placementSource: `certificate_${res.cert_type.toLowerCase()}`,
        certSubmitted: true,
        certDetails: {
          cert_type: res.cert_type,
          score: res.score,
          pdf_path: res.pdf_path,
        },
      })
      return true
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to submit certificate"
      set({ submitting: false, errorMessage: msg })
      return false
    }
  },

  skipTest: async (reason = "native_or_postponed") => {
    const { token } = get()
    set({ submitting: true, errorMessage: "" })
    try {
      const res = await api.skipEnglishTest(reason, token || undefined)
      set({
        submitting: false,
        phase: "done",
        placement: res.placement,
        placementSource: `waived_${reason}`,
      })
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to skip test"
      set({ submitting: false, errorMessage: msg })
      return false
    }
  },

  submitCheckin: async (gates, consent) => {
    const { sessionId, token } = get()
    if (!sessionId || !token) return false

    set({ submitting: true, errorMessage: "" })
    try {
      const res = await api.submitEnglishCheckin(sessionId, gates, consent, token)
      set({ submitting: false })

      if (res.passed && res.section && res.items) {
        get().enterSection(
          res.section,
          res.stage || "single",
          res.items,
          res.deadline
        )
        return true
      }
      set({
        errorMessage: res.missing
          ? `Missing requirements: ${res.missing.join(", ")}`
          : "Check-in was not accepted.",
      })
      return false
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Check-in failed"
      set({ submitting: false, errorMessage: msg })
      return false
    }
  },

  submitAnswers: async (formattedAnswers) => {
    const { sessionId, token } = get()
    if (!sessionId || !token) return

    set({ submitting: true, errorMessage: "" })
    try {
      const res = await api.submitEnglishAnswers(sessionId, formattedAnswers, token)
      set({ submitting: false })
      get().afterAnswer(res)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Submission failed"
      set({ submitting: false, errorMessage: msg })
    }
  },

  submitWriting: async (itemId: string, text: string) => {
    await get().submitAnswers([{ item_id: itemId, answer: text }])
  },

  uploadSpeaking: async (itemId: string, audioBlob: Blob) => {
    const { sessionId, token } = get()
    if (!sessionId || !token) return

    set({ submitting: true, errorMessage: "" })
    try {
      const res = await api.uploadSpeakingMedia(sessionId, itemId, audioBlob, token)
      set({ submitting: false })
      get().afterAnswer(res)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Audio upload failed"
      set({ submitting: false, errorMessage: msg })
    }
  },

  finishSession: async () => {
    const { sessionId, token, proctorResources } = get()
    if (!sessionId || !token) return

    set({ phase: "finishing" })
    if (proctorResources) {
      proctorResources.camera.getTracks().forEach((t) => t.stop())
      proctorResources.screen.getTracks().forEach((t) => t.stop())
      set({ proctorResources: null })
    }

    try {
      const res = await api.finishEnglishSession(sessionId, token)
      set({
        phase: "done",
        placement: res.placement || null,
        placementSource: "test",
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Grading failed"
      set({ errorMessage: msg, phase: "error" })
    }
  },

  reset: () => {
    const { proctorResources } = get()
    if (proctorResources) {
      proctorResources.camera.getTracks().forEach((t) => t.stop())
      proctorResources.screen.getTracks().forEach((t) => t.stop())
    }
    set({
      phase: "idle",
      sessionId: null,
      currentSection: null,
      stage: null,
      items: [],
      deadline: null,
      submitting: false,
      errorMessage: "",
      proctorResources: null,
    })
  },
}))
