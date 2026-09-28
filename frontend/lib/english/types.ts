export type ApplicantState =
  | "new"
  | "ielts_pending"
  | "needs_test"
  | "testing"
  | "placed"
  | "needs_review";

export interface MeOut {
  id: string;
  external_id: string;
  state: ApplicantState;
  placement: "BACHELOR" | "FOUNDATION" | null;
  placement_source: "ielts" | "test" | "human" | string | null;
}

export interface IeltsCheckOut {
  id: string;
  verdict: "VERIFIED" | "EXPIRED" | "NOT_VERIFIED" | "PENDING";
  reason?: string | null;
  overall: number;
}

export interface ClientQuestion {
  id: string;
  type?: "mcq" | "gap" | "tfng";
  prompt?: string;
  options?: string[];
}

export interface ClientItem {
  id: string;
  type: string;
  cefr?: number;
  // listening/reading passage
  audio?: string;
  media_path?: string;
  duration_s?: number;
  text?: string;
  questions?: ClientQuestion[];
  // ctest
  segments?: (string | { gap: true })[];
  // writing/speaking
  prompt?: string;
  image?: string | null;
  kind?: string;
  min_words?: number;
  max_words?: number;
  prep_s?: number;
  prep_seconds?: number;
  answer_s?: number;
  speak_seconds?: number;
}

export interface SectionOut {
  section: string;
  stage: string;
  items: ClientItem[];
  deadline?: string;
  screen_token_seed?: string;
}

export interface CheckinResult {
  passed: boolean;
  missing?: string[];
  section?: string;
  stage?: string;
  items?: ClientItem[];
  deadline?: string;
}

export interface AnswersResult {
  section_complete: boolean;
  stage?: string;
  items?: ClientItem[];
  next_section?: string | null;
  deadline?: string;
  state?: string;
}

export interface FinishResult {
  state: string;
  placement: "BACHELOR" | "FOUNDATION" | null;
}

export interface SessionDetail {
  id: string;
  applicant_id: string;
  levels: Record<string, number>;
  flags: Record<string, string[]>;
  placement: string | null;
  integrity_score: number;
  integrity_level: string | null;
  responses: Array<{
    item_id: string;
    section: string;
    answer: Record<string, unknown>;
    media_path: string | null;
    correct: boolean | null;
    grade: Record<string, unknown>;
  }>;
  events: Array<{
    seq: number;
    type: string;
    section: string | null;
    ts_server: string;
    data: Record<string, unknown>;
  }>;
}

export const CEFR_LABELS: Record<number, string> = {
  1: "A1",
  2: "A2",
  3: "B1",
  4: "B2",
  5: "C1",
  6: "C2",
};
