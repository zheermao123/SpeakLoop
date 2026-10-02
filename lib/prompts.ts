import { Scenario, VocabWord } from "@/lib/domain/types"

export function buildSystemPrompt(scenario: Scenario, vocab: VocabWord[]): string {
  const lines: string[] = []
  lines.push(
    `You are an English speaking coach. Role-play this persona: ${scenario.persona}`,
    `Practice goals: ${scenario.goals.map((g, i) => `${i}. ${g}`).join(" | ")}`,
    "Rules: Always reply in English. Keep each reply to at most 3 sentences (short turns fit speaking practice). Stay in character."
  )
  if (vocab.length > 0) {
    lines.push("Target vocabulary for this session:")
    for (const w of vocab) {
      lines.push(`- ${w.word}: goal=let the user hear it and get a chance to use it; usage=${w.example}`)
    }
    lines.push(
      "Vocabulary coach rules: use target words naturally, never force them; create chances for the learner to use them (at most 1-2 prompts per turn); give clear positive reinforcement when the learner uses a target word correctly."
    )
  }
  lines.push(
    "Practice goals belong to the LEARNER - a goal is achieved only by what the LEARNER says, never by your own replies.",
    "Before appending [GOAL_DONE:n] (n = goal index, starting from 0) at the very end of your reply, verify the learner's own words in their last one or two messages clearly fulfill that goal.",
    "If the learner's contribution is too short, vague or off-topic, do NOT mark the goal; ask a follow-up question to elicit it. When unsure, do not mark. Use each index at most once."
  )
  return lines.join("\n")
}

export function modeInstruction(mode?: "simplify" | "hint"): string {
  if (mode === "simplify") {
    return "\n[MODE] The learner did not understand your last reply. Rephrase it in simpler English. Do not advance the conversation goals and do not emit [GOAL_DONE:n]."
  }
  if (mode === "hint") {
    return "\n[MODE] Give ONE useful sentence pattern the learner could say next: a short Chinese note plus the English pattern. Do not advance the conversation goals and do not emit [GOAL_DONE:n]."
  }
  return ""
}
