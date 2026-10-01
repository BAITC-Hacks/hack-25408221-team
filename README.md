# inVision University — казачи капай (hack-25408221-team)

[English](README.md) | [Русский](README.ru.md)

> **inVision U by inDrive** — a GovTech Camp hackathon project built on top of the existing inVision U admissions platform. The platform's original flow has applicants self-record video answers that the committee reviews manually. During the hackathon we turned that step into a live **AI voice agent interview** and added an **IELTS / CEFR English placement test** that decides where each candidate goes next — **foundation prep or direct admission**.

---

## 🌐 Live Deployment & Credentials

| Service | Live URL |
| :--- | :--- |
| **Frontend Portal** | [https://kazachi-kapai.govtech-kz.com/](https://kazachi-kapai.govtech-kz.com/) |
| **English Placement Gateway** | [https://kazachi-kapai.govtech-kz.com/english](https://kazachi-kapai.govtech-kz.com/english) |
| **API Documentation** | [https://kazachi-kapai.govtech-kz.com/docs](https://kazachi-kapai.govtech-kz.com/docs) |

### Admin Credentials

```
Email:    admin@admin.admin
Password: Thcg5kEgkZR1URvtJZNUnC8PoceheUHJF
```

Login at `/signin` → automatically redirected to the admissions committee dashboard.

---

## 🎯 The Challenge (Задача)

inVision U already runs an admissions platform: applicants **record video answers** and the committee **reviews every recording manually**. That step doesn't scale — it takes hours per applicant, attention drifts across long queues, and English level is only discovered after a human already spent time on the file.

**What we added during the hackathon:**

1. **An AI voice agent at the recording step** — instead of a one-way recording, the applicant talks with an empathetic AI interviewer in real time. It runs a structured 6-question flow, probes vague answers ("water") with the ATOLA framework, transcribes everything, and hands the committee a quote-backed evaluation (9-competency BARS).
2. **An IELTS / CEFR English placement step with AI proctoring** — a quick verified test that shows where to move the candidate next: **foundation (prep) year or direct admission**.
3. **Committee tooling around it** — triage queue, deep analysis, and candidate comparison so reviewers spend minutes, not hours.

---

## 🚀 What We Added (Что добавили)

Built on top of the existing inVision U platform (registration, application form, and the original record-and-review flow already existed):

- **AI Voice Interviewer (replaces the manual review step):** Bidirectional low-latency audio streaming over WebSocket powered by Google Gemini Live API (`gemini-3.1-flash-live-preview`), with automated silence check-ins and turn-complete boundary detection.
- **ATOLA Probing & "Water" Detection:** Dynamic AI follow-up questioning targeting Action, Thinking, Outcome, Learnings, Application — filtering rehearsed or cliché responses in real time.
- **CEFR/IELTS English Gate (new step):** Self-contained English assessment testing grammar, vocabulary, writing, and speaking with browser-based AI proctoring (gaze, face detection, tab-switching prevention) — decides foundation prep vs. direct admission.
- **ML Evaluation Pipeline:** 8 rule-based heuristic modules running with zero heavy ML dependencies (IAF competency scoring, authenticity analysis, baseline agreement, language estimation).
- **9-Competency BARS Evaluation:** Behavioral Anchor Rating Scale evaluating motivation, leadership, resilience, intellectual agility, and collaboration with verifiable transcript quotes.
- **Admissions Admin Workspace:** Comprehensive committee dashboard featuring candidate cards, side-by-side candidate comparison (`/admin/compare`), Candidate Chat history, video recording replay, and 4-tier triage queues.
- **Production-Ready Infrastructure:** Containerized with Docker Compose, Traefik reverse proxy, automated Let's Encrypt SSL via `nip.io`, and dual-mode S3 storage.

---

## 👥 Team & Weekly Timeline (Кто что делал по неделям)

### Core Team & Roles
- **Aibar Berekeyev:** AI & interview pipeline optimization, backend hardening, security, and scoring models.
- **Ossein:** Frontend architecture, UI/UX engineering, and project management.
- **Arsen:** IELTS / CEFR English gateway integration & talent potential growth research.

---

### Weekly Breakdown

#### Week 1 (Sep 15 – Sep 21): Foundation, Security & Pipeline Hardening
- **Aibar:**
  - Built the backend testing safety net (166+ test suite with Gemini Live fakes).
  - Fixed baseline Alembic migration defects to ensure clean schema initialization.
  - Implemented core security hardening: patched IDOR on recordings, path traversal on upload endpoints, and added session creation rate limiting.
  - Hardened the live WebSocket audio pipeline (barge-in flush, silence monitor, auto-reconnect handling).
  - Designed `ScorerInterface`, `RatingEventTable`, and decision-persistence models.
- **Ossein:**
  - Extended the existing Next.js frontend with audio capture hooks and new interview/admissions flow views.
  - Prepared containerization configuration and began the VPS migration strategy.
- **Arsen:**
  - Researched admissions rubrics, candidate talent assessment criteria, and initial English placement test requirements.

#### Week 2 (Sep 22 – Sep 28): English Gate, Deployment & Integrations
- **Arsen:**
  - Implemented the CEFR/IELTS English testing engine, proctoring rules, and objective grading logic.
  - Formulated candidate evaluation rubrics based on language fluency and response depth.
- **Ossein:**
  - Consolidated the frontend into a unified portal integrating both the English Gate and AI Interview.
  - Configured automated GitHub Actions CI/CD for zero-downtime VPS deployment.
  - Set up production Traefik reverse proxy with Let's Encrypt wildcard SSL via `nip.io`.
- **Aibar:**
  - Created committee review endpoints, decision persistence, and idempotent seed scripts for demo applicants (Ada Lovelace, Grace Hopper, Alan Turing).
  - Firewalled demographic and communication bias signals out of decision-adjacent aggregators.

#### Week 3 (Sep 29 – Present): ATOLA Probing, Candidate Analytics & Polish
- **Aibar:**
  - Designed and implemented live agent tools (`start_question`, `log_followup`, `flag_distress`).
  - Built the ATOLA evaluation use cases and 9-competency BARS scoring engine.
  - Added candidate chat history tracking and distress flag logging.
- **Ossein:**
  - Developed the applicant comparison page (`/admin/compare`), competency radar/bar charts, question card views, and Candidate Chat drawer.
  - Optimized build outputs and trimmed the frontend bundle specifically for integration readiness.
- **Arsen:**
  - Refined rubrics for evaluating candidate growth potential and soft skills under the ATOLA framework.

---

## ⚡ Current Status (Что работает сейчас)

- **Live Deployment:** Operational at [https://kazachi-kapai.govtech-kz.com/](https://kazachi-kapai.govtech-kz.com/). *Note: depending on upstream VPS proxy routing, occasional transient latency or timeouts may occur.*
- **Infrastructure Adaptation:** We initially prepared deployment configs for AWS RDS/S3 and Azure; when adjusting to the provided VPS environment and S3 storage, we smoothly migrated the entire stack to a self-hosted PostgreSQL 16 container, local S3-compatible storage (with MinIO support), and Traefik SSL. We are very grateful to the organizers for providing the VPS and storage infrastructure.
- **Frontend Integration Readiness:** The frontend has been intentionally trimmed and modularized so it can easily integrate into larger university Student Information Systems (SIS).
- **Original Flow Preserved:** The platform's classic "record a video → committee reviews manually" path still works — our AI interview and English placement steps are additive, so the committee can choose either review mode per candidate.
- **End-to-End Working Flows:**
  1. Candidate registration (`/signup`) and sign-in (`/signin`).
  2. English placement test with proctoring (`/english`).
  3. Real-time AI voice interview with live transcript streaming and audio capture (`/apply/interview`).
  4. Video recording upload and S3 persistence.
  5. Committee review dashboard (`/admin`), candidate deep dive (`/admin/applicant/[id]`), candidate comparison (`/admin/compare`), and manual review overrides.

---

## 🏁 Quick Start (Local Development)

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ & `pnpm` (for local frontend dev)
- Python 3.10+ (for backend dev)
- Google Gemini API key

### Running with Docker Compose

1. **Configure Backend Environment:**
   ```bash
   cp backend/.env.example backend/.env
   ```
   Open `backend/.env` and supply:
   - `GEMINI_API_KEY`: Your Google Gemini API Key
   - `JWT_SECRET`: A secure secret (e.g. `openssl rand -hex 32`)

2. **Start Backend & Database:**
   ```bash
   docker compose up -d --build
   ```

3. **Start Frontend:**
   ```bash
   cd frontend
   pnpm install
   pnpm dev
   ```

4. **Access the Services:**
   - **Frontend:** [http://localhost:3000](http://localhost:3000)
   - **Backend API & Swagger Docs:** [http://localhost:8001/docs](http://localhost:8001/docs)

---

## 🏗️ Architecture

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
│  │  PostgreSQL │  │Google Live │  │     S3 Storage     │    │
│  │             │  │  Gemini AI │  │  (video storage)   │    │
│  └─────────────┘  └────────────┘  └────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Interview Lifecycle

1. **Register / Login** → JWT token issued.
2. **English Gate (Optional/Mandatory)** → CEFR/IELTS placement assessment with browser proctoring.
3. **Fill Application Form** → candidate data saved in PostgreSQL.
4. **Start Interview Session** → session initialized, mic & camera initialized.
5. **WebSocket Streaming** → bidirectional PCM audio streaming via Gemini Live API.
6. **ATOLA Probing** → AI agent identifies superficial answers and asks targeted follow-ups.
7. **Session Completion** → Gemini calls `end_session()` → structured notes and timestamps saved.
8. **Upload Recording** → WebM video recording uploaded to S3 storage.
9. **Committee Review** → AI evaluation, 9-competency BARS scoring, and triage tier assigned.

---

## 🧠 ML Analysis Pipeline

All 8 heuristic modules run with zero heavy external ML dependencies:

1. **Data Quality:** Measures completeness (6/6 questions answered) + transcript richness (word and turn count).
2. **Baseline Evaluation:** Fully independent rule-based scoring counting answered questions, length, and strength indicator phrases.
3. **AI vs. Baseline Agreement:** Compares AI recommendation against baseline (`exact`, `adjacent`, `disagreement`). Disagreements trigger Tier 4 triage.
4. **Authenticity Analysis:** Detects scripted, coached, or AI-generated answers via specificity ratios, naturalness/filler word balance, and cross-session n-gram overlap.
5. **Language Proficiency:** Estimates CEFR level (A1–C2) and IELTS equivalent across Grammar Accuracy, Vocabulary, Fluency, Coherence, and Listening.
6. **IAF Competency Score:** 7 dimensions weighted by academic program (Motivation, Resilience, Vision, Collaboration, Self-Awareness, Authenticity, Contribution).
7. **Explainability Module:** Human-readable explanation of recommendations: narrative summary, positive/negative drivers, question importance weights, and key quotes.
8. **Error & Edge-Case Detection:** Flags contradictions between scores and transcripts, extreme outliers, or unprobed critical questions.

### 4-Tier Admissions Triage Queue

| Tier | Label | Review Time | Criteria |
| :--- | :--- | :--- | :--- |
| **1** | **Fast Track** | ~5 min | High scores, strong data quality, high AI-baseline alignment, no anomalies. |
| **2** | **Standard Review** | ~12 min | Consistent profile with balanced scores. |
| **3** | **Hold Queue** | ~5 min | `not_recommended` verdict or low competency scores. |
| **4** | **Manual Required** | ~45 min | High authenticity risk, contradictions, or AI↔baseline disagreement. |

---

## 🖥️ Admissions Admin Panel

- **Candidate Table:** Filterable by status, program, triage tier, and recommendation.
- **Applicant Deep Dive:**
  - *Overview:* Candidate info, triage tier, key metrics.
  - *Interview Answers:* Extracted Q&A with ATOLA coverage indicators.
  - *AI Evaluation:* Overall score (1–10), strengths, concerns, and committee recommendation.
  - *Recording Replay:* Synchronized video and transcript playback.
  - *Deep Analysis:* Full breakdown of all 8 ML analysis modules.
- **Candidate Comparison (`/admin/compare`):** Side-by-side radar and bar chart comparison of candidate competencies.
- **Committee Actions:** Durable decision overrides with justification and audit trails.

---

## 🔮 Roadmap

- **Anti-Cheating & AI Detection:** Webcam eye-gaze tracking, prosodic voice stress analysis, and speech spontaneity detection.
- **Visual & Body Language Signals:** Head pose estimation, facial engagement markers, and lip-sync audio verification.
- **Multi-Reviewer Workflow:** Double-blind scoring, committee voting, and threaded applicant notes.
- **Direct SIS Integration:** Automated enrollment handoff to university Student Information Systems.
