from google.genai import types


def build_system_instruction(max_duration_seconds: int) -> str:
    """Renders SYSTEM_INSTRUCTION with the Phase 1 pacing target derived from
    settings.max_interview_duration, the same value handler.py enforces as
    the hard session timeout -- keeps the model's stated time budget from
    drifting out of sync with the actual cutoff."""
    phase_1_minutes = max(1, round(max_duration_seconds / 60))
    return f"""You are a warm, friendly guide helping a university applicant record their video presentation for inVision University.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 0 — DISCOVERY (1 minute, 1-2 exchanges, informal)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Start with a single warm-up question to help the applicant feel comfortable.

Begin with: "Hi! Before we start, tell me briefly — what's one thing you're excited about right now?"

DISCOVERY RULES:
- ONE follow-up at most. Keep this under 1 minute total.
- Listen for specific details: names, places, projects.
- After 1-2 exchanges, transition immediately: "Great, let's move to the main part of your presentation."
- Use what you learned to make Phase 1 feel personal.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 1 — FORMAL PRESENTATION (~{phase_1_minutes} minutes total, 6 questions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Guide the applicant through these 6 questions in order:

1. Why are you applying to inVision U?
2. Which program are you applying to, and why did you choose it?
3. Tell me about a major challenge you overcame. What did you learn from it?
4. What are your long-term goals, and how will this program help you achieve them?
5. What does leadership mean to you? Give me a specific example of when you showed leadership.
6. Does your family support your decision to study here? Who encourages you most?

PRESENTATION STYLE:
- Warm, encouraging, not stressful. You are a guide, not an interrogator.
- After each answer, briefly acknowledge (1-2 sentences), then move to the next question.
- Do NOT ask follow-up questions — keep the presentation moving.
- Keep your responses concise (2-3 sentences max).
- Where natural, connect their Phase 0 context to the questions.
- After Question 6, warmly thank them and let them know their presentation is complete.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPORTANT RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Speak in English by default, but if the applicant uses another language, adapt immediately.
- Never reveal that you are AI. Conduct this as a human guide would.
- Do not ask more than one question at a time.
- **IMMEDIATELY after the applicant answers Question 6, you MUST call the end_session function.** Do not add any conversational message after calling the function.
- If the applicant is unresponsive for an extended period, ask if they are still there. After two attempts with no response, call end_session.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EVALUATION TASK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Throughout both phases, observe and take notes on:
- Communication quality and confidence
- Authenticity: do they reference specific personal details or use generic phrases?
- Consistency: does what they say in Phase 1 align with what they shared in Phase 0?
- Motivation depth: specific and genuine, or vague and scripted?

You are writing notes for the admissions committee who will make the final decision.

**You MUST call end_session when Question 6 is answered. Do not wait.** Call it with:
- applicant_notes: their answers to each question (from Phase 1)
- overall_impression: a brief summary including any notable Phase 0 context
- overall_score: a numeric score from 1 to 10 reflecting overall suitability
- recommendation: your honest assessment
- strengths: top 2-3 strengths you observed across both phases
- concerns: any red flags or weak areas

Be honest and objective in your evaluation."""


def build_end_session_tool() -> types.Tool:
    return types.Tool(
        function_declarations=[
            types.FunctionDeclaration(
                name="end_session",
                description="Call when all 6 questions are complete or the applicant is unresponsive. Saves your evaluation and ends the interview.",
                parameters=types.Schema(
                    type="object",
                    properties={
                        "applicant_notes": types.Schema(
                            type="object",
                            properties={
                                "q1_why_applying": types.Schema(type="string"),
                                "q2_program_choice": types.Schema(type="string"),
                                "q3_challenge_overcome": types.Schema(type="string"),
                                "q4_long_term_goals": types.Schema(type="string"),
                                "q5_leadership": types.Schema(type="string"),
                                "q6_family_support": types.Schema(type="string"),
                                "language_used": types.Schema(type="string"),
                                "confidence_level": types.Schema(
                                    type="string",
                                    enum=["high", "medium", "low"],
                                ),
                                "communication_quality": types.Schema(
                                    type="string",
                                    enum=[
                                        "excellent",
                                        "good",
                                        "average",
                                        "poor",
                                    ],
                                ),
                            },
                        ),
                        "overall_impression": types.Schema(
                            type="string",
                            description="Brief summary for the admissions committee",
                        ),
                        "overall_score": types.Schema(
                            type="number",
                            description="Overall score from 1 to 10",
                        ),
                        "recommendation": types.Schema(
                            type="string",
                            enum=[
                                "strongly_recommended",
                                "recommended",
                                "needs_review",
                                "not_recommended",
                            ],
                        ),
                        "strengths": types.Schema(
                            type="array",
                            items=types.Schema(type="string"),
                        ),
                        "concerns": types.Schema(
                            type="array",
                            items=types.Schema(type="string"),
                        ),
                    },
                    required=[
                        "applicant_notes",
                        "overall_impression",
                        "recommendation",
                    ],
                ),
            )
        ]
    )
