import { mkdtempSync, readFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { beforeEach, expect, it } from "vitest"
import { read, update } from "@/lib/store/json-store"

beforeEach(() => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "sl-test-"))
})

it("read 空集合返回 []", async () => {
  expect(await read("vocab")).toEqual([])
})

it("update 持久化且为合法 JSON", async () => {
  await update("vocab", d => [...d, { id: "a" }])
  const raw = readFileSync(path.join(process.env.DATA_DIR!, "vocab.json"), "utf-8")
  expect(JSON.parse(raw)).toEqual([{ id: "a" }])
  expect(await read("vocab")).toEqual([{ id: "a" }])
})

it("并发 update 串行执行，无丢失", async () => {
  await update<{ id: string; v: number }>("vocab", d => [...d, { id: "a", v: 0 }])
  await Promise.all(
    Array.from({ length: 10 }, () =>
      update<{ id: string; v: number }>("vocab", d => d.map(x => ({ ...x, v: x.v + 1 }))))
  )
  expect((await read<{ id: string; v: number }>("vocab"))[0].v).toBe(10)
})
