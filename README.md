# inVision University — AI-Powered Admissions Platform

> **inVision U by inDrive** — a university admissions platform with an AI voice interviewer, automated ML evaluation pipeline, and 4-tier admissions triage system.

---

## 🏁 Quick Start for Judges

### Live Deployment


|                 | URL                                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Frontend**    | [https://invision-frontend.livelymushroom-33a1a220.eastus.azurecontainerapps.io/](https://invision-frontend.livelymushroom-33a1a220.eastus.azurecontainerapps.io/)       |
| **Backend API** | [https://invision-backend.livelymushroom-33a1a220.eastus.azurecontainerapps.io/](https://invision-backend.livelymushroom-33a1a220.eastus.azurecontainerapps.io/)         |
| **API Docs**    | [https://invision-backend.livelymushroom-33a1a220.eastus.azurecontainerapps.io/docs](https://invision-backend.livelymushroom-33a1a220.eastus.azurecontainerapps.io/docs) |


> Open the **Frontend URL** — everything is live and connected. No local setup needed.

### Admin Credentials

```
Email:    admin@admin.admin
Password: Thcg5kEgkZR1URvtJZNUnC8PoceheUHJF
```

Login at `/signin` → redirected to admin dashboard automatically.

### Suggested review order

1. `**/admin**` — Applicant list with scores, recommendations, triage tiers
2. `**/admin/applicant/{id}**` → **Interview Answers** tab — AI-extracted Q&A from voice interview
3. Same page → **AI Evaluation** tab — score, recommendation, strengths/concerns
4. Same page → **Deep Analysis** tab — full ML profiling (IAF, Authenticity, Language, Triage)

To experience the full applicant flow: register a new account at `/signup` → go to `/apply`.

---

## Overview

inVision University replaces traditional admissions interviews with a real-time AI voice screening. After the interview, the system automatically:

- Transcribes the full conversation (both sides)
- Saves the AI interviewer's structured evaluation (score, recommendation, notes)
- Runs 8 ML analysis modules on the applicant's answers
- Prioritizes the admissions queue via a 4-tier triage system
- Stores a video recording of the session in AWS S3


| Role        | Access                                                                  |
| ----------- | ----------------------------------------------------------------------- |
| `applicant` | Fill form, complete AI interview, upload recording                      |
| `admin`     | View all applicants, full ML analysis, override decisions, triage queue |


---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                   │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌───────────┐   │
│  │  /apply  │  │ /apply/  │  │  /admin   │  │  /admin/  │   │
│  │  (form)  │  │interview │  │  (list)   │  │applicant/ │   │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘  └─────┬─────┘   │
└───────┼─────────────┼──────────────┼───────────────┼────────┘
        │ REST API    │ WebSocket    │ REST API      │ REST API
        ▼             ▼              ▼               ▼
┌─────────────────────────────────────────────────────────────┐
│                     BACKEND (FastAPI)                       │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ user_routes │  │   websocket  │  │   admin_routes     │  │
│  │session_route│  │   endpoint   │  │ validation_routes  │  │
│  └──────┬──────┘  └──────┬───────┘  └────────┬───────────┘  │
│         └────────────────┼────────────────────┘             │
│                          ▼                                  │
│  ┌─────────────┐  ┌────────────┐  ┌────────────────────┐    │
│  │  PostgreSQL │  │Google Live │  │     AWS S3         │    │
│  │  (AWS RDS)  │  │  Gemini AI │  │  (video storage)   │    │
│  └─────────────┘  └────────────┘  └────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Interview Lifecycle

```
1. Register / Login      → JWT token issued
2. Fill application form → form_data saved to DB
3. Start interview       → session created in DB
4. WebSocket connect     → Gemini Live session opens
5. Audio streaming       → Browser mic → WS → Gemini → audio response → browser speaker
6. Transcription         → Both sides transcribed in real time
7. Interview ends        → Gemini calls end_session() → score + notes saved to DB
8. Upload recording      → Video (webm) saved to AWS S3
9. Admin reviews         → Full ML analysis runs on demand
```

---

## Tech Stack


| Layer    | Technology                                                               |
| -------- | ------------------------------------------------------------------------ |
| Frontend | Next.js 16 (App Router), TypeScript, React 19, Tailwind CSS 4, shadcn/ui |
| Backend  | Python, FastAPI, Uvicorn, SQLModel + SQLAlchemy async                    |
| Database | PostgreSQL on AWS RDS (IAM auth)                                         |
| AI       | Google Gemini Live API v1alpha — `gemini-3.1-flash-live-preview`         |
| Storage  | AWS S3 (eu-west-1)                                                       |
| Auth     | JWT HS256, bcrypt passwords, 24h token expiry                            |


---

## Getting Started (local)

### Prerequisites

- Node.js 18+ and `pnpm`
- Python 3.10+
- Google Gemini API key

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

Frontend → `http://localhost:3000` · Backend → `http://localhost:8000` · API Docs → `http://localhost:8000/docs`

---

## AI Interview

The AI interviewer is powered by **Google Gemini Live API** — real-time bidirectional audio streaming over WebSocket.

### Two-phase structure

**Phase 0 — Warm-up (1 min)**

- Single question: *"What's one thing you're excited about right now?"*
- Personalizes Phase 1 with discovered context

**Phase 1 — Formal Presentation (5–6 min, 6 questions)**

1. Why are you applying to inVision U?
2. Which program and why?
3. A major challenge you overcame — what did you learn?
4. Long-term goals and how this program helps
5. What leadership means to you (with a specific example)
6. Does your family support your decision?

After Question 6: AI automatically calls `end_session()` with full structured evaluation — score, recommendation, per-question notes, strengths, concerns.

### Silence handling

- After 20s silence → check-in message sent
- After 2 missed check-ins → session auto-closed

---

## ML Analysis Pipeline

All 8 modules are **heuristic/rule-based** — zero external ML dependencies. Run on-demand via the admin panel.

### 1. Data Quality

Measures answer completeness (6/6 questions answered) + transcript richness (word count, turn count). Outputs `overall_score` 0–100.

### 2. Baseline Evaluation

Fully independent rule-based score — counts answered questions, answer length, strength indicator phrases. Used to cross-validate the AI's recommendation without involving AI.

### 3. AI vs Baseline Agreement

Compares AI recommendation against baseline. Results: `exact` / `adjacent` / `disagreement`. Strong disagreement triggers Tier 4 triage (manual review required).

### 4. Authenticity Analysis

Detects coached, scripted, or AI-generated responses:

- **Specificity**: counts personal details (years, names, places) vs generic phrases
- **Naturalness**: filler words, self-corrections, sentence variance — zero fillers = AI-like penalty
- **Cross-session similarity**: 5-gram overlap against all other sessions (>60% overlap = flag)

Risk levels: `low` / `medium` / `high`

### 5. Language Proficiency

Estimates CEFR level (A1–C2) and IELTS equivalent from transcript. Scores 5 dimensions: Grammar Accuracy, Vocabulary Richness, Fluency, Coherence, Listening Comprehension.

> *Heuristic estimate only — not a certified assessment. ±1 CEFR band accuracy.*

### 6. IAF Competency Score

**IAF = inVision Applicant Framework** — 7 dimensions scored 1–5, weighted by program:


| Dimension                 | Based on                      |
| ------------------------- | ----------------------------- |
| Motivation Depth          | Why applying, program choice  |
| Resilience                | Challenge question            |
| Vision Clarity            | Goals, program choice         |
| Collaborative Orientation | Leadership, goals             |
| Self Awareness            | Challenge, goals              |
| Authenticity              | All answers (specificity)     |
| Contribution Drive        | Goals, leadership, motivation |


Weights adjust per program (`computer_science` boosts Vision Clarity, `education` boosts Contribution Drive, etc.).

### 7. Explainability

Human-readable explanation of the AI's recommendation: narrative summary, positive/negative factors, feature importance per question (%), key quotes, confidence verdict.

### 8. Error & Edge Case Analysis

Detects contradictions between AI score and actual answers. Flags unusual patterns: very long transcripts (repetition), missing critical answers, score outliers.

### Triage Priority

Aggregates all signals into a 4-tier admissions queue:


| Tier | Label           | Est. review | When                                                                |
| ---- | --------------- | ----------- | ------------------------------------------------------------------- |
| 1    | Fast Track      | 5 min       | Strong score + quality + AI/baseline aligned + no anomalies         |
| 2    | Standard Review | 12 min      | Normal profile                                                      |
| 3    | Hold Queue      | 5 min       | `not_recommended` or low score                                      |
| 4    | Manual Required | 45 min      | High authenticity risk / inconsistencies / AI↔baseline disagreement |


### Fairness Module

Monitors bias: score variance across all sessions, program parity (avg score per program), language parity (avg score by interview language).

---

## Admin Panel — 6-Tab Applicant View


| Tab               | Content                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------- |
| Overview          | Personal info, session status, ML signals sidebar (IAF, authenticity risk, CEFR, triage tier) |
| Interview Answers | AI-extracted responses to all 6 questions + language/confidence/communication quality         |
| AI Evaluation     | Score (1–10), recommendation badge, strengths, concerns, overall impression                   |
| Recording         | Video player with presigned S3 URL + download                                                 |
| Transcript        | Full conversation log with timestamps                                                         |
| Deep Analysis     | All 8 ML modules rendered with charts and explanations                                        |


Admins can also **override** the AI decision (with justification) and **submit feedback** on AI accuracy.

---

## Future Roadmap

The platform is designed to be extended indefinitely. The architecture supports new ML modules, new AI behaviors, and new data sources without breaking anything existing.

### AI Detection & Anti-Cheating
- **AI-generated speech detection** — flag applicants reading from ChatGPT: near-perfect grammar, zero hesitation, unnatural sentence uniformity, no filler words at all
- **Text-reading detection** — gaze tracking via webcam (eye movement when reading vs speaking from memory), unnatural rhythm analysis
- **Voice stress analysis** — detect rehearsed vs spontaneous delivery using prosody and pitch variance

### Video & Visual Analysis
- **Facial expression analysis** — confidence, engagement, nervousness indicators across the interview timeline
- **Eye contact scoring** — how often the applicant looks at the camera vs reads off-screen notes
- **Body language signals** — posture, fidgeting, hand gestures as secondary confidence indicators
- **Lip sync verification** — confirm the voice matches the person on camera

### Deeper ML Analysis
- **Semantic consistency** — does the applicant's story stay coherent across all 6 answers, or do details contradict each other?
- **Answer evolution tracking** — did the applicant grow more confident as the interview progressed, or more nervous?
- **Domain vocabulary depth** — does the applicant use program-specific terminology correctly, or just drop buzzwords?
- **Multi-session comparison** — track improvement if applicants are allowed a second attempt

### AI Interviewer via Prompt Engineering
> **The prompt is the product.** By changing the system instruction alone — zero code changes — the interviewer becomes a completely different evaluator.

- **Dynamic follow-ups** — instead of a fixed 6-question script, the AI probes weak answers and expands on strong ones
- **Program-specific tracks** — dedicated question sets for CS, Medicine, Business, Education — each surfacing the competencies that matter most for that program
- **Deeper potential unlocking** — the AI can be instructed to gently challenge vague answers, push back on inconsistencies, encourage a nervous applicant, and guide them to articulate things they wouldn't say unprompted
- **Fully multilingual** — adaptive conversations in Kazakh, Russian, English, or any combination, with language-aware evaluation rubrics

### Platform Extensions
- **Applicant portal** — let applicants review their transcript and feedback after decisions
- **Cohort analytics** — year-over-year trends, program demand forecasting, diversity reports
- **University SIS integration** — push accepted applicants directly into enrollment systems
- **Multi-reviewer workflow** — committee assignments, comment threads, voting on borderline cases
                                                            


