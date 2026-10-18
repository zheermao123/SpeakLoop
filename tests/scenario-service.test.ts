import { mkdtempSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { beforeEach, expect, it } from "vitest"
import { Scenario } from "@/lib/domain/types"
import { read, update } from "@/lib/store/json-store"
import { createScenario, draftScenario, getScenario, listScenarios } from "@/lib/services/scenario"
import { FakeChatProvider } from "./fixtures/fake-providers"

beforeEach(() => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "sl-test-"))
})

it("listScenarios 首次调用种子 4 个内置场景，幂等", async () => {
  const first = await listScenarios()
  expect(first).toHaveLength(4)
  expect(first.every(s => s.builtin)).toBe(true)
  expect(await listScenarios()).toHaveLength(4)
})

it("内置种子全部带中文角色 personaZh", async () => {
  const list = await listScenarios()
  expect(list.every(s => s.personaZh)).toBe(true)
})

it("内置种子 personaZh 为英文 persona 的忠实翻译", async () => {
  const list = await listScenarios()
  expect(list.find(s => s.id === "builtin-interview")?.personaZh).toBe("你是 Sarah，一家科技公司友好的招聘经理，正在为高级工程师岗位面试学习者。")
  expect(list.find(s => s.id === "builtin-standup")?.personaZh).toBe("你是主持周会的团队负责人。学习者汇报自己的进展、阻塞与计划。")
  expect(list.find(s => s.id === "builtin-oneonone")?.personaZh).toBe("你是 Alex，学习者的经理，正在进行一次轻松的一对一谈话。")
  expect(list.find(s => s.id === "builtin-smalltalk")?.personaZh).toBe("你是 Jamie，来自另一个团队的友好同事，正在办公室咖啡角与学习者闲聊。")
})

it("旧版内置场景（无 personaZh）自动回填并持久化", async () => {
  await update<Scenario>("scenarios", () => [
    { id: "builtin-interview", title: "英文面试", persona: "You are Sarah.", goals: ["a", "b", "c"], difficulty: "medium", builtin: true },
  ])
  const itv = (await listScenarios()).find(s => s.id === "builtin-interview")!
  expect(itv.personaZh).toBe("你是 Sarah，一家科技公司友好的招聘经理，正在为高级工程师岗位面试学习者。")
  const stored = await read<Scenario>("scenarios")
  expect(stored.find(s => s.id === "builtin-interview")?.personaZh).toBe("你是 Sarah，一家科技公司友好的招聘经理，正在为高级工程师岗位面试学习者。")
})

it("内置场景 personaZh 与种子同步（旧文案自动更新）", async () => {
  await update<Scenario>("scenarios", () => [
    { id: "builtin-smalltalk", title: "同事寒暄", persona: "You are Jamie.", personaZh: "旧文案", goals: ["a", "b", "c"], difficulty: "easy", builtin: true },
  ])
  const itv = (await listScenarios()).find(s => s.id === "builtin-smalltalk")!
  expect(itv.personaZh).toBe("你是 Jamie，来自另一个团队的友好同事，正在办公室咖啡角与学习者闲聊。")
})

it("内置场景含英文 persona 与 goals", async () => {
  const list = await listScenarios()
  const itv = list.find(s => s.title.includes("面试"))!
  expect(itv.persona).toMatch(/[a-zA-Z]/)
  expect(itv.goals.length).toBeGreaterThanOrEqual(3)
})

it("createScenario 保存并可查询", async () => {
  const s = await createScenario({ title: "谈判", persona: "You are Chris.", goals: ["a", "b"], difficulty: "hard" })
  expect((await getScenario(s.id))?.title).toBe("谈判")
})

it("createScenario 支持中文角色 personaZh", async () => {
  const s = await createScenario({ title: "谈判", persona: "You are Chris.", personaZh: "AI 扮演 Chris：谈判对手。", goals: ["a", "b"], difficulty: "hard" })
  expect((await getScenario(s.id))?.personaZh).toBe("AI 扮演 Chris：谈判对手。")
})

it("draftScenario 兜底草稿带中文角色", async () => {
  const d = await draftScenario("和外国客户谈判交期", new FakeChatProvider())
  expect(d.id).toBe("")
  expect(d.personaZh).toBe(`情景演练：和外国客户谈判交期`)
})

it("draftScenario 返回未落库草稿（id 为空）", async () => {
  const d = await draftScenario("和外国客户谈判交期", new FakeChatProvider())
  expect(d.id).toBe("")
  expect(d.title).toContain("谈判")
  expect((await listScenarios()).length).toBe(4)
})

it("首次播种返回隔离副本，变异不污染种子", async () => {
  const first = await listScenarios()
  first.reverse()
  first[0].title = "HACKED"
  const { rmSync } = await import("node:fs")
  const { join } = await import("node:path")
  rmSync(join(process.env.DATA_DIR!, "scenarios.json"))
  const again = await listScenarios()
  expect(again).toHaveLength(4)
  expect(again.some(s => s.title === "HACKED")).toBe(false)
  expect(again.map(s => s.id)).toEqual([
    "builtin-interview", "builtin-standup", "builtin-oneonone", "builtin-smalltalk",
  ])
})
