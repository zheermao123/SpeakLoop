import { mkdtempSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { beforeEach, expect, it } from "vitest"
import { NextRequest } from "next/server"

beforeEach(() => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "sl-test-"))
})

async function post(messages: { role: string; content: string }[]) {
  const { POST } = await import("@/app/api/chat/stream/route")
  const req = new Request("http://localhost/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenarioId: "builtin-interview", messages }),
  })
  return POST(req as unknown as NextRequest)
}

async function events(res: Response) {
  const text = await new Response(res.body).text()
  return text
    .split("\n\n")
    .filter(f => f.trim().startsWith("data:"))
    .map(f => JSON.parse(f.trim().slice(5)))
}

it("第二轮对话：分句/消毒增量/done 三类事件齐备", async () => {
  const res = await post([
    { role: "user", content: "hi" },
    { role: "assistant", content: "hello" },
    { role: "user", content: "second" },
  ])
  expect(res.headers.get("content-type")).toContain("text/event-stream")
  const evs = await events(res)
  const sentences = evs.filter(e => e.type === "sentence").map(e => e.text)
  const done = evs.find(e => e.type === "done")
  expect(sentences).toEqual(["That sounds good.", "Could you tell me more about it?"])
  expect(done.goalsDone).toEqual([0])
  expect(done.reply).toBe("That sounds good. Could you tell me more about it?")
})

it("delta 拼接等于 done.reply 且全程无标记泄漏", async () => {
  const res = await post([
    { role: "user", content: "hi" },
    { role: "assistant", content: "hello" },
    { role: "user", content: "second" },
  ])
  const evs = await events(res)
  const joined = evs.filter(e => e.type === "delta").map(e => e.text).join("")
  expect(joined.trim()).toBe(evs.find(e => e.type === "done").reply)
  expect(JSON.stringify(evs)).not.toContain("GOAL_DONE")
})

it("场景不存在返回 404", async () => {
  const { POST } = await import("@/app/api/chat/stream/route")
  const req = new Request("http://localhost/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenarioId: "nope", messages: [] }),
  })
  expect((await POST(req as unknown as NextRequest)).status).toBe(404)
})
