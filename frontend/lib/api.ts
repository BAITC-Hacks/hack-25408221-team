import { isTokenValid } from "./auth"

export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "")
  }
  if (typeof window !== "undefined") {
    return ""
  }
  return "http://127.0.0.1:8000"
}

export const API_URL = getApiBaseUrl()

const TOKEN_KEY = "accessToken"

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token || !isTokenValid(token)) return null
  
  return token
}

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Request failed" }))
    throw new Error(error.detail || "Request failed")
  }

  return response.json()
}

export const api = {
  login: (email: string, password: string) =>
    fetchApi<{ userId: string; name: string; accessToken: string }>("/api/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (name: string, email: string, phone: string, password: string) =>
    fetchApi<{ userId: string; name: string; accessToken: string }>("/api/register", {
      method: "POST",
      body: JSON.stringify({ name, email, phone, password }),
    }),

  getUsers: () => fetchApi<any[]>("/api/users"),
  getUser: (id: string) => fetchApi<any>(`/api/users/${id}`),

  createSession: (userId: string, program: string) => {
    const token = getToken()
    const options: RequestInit = {
      method: "POST",
      body: JSON.stringify({ userId, program }),
    }
    if (token) {
      options.headers = { Authorization: `Bearer ${token}` }
    }
    return fetchApi<{ sessionId: string }>("/api/sessions", options)
  },

  uploadRecording: (sessionId: string, file: Blob) => {
    const token = getToken()
    const formData = new FormData()
    formData.append("sessionId", sessionId)
    formData.append("file", file, `${sessionId}.webm`)

    const options: RequestInit = {
      method: "POST",
      body: formData,
    }

    if (token) {
      options.headers = { Authorization: `Bearer ${token}` }
    }

    return fetch(`${API_URL}/api/upload-recording`, options).then((res) => {
      if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.detail || "Upload failed")))
      return res.json()
    })
  },

  getSessionMetrics: (sessionId: string) =>
    fetchApi<any>(`/api/metrics/sessions/${sessionId}`),

  getEnglishAuthLink: () =>
    fetchApi<{
      id: string
      token: string
      state: string
      placement: string | null
      placement_source: string | null
    }>("/api/english/auth-link", { method: "POST" }),

  getEnglishApplicantStatus: (applicantId: string) =>
    fetchApi<any>(`/api/english/admin/applicants/${applicantId}`),

  adminGetCommitteeGrid: () =>
    fetchApi<{ items: CommitteeGridRow[] }>("/api/admin/committee"),

  adminGetCommitteeContext: (sessionId: string) =>
    fetchApi<CommitteeContext>(`/api/admin/committee/${sessionId}`),

  adminDecideRatingEvent: (
    sessionId: string,
    eventId: string,
    payload: { status: "accepted" | "rejected"; band?: string; quote?: string }
  ) =>
    fetchApi<RatingEvent>(`/api/admin/sessions/${sessionId}/rating-events/${eventId}/decide`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
}

export type RatingIndicatorKey = "motivation_university" | "leadership" | "prior_experience"

export type RatingEvent = {
  id: string
  session_id: string
  indicator: string
  quote: string
  band: string
  rater_type: "model" | "human"
  rater_id: string | null
  status: "proposed" | "accepted" | "rejected"
  created_at: string
}

export type CommitteeIndicatorCell = {
  band: string
  status: "proposed" | "accepted" | "rejected"
  rater_type: "model" | "human"
} | null

export type CommitteeGridRow = {
  session_id: string
  user_id: string
  user_name: string | null
  program: string
  indicators: Record<RatingIndicatorKey, CommitteeIndicatorCell>
}

export type CommitteeContext = {
  session_id: string
  user_id: string
  user_name: string | null
  program: string
  transcript: { role: string; text: string }[] | null
  rating_events: Record<RatingIndicatorKey, RatingEvent[]>
}
