# Product Owner Call Prep: invision-U Platform Status & Roadmap

This document summarizes our successful migration from AWS and Azure to Hetzner VPS with Coolify, and provides a structured guide for your 15-minute call with the Product Owner (PO) to align on upcoming feature requests.

---

## 🛠️ Part 1: What We Have Done (Achievements)

We have successfully completed a fully open-source migration of the inVision University admissions platform to Hetzner Cloud. Everything is live and accessible.

### 1. Zero-Cost Wildcard SSL Infrastructure (IP-Only Domain)
*   **The Problem:** Normies need standard SSL (`https://` and `wss://`) because modern browsers block microphone/camera permissions on unsecured `http://` sites (except `localhost`). Buying/pointing a custom domain takes time and money.
*   **Our Solution:** Configured a wildcard DNS fallback using `nip.io`. Your Hetzner VPS (`2.29.37.96`) now serves securely on:
    *   **Frontend:** `https://invision.2.29.37.96.nip.io`
    *   **Backend API Docs:** `https://invision-api.2.29.37.96.nip.io/docs`
*   **No Warning Padlock:** Fully valid Let's Encrypt SSL certificates automatically requested, verified (via HTTP-01 challenge), and renewed by the host proxy.

### 2. Coolify & Traefik Integration (Co-existence)
*   Provisioned your Hetzner `hel1` CX22 server over plain, secure SSH.
*   Started Coolify on port `8000` (`http://2.29.37.96:8000/`) and integrated our deployment directly with Coolify's built-in Traefik reverse proxy (`coolify-proxy`).
*   Joined our backend and frontend services into the external `coolify` Docker network, mapping ports and routing labels dynamically. No port numbers are needed in the public URLs!

### 3. Open-Source Self-Hosted Data Stack
*   **Database:** Replaced AWS RDS with a secure, self-hosted PostgreSQL 16 container (`postgres:16-alpine`), complete with a stateful storage volume (`pgdata`) and health check hooks. Disabled AWS IAM authentication seamlessly (`DB_USE_IAM_AUTH=false`).
*   **Dual-Stack Networking Fix:** Discovered and fixed a container binding issue where `uvicorn` on `0.0.0.0` blocked Traefik's IPv6-preferred routing. Reconfigured the FastAPI server to bind dual-stack (`::`), immediately resolving all `504 Gateway Timeout` errors.
*   **Storage Fallback:** Configured S3 local fallback volumes (`uploads/`) to store interview webm recordings locally on the NVMe SSD at no cost. Also included MinIO integration (`--profile minio`) so S3 compatibility is ready to turn on instantly with a single environment variable change.

### 4. Seeded Committee Grid
*   Successfully ran the idempotent seed script to populate the Postgres database with demo applicants:
    *   **Ada Lovelace** (Computer Science)
    *   **Grace Hopper** (Applied Mathematics)
    *   **Alan Turing** (Computer Science)
*   The admissions queue and committee grid are pre-populated and ready to demo.

---

## 🎯 Part 2: What They Need (PO Call - 15 Minute Discussion Guide)

Use these 5 targeted questions to prioritize upcoming development efforts based on the PO’s business objectives:

### ⏱️ Minute 0–3: Onboarding & Live Demo
*   **Status Update:** *"We have successfully migrated the entire tech stack from Azure and AWS RDS/S3 to a single Hetzner VPS with Coolify. We have full, green-padlock HTTPS/WSS Let's Encrypt SSL active on wildcard IP domains (`https://invision.2.29.37.96.nip.io`) so microphone and camera permissions work instantly for any candidate. We have also seeded three high-fidelity applicants (Ada Lovelace, Grace Hopper, Alan Turing) so the Admissions Committee Review grid is fully live."*

### 💬 Minute 3–12: Feature Prioritization Questions

#### Question 1: Competency & Rating Model Expansion
> **Context:** *Currently, our backend structures evaluate 3 core indicators (motivation, leadership, prior experience) using our verified quote/band model.*
*   **The Question:** *"Do we keep this focus, or do we want to expand this to the full 7-dimension IAF (inVision Applicant Framework) next, or should we prioritize other scoring blocks first?"*

#### Question 2: AI Interviewer Customization
> **Context:** *The AI currently follows a static, warm-up plus 6-presentation-question script.*
*   **The Question:** *"Do we keep the standard 6-question flow, or do we need to implement **program-specific tracks** (e.g., dedicated questions for Computer Science vs. Medicine) and **dynamic follow-up questions** where the AI actively probes weak or vague answers?"*

#### Question 3: Anti-Cheating & AI-Generated Detection
> **Context:** *We have a roadmap for cheat detection (gaze/face tracking, stress levels).*
*   **The Question:** *"Given candidates can easily use ChatGPT to feed answers during their screening, do you want us to prioritize **AI-generated speech/text-reading detection** (evaluating sentence variance, prosody, gaze tracking) or **lip-sync / biometric face verification** to confirm identity?"*

#### Question 4: Committee Review Workflow
> **Context:** *Currently, committee members can accept or reject proposed ratings directly.*
*   **The Question:** *"Would you like us to develop a **multi-reviewer consensus system** (e.g., double-blind reviews, score averaging, comment threads) or keep the direct accepted/rejected override workflow?"*

#### Question 5: Downstream Integrations vs. Portal Expansion
> **Context:** *Once accepted, applicants currently just see their completed screen.*
*   **The Question:** *"Should our next step be a dedicated **Applicant Portal** (where accepted candidates view their feedback and status) or direct **SIS (Student Information System) integration** to push admitted candidates directly into enrollment databases?"*

### 🏁 Minute 12–15: Selection & Next Action Items
*   Let the PO choose the top **two** priority areas.
*   Document their selection and set up the next milestone.
