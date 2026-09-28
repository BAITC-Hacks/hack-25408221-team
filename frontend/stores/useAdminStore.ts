import { create } from "zustand"
import {
  api,
  ApiUser,
  CommitteeGridRow,
  CommitteeContext,
  EnglishApplicantStatus,
} from "@/lib/api"

interface AdminState {
  applicants: ApiUser[]
  selectedApplicant: ApiUser | null
  committeeRows: CommitteeGridRow[]
  committeeContext: CommitteeContext | null
  englishStatus: EnglishApplicantStatus | null
  loading: boolean
  error: string | null
  searchQuery: string
  filterProgram: string

  setSearchQuery: (q: string) => void
  setFilterProgram: (p: string) => void

  fetchApplicants: () => Promise<void>
  fetchApplicantDossier: (id: string) => Promise<void>
  fetchCommitteeGrid: () => Promise<void>
  fetchCommitteeContext: (sessionId: string) => Promise<void>
  createRatingEvent: (
    sessionId: string,
    payload: {
      indicator: string
      band: string
      quote: string
      status?: "proposed" | "accepted"
    }
  ) => Promise<void>
  decideRatingEvent: (
    sessionId: string,
    eventId: string,
    status: "accepted" | "rejected",
    band?: string,
    quote?: string
  ) => Promise<void>
  submitPlacementDecision: (
    sessionId: string,
    placement: "BACHELOR" | "FOUNDATION",
    notes: string
  ) => Promise<void>
}

export const useAdminStore = create<AdminState>((set, get) => ({
  applicants: [],
  selectedApplicant: null,
  committeeRows: [],
  committeeContext: null,
  englishStatus: null,
  loading: false,
  error: null,
  searchQuery: "",
  filterProgram: "all",

  setSearchQuery: (q) => set({ searchQuery: q }),
  setFilterProgram: (p) => set({ filterProgram: p }),

  fetchApplicants: async () => {
    set({ loading: true, error: null })
    try {
      const data = await api.getAdminUsers()
      // Filter out admins so only actual applicants appear
      const realApplicants = (data || []).filter((u) => u.role !== "admin")
      set({ applicants: realApplicants, loading: false })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load applicants"
      set({ error: msg, loading: false })
    }
  },

  fetchApplicantDossier: async (id: string) => {
    set({ loading: true, error: null, selectedApplicant: null, englishStatus: null })
    try {
      const user = await api.getAdminUser(id)
      set({ selectedApplicant: user })

      // Also fetch English status if available
      try {
        const eng = await api.getEnglishAdminApplicant(id)
        set({ englishStatus: eng })
      } catch {
        // no english record yet
      }

      set({ loading: false })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load applicant dossier"
      set({ error: msg, loading: false })
    }
  },

  fetchCommitteeGrid: async () => {
    set({ loading: true, error: null })
    try {
      const data = await api.getCommitteeGrid()
      set({ committeeRows: data.items || [], loading: false })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load committee grid"
      set({ error: msg, loading: false })
    }
  },

  fetchCommitteeContext: async (sessionId: string) => {
    try {
      const ctx = await api.getCommitteeContext(sessionId)
      set({ committeeContext: ctx })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load committee context"
      set({ error: msg })
    }
  },

  createRatingEvent: async (sessionId, payload) => {
    try {
      await api.createRatingEvent(sessionId, payload)
      await get().fetchCommitteeContext(sessionId)
      await get().fetchCommitteeGrid()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create rating event"
      set({ error: msg })
    }
  },

  decideRatingEvent: async (sessionId, eventId, status, band, quote) => {
    try {
      await api.decideRatingEvent(sessionId, eventId, { status, band, quote })
      // Refresh context and grid
      await get().fetchCommitteeContext(sessionId)
      await get().fetchCommitteeGrid()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to decide rating event"
      set({ error: msg })
    }
  },

  submitPlacementDecision: async (sessionId, placement, notes) => {
    set({ loading: true })
    try {
      await api.submitEnglishDecision(sessionId, placement, notes)
      set({ loading: false })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Decision submission failed"
      set({ error: msg, loading: false })
    }
  },
}))
