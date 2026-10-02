import { afterEach, beforeEach, expect, it, vi } from "vitest"

function fakeDeps() {
  let now = 1000
  const stops: number[] = []
  return {
    d: {
      now: () => now,
      stop: () => {
        stops.push(now)
      },
      intervalMs: 5,
      idleMs: 30,
    },
    advance: (ms: number) => {
      now += ms
    },
    stops,
  }
}

beforeEach(() => {
  vi.resetModules()
})
afterEach(() => {
  delete process.env.AUTO_STOP
  delete process.env.AUTO_STOP_IDLE_MS
})

it("从未有心跳（如纯 API 使用）不触发停止", async () => {
  const { d, stops } = fakeDeps()
  const wd = (await import("@/lib/auto-stop")).createWatchdog(d)
  for (let i = 0; i < 10; i++) wd.tick()
  expect(stops).toEqual([])
  expect(wd.stopped).toBe(false)
})

it("心跳停止超空闲阈值 → 停止恰好一次", async () => {
  const { d, stops, advance } = fakeDeps()
  const wd = (await import("@/lib/auto-stop")).createWatchdog(d)
  wd.beat()
  wd.tick()
  advance(40)
  wd.tick()
  expect(stops).toEqual([1040])
  wd.tick()
  expect(stops).toHaveLength(1)
  expect(wd.stopped).toBe(true)
})

it("持续心跳不停止", async () => {
  const { d, stops, advance } = fakeDeps()
  const wd = (await import("@/lib/auto-stop")).createWatchdog(d)
  for (let i = 0; i < 20; i++) {
    wd.beat()
    advance(10)
    wd.tick()
  }
  expect(stops).toEqual([])
})

it("AUTO_STOP=0 时生产装配不启动", async () => {
  process.env.AUTO_STOP = "0"
  const mod = await import("@/lib/auto-stop")
  expect(mod.shouldAutoStop()).toBe(false)
  delete process.env.AUTO_STOP
  expect(mod.shouldAutoStop()).toBe(true)
})
