import { expect, it } from "vitest"
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
