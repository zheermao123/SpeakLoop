import { expect, it } from "vitest"
import { parseGoalMarker } from "@/lib/goal-marker"

it("解析并剥离单个标记", () => {
  const r = parseGoalMarker("Great point. [GOAL_DONE:0]")
  expect(r).toEqual({ clean: "Great point.", goals: [0] })
})

it("解析多个标记", () => {
  const r = parseGoalMarker("A [GOAL_DONE:0] and [GOAL_DONE:2] done")
  expect(r.goals).toEqual([0, 2])
  expect(r.clean).toBe("A and done")
})

it("相邻标记与塌缩多余空格", () => {
  const r = parseGoalMarker("[GOAL_DONE:0] [GOAL_DONE:1] text")
  expect(r).toEqual({ clean: "text", goals: [0, 1] })
})

it("无标记时原样返回", () => {
  expect(parseGoalMarker("Nothing here.")).toEqual({ clean: "Nothing here.", goals: [] })
})

it("格式错误的标记静默保留原文", () => {
  const r = parseGoalMarker("Odd [GOAL_DONE:x] marker")
  expect(r.goals).toEqual([])
  expect(r.clean).toBe("Odd [GOAL_DONE:x] marker")
})
