import { mkdtempSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { beforeEach, expect, it } from "vitest"
import { VocabWord } from "@/lib/domain/types"
import { addWord, containsWord, listWords, markUsedInSession, selectForInjection } from "@/lib/services/vocab"

beforeEach(() => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "sl-test-"))
})

const w = (over: Partial<VocabWord>): VocabWord => ({
  id: over.id ?? "w1", word: "negotiate", translation: "谈判", example: "ex",
  sourceSessionId: "s1", status: "learning", timesEncountered: 0,
  createdAt: "2026-10-01T00:00:00Z", ...over,
})

it("selectForInjection 过滤 mastered/ignored 并按次数升序取前5", () => {
  const words = [
    w({ id: "a", word: "alpha", timesEncountered: 3 }),
    w({ id: "b", word: "beta", timesEncountered: 1 }),
    w({ id: "c", word: "gamma", status: "mastered" }),
    w({ id: "d", word: "delta", status: "ignored" }),
    ...["e", "f", "g", "h", "i", "j"].map((x, i) => w({ id: x, word: x, timesEncountered: 10 + i })),
  ]
  const picked = selectForInjection(words)
  expect(picked.map(p => p.id)).toEqual(["b", "a", "e", "f", "g"])
})

it("containsWord 命中词形变化", () => {
  expect(containsWord("We negotiated the deadline yesterday.", "negotiate")).toBe(true)
  expect(containsWord("He negotiates hard.", "negotiate")).toBe(true)
  expect(containsWord("The negotiation is tough.", "negotiation")).toBe(true)
  expect(containsWord("totally unrelated text", "negotiate")).toBe(false)
})

it("containsWord 支持短语（子串）", () => {
  expect(containsWord("Let's touch base tomorrow.", "touch base")).toBe(true)
})

it("containsWord 短语：撇号/标点/空白对称归一", () => {
  expect(containsWord("let's touch base tomorrow.", "let's touch base")).toBe(true)
  expect(containsWord("lets touch base tomorrow.", "let's touch base")).toBe(true)
  expect(containsWord("We touch, base and go.", "touch base")).toBe(true)
  expect(containsWord("touch\n\nbase", "touch base")).toBe(true)
  expect(containsWord("totally different phrase here", "touch base")).toBe(false)
})

it("addWord 去重（大小写不敏感）", async () => {
  await addWord({ word: "Blocker", translation: "阻碍", example: "e", sourceSessionId: "s1" })
  const again = await addWord({ word: "blocker", translation: "x", example: "y", sourceSessionId: "s2" })
  const all = await listWords()
  expect(all).toHaveLength(1)
  expect(again.translation).toBe("阻碍")
})

it("addWord 对已存在词应用新状态", async () => {
  await addWord({ word: "blocker", translation: "阻碍", example: "e", sourceSessionId: "s1" })
  const w = await addWord({ word: "blocker", translation: "x", example: "y", sourceSessionId: "s2", status: "ignored" })
  expect(w.status).toBe("ignored")
  const all = await listWords()
  expect(all).toHaveLength(1)
  expect(all[0].status).toBe("ignored")
})

it("markUsedInSession 更新计数与状态", async () => {
  await addWord({ word: "blocker", translation: "阻碍", example: "e", sourceSessionId: "s1" })
  const active = (await listWords()).filter(x => x.status !== "ignored" && x.status !== "mastered")
  await markUsedInSession(active, "We hit a blocker in the API integration.")
  const [after] = await listWords()
  expect(after.timesEncountered).toBe(1)
  expect(after.status).toBe("learning")
  expect(after.lastUsedAt).toBeTruthy()
})
