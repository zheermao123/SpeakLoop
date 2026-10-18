import { expect, it, vi } from "vitest"
import { AudioQueue } from "@/lib/audio-queue"

const ab = (n: number) => {
  const b = new ArrayBuffer(1)
  new Uint8Array(b)[0] = n
  return b
}

it("顺序播放且互不重叠", async () => {
  const order: number[] = []
  const q = new AudioQueue(async buf => {
    order.push(new Uint8Array(buf)[0])
    await new Promise(r => setTimeout(r, 5))
  })
  q.enqueue(async () => ab(1))
  q.enqueue(async () => ab(2))
  q.enqueue(async () => ab(3))
  await q.idle
  expect(order).toEqual([1, 2, 3])
})

it("获取失败跳过不断链", async () => {
  const played: number[] = []
  const q = new AudioQueue(async buf => {
    played.push(new Uint8Array(buf)[0])
  })
  q.enqueue(async () => {
    throw new Error("net")
  })
  q.enqueue(async () => ab(9))
  await q.idle
  expect(played).toEqual([9])
})

it("空 buffer 与播放失败均被吞掉", async () => {
  const played: number[] = []
  const q = new AudioQueue(async buf => {
    const n = new Uint8Array(buf)[0]
    if (n === 1) throw new Error("blocked")
    played.push(n)
  })
  q.enqueue(async () => new ArrayBuffer(0))
  q.enqueue(async () => ab(1))
  q.enqueue(async () => ab(2))
  await q.idle
  expect(played).toEqual([2])
})

it("播放挂死时超时兜底，链继续（防队列冻结）", async () => {
  vi.useFakeTimers()
  const played: number[] = []
  const q = new AudioQueue(buf => {
    const n = new Uint8Array(buf)[0]
    played.push(n)
    return n === 1 ? new Promise<void>(() => {}) : Promise.resolve()
  })
  q.enqueue(async () => ab(1), { timeoutMs: 5000 })
  q.enqueue(async () => ab(2))
  await vi.advanceTimersByTimeAsync(5000)
  await q.idle
  expect(played).toEqual([1, 2])
  vi.useRealTimers()
})

it("fetchAudio 同步抛错链不死（防静默失效）", async () => {
  const played: number[] = []
  const q = new AudioQueue(async buf => {
    played.push(new Uint8Array(buf)[0])
  })
  q.enqueue((() => {
    throw new Error("sync boom")
  }) as () => Promise<ArrayBuffer | null>)
  q.enqueue(async () => ab(7))
  await q.idle
  expect(played).toEqual([7])
})
