import { expect, it } from "vitest"
import { SentenceStream, stripGoalMarkers, trailingMarkerPrefix } from "@/lib/sentence-stream"

it("单次 push 多句逐句回调", () => {
  const out: string[] = []
  const ss = new SentenceStream(s => out.push(s))
  ss.push("Hello there. How are you? Fine.")
  ss.flush()
  expect(out).toEqual(["Hello there.", "How are you?", "Fine."])
})

it("标记跨 delta 不外泄且计数", () => {
  const out: string[] = []
  const ss = new SentenceStream(s => out.push(s))
  ss.push("Great [GOAL_")
  ss.push("DONE:0]")
  ss.flush()
  expect(out.join("")).not.toContain("GOAL")
  expect(ss.goals).toEqual([0])
})

it("数字部分截断时回持", () => {
  const out: string[] = []
  const ss = new SentenceStream(s => out.push(s))
  ss.push("ok. [GOAL_DONE:1")
  expect(out).toEqual(["ok."])
  ss.push("2]")
  ss.flush()
  expect(ss.goals).toEqual([12])
  expect(out).toEqual(["ok."])
})

it("句末边界无后续内容时保守持有", () => {
  const out: string[] = []
  const ss = new SentenceStream(s => out.push(s))
  ss.push("Good.")
  expect(out).toEqual([])
  ss.push(" Next one.")
  ss.flush()
  expect(out).toEqual(["Good.", "Next one."])
})

it("flush 兜底无标点文本", () => {
  const out: string[] = []
  const ss = new SentenceStream(s => out.push(s))
  ss.push("no punct here")
  expect(out).toEqual([])
  ss.flush()
  expect(out).toEqual(["no punct here"])
})

it("工具函数：完整标记剥离与部分前缀检测", () => {
  const goals: number[] = []
  expect(stripGoalMarkers("a [GOAL_DONE:3] b", goals)).toBe("a  b")
  expect(goals).toEqual([3])
  expect(trailingMarkerPrefix("x [GOAL_D")).toBe(7)
  expect(trailingMarkerPrefix("x [GOAL_DONE:123")).toBe(14)
  expect(trailingMarkerPrefix("clean.")).toBe(0)
})
