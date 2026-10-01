import { mkdtempSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { beforeEach, expect, it } from "vitest"
import { createScenario, draftScenario, getScenario, listScenarios } from "@/lib/services/scenario"

beforeEach(() => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "sl-test-"))
})

it("listScenarios 首次调用种子 4 个内置场景，幂等", async () => {
  const first = await listScenarios()
  expect(first).toHaveLength(4)
  expect(first.every(s => s.builtin)).toBe(true)
  expect(await listScenarios()).toHaveLength(4)
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

it("draftScenario 返回未落库草稿（id 为空）", async () => {
  const d = await draftScenario("和外国客户谈判交期")
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
