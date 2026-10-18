import { randomUUID } from "node:crypto"
import { Scenario } from "@/lib/domain/types"
import { ChatProvider, getChat } from "@/lib/providers/types"
import { read, update } from "@/lib/store/json-store"

const SEED_SCENARIOS: Scenario[] = [
  {
    id: "builtin-interview",
    title: "英文面试",
    persona: "You are Sarah, a friendly hiring manager at a tech company, interviewing the learner for a senior engineer position.",
    personaZh: "你是 Sarah，一家科技公司友好的招聘经理，正在为高级工程师岗位面试学习者。",
    goals: ["Introduce yourself and your experience", "Describe a challenging project you worked on", "Ask a question about the role"],
    difficulty: "medium",
    builtin: true,
    voice: "Serena",
  },
  {
    id: "builtin-standup",
    title: "周会汇报",
    persona: "You are the team lead running the weekly sync. The learner reports their progress, blockers and plans.",
    personaZh: "你是主持周会的团队负责人。学习者汇报自己的进展、阻塞与计划。",
    goals: ["Report last week's progress", "Describe a blocker and ask for help", "Agree on next steps"],
    difficulty: "easy",
    builtin: true,
  },
  {
    id: "builtin-oneonone",
    title: "向上沟通（1:1）",
    persona: "You are Alex, the learner's manager, having a relaxed one-on-one conversation.",
    personaZh: "你是 Alex，学习者的经理，正在进行一次轻松的一对一谈话。",
    goals: ["Share a concern about workload", "Propose an idea for improvement", "Negotiate a deadline"],
    difficulty: "medium",
    builtin: true,
    voice: "Ryan",
  },
  {
    id: "builtin-smalltalk",
    title: "同事寒暄",
    persona: "You are Jamie, a friendly colleague from another team, chatting with the learner at the office coffee corner.",
    personaZh: "你是 Jamie，来自另一个团队的友好同事，正在办公室咖啡角与学习者闲聊。",
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
    if (!s.builtin) return s
    const seed = SEED_SCENARIOS.find(x => x.id === s.id)
    if (!seed || s.personaZh === seed.personaZh) return s
    return { ...s, personaZh: seed.personaZh }
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
  personaZh?: string
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
    '{"title":string(中文),"persona":string(English role-play setting),"personaZh":string(同一角色的中文描述),"goals":string[](3 English goals),"difficulty":"easy"|"medium"|"hard"}'
  const raw = await provider.chat(system, [{ role: "user", content: description }])
  let draft: Scenario
  try {
    const j = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""))
    const persona = String(j.persona ?? "You are a friendly colleague.")
    draft = {
      id: "",
      title: String(j.title ?? description),
      persona,
      personaZh: String(j.personaZh ?? "你是一位友好的同事。"),
      goals: Array.isArray(j.goals) && j.goals.length ? j.goals.map(String) : ["Keep the conversation going"],
      difficulty: j.difficulty === "easy" || j.difficulty === "hard" ? j.difficulty : "medium",
      builtin: false,
    }
  } catch {
    draft = {
      id: "",
      title: `自定义：${description.slice(0, 12)}`,
      persona: `Role-play a workplace scenario: ${description}`,
      personaZh: `情景演练：${description}`,
      goals: ["Open the conversation", "Discuss the main topic", "Wrap up politely"],
      difficulty: "medium",
      builtin: false,
    }
  }
  return draft
}
