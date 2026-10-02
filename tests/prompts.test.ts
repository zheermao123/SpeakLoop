import { expect, it } from "vitest"
import { Scenario, VocabWord } from "@/lib/domain/types"
import { buildSystemPrompt, modeInstruction } from "@/lib/prompts"

const scenario: Scenario = {
  id: "s1", title: "面试", persona: "You are Sarah, a hiring manager.",
  goals: ["Introduce yourself", "Describe a project"], difficulty: "medium", builtin: true,
}
const word: VocabWord = {
  id: "v1", word: "stakeholder", translation: "利益相关方",
  example: "Let's align with stakeholders first.", sourceSessionId: "x",
  status: "learning", timesEncountered: 0, createdAt: "2026-10-01T00:00:00Z",
}

it("包含 persona、goals、3 句上限与 GOAL_DONE 指令", () => {
  const p = buildSystemPrompt(scenario, [])
  expect(p).toContain("Sarah")
  expect(p).toContain("Introduce yourself")
  expect(p).toContain("at most 3 sentences")
  expect(p).toContain("[GOAL_DONE:n]")
  expect(p).toContain("belong to the LEARNER")
  expect(p).toContain("do NOT mark the goal")
})

it("生词为空时不出现词汇段", () => {
  expect(buildSystemPrompt(scenario, [])).not.toContain("Target vocabulary")
})

it("结构化注入包含词、例句与教练规则", () => {
  const p = buildSystemPrompt(scenario, [word])
  expect(p).toContain("Target vocabulary")
  expect(p).toContain("stakeholder")
  expect(p).toContain("align with stakeholders")
  expect(p).toContain("positive reinforcement")
})

it("modeInstruction 分流", () => {
  expect(modeInstruction()).toBe("")
  expect(modeInstruction("simplify")).toContain("simpler English")
  expect(modeInstruction("hint")).toContain("sentence pattern")
})
