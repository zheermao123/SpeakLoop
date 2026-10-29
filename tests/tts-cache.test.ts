import { mkdtempSync, readdirSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { expect, it } from "vitest"
import { cacheKey, createTtsCache } from "@/lib/services/tts-cache"

function tmpDir() {
  return mkdtempSync(path.join(os.tmpdir(), "sl-tts-cache-"))
}

function wavOf(label: string, pad = 0): ArrayBuffer {
  const s = label.padEnd(pad, "x")
  return new TextEncoder().encode(s).buffer as ArrayBuffer
}

function makeCache(dir: string, capBytes?: number) {
  let synthCount = 0
  const cache = createTtsCache({ dataDir: () => dir, capBytes })
  const synth = (label: string) => async () => {
    synthCount++
    return wavOf(label)
  }
  return { cache, count: () => synthCount, synth }
}

const wavFiles = (dir: string) => readdirSync(path.join(dir, "tts-cache")).filter(f => f.endsWith(".wav"))

it("miss 合成一次，hit 不再合成", async () => {
  const dir = tmpDir()
  const { cache, count, synth } = makeCache(dir)
  const r1 = await cache.synthesizeCached({ text: "hello", speaker: "Aiden", synth: synth("a") })
  expect(r1.hit).toBe(false)
  const r2 = await cache.synthesizeCached({ text: "hello", speaker: "Aiden", synth: synth("b") })
  expect(r2.hit).toBe(true)
  expect(new TextDecoder().decode(r2.buf)).toBe("a")
  expect(count()).toBe(1)
})

it("speaker 不同则 key 不同、重新合成", async () => {
  const dir = tmpDir()
  const { cache, count, synth } = makeCache(dir)
  await cache.synthesizeCached({ text: "hello", speaker: "Aiden", synth: synth("a") })
  const r = await cache.synthesizeCached({ text: "hello", speaker: "Emma", synth: synth("b") })
  expect(r.hit).toBe(false)
  expect(count()).toBe(2)
  expect(cacheKey("hello", "Aiden")).not.toBe(cacheKey("hello", "Emma"))
})

it("并发同 key 只合成一次", async () => {
  const dir = tmpDir()
  const { cache, count, synth } = makeCache(dir)
  const results = await Promise.all([
    cache.synthesizeCached({ text: "concurrent", speaker: "Aiden", synth: synth("x") }),
    cache.synthesizeCached({ text: "concurrent", speaker: "Aiden", synth: synth("y") }),
    cache.synthesizeCached({ text: "concurrent", speaker: "Aiden", synth: synth("z") }),
  ])
  expect(count()).toBe(1)
  expect(results.map(r => r.hit)).toEqual([false, false, false])
  expect(new TextDecoder().decode(results[2].buf)).toBe("x")
})

it("超上限逐出最旧文件", async () => {
  const dir = tmpDir()
  const { cache } = makeCache(dir, 300)
  await cache.synthesizeCached({ text: "old", speaker: "Aiden", synth: async () => wavOf("old", 200) })
  await new Promise(r => setTimeout(r, 30))
  await cache.synthesizeCached({ text: "new", speaker: "Aiden", synth: async () => wavOf("new", 200) })
  await new Promise(r => setTimeout(r, 100))
  const files = wavFiles(dir)
  expect(files).toEqual([`${cacheKey("new", "Aiden")}.wav`])
})

it("空缓存文件视为未命中并回退合成", async () => {
  const dir = tmpDir()
  const { cache, count, synth } = makeCache(dir)
  await cache.synthesizeCached({ text: "hello", speaker: "Aiden", synth: synth("a") })
  const r1 = await cache.synthesizeCached({ text: "hello", speaker: "Aiden", synth: synth("skip") })
  expect(r1.hit).toBe(true)
  const key = cacheKey("hello", "Aiden")
  const { writeFileSync } = await import("node:fs")
  writeFileSync(path.join(dir, "tts-cache", `${key}.wav`), Buffer.alloc(0))
  const r2 = await cache.synthesizeCached({ text: "hello", speaker: "Aiden", synth: synth("b") })
  expect(r2.hit).toBe(false)
  expect(new TextDecoder().decode(r2.buf)).toBe("b")
  expect(count()).toBe(2)
})
