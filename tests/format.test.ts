import { expect, it } from "vitest"
import { relativeTime } from "@/lib/format"

const now = new Date(2026, 9, 25, 15, 30)

it("同日显示今天与零填充时间", () => {
  expect(relativeTime(new Date(2026, 9, 25, 9, 5).toISOString(), now)).toBe("今天 09:05")
})

it("昨日显示昨天与零填充时间", () => {
  expect(relativeTime(new Date(2026, 9, 24, 23, 7).toISOString(), now)).toBe("昨天 23:07")
})

it("同年更早显示月日与时间", () => {
  expect(relativeTime(new Date(2026, 2, 5, 8, 3).toISOString(), now)).toBe("3月5日 08:03")
})

it("跨年显示年月日且不含时间", () => {
  expect(relativeTime(new Date(2025, 11, 31, 23, 59).toISOString(), now)).toBe("2025年12月31日")
})
