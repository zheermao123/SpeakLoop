import { randomUUID } from "node:crypto"
import { Scenario } from "@/lib/domain/types"
import { getChat } from "@/lib/providers/types"
import { read, update } from "@/lib/store/json-store"

const SEED_SCENARIOS: Scenario[] = [
  {
    id: "builtin-interview",
    title: "英文面试",
    persona: "You are Sarah, a friendly hiring manager at a tech company, interviewing the learner for a senior engineer position.",
    goals: ["Introduce yourself and your experience", "Describe a challenging project you worked on", "Ask a question about the role"],
    difficulty: "medium",
    builtin: true,
    voice: "Serena",
  },
  {
    id: "builtin-standup",
    title: "周会汇报",
    persona: "You are the team lead running the weekly sync. The learner reports their progress, blockers and plans.",
    goals: ["Report last week's progress", "Describe a blocker and ask for help", "Agree on next steps"],
    difficulty: "easy",
    builtin: true,
  },
  {
    id: "builtin-oneonone",
    title: "向上沟通（1:1）",
    persona: "You are Alex, the learner's manager, having a relaxed one-on-one conversation.",
    goals: ["Share a concern about workload", "Propose an idea for improvement", "Negotiate a deadline"],
    difficulty: "medium",
    builtin: true,
    voice: "Ryan",
  },
  {
    id: "builtin-smalltalk",
    title: "同事寒暄",
    persona: "You are Jamie, a friendly colleague from another team, chatting with the learner at the office coffee corner.",
    goals: ["Greet and make small talk about the weekend", "Talk casually about current projects", "End the conversation politely"],
    difficulty: "easy",
    builtin: true,
  },
]

export async function listScenarios(): Promise<Scenario[]> {
  const existing = await read<Scenario>("scenarios")
  if (existing.length > 0) return existing
  await update<Scenario>("scenarios", () => SEED_SCENARIOS)
  return structuredClone(SEED_SCENARIOS)
}

export async function getScenario(id: string): Promise<Scenario | undefined> {
  return (await listScenarios()).find(s => s.id === id)
}

export async function createScenario(input: {
  title: string
  persona: string
  goals: string[]
  difficulty: Scenario["difficulty"]
}): Promise<Scenario> {
  const scenario: Scenario = { id: randomUUID(), ...input, builtin: false }
  await update<Scenario>("scenarios", d => [...d, scenario])
  return scenario
}

export async function draftScenario(description: string): Promise<Scenario> {
  const system =
    "You are a scenario designer for workplace English practice. Output ONLY a JSON object: " +
    '{"title":string(中文),"persona":string(English role-play setting),"goals":string[](3 English goals),"difficulty":"easy"|"medium"|"hard"}'
  const raw = await getChat().chat(system, [{ role: "user", content: description }])
  let draft: Scenario
  try {
    const j = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""))
    draft = {
      id: "",
      title: String(j.title ?? description),
      persona: String(j.persona ?? "You are a friendly colleague."),
      goals: Array.isArray(j.goals) && j.goals.length ? j.goals.map(String) : ["Keep the conversation going"],
      difficulty: j.difficulty === "easy" || j.difficulty === "hard" ? j.difficulty : "medium",
      builtin: false,
    }
  } catch {
    draft = {
      id: "",
      title: `自定义：${description.slice(0, 12)}`,
      persona: `Role-play a workplace scenario: ${description}`,
      goals: ["Open the conversation", "Discuss the main topic", "Wrap up politely"],
      difficulty: "medium",
      builtin: false,
    }
  }
  return draft
}
