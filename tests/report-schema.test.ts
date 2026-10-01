import { expect, it } from "vitest"
import { tolerantParse } from "@/lib/report-schema"

const valid = JSON.stringify({
  summary: "不错",
  highlights: ["流利"],
  corrections: [{ turnId: "t1", original: "I go yesterday", type: "grammar", improved: "I went yesterday", explanation: "过去时" }],
  vocabCandidates: [{ word: "blocker", translation: "阻碍", example: "a blocker" }],
})

it("解析正常 JSON", () => {
  const r = tolerantParse(valid)
  expect(r?.summary).toBe("不错")
  expect(r?.corrections[0].turnId).toBe("t1")
})

it("剥离 markdown 围栏", () => {
  expect(tolerantParse("```json\n" + valid + "\n```")?.summary).toBe("不错")
})

it("前后有杂文时截取大括号段", () => {
  expect(tolerantParse(`Here is the report: ${valid} hope it helps`)?.summary).toBe("不错")
})

it("缺失字段用默认值兜底", () => {
  const r = tolerantParse('{"summary":"s"}')
  expect(r?.highlights).toEqual([])
  expect(r?.corrections).toEqual([])
})

it("非法输入返回 null", () => {
  expect(tolerantParse("not json at all")).toBeNull()
  expect(tolerantParse("")).toBeNull()
})

it("围栏外散文含花括号时仍能提取 JSON", () => {
  const prose = `Sure — use {placeholder} syntax: {"summary":"s"} done.`
  expect(tolerantParse(prose)?.summary).toBe("s")
})

it("字符串值内的花括号不干扰平衡扫描", () => {
  const prose = `Note {a}: {"summary":"use {braces} inside","highlights":[]}`
  expect(tolerantParse(prose)?.summary).toBe("use {braces} inside")
})

it("含花括号但无合法 JSON 时返回 null", () => {
  expect(tolerantParse("no json {just braces} here")).toBeNull()
})
