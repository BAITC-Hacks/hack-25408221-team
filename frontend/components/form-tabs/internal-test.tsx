"use client"

import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"

const personalityQuestions = [
  {
    id: 1,
    question: "When I see that something can be improved, I usually...",
    options: [
      "Wait until I fully understand how to make it better.",
      "Discuss with others whether something should be changed.",
      "Try to make an improvement right away, even a small one.",
      "Notice what could be better but avoid getting involved unless asked."
    ]
  },
  {
    id: 2,
    question: 'When a group discussion reaches a "dead end" and no one suggests ideas, I...',
    options: [
      "Pause and wait for someone else to speak first.",
      "Ask a question to restart the discussion.",
      "Offer an idea, even if it's not fully developed.",
      "Suggest postponing the discussion until later."
    ]
  },
  {
    id: 3,
    question: "When I face a problem I've never encountered before, I...",
    options: [
      "Look for a solution on my own, using available resources.",
      "First learn how others have solved similar problems.",
      "Ask someone who knows better.",
      "Leave it as it is to avoid making things worse."
    ]
  },
  {
    id: 4,
    question: "If a teammate makes a mistake that affects my part of the project, I...",
    options: [
      "Discuss it with them and help fix it since it's a shared outcome.",
      "Inform the supervisor and let them decide what to do.",
      "Mention the mistake but avoid interfering — everyone is responsible for their part.",
      "Point out that my part was done correctly and it's not my responsibility."
    ]
  },
  {
    id: 5,
    question: "If I promised to help someone but realize I won't make it on time, I...",
    options: [
      "Let them know I can't help and explain why.",
      "Inform them early, apologize, and try to fulfill my promise later.",
      "Avoid contact for a while to skip awkward explanations.",
      "Wait until they solve it on their own."
    ]
  },
  {
    id: 6,
    question: "If I promised the team to complete a task but realize I can't, I...",
    options: [
      "Inform them in advance and help reassign the task.",
      "Stay silent, hoping to finish at least part of it.",
      "Explain later that my situation changed and it's not my fault.",
      "Warn the team at the last moment and ask for their help."
    ]
  },
  {
    id: 7,
    question: "When I'm learning something new and face difficulties, I...",
    options: [
      "See it as part of growth and look for solutions.",
      "Stop doing it, thinking it's just not for me.",
      "Put it aside and return later when inspired.",
      "Ask for help to save time."
    ]
  },
  {
    id: 8,
    question: "When I think about my future, I...",
    options: [
      "Plan which skills to develop to move forward.",
      "Go with the flow — life will show the way.",
      "Listen to advice and try to define a direction for growth.",
      "Don't think about it much — luck decides most things."
    ]
  },
  {
    id: 9,
    question: "When I notice the teacher explains something superficially, I...",
    options: [
      "Assume it's not that important.",
      "Ask for additional reading materials.",
      "Wait, hoping the next class will clarify things.",
      "Find extra sources and study the topic deeper on my own."
    ]
  },
  {
    id: 10,
    question: "When a task takes more time than expected, I...",
    options: [
      "Adjust my approach and continue until I finish.",
      "Switch to something else to avoid getting stuck.",
      "Wait until I get more support or resources.",
      "Break it down into smaller parts to move gradually."
    ]
  },
  {
    id: 11,
    question: "When I lack motivation or energy, I...",
    options: [
      "Remind myself why I started and finish anyway.",
      "Switch to easier parts to maintain momentum.",
      "Stop, believing that forcing myself won't help.",
      "Take a break and wait for the right mood."
    ]
  },
  {
    id: 12,
    question: "When competition rules suddenly change at the final stage, I...",
    options: [
      "Complete it formally — it's too late to change much.",
      "Keep the same approach but improve the presentation.",
      "Adapt my project to the new requirements.",
      "Drop out, believing it's unfair."
    ]
  },
  {
    id: 13,
    question: "When I receive critical feedback on my work, I...",
    options: [
      "Analyze it carefully and use it to improve.",
      "Feel discouraged but try to take the useful parts.",
      "Defend my approach and explain why I did it that way.",
      "Ignore it if I don't agree with the person giving it."
    ]
  },
  {
    id: 14,
    question: "When working in a team with different opinions, I...",
    options: [
      "Try to find a compromise that incorporates the best ideas.",
      "Advocate strongly for my own viewpoint.",
      "Step back and let others decide.",
      "Suggest voting to reach a quick decision."
    ]
  },
  {
    id: 15,
    question: "When I have a lot of tasks to complete, I...",
    options: [
      "Make a list and prioritize by importance and deadline.",
      "Start with the easiest ones to build momentum.",
      "Tackle the hardest one first.",
      "Work on whatever feels most urgent in the moment."
    ]
  },
  {
    id: 16,
    question: "When someone shares a problem with me, I usually...",
    options: [
      "Listen carefully and ask questions to understand better.",
      "Immediately suggest solutions.",
      "Share a similar experience I've had.",
      "Feel uncomfortable and try to change the subject."
    ]
  },
  {
    id: 17,
    question: "When I make a mistake, I...",
    options: [
      "Acknowledge it openly and learn from it.",
      "Feel bad but try to fix it quietly.",
      "Explain the circumstances that led to it.",
      "Try to move on quickly without dwelling on it."
    ]
  },
  {
    id: 18,
    question: "When I'm given a task with unclear instructions, I...",
    options: [
      "Ask for clarification before starting.",
      "Start working and figure it out as I go.",
      "Look for similar examples to guide me.",
      "Wait until the instructions become clearer."
    ]
  },
  {
    id: 19,
    question: "When I disagree with a decision made by a leader, I...",
    options: [
      "Share my perspective respectfully and explain my reasoning.",
      "Follow the decision but note my concerns.",
      "Stay silent to avoid conflict.",
      "Try to convince others to see my point of view."
    ]
  },
  {
    id: 20,
    question: "When I'm under a tight deadline, I...",
    options: [
      "Stay focused and manage my time carefully.",
      "Work faster but worry about quality.",
      "Ask for help or extensions if needed.",
      "Feel stressed and struggle to concentrate."
    ]
  },
  {
    id: 21,
    question: "When I notice someone being treated unfairly, I...",
    options: [
      "Speak up and address the situation.",
      "Talk to the person privately afterward.",
      "Report it to someone in authority.",
      "Feel uncomfortable but don't intervene."
    ]
  },
  {
    id: 22,
    question: "When starting a new project, I prefer to...",
    options: [
      "Plan everything thoroughly before taking action.",
      "Start with a rough idea and refine as I go.",
      "Research extensively to gather all the information.",
      "Jump in and learn through doing."
    ]
  },
  {
    id: 23,
    question: "When I achieve a goal, I...",
    options: [
      "Celebrate briefly and set the next goal.",
      "Reflect on what I learned from the process.",
      "Share the credit with those who helped.",
      "Take time to enjoy the accomplishment."
    ]
  },
  {
    id: 24,
    question: "When I'm in an unfamiliar social situation, I...",
    options: [
      "Try to start conversations and meet people.",
      "Observe first and join in when comfortable.",
      "Stay close to someone I already know.",
      "Wait for others to approach me."
    ]
  },
  {
    id: 25,
    question: "When I have to learn a complex new skill, I...",
    options: [
      "Break it down into smaller, manageable parts.",
      "Find a mentor or teacher to guide me.",
      "Practice repeatedly until it becomes natural.",
      "Study the theory before attempting practice."
    ]
  },
  {
    id: 26,
    question: "When plans fall through unexpectedly, I...",
    options: [
      "Quickly come up with an alternative plan.",
      "Feel frustrated but adapt eventually.",
      "Go with whatever happens next.",
      "Try to salvage the original plan."
    ]
  },
  {
    id: 27,
    question: "When someone asks for my honest opinion, I...",
    options: [
      "Give it directly but tactfully.",
      "Soften it to avoid hurting their feelings.",
      "Ask them what kind of feedback they want first.",
      "Share my thoughts but emphasize the positives."
    ]
  },
  {
    id: 28,
    question: "When I'm working on something I'm passionate about, I...",
    options: [
      "Lose track of time and give it my full attention.",
      "Work in bursts of intense focus.",
      "Balance it with other responsibilities carefully.",
      "Share my enthusiasm with others to get them involved."
    ]
  },
  {
    id: 29,
    question: "When I face a setback, I...",
    options: [
      "Analyze what went wrong and adjust my approach.",
      "Take a step back to regain perspective.",
      "Push through with even more determination.",
      "Seek advice from someone I trust."
    ]
  },
  {
    id: 30,
    question: "When I'm asked to lead a group, I...",
    options: [
      "Feel confident and organize everyone's roles.",
      "Accept but prefer a collaborative approach.",
      "Feel nervous but try my best.",
      "Suggest someone else might be better suited."
    ]
  },
  {
    id: 31,
    question: "When I encounter information that contradicts my beliefs, I...",
    options: [
      "Examine it carefully and reconsider my position.",
      "Look for evidence on both sides before deciding.",
      "Dismiss it if my beliefs are well-founded.",
      "Feel uncomfortable and avoid thinking about it."
    ]
  },
  {
    id: 32,
    question: "When I have free time, I usually...",
    options: [
      "Use it productively to learn or improve something.",
      "Relax and recharge.",
      "Catch up on tasks I've been putting off.",
      "Spend time with friends or family."
    ]
  },
  {
    id: 33,
    question: "When I'm part of a successful team, I...",
    options: [
      "Make sure everyone gets recognition.",
      "Feel proud of my contribution.",
      "Think about how to replicate the success.",
      "Enjoy the moment and celebrate together."
    ]
  },
  {
    id: 34,
    question: "When I need to make a difficult decision, I...",
    options: [
      "List the pros and cons systematically.",
      "Trust my gut feeling.",
      "Consult people whose judgment I respect.",
      "Sleep on it and decide the next day."
    ]
  },
  {
    id: 35,
    question: "When I see an opportunity to help someone grow, I...",
    options: [
      "Offer guidance and share my experience.",
      "Encourage them to find their own path.",
      "Connect them with resources or people who can help.",
      "Wait for them to ask for help first."
    ]
  },
  {
    id: 36,
    question: "When I'm criticized publicly, I...",
    options: [
      "Stay composed and address it professionally.",
      "Feel embarrassed but handle it afterward.",
      "Defend myself in the moment.",
      "Feel hurt and withdraw."
    ]
  },
  {
    id: 37,
    question: "When I'm given responsibility beyond my comfort zone, I...",
    options: [
      "See it as a chance to grow and take it on.",
      "Accept it but seek guidance along the way.",
      "Express my concerns but do my best.",
      "Suggest someone more experienced should handle it."
    ]
  },
  {
    id: 38,
    question: "When reflecting on my personal growth, I...",
    options: [
      "Regularly assess my progress and set new goals.",
      "Notice changes naturally without formal reflection.",
      "Compare myself to where I was a year ago.",
      "Rely on feedback from others to gauge growth."
    ]
  },
  {
    id: 39,
    question: "When I feel envy, I...",
    options: [
      "Acknowledge it and think about what I can do to improve myself.",
      "Think life is unfair and get into a bad mood.",
      "Try not to show that something has affected me.",
      "Shift my focus to something else to calm down."
    ]
  },
  {
    id: 40,
    question: "When I feel irritated by others, I...",
    options: [
      "Step aside to cool down a bit.",
      "Try not to show my irritation, even if I'm boiling inside.",
      "Acknowledge my feelings and try to understand what exactly triggered me.",
      "Think irritation is a normal reaction and don't see a reason to overthink it."
    ]
  }
]

interface InternalTestTabProps {
  formData: Record<string, unknown>
  updateFormData: (data: Record<string, unknown>) => void
  showErrors?: boolean
}

export function InternalTestTab({ formData, updateFormData, showErrors }: InternalTestTabProps) {
  const [answers, setAnswers] = useState<Record<number, string>>(
    (formData.testAnswers as Record<number, string>) || {}
  )
  const [privacyConsent, setPrivacyConsent] = useState(formData.testPrivacyConsent as boolean || false)
  const [minorConsent, setMinorConsent] = useState(formData.testMinorConsent as boolean || false)

  const handleAnswerChange = (questionId: number, answer: string) => {
    const newAnswers = { ...answers, [questionId]: answer }
    setAnswers(newAnswers)
    updateFormData({ testAnswers: newAnswers })
  }

  return (
    <div className="space-y-8">
      {/* Introduction */}
      <div className="rounded-lg bg-muted/50 p-6">
        <h3 className="text-lg font-semibold">This is a personality test.</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          There are no right or wrong answers — we just want to understand you better, your way of thinking, 
          and what drives your decisions. Be honest and go with your first instinct.
        </p>
      </div>

      {/* Questions */}
      {personalityQuestions.map((q) => (
        <div key={q.id} className="rounded-lg bg-background p-6 shadow-sm">
          <h4 className="text-base font-semibold">
            {q.id}. {q.question}
          </h4>
          <p className="mt-1 text-sm text-muted-foreground">Choose one option</p>
          <div className="mt-2 h-px bg-border" />
          
          <div className="mt-4 space-y-3">
            {q.options.map((option, idx) => (
              <label
                key={idx}
                className="flex cursor-pointer items-start gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50"
              >
                <Checkbox
                  checked={answers[q.id] === option}
                  onCheckedChange={() => handleAnswerChange(q.id, option)}
                  className="mt-0.5"
                />
                <span className="text-sm">{option}</span>
              </label>
            ))}
          </div>
          
          {showErrors && !answers[q.id] && (
            <p className="mt-2 text-sm text-red-500">Field is required</p>
          )}
        </div>
      ))}

      {/* Consent checkboxes */}
      <div className="rounded-lg bg-background p-6 shadow-sm">
        <div className="space-y-4">
          <label className="flex items-start gap-3">
            <Checkbox
              checked={privacyConsent}
              onCheckedChange={(checked) => {
                setPrivacyConsent(checked as boolean)
                updateFormData({ testPrivacyConsent: checked })
              }}
              className="mt-0.5"
            />
            <span className="text-sm">
              By submitting this form, you agree to the processing of your personal data in accordance with our{" "}
              <a href="#" className="text-foreground underline">Privacy Policy</a>
              <span className="text-red-500"> *</span>
            </span>
          </label>
          {showErrors && !privacyConsent && (
            <p className="ml-7 text-sm text-red-500">Field is required</p>
          )}

          <label className="flex items-start gap-3">
            <Checkbox
              checked={minorConsent}
              onCheckedChange={(checked) => {
                setMinorConsent(checked as boolean)
                updateFormData({ testMinorConsent: checked })
              }}
              className="mt-0.5"
            />
            <span className="text-sm">
              If the participant is under the age of 18, this questionnaire must be completed by their parent or legal guardian. 
              By proceeding, you confirm that you are either (a) the participant aged 18 or older, or (b) the parent or legal guardian 
              completing this form on behalf of a minor.
              <span className="text-red-500"> *</span>
            </span>
          </label>
          {showErrors && !minorConsent && (
            <p className="ml-7 text-sm text-red-500">Field is required</p>
          )}
        </div>
      </div>
    </div>
  )
}
