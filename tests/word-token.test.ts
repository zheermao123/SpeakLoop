import { expect, it } from "vitest"
import { hasCjk, tokenizeWords } from "@/lib/word-token"

it("切分单词与文本段", () => {
  expect(tokenizeWords("Hello, world!")).toEqual([
    { type: "word", value: "Hello" },
    { type: "text", value: ", " },
    { type: "word", value: "world" },
    { type: "text", value: "!" },
  ])
})

it("缩写保持完整", () => {
  expect(tokenizeWords("I don't know.")).toEqual([
    { type: "word", value: "I" },
    { type: "text", value: " " },
    { type: "word", value: "don't" },
    { type: "text", value: " " },
    { type: "word", value: "know" },
    { type: "text", value: "." },
  ])
})

it("拼接还原原文", () => {
  const text = "It's 3 o'clock.\nLet's go!"
  expect(tokenizeWords(text).map(t => t.value).join("")).toBe(text)
})

it("无字母文本返回单段", () => {
  expect(tokenizeWords("42\n!!")).toEqual([{ type: "text", value: "42\n!!" }])
})

it("hasCjk：中英判定（翻译能力开关）", () => {
  expect(hasCjk("你好")).toBe(true)
  expect(hasCjk("Hello 你好")).toBe(true)
  expect(hasCjk("情景演练：和外国客户谈判")).toBe(true)
  expect(hasCjk("Hello, world! 42.")).toBe(false)
  expect(hasCjk("")).toBe(false)
})
