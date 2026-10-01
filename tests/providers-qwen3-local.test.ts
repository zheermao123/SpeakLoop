import { expect, it } from "vitest"
import { Qwen3LocalStt } from "@/lib/providers/stt/qwen3-local"
import { Qwen3LocalTts } from "@/lib/providers/tts/qwen3-local"

it("stt：multipart 转发并返回文本", async () => {
  let captured: FormData | null = null
  const stt = new Qwen3LocalStt(
    "http://127.0.0.1:8100",
    async (_u, i) => {
      captured = i?.body as FormData
      return { ok: true, json: async () => ({ text: "Hello there." }) } as unknown as Response
    }
  )
  const r = await stt.transcribe(new Blob(["x"]))
  expect(r.text).toBe("Hello there.")
  expect(captured!.get("file")).toBeTruthy()
})

it("stt：非 2xx 抛错", async () => {
  const stt = new Qwen3LocalStt("http://127.0.0.1:8100", async () =>
    ({ ok: false, status: 503 }) as unknown as Response
  )
  await expect(stt.transcribe(new Blob(["x"]))).rejects.toThrow("503")
})

it("tts：转发 speaker 并返回 wav buffer", async () => {
  let body = ""
  const wav = new ArrayBuffer(8)
  const tts = new Qwen3LocalTts(
    "http://127.0.0.1:8101",
    async (_u, i) => {
      body = String(i?.body)
      return { ok: true, arrayBuffer: async () => wav } as unknown as Response
    }
  )
  const out = await tts.synthesize("Hello.", { speaker: "Serena" })
  expect(out).toBe(wav)
  expect(JSON.parse(body)).toEqual({ text: "Hello.", speaker: "Serena" })
})

it("tts：默认音色 Aiden，非 2xx 抛错", async () => {
  let body = ""
  const tts = new Qwen3LocalTts(
    "http://127.0.0.1:8101",
    async (_u, i) => {
      body = String(i?.body)
      return { ok: false, status: 500 } as unknown as Response
    }
  )
  await expect(tts.synthesize("Hi.")).rejects.toThrow("500")
  expect(JSON.parse(body).speaker).toBe("Aiden")
})
