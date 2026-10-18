import { beforeEach, expect, it, vi } from "vitest"

beforeEach(() => {
  vi.resetModules()
  delete (globalThis as Record<string, unknown>).__slWatchdog
})

it("GET 初始未武装、无年龄", async () => {
  const route = await import("@/app/api/heartbeat/route")
  const j = await (await route.GET()).json()
  expect(j.armed).toBe(false)
  expect(j.ageSec).toBeNull()
})

it("POST 心跳后 GET 武装且年龄新鲜", async () => {
  const route = await import("@/app/api/heartbeat/route")
  await route.POST()
  const j = await (await route.GET()).json()
  expect(j.armed).toBe(true)
  expect(j.ageSec).toBeLessThanOrEqual(2)
})
