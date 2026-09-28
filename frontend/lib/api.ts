import { getStoredToken } from "./auth"

export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "")
  }
  if (typeof window !== "undefined") {
    // If running in browser and no explicit env var, use current origin
    return ""
  }
  return "http://127.0.0.1:8000"
}

export function getWsBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL.replace(/\/$/, "")
  }
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    return `${protocol}//${window.location.host}`
  }
  return "ws://127.0.0.1:8000"
}

export async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }

  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(`${getApiBaseUrl()}${endpoint}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    let errorDetail = "Request failed"
    try {
      const errJson = await res.json()
      errorDetail = errJson.detail || errJson.message || errorDetail
    } catch {
      // ignore
    }
    const err = new Error(errorDetail) as Error & { status?: number }
    err.status = res.status
    throw err
  }

  return res.json()
}

// Types for Interview, English Gate, and Admin
export interface ApiUser {
  id: string
  name: string
  email: string
  phone?: string
  role?: string
  created_at?: string
  session?: {
    id: string
    program: string
    status: string
    started_at?: string
    completed_at?: string
    created_at?: string
    recording_url?: string
    transcript?: { role: string; text: string; timestamp?: number }[]
    applicant_data?: Record<string, unknown>
    evaluation?: {
      overall_score?: number
      overall_impression?: string
      recommendation?: string
      strengths?: string[]
      concerns?: string[]
    }
  }
  has_recording?: boolean
}

export interface CommitteeIndicatorCell {
  band: "emerging" | "developing" | "strong"
  status: "proposed" | "accepted" | "rejected"
  rater_type: "model" | "human"
}

export interface CommitteeGridRow {
  session_id: string
  user_id: string
  user_name: string | null
  program: string
  indicators: {
    motivation_university: CommitteeIndicatorCell | null
    leadership: CommitteeIndicatorCell | null
    prior_experience: CommitteeIndicatorCell | null
  }
}

export interface RatingEvent {
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

export interface CommitteeContext {
  session_id: string
  user_id: string
  user_name: string | null
  program: string
  transcript: { role: string; text: string; timestamp?: number }[] | null
  rating_events: {
    motivation_university: RatingEvent[]
    leadership: RatingEvent[]
    prior_experience: RatingEvent[]
  }
}

export interface EnglishApplicantStatus {
  id: string
  full_name: string
  email: string
  state: string
  placement?: string | null
  placement_source?: string | null
  ielts?: {
    trf_number: string
    overall: number
    verdict: string
    module: string
    listening: number
    reading: number
    writing: number
    speaking: number
  } | null
  session?: {
    id: string
    levels?: Record<string, number>
    flags?: Record<string, boolean>
    placement?: string
    integrity_score?: number
    integrity_level?: "green" | "amber" | "red"
  } | null
  responses?: {
    id: string
    prompt: string
    item_id: string
    section: string
    answer: unknown
    media_path?: string
    correct?: boolean
    grade?: Record<string, unknown>
  }[]
  events?: {
    seq: number
    type: string
    section?: string
    ts_server: string
    data?: unknown
  }[]
  reviews?: {
    decision: string
    note: string
    reviewer: string
    created_at: string
  }[]
}

export const api = {
  // Auth
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

  // AI Interview Sessions
  createSession: (userId: string, program: string) =>
    fetchApi<{ sessionId: string; maxDurationSecs: number }>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ userId, program }),
    }),

  uploadRecording: async (sessionId: string, blob: Blob) => {
    const token = getStoredToken()
    const formData = new FormData()
    formData.append("sessionId", sessionId)
    formData.append("file", blob, `${sessionId}.webm`)

    const headers: Record<string, string> = {}
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    }

    const res = await fetch(`${getApiBaseUrl()}/api/upload-recording`, {
      method: "POST",
      headers,
      body: formData,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Upload failed" }))
      throw new Error(err.detail || "Upload failed")
    }
    return res.json() as Promise<{ ok: boolean; file: string; url: string }>
  },

  getRecordingUrl: (sessionId: string) => {
    const token = getStoredToken()
    return fetchApi<{ url: string }>(`/api/recording-url/${sessionId}${token ? `?token=${token}` : ""}`)
  },

  // English Placement Testing
  demoStart: () =>
    fetchApi<{ id: string; external_id: string; token: string; state: string }>(
      "/api/english/demo-start",
      { method: "POST" }
    ),

  getEnglishAuthLink: () =>
    fetchApi<{
      id: string
      token: string
      state: string
      placement: string | null
      placement_source: string | null
    }>("/api/english/auth-link", { method: "POST" }),

  getEnglishMe: (customToken?: string) =>
    fetchApi<{
      id: string
      external_id: string
      state: string
      placement: string | null
      placement_source: string | null
    }>("/api/english/me", {
      headers: customToken ? { Authorization: `Bearer ${customToken}` } : {},
    }),

  verifyIelts: (payload: {
    trf_number: string
    family_name: string
    date_of_birth: string
    test_date: string
    module: "academic" | "general"
    listening: number
    reading: number
    writing: number
    speaking: number
    overall: number
  }, customToken?: string) =>
    fetchApi<{
      id: string
      verdict: "VERIFIED" | "EXPIRED" | "NOT_VERIFIED" | "PENDING"
      reason?: string | null
      overall: number
    }>("/api/english/ielts", {
      method: "POST",
      headers: customToken ? { Authorization: `Bearer ${customToken}` } : {},
      body: JSON.stringify(payload),
    }),

  submitCertificate: async (
    payload: {
      cert_type: string
      score: string
      test_date?: string
      cert_number?: string
      pdf?: File | null
    },
    customToken?: string
  ) => {
    const token = customToken || getStoredToken()
    const formData = new FormData()
    formData.append("cert_type", payload.cert_type)
    formData.append("score", payload.score)
    if (payload.test_date) formData.append("test_date", payload.test_date)
    if (payload.cert_number) formData.append("cert_number", payload.cert_number)
    if (payload.pdf) formData.append("pdf", payload.pdf)

    const headers: Record<string, string> = {}
    if (token) headers["Authorization"] = `Bearer ${token}`

    const res = await fetch(`${getApiBaseUrl()}/api/english/certificate`, {
      method: "POST",
      headers,
      body: formData,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Certificate upload failed" }))
      throw new Error(err.detail || "Certificate upload failed")
    }
    return res.json() as Promise<{
      ok: boolean
      state: string
      placement: string
      pdf_path?: string
      cert_type: string
      score: string
    }>
  },

  skipEnglishTest: async (reason: string = "native_or_postponed", customToken?: string) => {
    const token = customToken || getStoredToken()
    const formData = new FormData()
    formData.append("reason", reason)
    const headers: Record<string, string> = {}
    if (token) headers["Authorization"] = `Bearer ${token}`

    const res = await fetch(`${getApiBaseUrl()}/api/english/skip`, {
      method: "POST",
      headers,
      body: formData,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Failed to skip test" }))
      throw new Error(err.detail || "Failed to skip test")
    }
    return res.json() as Promise<{ ok: boolean; state: string; placement: string }>
  },

  getCertificateFileUrl: (applicantId: string) => {
    return `${getApiBaseUrl()}/api/english/certificate/${applicantId}/file`
  },

  createEnglishSession: (customToken?: string) =>
    fetchApi<{ session_id: string; state: string }>("/api/english/sessions", {
      method: "POST",
      headers: customToken ? { Authorization: `Bearer ${customToken}` } : {},
    }),

  getCurrentEnglishSession: (customToken?: string) =>
    fetchApi<{ session_id: string; state: string } | null>(
      "/api/english/sessions/current",
      { headers: customToken ? { Authorization: `Bearer ${customToken}` } : {} }
    ),

  submitEnglishCheckin: (
    sessionId: string,
    gates: {
      browser_ok: boolean
      camera_mic_ok: boolean
      screen_share_monitor: boolean
      not_extended: boolean
      fullscreen: boolean
      single_face_confirmed: boolean
    },
    consent: boolean,
    customToken?: string
  ) =>
    fetchApi<{
      passed: boolean
      section?: string
      stage?: string
      items?: any[]
      deadline?: string
      missing?: string[]
    }>(`/api/english/sessions/${sessionId}/checkin`, {
      method: "POST",
      headers: customToken ? { Authorization: `Bearer ${customToken}` } : {},
      body: JSON.stringify({ gates, consent }),
    }),

  getEnglishSection: (sessionId: string, customToken?: string) =>
    fetchApi<{
      section: string
      stage: string
      items: any[]
      deadline?: string
      screen_token_seed?: string
    }>(`/api/english/sessions/${sessionId}/section`, {
      headers: customToken ? { Authorization: `Bearer ${customToken}` } : {},
    }),

  submitEnglishAnswers: (
    sessionId: string,
    answers: { item_id: string; answer: unknown }[],
    customToken?: string
  ) =>
    fetchApi<{
      section_complete: boolean
      next_section?: string
      stage?: string
      items?: any[]
      deadline?: string
    }>(`/api/english/sessions/${sessionId}/answers`, {
      method: "POST",
      headers: customToken ? { Authorization: `Bearer ${customToken}` } : {},
      body: JSON.stringify({ answers }),
    }),

  uploadSpeakingMedia: async (
    sessionId: string,
    itemId: string,
    audioBlob: Blob,
    customToken?: string
  ) => {
    const token = customToken || getStoredToken()
    const formData = new FormData()
    formData.append("kind", "speaking")
    formData.append("item_id", itemId)
    const ext = audioBlob.type.includes("mp4")
      ? "mp4"
      : audioBlob.type.includes("ogg")
      ? "ogg"
      : "webm"
    formData.append("file", audioBlob, `${itemId}.${ext}`)
    formData.append("audio", audioBlob, `${itemId}.${ext}`)

    const headers: Record<string, string> = {}
    if (token) headers["Authorization"] = `Bearer ${token}`

    const res = await fetch(`${getApiBaseUrl()}/api/english/sessions/${sessionId}/media`, {
      method: "POST",
      headers,
      body: formData,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Media upload failed" }))
      throw new Error(err.detail || "Media upload failed")
    }
    return res.json() as Promise<{ section_complete: boolean; next_section?: string; stage?: string; items?: any[] }>
  },

  postProctorEvents: (
    sessionId: string,
    events: { seq: number; type: string; section?: string | null; ts_client: string; data?: unknown }[],
    customToken?: string
  ) =>
    fetchApi<{ received: number; last_seq: number }>(`/api/english/sessions/${sessionId}/events`, {
      method: "POST",
      headers: customToken ? { Authorization: `Bearer ${customToken}` } : {},
      body: JSON.stringify({ events }),
    }),

  sendEnglishProctorEvents: (
    sessionId: string,
    events: { seq: number; type: string; section?: string | null; ts_client: string; data?: unknown }[],
    customToken?: string
  ) =>
    fetchApi<{ received: number; last_seq: number }>(`/api/english/sessions/${sessionId}/events`, {
      method: "POST",
      headers: customToken ? { Authorization: `Bearer ${customToken}` } : {},
      body: JSON.stringify({ events }),
    }),

  expireEnglishSection: (
    sessionId: string,
    section: string | null,
    customToken?: string
  ) =>
    fetchApi<{
      section_complete: boolean
      next_section?: string | null
      stage?: string
      items?: any[]
      deadline?: string
      state?: string
    }>(`/api/english/sessions/${sessionId}/expire`, {
      method: "POST",
      headers: customToken ? { Authorization: `Bearer ${customToken}` } : {},
      body: JSON.stringify({ section }),
    }),

  getEnglishSpeakingAudioUrl: (responseId: string) => {
    return `${getApiBaseUrl()}/api/english/admin/responses/${responseId}/audio`
  },

  getEnglishMediaUrl: (path: string) => {
    if (!path) return ""
    if (path.startsWith("http")) return path
    const cleanPath = path.startsWith("/") ? path.slice(1) : path
    return `${getApiBaseUrl()}/api/english/media/${cleanPath}`
  },

  finishEnglishSession: (sessionId: string, customToken?: string) =>
    fetchApi<{ state: string; placement?: string | null }>(
      `/api/english/sessions/${sessionId}/finish`,
      {
        method: "POST",
        headers: customToken ? { Authorization: `Bearer ${customToken}` } : {},
      }
    ),

  // Admin Panel
  getAdminUsers: () => fetchApi<ApiUser[]>("/api/users"),
  getAdminUser: (id: string) => fetchApi<ApiUser>(`/api/admin/users/${id}`),

  getCommitteeGrid: () =>
    fetchApi<{ items: CommitteeGridRow[] }>("/api/admin/committee"),

  getCommitteeContext: (sessionId: string) =>
    fetchApi<CommitteeContext>(`/api/admin/committee/${sessionId}`),

  createRatingEvent: (
    sessionId: string,
    payload: {
      indicator: string
      band: string
      quote: string
      status?: "proposed" | "accepted"
    }
  ) =>
    fetchApi<RatingEvent>(`/api/admin/sessions/${sessionId}/rating-events`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  decideRatingEvent: (
    sessionId: string,
    eventId: string,
    payload: { status: "accepted" | "rejected"; band?: string; quote?: string }
  ) =>
    fetchApi<RatingEvent>(
      `/api/admin/sessions/${sessionId}/rating-events/${eventId}/decide`,
      { method: "POST", body: JSON.stringify(payload) }
    ),

  getEnglishAdminApplicant: (applicantId: string) =>
    fetchApi<EnglishApplicantStatus>(`/api/english/admin/applicants/${applicantId}`),

  getEnglishAdminQueue: () =>
    fetchApi<{
      sessions: { id: string; applicant_id: string; levels: any; placement: string; integrity_level: string; flags: any }[]
      ielts_checks: { id: string; applicant_id: string; trf_number: string; checked_at: string }[]
    }>("/api/english/admin/queue"),

  submitEnglishDecision: (
    sessionId: string,
    placement: "BACHELOR" | "FOUNDATION",
    notes: string
  ) =>
    fetchApi<{ ok: boolean }>(`/api/english/admin/sessions/${sessionId}/decision`, {
      method: "POST",
      body: JSON.stringify({ placement, notes }),
    }),
}
