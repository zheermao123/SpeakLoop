import { randomUUID } from "node:crypto"
import { Scenario } from "@/lib/domain/types"
import { ChatProvider, getChat } from "@/lib/providers/types"
import { read, update } from "@/lib/store/json-store"

const SEED_SCENARIOS: Scenario[] = [
  {
    id: "builtin-interview",
    title: "英文面试",
    persona: "You are Sarah, a friendly hiring manager at a tech company, interviewing the learner for a senior engineer position.",
    personaZh: "AI 扮演 Sarah：科技公司友好的招聘经理，正在面试你这位高级工程师候选人。",
    goals: ["Introduce yourself and your experience", "Describe a challenging project you worked on", "Ask a question about the role"],
    difficulty: "medium",
    builtin: true,
    voice: "Serena",
  },
  {
    id: "builtin-standup",
    title: "周会汇报",
    persona: "You are the team lead running the weekly sync. The learner reports their progress, blockers and plans.",
    personaZh: "AI 扮演你的团队负责人：主持周会，听你汇报进展、阻塞与计划。",
    goals: ["Report last week's progress", "Describe a blocker and ask for help", "Agree on next steps"],
    difficulty: "easy",
    builtin: true,
  },
  {
    id: "builtin-oneonone",
    title: "向上沟通（1:1）",
    persona: "You are Alex, the learner's manager, having a relaxed one-on-one conversation.",
    personaZh: "AI 扮演 Alex：你的经理，与你进行一次轻松的一对一交流。",
    goals: ["Share a concern about workload", "Propose an idea for improvement", "Negotiate a deadline"],
    difficulty: "medium",
    builtin: true,
    voice: "Ryan",
  },
  {
    id: "builtin-smalltalk",
    title: "同事寒暄",
    persona: "You are Jamie, a friendly colleague from another team, chatting with the learner at the office coffee corner.",
    personaZh: "AI 扮演 Jamie：邻团队的友好同事，在办公室咖啡角与你闲聊。",
    goals: ["Greet and make small talk about the weekend", "Talk casually about current projects", "End the conversation politely"],
    difficulty: "easy",
    builtin: true,
  },
]

export async function listScenarios(): Promise<Scenario[]> {
  const existing = await read<Scenario>("scenarios")
  if (existing.length === 0) {
    await update<Scenario>("scenarios", () => SEED_SCENARIOS)
    return structuredClone(SEED_SCENARIOS)
  }
  const patched = existing.map(s => {
    if (!s.builtin || s.personaZh) return s
    const seed = SEED_SCENARIOS.find(x => x.id === s.id)
    return seed?.personaZh ? { ...s, personaZh: seed.personaZh } : s
  })
  if (patched.some((s, i) => s !== existing[i])) {
    await update<Scenario>("scenarios", () => patched)
  }
  return patched
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

export async function draftScenario(description: string, chat?: ChatProvider): Promise<Scenario> {
  const provider = chat ?? (await getChat())
  const system =
    "You are a scenario designer for workplace English practice. Output ONLY a JSON object: " +
    '{"title":string(中文),"persona":string(English role-play setting),"goals":string[](3 English goals),"difficulty":"easy"|"medium"|"hard"}'
  const raw = await provider.chat(system, [{ role: "user", content: description }])
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
