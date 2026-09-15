# Data Schema

This document describes the data structures used in the inVision University admissions system.

---

## Database Schema

### Users Table

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| id | UUID | Unique user identifier | Yes |
| name | string | Full name | Yes |
| email | string | Email (unique) | Yes |
| phone | string | Phone number | No |
| password | string | Hashed password | Yes |
| role | string | user_role (applicant/admin) | Yes |
| created_at | timestamp | Creation timestamp | Yes |

---

### Sessions Table

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| id | UUID | Unique session identifier | Yes |
| user_id | UUID | Foreign key to users | Yes |
| program | string | Applied program | Yes |
| recording_url | string | S3 URL to video | No |
| transcript | JSON | Full conversation log | No |
| applicant_data | JSON | Extracted Q&A data | No |
| evaluation | JSON | AI evaluation result | No |
| started_at | timestamp | Interview start time | No |
| completed_at | timestamp | Interview end time | No |
| created_at | timestamp | Session creation | Yes |

---

## JSON Structures

### Transcript Entry

```json
{
  "role": "user|assistant",
  "text": "Transcribed text",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Full Transcript Example

```json
[
  {"role": "assistant", "text": "Welcome to inVision U...", "timestamp": "2024-01-15T10:30:00Z"},
  {"role": "user", "text": "Hi, I'm excited to be here...", "timestamp": "2024-01-15T10:30:05Z"},
  ...
]
```

---

### Applicant Data Structure

```json
{
  "q1_why_applying": "Detailed answer text...",
  "q2_program_choice": "Detailed answer text...",
  "q3_challenge_overcome": "Detailed answer text...",
  "q4_long_term_goals": "Detailed answer text...",
  "q5_leadership": "Detailed answer text...",
  "q6_family_support": "Detailed answer text...",
  "language_used": "en",
  "confidence_level": "high|medium|low",
  "communication_quality": "excellent|good|average|poor"
}
```

---

### Evaluation Structure

```json
{
  "overall_score": 8,
  "recommendation": "recommended",
  "confidence": 0.85,
  "strengths": [
    "Clear motivation for attending",
    "Specific leadership example",
    "Well-articulated long-term goals"
  ],
  "areas_for_improvement": [
    "Could provide more specific program details",
    "Family support could be elaborated"
  ],
  "notes": "Strong candidate with clear goals..."
}
```

### Evaluation Structure (from WebSocket / Gemini Flash)

```json
{
  "overall_impression": "Brief summary...",
  "overall_score": 8.5,
  "recommendation": "strongly_recommended|recommended|needs_review|not_recommended",
  "strengths": ["strength1", "strength2"],
  "concerns": ["concern1"]
}
```

---

## API Request/Response Formats

### Create Session

**Request:**
```json
{
  "user_id": "uuid",
  "program": "Computer Science"
}
```

**Response:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "program": "Computer Science",
  "created_at": "2024-01-15T10:00:00Z",
  ...
}
```

### Analyze Session

**Request:**
```json
{
  "transcript": [...]
}
```

**Response:**
```json
{
  "applicant_data": {...},
  "evaluation": {...}
}
```

### Admin Override

**Request:**
```json
{
  "override_score": 7,
  "override_recommendation": "recommended",
  "justification": "Stronger leadership example than AI detected"
}
```

---

---

## Enhanced Analysis Response

Returned by `GET /api/metrics/sessions/{session_id}` and `POST /api/demo/analyze`.

```json
{
  "session_id": "uuid",
  "data_quality": {
    "completeness_score": 85,
    "transcript_score": 72,
    "evaluation_score": 100,
    "overall_score": 83,
    "missing_answers": [
      {"field": "q3_challenge_overcome", "severity": "high"}
    ]
  },
  "baseline_evaluation": {
    "score": 7.5,
    "recommendation": "recommended",
    "confidence": "low",
    "reasoning": "Answer completeness: 4/4, Length score: 2/3, Keyword score: 2/3"
  },
  "agreement": {
    "ai_recommendation": "recommended",
    "baseline_recommendation": "recommended",
    "agreement": "exact",
    "score": 1.0
  },
  "error_analysis": {
    "inconsistencies": [
      {"type": "low_score_many_strengths", "detail": "Score 3 but 5 strengths listed"}
    ],
    "edge_cases": {
      "flags": ["non_english_detected", "very_short_session"],
      "reliability": "low"
    }
  },
  "explainability": {
    "explanation": {
      "summary": "Recommended based on clear motivation and strong leadership example.",
      "factors": [
        {"factor": "Clear motivation for program", "impact": "positive"},
        {"factor": "Leadership example with measurable outcome", "impact": "positive"},
        {"factor": "Baseline agreement: exact match", "impact": "neutral"}
      ]
    },
    "feature_importance": {
      "q1_why_applying": 0.22,
      "q2_program_choice": 0.18,
      "q3_challenge_overcome": 0.15,
      "q4_long_term_goals": 0.19,
      "q5_leadership": 0.17,
      "q6_family_support": 0.09
    }
  }
}
```

---

## Fairness Report Response

Returned by `GET /api/fairness/report`.

```json
{
  "program_parity": {
    "rates": {"Computer Science": 0.72, "Business": 0.48},
    "max_gap": 0.24,
    "flagged": false
  },
  "language_parity": {
    "rates": {"english": 0.65, "russian": 0.41},
    "max_gap": 0.24,
    "flagged": false
  },
  "score_variance": {
    "mean": 6.8,
    "stdev": 1.9,
    "flagged": false
  },
  "requires_audit": false,
  "flags": []
}
```

---

## Data Quality Flags

### Completeness Score

```json
{
  "completeness": {
    "questions_answered": 6,
    "total_questions": 6,
    "score": 1.0
  }
}
```

### Missing Data Flag

```json
{
  "data_quality": {
    "completeness": 0.67,
    "flags": ["q3_challenge_overcome missing"]
  }
}
```

---

## Enums

### Recommendation Categories

| Value | Description |
|-------|-------------|
| strongly_recommended | High confidence admission |
| recommended | Standard admission |
| needs_review | Needs additional review |
| not_recommended | Not recommended |

### User Roles

| Value | Description |
|-------|-------------|
| applicant | Student applicant |
| admin | Admissions staff |

### Confidence Levels

| Value | Description |
|-------|-------------|
| high | Clear, confident responses |
| medium | Some uncertainty |
| low | Hesitant or unclear |

---

## Relationships

```
User (1) ───< (Many) Session
Session (1) ───< (1) Recording (S3)
```

---

## Notes

- All timestamps in UTC
- All UUIDs as strings
- JSON fields stored as JSONB in PostgreSQL
- Sensitive data should be anonymized before analytics

See also:
- [Assessment Rubric](assessment_rubric.md)
- [Model Limitations](model_limitations.md)