import { existsSync, mkdtempSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { beforeEach, expect, it } from "vitest"
import { Turn } from "@/lib/domain/types"
import { appendTurn, createSession, getSession, listSessions, saveAudio, saveReport } from "@/lib/services/practice"

beforeEach(() => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "sl-test-"))
})

const turn = (id: string, n: number): Turn => ({
  id, userText: `u${n}`, aiText: `a${n}`, sttProvider: "keyboard",
  createdAt: new Date(Date.now() + n).toISOString(),
})

it("createSession + appendTurn + goalProgress 并集", async () => {
  const s = await createSession("sc1")
  await appendTurn(s.id, turn("t1", 1), [0])
  await appendTurn(s.id, turn("t2", 2), [0, 1])
  await appendTurn(s.id, turn("t3", 3), [])
  const after = (await getSession(s.id))!
  expect(after.turns.map(t => t.id)).toEqual(["t1", "t2", "t3"])
  expect(after.goalProgress).toEqual([0, 1])
})

it("appendTurn 同 id 去重（重试幂等）", async () => {
  const s = await createSession("sc1")
  await appendTurn(s.id, turn("t1", 1))
  await appendTurn(s.id, { ...turn("t1", 1), aiText: "fixed" })
  expect((await getSession(s.id))!.turns).toHaveLength(1)
  expect((await getSession(s.id))!.turns[0].aiText).toBe("fixed")
})

it("listSessions 按开始时间降序", async () => {
  const a = await createSession("sc1")
  await new Promise(r => setTimeout(r, 5))
  const b = await createSession("sc1")
  expect((await listSessions()).map(s => s.id)).toEqual([b.id, a.id])
})

it("saveAudio 写文件并返回 URL", async () => {
  const s = await createSession("sc1")
  const url = await saveAudio(s.id, "t1", Buffer.from("fake"))
  expect(url).toBe(`/api/audio/${s.id}/t1.webm`)
  expect(existsSync(path.join(process.env.DATA_DIR!, "audio", s.id, "t1.webm"))).toBe(true)
})

it("saveReport 内嵌到 session", async () => {
  const s = await createSession("sc1")
  await saveReport(s.id, { sessionId: s.id, summary: "s", highlights: [], corrections: [], vocabCandidates: [] })
  expect((await getSession(s.id))!.report?.summary).toBe("s")
})
