# inVision Backend

AI-powered university interview platform backend built with FastAPI, PostgreSQL (Aurora), and AWS S3.

## Architecture

```
app/
├── api/
│   ├── admin_routes.py       # Admin endpoints (users, sessions, create-admin)
│   ├── session_routes.py     # Session CRUD, upload, analyze
│   ├── user_routes.py        # Auth (register, login, list users)
│   └── websocket.py          # Gemini Live AI interview (VAD + tool calling)
├── core/
├── domain/
│   ├── entities.py           # Pydantic domain models
│   └── interfaces.py         # Repository interfaces (ports)
├── infrastructure/
│   ├── database.py           # Async SQLModel engine + IAM auth
│   ├── models.py             # SQLModel DB tables
│   ├── repositories.py       # PostgreSQL repository implementations
│   └── s3_client.py          # AWS S3 client (presigned URLs)
├── use_cases/
│   ├── analyze_session_use_case.py  # Post-interview AI analysis
│   ├── session_use_cases.py         # Session business logic
│   └── user_use_cases.py            # User business logic
├── config.py                 # Settings (env vars)
└── main.py                   # FastAPI app factory
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | FastAPI 0.115 |
| ORM | SQLModel + asyncpg |
| Database | Aurora PostgreSQL 17.7 (Serverless v2) |
| Storage | AWS S3 (recordings) |
| AI | Google Gemini 3.1 Flash Live |
| Auth | RDS IAM Authentication |
| Migrations | Alembic |

## Setup

### 1. Prerequisites

- Python 3.10+
- AWS CLI configured with credentials
- Access to Aurora PostgreSQL cluster
- S3 bucket created

### 2. Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Required variables:

```env
# Gemini AI
GEMINI_API_KEY=your-gemini-api-key

# Aurora PostgreSQL (IAM Auth)
DB_HOST=database-1.cluster-xxxxx.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_USER=postgres
DB_NAME=postgres
DB_USE_IAM_AUTH=true
DB_REGION=us-east-1

# AWS S3
AWS_REGION=eu-west-1
AWS_S3_BUCKET=invision-046573763502-eu-west-1-an
```

### 3. Install Dependencies

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install psycopg2-binary  # for alembic migrations
```

### 4. Database Migrations

```bash
# Generate migration (after model changes)
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Check status
alembic current

# Rollback
alembic downgrade -1
```

### 5. Create Admin Account

```bash
python create_admin.py Admin admin@admin.admin YourSecurePassword
```

### 6. Run Server

```bash
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

## API Endpoints

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/register` | Register new user |
| POST | `/api/login` | Login user |
| GET | `/api/users` | List all users |
| GET | `/api/users/{id}` | Get user with session |

### Sessions

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/sessions` | Create interview session |
| POST | `/api/upload-recording` | Upload video recording |
| GET | `/api/recording/{id}` | Get recording (redirects to S3) |
| POST | `/api/sessions/{id}/analyze` | Analyze session transcript |

### WebSocket

| Path | Description |
|------|-------------|
| `ws://host/ws/{sessionId}` | Gemini Live AI interview |

### Admin

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/create-admin` | Create admin account |
| GET | `/api/admin/users` | List all users (with filters) |
| GET | `/api/admin/users/{id}` | Get user details |
| GET | `/api/admin/sessions` | List all sessions |
| GET | `/api/admin/sessions/{id}` | Get session with evaluation |

## Security

- **RDS IAM Auth** — No passwords stored, tokens generated dynamically (15 min expiry)
- **S3 Default Credentials** — Uses IAM role or AWS CLI credentials, no hardcoded keys
- **SSL Required** — All database connections use SSL

## Interview Flow

1. User creates session → `POST /api/sessions`
2. Frontend connects WebSocket → `ws://host/ws/{sessionId}`
3. Gemini asks 6 questions with VAD (1s silence detection)
4. If 20s silence → check-in popup (max 2 times)
5. After all questions → Gemini calls `end_session` tool
6. Backend saves: transcript + applicant_data + evaluation
7. Frontend uploads video → `POST /api/upload-recording`
8. Admin views results → `GET /api/admin/sessions/{id}`

## Evaluation System

### How AI Evaluation Works

1. **Interview**: Gemini 2.5 Flash Live conducts 6-question interview via WebSocket
2. **Transcript Capture**: Full conversation stored with timestamps
3. **Analysis**: Post-session, Gemini 2.5 Flash analyzes transcript
4. **Extraction**: Applicant data extracted (Q&A from 6 questions)
5. **Scoring**: Generates overall score (1-10) and recommendation
6. **Review**: Admin can view, override, or provide feedback

### Recommendation Categories

| Category | Score Range | Action |
|----------|-------------|--------|
| strongly_recommended | 9-10 | Priority admission |
| recommended | 7-8 | Standard admission |
| consider | 5-6 | Additional review |
| not_recommended | 1-4 | Not recommended |

### Validation

- Cross-validation performed on evaluations
- Baseline comparison available via `/api/validation/compare`
- See [Model Limitations](docs/model_limitations.md) for accuracy metrics

### Fairness

- Bias monitoring via `/api/admin/fairness-dashboard`
- Regular bias audits recommended
- Human override available when needed

## Extended Documentation

- [Assessment Rubric](docs/assessment_rubric.md) - Scoring criteria
- [Model Limitations](docs/model_limitations.md) - Known limitations
- [Data Schema](docs/data_schema.md) - Database structures
- [Usage Scenarios](docs/usage_scenarios.md) - Common workflows

## Extended API Endpoints

### Validation

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/validation/metrics` | Get evaluation metrics |
| GET | `/api/validation/error-analysis` | Get error analysis |
| POST | `/api/validation/compare` | Compare with baseline |

### Demo

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/demo/scenarios` | List sample scenarios |
| POST | `/api/demo/run/{scenario_id}` | Run demo evaluation |

### Admin Extensions

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/sessions/{id}/override` | Override AI recommendation |
| POST | `/api/admin/sessions/{id}/feedback` | Submit feedback |
| GET | `/api/admin/fairness-dashboard` | View bias metrics |
| POST | `/api/admin/data-retention/apply` | Apply retention policy |

## Migrations

See [MIGRATIONS.md](MIGRATIONS.md) for detailed migration guide.
