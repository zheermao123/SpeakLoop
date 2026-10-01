import { mkdtempSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { beforeEach, expect, it } from "vitest"
import { RawReport } from "@/lib/report-schema"
import { Turn } from "@/lib/domain/types"
import { addWord, listWords } from "@/lib/services/vocab"
import { createSession, appendTurn, getSession } from "@/lib/services/practice"
import { backfillCorrections, generateReport } from "@/lib/services/report"

beforeEach(() => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "sl-test-"))
})

const turn = (id: string, userText: string): Turn => ({
  id, userText, aiText: "ok", sttProvider: "keyboard",
  createdAt: new Date(Date.now() + Math.random()).toISOString(),
})

const raw = (over: Partial<RawReport> = {}): RawReport => ({
  summary: "s",
  highlights: ["h1"],
  corrections: [
    { turnId: "t1", original: "I go yesterday", type: "grammar", improved: "I went yesterday", explanation: "过去时" },
  ],
  vocabCandidates: [{ word: "blocker", translation: "阻碍", example: "a blocker" }],
  ...over,
})

it("回填校验：turnId 匹配则保留", () => {
  const out = backfillCorrections(raw(), [turn("t1", "I go yesterday")])
  expect(out).toHaveLength(1)
  expect(out[0].turnId).toBe("t1")
})

it("回填校验：turnId 不存在但原文匹配则修正 turnId", () => {
  const out = backfillCorrections(raw(), [turn("real-id", "I go yesterday")])
  expect(out).toHaveLength(1)
  expect(out[0].turnId).toBe("real-id")
})

it("回填校验：幻觉（无匹配）与空 original 被丢弃", () => {
  const r = raw({ corrections: [
    { turnId: "ghost", original: "never said this", type: "vocab", improved: "x", explanation: "y" },
    { turnId: "t1", original: "", type: "vocab", improved: "x", explanation: "y" },
  ] })
  expect(backfillCorrections(r, [turn("t1", "I go yesterday")])).toHaveLength(0)
})

it("generateReport 全链路：报告落库、生词计数、会话结束", async () => {
  const s = await createSession("builtin-interview")
  await appendTurn(s.id, turn("t1", "I go yesterday because we hit a blocker"))
  await addWord({ word: "blocker", translation: "阻碍", example: "We hit a blocker.", sourceSessionId: "other" })
  const report = await generateReport(s.id)
  expect(report.corrections[0].turnId).toBe("t1")
  const stored = (await getSession(s.id))!
  expect(stored.report?.summary).toBeTruthy()
  expect(stored.endedAt).toBeTruthy()
  const [w] = await listWords()
  expect(w.timesEncountered).toBe(1)
  expect(w.lastUsedAt).toBeTruthy()
})

it("generateReport 会话不存在抛错", async () => {
  await expect(generateReport("nope")).rejects.toThrow("session not found")
})
