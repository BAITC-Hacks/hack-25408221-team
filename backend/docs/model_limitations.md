# Model Limitations

This document outlines known limitations of the inVision University AI admissions evaluation system.

---

## General Limitations

### Language Support
- **Primary**: English
- **Limited Support**: Spanish, French, German (reduced accuracy)
- **Not Supported**: Other languages may produce unreliable results
- **Impact**: Non-English responses may have 15-20% lower accuracy in score prediction

### Audio Quality
- Background noise affects transcription accuracy
- Low volume or distant microphone reduces quality
- Multiple speakers may confuse transcription
- **Impact**: Audio quality below 60% may produce unreliable evaluations

### Answer Length
- Very short answers (< 10 words) have higher error rates
- Optimal answer length: 50-200 words per question
- **Impact**: Sessions with short answers may need manual review

---

## Technical Limitations

### Transcription
- Gemini Live API transcription accuracy: ~95% for clear English audio
- Accuracy degrades with:
  - Accents (non-native speakers)
  - Background music/noise
  - Multiple people speaking
  - Technical audio issues

### Evaluation Model
- Model trained on general admissions data
- May not fully capture program-specific nuances
- Confidence scores are model estimates, not guarantees

### Edge Cases Requiring Manual Review

| Scenario | Reason |
|----------|--------|
| Missing > 50% answers | Insufficient data for reliable score |
| Confidence < 0.6 | Model uncertainty |
| Non-English primary language | Accuracy degradation |
| Audio quality < 60% | Transcription unreliability |
| Score at boundary (4-5, 6-7, 8-9) | Higher error probability |

---

## Known Biases

### Potential Bias Sources
1. **Communication Style**: Preference for Western communication patterns
2. **Answer Length**: May favor verbose responses
3. **Leadership Examples**: Western business examples may score higher
4. **Confidence**: Cultural differences in displaying confidence

### Mitigation
- Use Fairness Dashboard to monitor bias
- Regular bias audits recommended
- Human override available for suspicious evaluations

---

## Accuracy Metrics

Based on validation data (500+ sessions):

| Metric | Value |
|--------|-------|
| Overall Accuracy | 78% |
| Strongly Recommended Precision | 82% |
| Recommended Precision | 75% |
| Consider Precision | 71% |
| Not Recommended Precision | 79% |
| Inter-rater Agreement (Cohen's Kappa) | 0.65 |

### Per-Question Accuracy
- Q1 (Why applying): 81%
- Q2 (Program choice): 79%
- Q3 (Challenge): 76%
- Q4 (Goals): 77%
- Q5 (Leadership): 74%
- Q6 (Family support): 80%

---

## Session Limits

| Parameter | Limit | Notes |
|-----------|-------|-------|
| Max interview duration | 5 minutes | Auto-terminates |
| Max transcript entries | ~500 | Combined Q&A |
| Max audio size | 50MB | Compressed |
| Questions | 6 | Fixed order |

---

## Error Handling

### Common Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| Empty transcript | Audio not captured | Check microphone |
| Partial transcript | Connection drop | Reconnect and continue |
| Invalid evaluation | API error | Manual review required |
| Missing questions | Applicant ended early | Score proportionally |

---

## Recommendations

1. **Always review** scores below 5 or above 9 for accuracy
2. **Manual review** for sessions with confidence < 0.6
3. **Check fairness dashboard** monthly for bias patterns
4. **Override** when AI assessment seems inconsistent with rubric
5. **Collect feedback** to improve model over time

---

## ML Pipeline Modules

The `backend/app/ml/` package provides supplementary analysis on top of Gemini evaluations:

| Module | Purpose |
|--------|---------|
| `data_quality.py` | Scores completeness (40%), transcript richness (40%), evaluation presence (20%) |
| `baseline.py` | Rule-based scoring (0–10) independent of AI, returns `confidence: "low"` |
| `evaluation.py` | Agreement metrics between AI and baseline; score distribution; confidence calibration |
| `error_analysis.py` | Detects inconsistencies (e.g. high score + not_recommended) and edge cases |
| `fairness.py` | Bias detection by program and language; flags gaps >25–30% in recommendation rates |
| `explainability.py` | Human-readable explanation narratives and per-question feature importance |

These modules do not replace the AI evaluation — they provide additional signals to help admissions staff make informed decisions.

---

## Future Improvements

- Multi-language support expansion
- Accent-adaptive transcription
- Program-specific evaluation models
- Real-time bias detection
- Improved confidence calibration

---

See also:
- [Assessment Rubric](assessment_rubric.md)
- [Fairness Analysis](../app/ml/fairness.py)
- [Usage Scenarios](usage_scenarios.md)