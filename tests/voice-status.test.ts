import { expect, it } from "vitest"
import { lineStatus } from "@/lib/voice-status"

it("ready/disabled/offline 直接映射", () => {
  expect(lineStatus("ready", 0)).toEqual({ level: "ready", label: "就绪" })
  expect(lineStatus("disabled", 0)).toEqual({ level: "loading", label: "未启用" })
  expect(lineStatus("offline", 0)).toEqual({ level: "offline", label: "离线" })
})

it("loading 计时显示", () => {
  expect(lineStatus("loading", 78)).toEqual({ level: "loading", label: "预热中 · 78s" })
})

it("超过阈值升级为 error（240s 默认）", () => {
  expect(lineStatus("loading", 239).level).toBe("loading")
  expect(lineStatus("loading", 240)).toEqual({ level: "error", label: "异常（已 240s）" })
  expect(lineStatus("loading", 300, 180).label).toBe("异常（已 300s）")
})
