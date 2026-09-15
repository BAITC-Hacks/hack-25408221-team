import { isTokenValid } from "./auth"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

const TOKEN_KEY = "accessToken"

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token || !isTokenValid(token)) return null
  
  return token
}

export function getStoredUser(): { userId: string; name: string } | null {
  if (typeof window === "undefined") return null
  
  const userStr = localStorage.getItem("user")
  if (!userStr) return null
  
  try {
    return JSON.parse(userStr)
  } catch {
    return null
  }
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

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Request failed" }))
    throw new Error(error.detail || "Request failed")
  }

  return response.json()
}

export async function fetchApiRaw(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken()
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  return fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  })
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
      credentials: "include",
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

  adminGetUsers: (page = 1, pageSize = 50) =>
    fetchApi<{ total: number; page: number; page_size: number; pages: number; items: any[] }>(
      `/api/admin/users?page=${page}&page_size=${pageSize}`
    ),
  adminGetSessions: (page = 1, pageSize = 50) =>
    fetchApi<{ total: number; page: number; page_size: number; pages: number; items: any[] }>(
      `/api/admin/sessions?page=${page}&page_size=${pageSize}`
    ),

  detectAI: (sessionId: string) =>
    fetchApi<{
      overall_score: number
      total_user_segments: number
      flagged_segments: {
        transcript_index: number
        text: string
        timestamp_start: number
        timestamp_end: number
        max_ai_score: number
        sentences: { sentence: string; ai_score: number }[]
      }[]
      error: string | null
    }>(`/api/sessions/${sessionId}/detect-ai`, { method: "POST" }),
}
