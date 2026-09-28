import { create } from "zustand"
import { api } from "@/lib/api"
import {
  decodeToken,
  getStoredToken,
  setStoredToken,
  clearStoredToken,
  isTokenValid,
} from "@/lib/auth"

export interface User {
  id: string
  name: string
  email?: string
  role?: string
}

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  program: string
  setProgram: (p: string) => void
  initialize: () => void
  login: (email: string, pass: string) => Promise<void>
  register: (name: string, email: string, pass: string, phone?: string) => Promise<void>
  startDemo: () => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  program: "Undergraduate",

  setProgram: (p: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("invision_program", p)
    }
    set({ program: p })
  },

  initialize: () => {
    if (typeof window === "undefined") return
    const token = getStoredToken()
    const storedUser = localStorage.getItem("invision_user")
    const storedProgram = localStorage.getItem("invision_program") || "Undergraduate"

    if (token && isTokenValid(token)) {
      const payload = decodeToken(token)
      let userObj: User = { id: payload?.sub || "user", name: "Candidate", role: payload?.role || "applicant" }
      if (storedUser) {
        try {
          userObj = JSON.parse(storedUser)
        } catch {
          // ignore
        }
      }
      set({
        user: userObj,
        token,
        isAuthenticated: true,
        isLoading: false,
        program: storedProgram,
      })
    } else {
      clearStoredToken()
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        program: storedProgram,
      })
    }
  },

  login: async (email: string, pass: string) => {
    const res = await api.login(email, pass)
    setStoredToken(res.accessToken)
    const payload = decodeToken(res.accessToken)
    const user: User = {
      id: res.userId,
      name: res.name,
      email,
      role: payload?.role || "applicant",
    }
    localStorage.setItem("invision_user", JSON.stringify(user))
    set({ user, token: res.accessToken, isAuthenticated: true })
  },

  register: async (name: string, email: string, pass: string, phone: string = "") => {
    const res = await api.register(name, email, phone, pass)
    setStoredToken(res.accessToken)
    const payload = decodeToken(res.accessToken)
    const user: User = {
      id: res.userId,
      name: res.name,
      email,
      role: payload?.role || "applicant",
    }
    localStorage.setItem("invision_user", JSON.stringify(user))
    set({ user, token: res.accessToken, isAuthenticated: true })
  },

  startDemo: async () => {
    const demo = await api.demoStart()
    setStoredToken(demo.token)
    const user: User = {
      id: demo.id,
      name: "Demo Candidate",
      email: `${demo.external_id}@demo.invision.u`,
      role: "applicant",
    }
    localStorage.setItem("invision_user", JSON.stringify(user))
    set({ user, token: demo.token, isAuthenticated: true })
  },

  logout: () => {
    clearStoredToken()
    if (typeof window !== "undefined") {
      localStorage.removeItem("invision_user")
    }
    set({ user: null, token: null, isAuthenticated: false })
  },
}))
