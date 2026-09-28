import {
  MeOut,
  IeltsCheckOut,
  CheckinResult,
  Gates,
  AnswersResult,
  FinishResult,
  ProctorEvent,
  Dashboard,
  CandidateDetail,
} from "../types"
import { englishRequest, getDefaultApiUrl, setLocalToken } from "./client"

export async function startDemoApplicant(): Promise<{ id: string; token: string }> {
  const res = await englishRequest<{ id: string; token: string }>("/demo-start", {
    method: "POST",
  })
  setLocalToken(res.token)
  return res
}

export async function getMe(token?: string): Promise<MeOut> {
  return englishRequest<MeOut>("/me", { method: "GET", tokenOverride: token })
}

export async function submitIelts(
  body: {
    trf_number: string
    family_name: string
    date_of_birth: string
    test_date: string
    module: string
    listening: number
    reading: number
    writing: number
    speaking: number
    overall: number
  },
  token?: string
): Promise<IeltsCheckOut> {
  return englishRequest<IeltsCheckOut>("/ielts", {
    method: "POST",
    body: JSON.stringify(body),
    tokenOverride: token,
  })
}

export async function getCurrentSession(
  token?: string
): Promise<{ session_id: string; state: string } | null> {
  return englishRequest<{ session_id: string; state: string } | null>(
    "/sessions/current",
    { method: "GET", tokenOverride: token }
  )
}

export async function createSession(
  token?: string
): Promise<{ session_id: string; state: string }> {
  return englishRequest<{ session_id: string; state: string }>("/sessions", {
    method: "POST",
    tokenOverride: token,
  })
}

export async function submitCheckin(
  sessionId: string,
  gates: Gates,
  token?: string
): Promise<CheckinResult> {
  return englishRequest<CheckinResult>(`/sessions/${sessionId}/checkin`, {
    method: "POST",
    body: JSON.stringify({ gates, consent: true }),
    tokenOverride: token,
  })
}

export async function submitAnswers(
  sessionId: string,
  answers: { item_id: string; answer: unknown }[],
  token?: string
): Promise<AnswersResult> {
  return englishRequest<AnswersResult>(`/sessions/${sessionId}/answers`, {
    method: "POST",
    body: JSON.stringify({ answers }),
    tokenOverride: token,
  })
}

export async function uploadSpeakingAudio(
  sessionId: string,
  itemId: string,
  audioBlob: Blob,
  token?: string
): Promise<void> {
  const form = new FormData()
  form.append("item_id", itemId)
  form.append("audio", audioBlob, `${itemId}.webm`)
  return englishRequest<void>(`/sessions/${sessionId}/media`, {
    method: "POST",
    body: form,
    tokenOverride: token,
  })
}

export async function pollSpeakingFollowup(
  sessionId: string,
  token?: string
): Promise<any> {
  return englishRequest<any>(`/sessions/${sessionId}/followup`, {
    method: "GET",
    tokenOverride: token,
  })
}

export async function sendProctorEvents(
  sessionId: string,
  events: ProctorEvent[],
  token?: string
): Promise<void> {
  return englishRequest<void>(`/sessions/${sessionId}/events`, {
    method: "POST",
    body: JSON.stringify({ events }),
    tokenOverride: token,
  })
}

export async function finishSession(
  sessionId: string,
  token?: string
): Promise<FinishResult> {
  return englishRequest<FinishResult>(`/sessions/${sessionId}/finish`, {
    method: "POST",
    tokenOverride: token,
  })
}

export function getMediaUrl(path: string, baseUrl: string = getDefaultApiUrl()): string {
  if (!path) return ""
  if (path.startsWith("http")) return path
  const normalized = path.replace(/^\/+/, "")
  return `${baseUrl}/media/${normalized}`
}

export async function adminLogin(password: string): Promise<{ access_token: string }> {
  return englishRequest<{ access_token: string }>("/admin/login", {
    method: "POST",
    body: JSON.stringify({ password }),
    asAdmin: true,
  })
}

export async function adminGetDashboard(): Promise<Dashboard> {
  return englishRequest<Dashboard>("/admin/dashboard", { method: "GET", asAdmin: true })
}

export async function adminGetCandidateDetail(applicantId: string): Promise<CandidateDetail> {
  return englishRequest<CandidateDetail>(`/admin/applicants/${applicantId}`, {
    method: "GET",
    asAdmin: true,
  })
}

export async function adminSubmitDecision(
  sessionId: string,
  decision: { placement: "BACHELOR" | "FOUNDATION"; notes?: string }
): Promise<void> {
  return englishRequest<void>(`/admin/sessions/${sessionId}/decision`, {
    method: "POST",
    body: JSON.stringify(decision),
    asAdmin: true,
  })
}
