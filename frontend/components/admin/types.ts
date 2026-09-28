export type TranscriptEntry = {
  role: "user" | "assistant"
  text: string
  timestamp: string
}

export type ApplicantData = {
  q1_why_applying: string
  q2_program_choice: string
  q3_challenge_overcome: string
  q4_long_term_goals: string
  q5_leadership: string
  q6_family_support: string
  language_used: string
  confidence_level: string
  communication_quality: string
}

export type Evaluation = {
  overall_score?: number
  overall_impression?: string
  strengths: string[]
  areas_for_improvement?: string[]
  concerns?: string[]
  recommendation: "strongly_recommended" | "recommended" | "needs_review" | "not_recommended" | "pending"
  notes?: string
}

export type Session = {
  id: string
  user_id: string
  program: string
  recording_url: string | null
  transcript: TranscriptEntry[] | null
  applicant_data: ApplicantData | null
  evaluation: Evaluation | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export type ApiUser = {
  id: string
  name: string
  email: string
  phone: string
  has_recording: boolean
  session: Session | null
}

export const TIER_LABELS: Record<number, string> = {
  1: "Fast Track",
  2: "Standard Review",
  3: "Hold Queue",
  4: "Manual Required",
}

export const TIER_COLORS: Record<number, string> = {
  1: "bg-green-100 text-green-800",
  2: "bg-blue-100 text-blue-800",
  3: "bg-yellow-100 text-yellow-800",
  4: "bg-red-100 text-red-800",
}

export const CEFR_COLORS: Record<string, string> = {
  A1: "bg-red-100 text-red-800",
  A2: "bg-orange-100 text-orange-800",
  B1: "bg-yellow-100 text-yellow-800",
  B2: "bg-blue-100 text-blue-800",
  C1: "bg-green-100 text-green-800",
  C2: "bg-purple-100 text-purple-800",
}

export const QUESTION_LABELS: Record<string, string> = {
  q1_why_applying: "Why are you applying to inVision U?",
  q2_program_choice: "Which program are you applying to, and why?",
  q3_challenge_overcome: "Tell me about a major challenge you overcame.",
  q4_long_term_goals: "What are your long-term goals?",
  q5_leadership: "What does leadership mean to you?",
  q6_family_support: "Does your family support your decision?",
}
