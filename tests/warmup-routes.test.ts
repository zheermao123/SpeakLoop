import { afterEach, expect, it, vi } from "vitest"

afterEach(() => {
  vi.resetModules()
  delete process.env.TTS_PROVIDER
  delete process.env.STT_PROVIDER
  delete process.env.TTS_BASE_URL
  delete process.env.STT_BASE_URL
})

it("mock 模式：两路由直接 ok", async () => {
  const ttsRoute = await import("@/app/api/tts/warmup/route")
  const sttRoute = await import("@/app/api/stt/warmup/route")
  expect((await ttsRoute.POST()).status).toBe(200)
  expect(await (await ttsRoute.POST()).json()).toEqual({ ok: true })
  expect(await (await sttRoute.POST()).json()).toEqual({ ok: true })
})

it("qwen3-local 模式：目标不可达返回 ok:false 而非 500", async () => {
  process.env.TTS_PROVIDER = "qwen3-local"
  process.env.TTS_BASE_URL = "http://127.0.0.1:9"
  const { POST } = await import("@/app/api/tts/warmup/route")
  const res = await POST()
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ ok: false })
})
