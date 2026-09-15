# Usage Scenarios

This document describes common usage scenarios for the inVision University admissions system.

---

## Scenario 1: New Applicant Interview

### Flow

```
1. Applicant registers at /api/register
       ↓
2. Applicant logs in at /api/login
       ↓
3. Applicant creates session: POST /api/sessions
   {user_id, program}
       ↓
4. Frontend receives session ID
       ↓
5. Frontend connects WebSocket: ws://host/ws/{session_id}
       ↓
6. Gemini AI guides through 6 questions
   (5-minute max interview)
       ↓
7. Session ends, transcript saved
       ↓
8. Frontend uploads recording: POST /api/upload-recording
       ↓
9. Admin reviews: GET /api/admin/sessions/{id}
```

### API Calls

```bash
# 1. Register
curl -X POST http://localhost:8000/api/register \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com","password":"..."}'

# 2. Login
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"..."}'

# 3. Create session
curl -X POST http://localhost:8000/api/sessions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"<uuid>","program":"Computer Science"}'

# 4. Connect WebSocket (from frontend)
const ws = new WebSocket('ws://localhost:8000/ws/<session_id>');

# 5. Upload recording
curl -X POST http://localhost:8000/api/upload-recording \
  -H "Authorization: Bearer <token>" \
  -F "file=@recording.webm" \
  -F "session_id=<uuid>"

# 6. Admin reviews
curl -X GET http://localhost:8000/api/admin/sessions/<session_id> \
  -H "Authorization: Bearer <admin_token>"
```

### Expected Results

- Session created with unique ID
- WebSocket connects and begins interview
- Questions asked in order: Why applying, Program choice, Challenge, Goals, Leadership, Family support
- Interview auto-ends after 5 minutes or when all questions complete
- Transcript stored with evaluation
- Admin can view full evaluation

---

## Scenario 2: Admin Override

### When to Override

- AI score seems inconsistent with rubric
- Stronger/weaker candidate than AI detected
- Special circumstances not captured in transcript
- Technical issues affected evaluation

### Flow

```
1. Admin views session evaluation
       ↓
2. Admin reviews transcript and AI reasoning
       ↓
3. Admin determines override needed
       ↓
4. Admin submits override: POST /api/admin/sessions/{id}/override
       ↓
5. System logs override with justification
       ↓
6. Session updated with human evaluation
```

### API Call

```bash
curl -X POST http://localhost:8000/api/admin/sessions/<id>/override \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "override_score": 9,
    "override_recommendation": "strongly_recommended",
    "justification": "Candidate showed exceptional leadership in community project not fully captured in transcript. Strong academic background also noted."
  }'
```

### Response

```json
{
  "session_id": "<uuid>",
  "original_score": 7,
  "original_recommendation": "recommended",
  "override_score": 9,
  "override_recommendation": "strongly_recommended",
  "admin_id": "<uuid>",
  "justification": "...",
  "timestamp": "2024-01-15T15:00:00Z"
}
```

---

## Scenario 3: Admin Feedback for Improvement

### Purpose

Collect feedback on AI evaluations to improve model over time.

### Flow

```
1. Admin reviews AI evaluation
       ↓
2. Admin submits feedback: POST /api/admin/sessions/{id}/feedback
       ↓
3. Feedback stored for analysis
       ↓
4. Periodic review of feedback patterns
       ↓
5. Model updates based on patterns
```

### API Call

```bash
curl -X POST http://localhost:8000/api/admin/sessions/<id>/feedback \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": "accurate|somewhat_accurate|inaccurate",
    "comments": "AI correctly identified leadership potential...",
    "suggestions": "Could improve detection of non-verbal enthusiasm"
  }'
```

---

## Scenario 4: Fairness Audit

### Purpose

Regularly check for bias in AI evaluations.

### Flow

```
1. Admin accesses fairness dashboard
       ↓
2. Review demographic parity metrics
       ↓
3. Check equalized odds by program
       ↓
4. Identify potential bias flags
       ↓
5. Review flagged cases
       ↓
6. Document findings and actions
```

### API Calls

```bash
# Full fairness audit report
curl -X GET http://localhost:8000/api/fairness/report \
  -H "Authorization: Bearer <admin_token>"

# Score distribution only
curl -X GET http://localhost:8000/api/fairness/distribution \
  -H "Authorization: Bearer <admin_token>"

# Recommendation rates by program
curl -X GET http://localhost:8000/api/fairness/program-parity \
  -H "Authorization: Bearer <admin_token>"

# Recommendation rates by language
curl -X GET http://localhost:8000/api/fairness/language-parity \
  -H "Authorization: Bearer <admin_token>"
```

### Response

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

## Scenario 5: Bulk Import for Testing

### Purpose

Test evaluation system with sample profiles.

### Flow

```
1. Admin prepares CSV with sample data
       ↓
2. Admin uploads: POST /api/admin/sessions/bulk-import
       ↓
3. System processes profiles
       ↓
4. Results exported for review
```

### CSV Format

```csv
user_id,program,q1_answer,q2_answer,q3_answer,q4_answer,q5_answer,q6_answer
uuid1,Computer Science,I want to... because...,I chose... because...,...
uuid2,Business,...

```

### API Call

```bash
curl -X POST http://localhost:8000/api/admin/sessions/bulk-import \
  -H "Authorization: Bearer <admin_token>" \
  -F "file=@sample_profiles.csv"
```

---

## Scenario 6: Evaluation Validation

### Purpose

Compare AI evaluation against rule-based baseline and get full ML analysis.

### Flow

```
1. Admin requests enhanced analysis: GET /api/metrics/sessions/{id}
       ↓
2. System runs rule-based baseline (app/ml/baseline.py)
       ↓
3. System calculates agreement between AI and baseline
       ↓
4. System detects inconsistencies and edge cases
       ↓
5. System generates explainability narrative + feature importance
       ↓
6. Results returned for review
```

### API Calls

```bash
# Full enhanced analysis for a session (admin only)
curl -X GET http://localhost:8000/api/metrics/sessions/<uuid> \
  -H "Authorization: Bearer <admin_token>"

# Aggregate overview across all sessions
curl -X GET http://localhost:8000/api/metrics/overview \
  -H "Authorization: Bearer <admin_token>"
```

### Response

```json
{
  "session_id": "<uuid>",
  "data_quality": {"overall_score": 83, "missing_answers": []},
  "baseline_evaluation": {
    "score": 7.5,
    "recommendation": "recommended",
    "confidence": "low"
  },
  "agreement": {
    "ai_recommendation": "recommended",
    "baseline_recommendation": "recommended",
    "agreement": "exact",
    "score": 1.0
  },
  "error_analysis": {
    "inconsistencies": [],
    "edge_cases": {"flags": [], "reliability": "high"}
  },
  "explainability": {
    "explanation": {"summary": "...", "factors": [...]},
    "feature_importance": {"q1_why_applying": 0.22, ...}
  }
}
```

---

## Scenario 7: Demo Mode

### Purpose

Test the ML pipeline without real applicants or database writes.

### Flow

```
1. Caller sends data (or omits fields to use built-in samples): POST /api/demo/analyze
       ↓
2. System runs full ML pipeline: data quality, baseline, agreement, error analysis, explainability
       ↓
3. Results returned — nothing saved to DB
       ↓
4. Optionally view baseline-only result: GET /api/demo/baseline
```

### API Calls

```bash
# Run full ML analysis on custom or sample data (requires auth)
curl -X POST http://localhost:8000/api/demo/analyze \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "applicant_data": {
      "q1_why_applying": "I want to build tech...",
      "q5_leadership": "I led a 5-person team..."
    }
  }'

# Run on built-in sample data (omit all fields)
curl -X POST http://localhost:8000/api/demo/analyze \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{}'

# View baseline evaluation of built-in sample (requires auth)
curl -X GET http://localhost:8000/api/demo/baseline \
  -H "Authorization: Bearer <token>"
```

### Notes

- Any field omitted from the payload falls back to built-in sample data
- Results include `"used_sample_data": true` if `applicant_data` was not provided
- No data is persisted to the database

---

## Scenario 8: Data Retention

### Purpose

Comply with data retention policies.

### Flow

```
1. Admin triggers retention: POST /api/admin/data-retention/apply
       ↓
2. System archives sessions > 180 days
       ↓
3. System deletes recordings > 365 days
       ↓
4. Compliance log created
```

### API Call

```bash
curl -X POST http://localhost:8000/api/admin/data-retention/apply \
  -H "Authorization: Bearer <admin_token>"
```

---

## Quick Reference

| Task | Endpoint |
|------|----------|
| View all sessions | GET /api/admin/sessions |
| View single session | GET /api/admin/sessions/{id} |
| Override evaluation | POST /api/admin/sessions/{id}/override |
| Submit feedback | POST /api/admin/sessions/{id}/feedback |
| Enhanced ML analysis | GET /api/metrics/sessions/{id} |
| Aggregate metrics overview | GET /api/metrics/overview |
| Full fairness audit | GET /api/fairness/report |
| Score variance | GET /api/fairness/distribution |
| Parity by program | GET /api/fairness/program-parity |
| Parity by language | GET /api/fairness/language-parity |
| Demo ML pipeline | POST /api/demo/analyze |
| Demo baseline only | GET /api/demo/baseline |

See also:
- [Assessment Rubric](assessment_rubric.md)
- [Model Limitations](model_limitations.md)
- [Data Schema](data_schema.md)