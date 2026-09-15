# Evaluation Rubric

This document defines the scoring criteria for the inVision University AI admissions evaluation system.

---

## Overview

Each interview session is evaluated across 6 questions. The AI produces:
- **Overall Score**: 1-10 scale
- **Recommendation**: strongly_recommended | recommended | consider | not_recommended
- **Confidence Level**: high | medium | low
- **Communication Quality**: excellent | good | average | poor

---

## Score Definitions

### Score 9-10: Strongly Recommended

**Criteria:**
- Clear, detailed answers to all 6 questions
- Strong motivation demonstrating alignment with inVision U's mission
- Specific examples of leadership and achievement
- Excellent communication skills (clear, articulate, confident)
- Well-articulated long-term goals with clear program connection
- Strong family/support system engagement

**Typical Profile:**
- "I want to attend inVision U because its innovation-focused curriculum aligns perfectly with my goal to become a tech entrepreneur. The hands-on learning approach will help me develop practical skills."
- Provides specific examples: "I led a team of 5 students to develop an app that won the regional hackathon..."

---

### Score 7-8: Recommended

**Criteria:**
- Adequate answers to most questions (5-6 answered well)
- Reasonable motivation for applying
- Some demonstration of leadership potential
- Good communication skills
- Clear long-term goals
- Adequate support system

**Typical Profile:**
- "I chose this program because it has a good reputation and the courses seem interesting."
- Provides general examples without specifics

---

### Score 5-6: Consider

**Criteria:**
- Weak answers to 2-3 questions
- Unclear or generic motivation
- Limited leadership examples
- Average communication skills (some hesitation, unclear articulation)
- Vague or undefined goals
- Limited support system mentioned

**Typical Profile:**
- Short answers (< 50 words per question)
- "I don't know" or "I'm not sure" responses
- Difficulty articulating thoughts

---

### Score 1-4: Not Recommended

**Criteria:**
- Incomplete answers (many questions unanswered)
- No clear motivation for applying
- No leadership demonstration
- Poor communication (incomplete sentences, very short answers)
- No clear goals
- No support system mentioned
- Concerning responses (disinterest, inappropriate content)

**Typical Profile:**
- Single word answers
- "I just want a degree" type responses
- No engagement with questions

---

## Question-Specific Rubrics

### Q1: Why applying to inVision U?

| Score | Indicators |
|-------|------------|
| 9-10 | Specific alignment with inVision U's values/mission; innovative mindset; clear vision |
| 7-8 | General positive reasons; adequate research shown |
| 5-6 | Vague reasons; "good school" without specifics |
| 1-4 | No clear reason; negative sentiment |

### Q2: Program choice

| Score | Indicators |
|-------|------------|
| 9-10 | Specific program with clear rationale; career alignment |
| 7-8 | Program named with some reasoning |
| 5-6 | Vague program choice; limited reasoning |
| 1-4 | No program mentioned; unclear |

### Q3: Challenge overcome

| Score | Indicators |
|-------|------------|
| 9-10 | Detailed story with lesson learned; growth mindset |
| 7-8 | Adequate example with some reflection |
| 5-6 | Brief mention without detail |
| 1-4 | No challenge mentioned or refused to answer |

### Q4: Long-term goals

| Score | Indicators |
|-------|------------|
| 9-10 | Specific, measurable goals; connection to program |
| 7-8 | Clear goals with some connection |
| 5-6 | Vague goals |
| 1-4 | No goals mentioned |

### Q5: Leadership

| Score | Indicators |
|-------|------------|
| 9-10 | Specific example with role and impact |
| 7-8 | Example provided |
| 5-6 | Vague mention of leadership |
| 1-4 | No example or refused |

### Q6: Family support

| Score | Indicators |
|-------|------------|
| 9-10 | Specific supporters named; clear support system |
| 7-8 | General support mentioned |
| 5-6 | Minimal mention |
| 1-4 | No support or concerning response |

---

## Communication Quality Scoring

| Level | Criteria |
|-------|----------|
| **Excellent** | Clear articulation; complete sentences; good pacing; proper grammar |
| **Good** | Generally clear; minor issues with grammar or pacing |
| **Average** | Some difficulty expressing ideas; occasional confusion |
| **Poor** | Hard to understand; very short answers; significant issues |

---

## Confidence Level Indicators

| Level | Criteria |
|-------|----------|
| **High** | Firm answers; specific details; no hesitation |
| **Medium** | Generally confident with some uncertainty |
| **Low** | Hesitation; "I'm not sure"; incomplete answers |

---

## Recommendation Mapping

| Score Range | Recommendation | Action |
|-------------|----------------|--------|
| 9-10 | strongly_recommended | Priority admission |
| 7-8 | recommended | Standard admission |
| 5-6 | needs_review | Additional review needed |
| 1-4 | not_recommended | Not recommended for admission |

---

## Notes for Human Evaluators

1. **Consistency**: Score each question independently, then average
2. **Context**: Consider cultural differences in communication style
3. **Audio Quality**: Note if technical issues affected responses
4. **Missing Data**: Flag sessions with >50% missing answers
5. **Edge Cases**: For scores near boundaries (4-5, 6-7, 8-9), review carefully

---

## AI vs Human Agreement

When reviewing AI evaluations:
- Review reasoning behind score
- Check for bias patterns
- Verify recommendation matches rubric
- Override if AI assessment seems inconsistent with rubric

---

## ML-Based Enhanced Analysis

In addition to the AI evaluation, each session can be run through the ML pipeline (`app/ml/`) which provides:

### Baseline Comparison

A rule-based baseline (`app/ml/baseline.py`) independently scores the applicant using:
- Answer completeness (up to 4 points)
- Answer length (up to 3 points)
- Keyword presence for goals/leadership/motivation (up to 3 points)
- Concern penalty for negative indicators (−2 points)

The baseline returns its own `recommendation` with `confidence: "low"` (rule-based, not AI).

### Agreement Score

`app/ml/evaluation.py` compares AI vs baseline recommendation:

| Agreement | Score | Meaning |
|-----------|-------|---------|
| exact | 1.0 | Both agree exactly |
| adjacent | 0.5 | One tier apart (e.g. recommended vs needs_review) |
| disagreement | 0.0 | Significant discrepancy — flag for review |

### Reliability Level

`app/ml/error_analysis.py` assigns a session reliability level:

| Level | Trigger |
|-------|---------|
| high | No edge cases detected |
| medium | 1 edge case (e.g. short session, non-English) |
| low | 2 edge cases |
| very_low | 3+ edge cases |

Sessions with `reliability = low` or `very_low` should be prioritized for human review.

See also:
- [Model Limitations](model_limitations.md)
- [Fairness Analysis](../app/ml/fairness.py)
- [Usage Scenarios](usage_scenarios.md)