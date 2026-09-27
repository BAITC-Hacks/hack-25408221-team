export type ApplicantState =
  | "new"
  | "ielts_pending"
  | "needs_test"
  | "testing"
  | "placed"
  | "needs_review"

export interface MeOut {
  id: string
  external_id: string
  state: ApplicantState
  placement: "BACHELOR" | "FOUNDATION" | null
  placement_source: "ielts" | "test" | "human" | null
}

export interface IeltsCheckOut {
  id: string
  verdict: "VERIFIED" | "EXPIRED" | "NOT_VERIFIED" | "PENDING"
  reason: string | null
  overall: number
}

export interface ClientQuestion {
  id: string
  type?: "mcq" | "gap" | "tfng"
  prompt?: string
  options?: string[]
}

export interface ClientItem {
  id: string
  type: string
  cefr: number
  // listening/reading passage
  audio?: string
  duration_s?: number
  text?: string
  questions?: ClientQuestion[]
  // ctest
  segments?: (string | { gap: true })[]
  // writing/speaking
  prompt?: string
  image?: string | null
  kind?: string
  prep_s?: number
  answer_s?: number
}

export interface SectionOut {
  section: string
  stage: string
  items: ClientItem[]
  deadline?: string
  screen_token_seed?: string
}

export interface Gates {
  browser_ok: boolean
  camera_mic_ok: boolean
  screen_share_monitor: boolean
  not_extended: boolean
  fullscreen: boolean
  single_face_confirmed: boolean
}

export interface CheckinResult {
  passed: boolean
  missing?: string[]
  section?: string
  stage?: string
  items?: ClientItem[]
  deadline?: string
}

export interface AnswersResult {
  section_complete: boolean
  stage?: string
  items?: ClientItem[]
  next_section?: string | null
  deadline?: string
  state?: string
}

export interface FinishResult {
  state: string
  placement: "BACHELOR" | "FOUNDATION" | null
}

export type Screens = EventTarget & { screens: unknown[] }

export type ProctorResources = {
  camera: MediaStream
  screen: MediaStream
  displays: Screens
}

export interface ProctorEvent {
  seq: number
  type: string
  section: string | null
  ts_client: string
  data: Record<string, unknown>
}

export interface FaceCheckResult {
  ok: boolean
  reason?: "no_face" | "multiple_faces" | "camera_denied" | "detector_failed"
  detail?: string
}

export interface Candidate {
  id: string
  full_name: string
  email: string
  state: string
  session_id: string | null
  levels: Record<string, number | null>
  flags: Record<string, string[]>
  placement: string | null
  recommendation: string | null
  source: string | null
  integrity: string | null
  ielts: { verdict: string; overall: number; reason: string | null } | null
}

export interface Dashboard {
  applicants: Candidate[]
  metrics: Record<string, number>
  services: {
    ielts: string
    asr: string
    llm_configured: boolean
    auto_placement: boolean
    lockdown_required: boolean
  }
}

export interface CandidateDetail {
  id: string
  full_name: string
  email: string
  state: string
  levels: Record<string, number | null>
  flags: Record<string, string[]>
  placement: string | null
  integrity_level: string | null
  responses: {
    id: string
    item_id: string
    section: string
    prompt: string
    answer: { value?: unknown }
    media_path: string | null
    grade: {
      rationale?: string[]
      criteria?: Record<string, { median: number; evidence: string[] }>
      per_task?: Record<
        string,
        {
          transcript: string
          word_count: number
          speech_rate_wpm: number
          pause_ratio: number
        }
      >
      correct_count?: number
      total?: number
    }
  }[]
}

export const CEFR_LABELS: Record<number, string> = {
  0: "Pre-A1",
  1: "A1",
  2: "A2",
  3: "B1",
  4: "B2",
  5: "C1",
  6: "C2",
}
