# inVision Frontend

Next.js interview application for inVision University. Users record video presentations with an AI guide.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| UI | shadcn/ui + Lucide icons |
| Audio | Web Audio API + AudioWorklet |
| Video | MediaRecorder API |

## Setup

### 1. Prerequisites

- Node.js 18+
- Backend running on port 8000

### 2. Environment Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. Install & Run

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000

## Pages

| Path | Description |
|------|-------------|
| `/` | Landing page |
| `/signin` | User login |
| `/signup` | User registration |
| `/apply/form` | Application form (program selection) |
| `/apply/interview` | AI interview session |
| `/admin` | Admin dashboard |
| `/admin/applicant/{id}` | Applicant detail view |

## Audio Architecture

### Microphone Capture
```
Microphone → getUserMedia → AudioContext (16kHz)
                              → AudioWorklet (PCM conversion)
                                → WebSocket → Backend (Gemini)
```

### Gemini Audio Playback
```
Backend → WebSocket → AudioContext (24kHz)
                        → Speakers (playPCM)
                        → MediaStreamDestination (recording)
```

### Video Recording (Mixed Audio)
```
Camera ──────────────────────────────────────────┐
Mic ─────────────────────────────────────────────┤
                                                  ↓
Gemini audio → AudioContext → Speakers ──→ AudioDest ┘
                                                       ↓
                                             MediaRecorder → video.webm
                                             (both voices)
```

## WebSocket Protocol

### Connection

```typescript
const ws = new WebSocket(`ws://localhost:8000/ws/${sessionId}`)
ws.binaryType = "arraybuffer"
```

### Incoming Messages

#### `status` — Session started
```json
{ "type": "status", "message": "Connected! ..." }
```

#### `check_in` — Silence detected
```json
{ "type": "check_in", "message": "Are you still there?" }
```
- Show overlay popup
- Play notification sound
- Keep audio stream active (don't stop recording)
- User speaking dismisses automatically

#### `interview_ended` — Session complete
```json
{ "type": "interview_ended", "message": "Thank you! ..." }
```
- Stop video recording
- Stop sending audio to WebSocket
- Close WebSocket
- Upload recording to backend

#### `error` — Error occurred
```json
{ "type": "error", "message": "Error description" }
```

#### Binary frames — Gemini audio
- PCM audio at 24kHz, 16-bit signed
- Play through AudioContext

### Outgoing

#### Binary frames — Microphone audio
- PCM audio at 16kHz, 16-bit signed
- Sent continuously via AudioWorklet

## Interview Flow

```
1. Login → localStorage: userId, userName
2. Select program → localStorage: program
3. Create session → POST /api/sessions → sessionId
4. Start interview → Connect WebSocket + MediaRecorder
5. Answer questions → Gemini asks 6 questions via audio
6. If check_in → Show popup, keep recording
7. interview_ended → Stop recording, upload video
8. Upload → POST /api/upload-recording → Success
```

## Key Components

### `app/apply/interview/page.tsx`
Main interview page. Handles:
- WebSocket connection
- Microphone capture (AudioWorklet)
- Gemini audio playback
- Video recording (MediaRecorder with mixed audio)
- Check-in popup
- Upload flow

### `public/pcm-processor.js`
AudioWorklet that converts Float32 mic samples to Int16 PCM at 16kHz.

## Admin Panel

### `app/admin/page.tsx`
Dashboard listing all applicants with:
- Name, email, program
- Recording status
- AI evaluation score
- Filter by program / has recording

### `app/admin/applicant/[id]/page.tsx`
Detail view with:
- Applicant info
- Answers to all 6 questions
- AI evaluation (score, strengths, concerns, recommendation)
- Full transcript
- Video recording player

## API Integration

### Auth
```typescript
// Login
POST /api/login { email, password } → { userId, name }

// Register
POST /api/register { name, email, phone, password } → { userId, name }
```

### Sessions
```typescript
// Create session
POST /api/sessions { userId, program } → { sessionId }

// Upload recording
POST /api/upload-recording FormData { sessionId, file } → { ok, url }
```

### Admin
```typescript
// List users with filters
GET /api/admin/users?program=CS&has_recording=true → UserWithSession[]

// Get session with evaluation
GET /api/admin/sessions/{sessionId} → Session with transcript, applicant_data, evaluation
```

## Troubleshooting

### Microphone not working
- Check browser permissions
- Ensure HTTPS (required for getUserMedia in production)

### WebSocket connection fails
- Verify backend is running on port 8000
- Check CORS settings in backend

### Recording has no Gemini audio
- Ensure `audioDestRef` is created before MediaRecorder
- Check that `playPCM` connects to both `ctx.destination` and `audioDestRef.current`

### Check-in popup doesn't dismiss
- User must speak (audio sent to WebSocket triggers dismissal)
- Clicking "I'm here, continue" also dismisses
