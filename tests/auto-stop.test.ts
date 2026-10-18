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


it("leave：宽限期内无心跳则停止；期间心跳取消（刷新保护）", async () => {
  vi.useFakeTimers()
  const { d, stops } = fakeDeps()
  const wd = (await import("@/lib/auto-stop")).createWatchdog(d)
  wd.leave(5000)
  vi.advanceTimersByTime(4999)
  expect(stops).toEqual([])
  wd.beat()
  vi.advanceTimersByTime(10000)
  expect(stops).toEqual([])
  wd.leave(5000)
  vi.advanceTimersByTime(4999)
  expect(stops).toEqual([])
  vi.advanceTimersByTime(1)
  expect(stops).toHaveLength(1)
  expect(wd.stopped).toBe(true)
  vi.useRealTimers()
})

it("beatAgeMs：未心跳 -1，心跳后返回年龄", async () => {
  const { d, advance } = fakeDeps()
  const wd = (await import("@/lib/auto-stop")).createWatchdog(d)
  expect(wd.beatAgeMs()).toBe(-1)
  wd.beat()
  advance(2500)
  expect(wd.beatAgeMs()).toBe(2500)
})

it("默认空闲兜底阈值 12s（关闭→立即停靠信标，崩溃兜底 ≤12s）", async () => {
  delete process.env.AUTO_STOP_IDLE_MS
  const { idleMsFromEnv } = await import("@/lib/auto-stop")
  expect(idleMsFromEnv()).toBe(12000)
})