import { expect, it } from "vitest"
import { tokenizeWords } from "@/lib/word-token"

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
