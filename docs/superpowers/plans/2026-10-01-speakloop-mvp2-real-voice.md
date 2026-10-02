# SpeakLoop MVP-2 实施计划（真实语音 + 真实 Chat）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 接入真实语音链路（qwen3-local STT/TTS）与真实云端 Chat（OpenAI 兼容协议、任意厂商），并以 **SSE 流式 chat + 服务端分句 TTS 管线**把语音回复感知延迟压到 ~3s 级（spike 实测 TTS 整段 10.44s 超标的既定预案，spec §6.6/§12）。

**Architecture:** 服务端分句——`/api/chat/stream` 以 SSE 下发三类事件（delta=消毒后文本增量 / sentence=完整句 / done=goalsDone+权威清洁全文）；前端 AudioQueue 收句即合成、顺序播放。Provider 工厂全面 async 化并按 env 分流（mock / qwen3-local / openai-compatible）。

**Tech Stack:** 既有 Next.js 15 + Vitest 基线（47 tests）；新增：ReadableStream SSE（服务端+客户端）、FormData/Blob（Node 20 原生）、AbortSignal.timeout。

## Global Constraints

- 遵守 `AGENTS.md`：`docs/**` 受控只读；验证命令 `npm test`（Vitest）、`npm run build`、`npm run doctor`
- **基线不破坏**：每任务结束时全量测试绿；测试计数推进 47→49→57→60→64→68→71→74→76（勘误 R3/R5 增 3 测）；验证链含 `npm run typecheck`（勘误 R4）
- 端口/环境：asr `:8100`、tts `:8101`；env 矩阵见 Task 9（`.env.example`）
- UI 不变量（spec §9）：所有 fetch 检查 `r.ok`；busy 必须 try/finally 复位；加载必有终结态；禁止 undefined 路由
- 标记纪律：`[GOAL_DONE:n]` 永不出现在前端文本——服务端 delta 消毒（完整标记剥离 + 部分前缀回持）与句子级剥离双保险
- 代码风格：无注释；既有 token/图标/aria 规则延续（spec §8.1）
- spike 实测锚点：TTS 热 10.44s/句段、冷载 145s（warmup 超时须 ≥180s）、ASR 热 2.42s

---

### Task 1: ChatProvider 流式契约 + Mock 流式实现

**Files:**
- Modify: `lib/providers/types.ts`（接口增 chatStream）
- Modify: `lib/providers/chat/mock.ts`
- Test: `tests/providers-chat-stream.test.ts`

**Interfaces:**
- Produces: `ChatProvider` 增加 `chatStream(system, messages, onDelta: (d: string) => void): Promise<string>`（返回完整原文，含标记——剥离职责在 SentenceStream/路由）；Mock 实现按 16 字符分块回调

- [ ] **Step 1: 写失败测试**

`tests/providers-chat-stream.test.ts`：

```ts
import { expect, it } from "vitest"
import { getChat } from "@/lib/providers/types"

it("chatStream 分块回调且拼接等于全文", async () => {
  const c = await getChat()
  const chunks: string[] = []
  const full = await c.chatStream(
    "You are an English speaking coach.",
    [{ role: "user", content: "hi" }],
    d => chunks.push(d)
  )
  expect(chunks.length).toBeGreaterThanOrEqual(2)
  expect(chunks.join("")).toBe(full)
  expect(full).toContain("Nice to meet you")
})

it("report 分支经流式返回合法 JSON", async () => {
  const c = await getChat()
  const full = await c.chatStream(
    "You are a spoken-English report analyzer.",
    [{ role: "user", content: "[abc-123] I go yesterday" }],
    () => {}
  )
  const parsed = JSON.parse(full)
  expect(parsed.corrections[0].turnId).toBe("abc-123")
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/providers-chat-stream.test.ts`
Expected: FAIL（chatStream 不存在）

- [ ] **Step 3: 实现**

`lib/providers/types.ts` 的接口改为：

```ts
export interface ChatProvider {
  chat(
    system: string,
    messages: { role: "user" | "assistant"; content: string }[]
  ): Promise<string>
  chatStream(
    system: string,
    messages: { role: "user" | "assistant"; content: string }[],
    onDelta: (delta: string) => void
  ): Promise<string>
}
```

`lib/providers/chat/mock.ts` 的 MockChatProvider 类内追加：

```ts
  async chatStream(
    system: string,
    messages: { role: "user" | "assistant"; content: string }[],
    onDelta: (delta: string) => void
  ): Promise<string> {
    const full = await this.chat(system, messages)
    for (let i = 0; i < full.length; i += 16) onDelta(full.slice(i, i + 16))
    return full
  }
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/providers-chat-stream.test.ts`
Expected: 2 passed

- [ ] **Step 5: Commit**

```powershell
git add lib/providers/types.ts lib/providers/chat/mock.ts tests/providers-chat-stream.test.ts
git commit -m "feat: chat provider streaming contract with mock implementation"
```

---

### Task 2: SentenceStream（标记剥离 + 分句）

**Files:**
- Create: `lib/sentence-stream.ts`
- Test: `tests/sentence-stream.test.ts`

**Interfaces:**
- Produces: `stripGoalMarkers(s: string, goals?: number[]): string`（剥离完整标记并收集序号）；`trailingMarkerPrefix(s: string): number`（尾部部分标记长度，0=无）；`class SentenceStream { constructor(onSentence: (s: string) => void); push(delta: string): void; flush(): void; readonly goals: number[] }`——句边界 `[.!?]+(?=\s|\n|$)`，非终态时句末无后续内容则保守持有；标记跨 delta 由回持保护

- [ ] **Step 1: 写失败测试**

`tests/sentence-stream.test.ts`：

```ts
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
  expect(trailingMarkerPrefix("x [GOAL_DONE:12")).toBe(14)
  expect(trailingMarkerPrefix("clean.")).toBe(0)
})

it("flush 剥离截断的标记残段（词干截断，勘误 R5）", () => {
  const out: string[] = []
  const ss = new SentenceStream(s => out.push(s))
  ss.push("Great job [GOAL_DON")
  ss.flush()
  expect(out).toEqual(["Great job"])
})

it("flush 剥离截断的标记残段（数字截断，勘误 R5）", () => {
  const out: string[] = []
  const ss = new SentenceStream(s => out.push(s))
  ss.push("Done here [GOAL_DONE:1")
  ss.flush()
  expect(out).toEqual(["Done here"])
  expect(ss.goals).toEqual([])
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/sentence-stream.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 lib/sentence-stream.ts**

```ts
export function stripGoalMarkers(s: string, goals: number[] = []): string {
  const re = /\[GOAL_DONE:(\d+)\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) goals.push(Number(m[1]))
  return s.replace(re, "")
}

export function trailingMarkerPrefix(s: string): number {
  const M = "[GOAL_DONE:"
  const tail = s.slice(-(M.length + 3))
  for (let n = Math.min(M.length, tail.length); n >= 1; n--) {
    if (tail.endsWith(M.slice(0, n))) return n
  }
  const dm = /\[GOAL_DONE:\d{0,3}$/.exec(tail)
  return dm ? dm[0].length : 0
}

export class SentenceStream {
  private buf = ""
  readonly goals: number[] = []
  constructor(private readonly onSentence: (s: string) => void) {}

  push(delta: string): void {
    this.buf = stripGoalMarkers(this.buf + delta, this.goals)
    this.drain(false)
  }

  flush(): void {
    this.drain(true)
  }

  private drain(final: boolean): void {
    if (final) {
      const p = trailingMarkerPrefix(this.buf)
      if (p) this.buf = this.buf.slice(0, this.buf.length - p)
    }
    const hold = final ? 0 : trailingMarkerPrefix(this.buf)
    const avail = hold ? this.buf.slice(0, this.buf.length - hold) : this.buf
    const m = /[.!?]+(?=\s|\n|$)/.exec(avail)
    if (m && (m.index + m[0].length < avail.length || final)) {
      const end = m.index + m[0].length
      const head = avail.slice(0, end).trim()
      if (head) this.onSentence(head)
      this.buf = this.buf.slice(end)
      this.drain(final)
      return
    }
    if (final) {
      const rest = this.buf.replace(/\s+/g, " ").trim()
      if (rest) this.onSentence(rest)
      this.buf = ""
    }
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/sentence-stream.test.ts`
Expected: 8 passed

- [ ] **Step 5: Commit**

```powershell
git add lib/sentence-stream.ts tests/sentence-stream.test.ts
git commit -m "feat: sentence stream with marker stripping and boundary holdback"
```

---

### Task 3: OpenAI 兼容 Chat Provider

**Files:**
- Create: `lib/providers/chat/openai-compatible.ts`
- Test: `tests/providers-openai-compatible.test.ts`

**Interfaces:**
- Produces: `class OpenAICompatibleChatProvider implements ChatProvider`，构造 `{ baseUrl, apiKey, model, fetchImpl? }`（fetchImpl 注入供测试）；`chat()` 非流式；`chatStream()` 解析 SSE 行（`data: {...}` / `data: [DONE]`，取 `choices[0].delta.content`）；HTTP 非 2xx 抛错；兼容 DeepSeek/GLM/Kimi/Qwen 等任意 OpenAI 协议厂商（仅 env 配置差异）

- [ ] **Step 1: 写失败测试**

`tests/providers-openai-compatible.test.ts`：

```ts
import { expect, it } from "vitest"
import { OpenAICompatibleChatProvider } from "@/lib/providers/chat/openai-compatible"

const CFG = { baseUrl: "https://api.example.com/v1", apiKey: "sk-test", model: "test-model" }

it("非流式：请求形状正确并返回内容", async () => {
  let url = ""
  let init: RequestInit = {}
  const p = new OpenAICompatibleChatProvider({
    ...CFG,
    fetchImpl: async (u, i) => {
      url = String(u)
      init = i as RequestInit
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: "hello there" } }] }),
        text: async () => "",
      } as unknown as Response
    },
  })
  const out = await p.chat("SYS", [{ role: "user", content: "hi" }])
  expect(out).toBe("hello there")
  expect(url).toBe("https://api.example.com/v1/chat/completions")
  expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test")
  const body = JSON.parse(String(init.body))
  expect(body.stream).toBe(false)
  expect(body.messages[0]).toEqual({ role: "system", content: "SYS" })
})

it("流式：解析 SSE 分块并回调增量", async () => {
  const sse = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(
        new TextEncoder().encode(
          sse({ choices: [{ delta: { content: "Hel" } }] }) +
            sse({ choices: [{ delta: { content: "lo." } }] }) +
            "data: [DONE]\n\n"
        )
      )
      c.close()
    },
  })
  const p = new OpenAICompatibleChatProvider({
    ...CFG,
    fetchImpl: async () => ({ ok: true, body, text: async () => "" }) as unknown as Response,
  })
  const deltas: string[] = []
  const full = await p.chatStream("SYS", [{ role: "user", content: "hi" }], d => deltas.push(d))
  expect(deltas).toEqual(["Hel", "lo."])
  expect(full).toBe("Hello.")
})

it("HTTP 错误抛出含状态码", async () => {
  const p = new OpenAICompatibleChatProvider({
    ...CFG,
    fetchImpl: async () => ({ ok: false, status: 401, text: async () => "unauthorized" }) as unknown as Response,
  })
  await expect(p.chat("SYS", [])).rejects.toThrow("401")
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/providers-openai-compatible.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 lib/providers/chat/openai-compatible.ts**

```ts
import { ChatProvider } from "@/lib/providers/types"

interface ChatCfg {
  baseUrl: string
  apiKey: string
  model: string
  fetchImpl?: typeof fetch
}

export class OpenAICompatibleChatProvider implements ChatProvider {
  private f: typeof fetch
  constructor(private cfg: ChatCfg) {
    this.f = cfg.fetchImpl ?? fetch
  }

  private request(system: string, messages: { role: string; content: string }[], stream: boolean): Promise<Response> {
    return this.f(`${this.cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: this.cfg.model,
        stream,
        messages: [{ role: "system", content: system }, ...messages],
      }),
    })
  }

  async chat(
    system: string,
    messages: { role: "user" | "assistant"; content: string }[]
  ): Promise<string> {
    const r = await this.request(system, messages, false)
    if (!r.ok) throw new Error(`chat ${r.status}: ${await r.text()}`)
    const j = await r.json()
    return j.choices?.[0]?.message?.content ?? ""
  }

  async chatStream(
    system: string,
    messages: { role: "user" | "assistant"; content: string }[],
    onDelta: (delta: string) => void
  ): Promise<string> {
    const r = await this.request(system, messages, true)
    if (!r.ok || !r.body) throw new Error(`chat stream ${r.status}: ${await r.text()}`)
    const reader = (r.body as ReadableStream<Uint8Array>).getReader()
    const dec = new TextDecoder()
    let buf = ""
    let full = ""
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      const lines = buf.split("\n")
      buf = lines.pop() ?? ""
      for (const line of lines) {
        const t = line.trim()
        if (!t.startsWith("data:")) continue
        const payload = t.slice(5).trim()
        if (payload === "[DONE]") continue
        try {
          const j = JSON.parse(payload)
          const d = j.choices?.[0]?.delta?.content
          if (d) {
            full += d
            onDelta(d)
          }
        } catch {
          continue
        }
      }
    }
    return full
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/providers-openai-compatible.test.ts`
Expected: 3 passed

- [ ] **Step 5: Commit**

```powershell
git add lib/providers/chat/openai-compatible.ts tests/providers-openai-compatible.test.ts
git commit -m "feat: openai-compatible chat provider with streaming"
```

---

### Task 4: qwen3-local STT/TTS Providers

**Files:**
- Create: `lib/providers/stt/qwen3-local.ts`、`lib/providers/tts/qwen3-local.ts`
- Test: `tests/providers-qwen3-local.test.ts`

**Interfaces:**
- Produces: `class Qwen3LocalStt implements STTProvider`（FormData POST `${baseUrl}/stt` → `{text}`）；`class Qwen3LocalTts implements TTSProvider`（JSON POST `${baseUrl}/tts` → `ArrayBuffer` wav）；均构造注入 `baseUrl` 与可选 `fetchImpl`；非 2xx 抛错

- [ ] **Step 1: 写失败测试**

`tests/providers-qwen3-local.test.ts`：

```ts
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
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/providers-qwen3-local.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

`lib/providers/stt/qwen3-local.ts`：

```ts
import { STTProvider, STTResult } from "@/lib/providers/types"

export class Qwen3LocalStt implements STTProvider {
  private f: typeof fetch
  constructor(private baseUrl: string, fetchImpl?: typeof fetch) {
    this.f = fetchImpl ?? fetch
  }

  async transcribe(audio: Blob, _options?: { language?: string }): Promise<STTResult> {
    const fd = new FormData()
    fd.set("file", audio, "turn.webm")
    const r = await this.f(`${this.baseUrl.replace(/\/$/, "")}/stt`, { method: "POST", body: fd })
    if (!r.ok) throw new Error(`stt failed: ${r.status}`)
    const j = await r.json()
    return { text: String(j.text ?? "") }
  }
}
```

`lib/providers/tts/qwen3-local.ts`：

```ts
import { TTSProvider } from "@/lib/providers/types"

export class Qwen3LocalTts implements TTSProvider {
  private f: typeof fetch
  constructor(private baseUrl: string, fetchImpl?: typeof fetch) {
    this.f = fetchImpl ?? fetch
  }

  async synthesize(text: string, options?: { speaker?: string }): Promise<ArrayBuffer> {
    const r = await this.f(`${this.baseUrl.replace(/\/$/, "")}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, speaker: options?.speaker ?? "Aiden" }),
    })
    if (!r.ok) throw new Error(`tts failed: ${r.status}`)
    return r.arrayBuffer()
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/providers-qwen3-local.test.ts`
Expected: 4 passed

- [ ] **Step 5: Commit**

```powershell
git add lib/providers/stt/qwen3-local.ts lib/providers/tts/qwen3-local.ts tests/providers-qwen3-local.test.ts
git commit -m "feat: qwen3-local stt and tts providers"
```

---

### Task 5: async 工厂 + 全调用点接线（含关闭 M1）

**Files:**
- Modify: `lib/providers/types.ts`（工厂改 async + env 分流）
- Modify: `app/api/stt/route.ts`、`app/api/chat/route.ts`、`app/api/tts/route.ts`、`lib/services/report.ts`、`lib/services/scenario.ts`
- Test: `tests/providers-factory.test.ts`

**Interfaces:**
- Produces: `getSTT(): Promise<STTProvider>`（`STT_PROVIDER=qwen3-local` → Qwen3LocalStt(STT_BASE_URL)，默认/未知 → mock）；`getChat(): Promise<ChatProvider>`（`CHAT_PROVIDER=openai-compatible` → OpenAICompatibleChatProvider(CHAT_BASE_URL/CHAT_API_KEY/CHAT_MODEL)）；`getTTS(): Promise<TTSProvider>`（`TTS_PROVIDER=qwen3-local` → Qwen3LocalTts(TTS_BASE_URL)）；`/api/stt` 响应 `sttProvider` 改为 `process.env.STT_PROVIDER ?? "mock"`（真实值，关闭台账 M1 的数据源）

- [ ] **Step 1: 写失败测试**

`tests/providers-factory.test.ts`：

```ts
import { afterEach, beforeEach, expect, it, vi } from "vitest"

function freshTypes() {
  vi.resetModules()
  return import("@/lib/providers/types")
}

const KEYS = ["STT_PROVIDER", "TTS_PROVIDER", "CHAT_PROVIDER", "STT_BASE_URL", "TTS_BASE_URL", "CHAT_BASE_URL", "CHAT_API_KEY", "CHAT_MODEL"] as const

beforeEach(() => {
  vi.resetModules()
  for (const k of KEYS) delete process.env[k]
})
afterEach(() => {
  for (const k of KEYS) delete process.env[k]
})

it("默认全 mock", async () => {
  const { getSTT, getChat, getTTS } = await freshTypes()
  expect((await getSTT()).constructor.name).toBe("MockSttProvider")
  expect((await getChat()).constructor.name).toBe("MockChatProvider")
  expect((await getTTS()).constructor.name).toBe("MockTtsProvider")
})

it("qwen3-local 分流", async () => {
  process.env.STT_PROVIDER = "qwen3-local"
  process.env.TTS_PROVIDER = "qwen3-local"
  const { getSTT, getTTS } = await freshTypes()
  expect((await getSTT()).constructor.name).toBe("Qwen3LocalStt")
  expect((await getTTS()).constructor.name).toBe("Qwen3LocalTts")
})

it("openai-compatible 分流", async () => {
  process.env.CHAT_PROVIDER = "openai-compatible"
  process.env.CHAT_BASE_URL = "https://api.example.com/v1"
  process.env.CHAT_API_KEY = "sk-x"
  process.env.CHAT_MODEL = "m1"
  const { getChat } = await freshTypes()
  expect((await getChat()).constructor.name).toBe("OpenAICompatibleChatProvider")
})

it("openai-compatible 缺 env 时 fail-fast（勘误 R3）", async () => {
  process.env.CHAT_PROVIDER = "openai-compatible"
  process.env.CHAT_API_KEY = "sk-x"
  const { getChat } = await freshTypes()
  await expect(getChat()).rejects.toThrow("CHAT_BASE_URL")
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/providers-factory.test.ts`
Expected: FAIL（getSTT 等仍为同步，constructor.name 为 Promise）

- [ ] **Step 3: 实现——types.ts 工厂替换为**

```ts
import { MockSttProvider } from "@/lib/providers/stt/mock"
import { MockChatProvider } from "@/lib/providers/chat/mock"
import { MockTtsProvider } from "@/lib/providers/tts/mock"
import { STTProvider, ChatProvider, TTSProvider } from "@/lib/providers/types"
```

（注：以上为示意——实际实现中接口与实现在同一文件会产生循环引用。工厂保持与接口同文件 `lib/providers/types.ts`，用**动态 import** 加载实现，避免 mock 实现反向 import 接口造成的环。）

`lib/providers/types.ts` 中三个工厂替换为：

```ts
export async function getSTT(): Promise<STTProvider> {
  if ((process.env.STT_PROVIDER ?? "mock") === "qwen3-local") {
    const { Qwen3LocalStt } = await import("@/lib/providers/stt/qwen3-local")
    return new Qwen3LocalStt(process.env.STT_BASE_URL ?? "http://127.0.0.1:8100")
  }
  const { MockSttProvider } = await import("@/lib/providers/stt/mock")
  return new MockSttProvider()
}

export async function getChat(): Promise<ChatProvider> {
  if ((process.env.CHAT_PROVIDER ?? "mock") === "openai-compatible") {
    const baseUrl = process.env.CHAT_BASE_URL
    const apiKey = process.env.CHAT_API_KEY
    const model = process.env.CHAT_MODEL
    if (!baseUrl || !apiKey || !model) {
      throw new Error(
        "CHAT_PROVIDER=openai-compatible 需要 CHAT_BASE_URL / CHAT_API_KEY / CHAT_MODEL 全部配置"
      )
    }
    const { OpenAICompatibleChatProvider } = await import("@/lib/providers/chat/openai-compatible")
    return new OpenAICompatibleChatProvider({ baseUrl, apiKey, model })
  }
  const { MockChatProvider } = await import("@/lib/providers/chat/mock")
  return new MockChatProvider()
}

export async function getTTS(): Promise<TTSProvider> {
  if ((process.env.TTS_PROVIDER ?? "mock") === "qwen3-local") {
    const { Qwen3LocalTts } = await import("@/lib/providers/tts/qwen3-local")
    return new Qwen3LocalTts(process.env.TTS_BASE_URL ?? "http://127.0.0.1:8101")
  }
  const { MockTtsProvider } = await import("@/lib/providers/tts/mock")
  return new MockTtsProvider()
}
```

（同步删除文件顶部原有的三个静态 mock import 与同步工厂。）

- [ ] **Step 4: 调用点接线（6 处，全部改 await）**

1. `app/api/stt/route.ts`：`const stt = await getSTT()` 后 `stt.transcribe(...)`；响应 `sttProvider: process.env.STT_PROVIDER ?? "mock"`
2. `app/api/chat/route.ts`：`const chat = await getChat()`；`const raw = await chat.chat(system, messages ?? [])`
3. `app/api/tts/route.ts`：`const tts = await getTTS()`
4. `lib/services/report.ts`（generateReport 内）：`const raw = await (await getChat()).chat(REPORT_SYSTEM, [...])`
5. `lib/services/scenario.ts`（draftScenario 内）：`const raw = await (await getChat()).chat(system, [...])`
6. `app/practice/[id]/page.tsx` 本任务不动（Task 7 处理），但 `turn.sttProvider` 的数据源已由 `/api/stt` 响应真实化

- [ ] **Step 5: 全量回归**

Run: `npm test`
Expected: 68 passed（47 基线 + T1×2 + T2×8 + T3×3 + T4×4 + 本任务 4）

- [ ] **Step 6: Commit**

```powershell
git add lib/providers/types.ts app/api lib/services tests/providers-factory.test.ts
git commit -m "feat: async provider factories with env routing"
```

---

### Task 6: /api/chat/stream SSE 路由

**Files:**
- Create: `app/api/chat/stream/route.ts`
- Test: `tests/chat-stream-route.test.ts`

**Interfaces:**
- Consumes: Task 2 SentenceStream/stripGoalMarkers/trailingMarkerPrefix、Task 5 getChat、prompts.buildSystemPrompt、vocab 注入选择
- Produces: `POST /api/chat/stream {scenarioId, messages}` → `text/event-stream`，帧事件：`{"type":"delta","text":<消毒增量>}`（完整标记已剥离+部分前缀回持，UI 永不见 `[GOAL_DONE`）、`{"type":"sentence","text":<完整句>}`（驱动 TTS）、`{"type":"done","goalsDone":[...],"reply":<权威清洁全文>}`、`{"type":"error","message"}`；404 场景不存在；签名 `(req: NextRequest)`，测试用普通 Request 转型

- [ ] **Step 1: 写失败测试**

`tests/chat-stream-route.test.ts`：

```ts
import { mkdtempSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { beforeEach, expect, it } from "vitest"
import { NextRequest } from "next/server"

beforeEach(() => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "sl-test-"))
})

async function post(messages: { role: string; content: string }[]) {
  const { POST } = await import("@/app/api/chat/stream/route")
  const req = new Request("http://localhost/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenarioId: "builtin-interview", messages }),
  })
  return POST(req as unknown as NextRequest)
}

async function events(res: Response) {
  const text = await new Response(res.body).text()
  return text
    .split("\n\n")
    .filter(f => f.trim().startsWith("data:"))
    .map(f => JSON.parse(f.trim().slice(5)))
}

it("第二轮对话：分句/消毒增量/done 三类事件齐备", async () => {
  const res = await post([
    { role: "user", content: "hi" },
    { role: "assistant", content: "hello" },
    { role: "user", content: "second" },
  ])
  expect(res.headers.get("content-type")).toContain("text/event-stream")
  const evs = await events(res)
  const sentences = evs.filter(e => e.type === "sentence").map(e => e.text)
  const done = evs.find(e => e.type === "done")
  expect(sentences).toEqual(["That sounds good.", "Could you tell me more about it?"])
  expect(done.goalsDone).toEqual([0])
  expect(done.reply).toBe("That sounds good. Could you tell me more about it?")
})

it("delta 拼接等于 done.reply 且全程无标记泄漏", async () => {
  const res = await post([
    { role: "user", content: "hi" },
    { role: "assistant", content: "hello" },
    { role: "user", content: "second" },
  ])
  const evs = await events(res)
  const joined = evs.filter(e => e.type === "delta").map(e => e.text).join("")
  expect(joined.trim()).toBe(evs.find(e => e.type === "done").reply)
  expect(JSON.stringify(evs)).not.toContain("GOAL_DONE")
})

it("场景不存在返回 404", async () => {
  const { POST } = await import("@/app/api/chat/stream/route")
  const req = new Request("http://localhost/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenarioId: "nope", messages: [] }),
  })
  expect((await POST(req as unknown as NextRequest)).status).toBe(404)
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/chat-stream-route.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 app/api/chat/stream/route.ts**

```ts
import { NextRequest } from "next/server"
import { buildSystemPrompt } from "@/lib/prompts"
import { getChat } from "@/lib/providers/types"
import { SentenceStream, stripGoalMarkers, trailingMarkerPrefix } from "@/lib/sentence-stream"
import { getScenario } from "@/lib/services/scenario"
import { listWords, selectForInjection } from "@/lib/services/vocab"

export async function POST(req: NextRequest) {
  const { scenarioId, messages } = await req.json()
  const scenario = await getScenario(scenarioId)
  if (!scenario) return new Response("scenario not found", { status: 404 })
  const vocab = selectForInjection(await listWords())
  const system = buildSystemPrompt(scenario, vocab)
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      const ss = new SentenceStream(s => {
        if (s) send({ type: "sentence", text: s })
      })
      let displayBuf = ""
      let displaySent = 0
      const displayGoals: number[] = []
      try {
        const chat = await getChat()
        const full = await chat.chatStream(system, messages ?? [], d => {
          ss.push(d)
          displayBuf = stripGoalMarkers(displayBuf + d, displayGoals)
          const hold = trailingMarkerPrefix(displayBuf)
          const safe = hold ? displayBuf.slice(0, displayBuf.length - hold) : displayBuf
          if (safe.length > displaySent) {
            send({ type: "delta", text: safe.slice(displaySent) })
            displaySent = safe.length
          }
        })
        ss.flush()
        const stripped = full.replace(/\[GOAL_DONE:\d+\]/g, "")
        const tail = trailingMarkerPrefix(stripped)
        const reply = (tail ? stripped.slice(0, stripped.length - tail) : stripped)
          .replace(/ {2,}/g, " ")
          .trim()
        send({ type: "done", goalsDone: ss.goals, reply })
      } catch (e) {
        send({ type: "error", message: (e as Error).message })
      } finally {
        controller.close()
      }
    },
  })
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  })
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/chat-stream-route.test.ts`
Expected: 3 passed

- [ ] **Step 5: Commit**

```powershell
git add app/api/chat/stream/route.ts tests/chat-stream-route.test.ts
git commit -m "feat: sse chat stream route with sanitized deltas and sentence events"
```

---

### Task 7: AudioQueue + 对话页 SSE 消费

**Files:**
- Create: `lib/audio-queue.ts`、`tests/audio-queue.test.ts`
- Modify: `app/practice/[id]/page.tsx`（手术式替换 4 个函数块 + 导入/引用）

**Interfaces:**
- Produces: `class AudioQueue { constructor(play: (buf: ArrayBuffer) => Promise<void>); enqueue(fetchAudio: () => Promise<ArrayBuffer | null>): void; get idle(): Promise<void> }`（顺序播放、单条失败跳过不断链）；页面 `runChatStream`（SSE 消费：delta 追加临时气泡、sentence→入队合成、done→persistTurn）、`postTts(text): Promise<ArrayBuffer | null>`（替代 playTts）、`runChat(mode)` 收窄为教练模式专用

- [ ] **Step 1: 写失败测试**

`tests/audio-queue.test.ts`：

```ts
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
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/audio-queue.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 lib/audio-queue.ts**

```ts
export class AudioQueue {
  private chain: Promise<void> = Promise.resolve()
  constructor(private readonly play: (buf: ArrayBuffer) => Promise<void>) {}

  enqueue(fetchAudio: () => Promise<ArrayBuffer | null>): void {
    this.chain = this.chain.then(async () => {
      const buf = await fetchAudio().catch(() => null)
      if (!buf || buf.byteLength === 0) return
      await this.play(buf).catch(() => undefined)
    })
  }

  get idle(): Promise<void> {
    return this.chain
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/audio-queue.test.ts`
Expected: 3 passed

- [ ] **Step 5: 对话页手术式替换**（基于 `76779e1` 版本行号）

1. 导入区追加：`import { AudioQueue } from "@/lib/audio-queue"`
2. `pending` ref 类型改为 `useRef<{ turnId?: string; audioUrl?: string; userText: string; sttProvider?: string } | null>(null)`；其下追加：

```tsx
  const audioQueue = useRef<AudioQueue | null>(null)
  function queue(): AudioQueue {
    if (!audioQueue.current) {
      audioQueue.current = new AudioQueue(async buf => {
        await new Promise<void>(resolve => {
          const a = new Audio(URL.createObjectURL(new Blob([buf], { type: "audio/wav" })))
          a.onended = () => {
            URL.revokeObjectURL(a.src)
            setTtsDown(false)
            resolve()
          }
          a.onerror = () => resolve()
          a.play().catch(() => {
            setTtsDown(true)
            resolve()
          })
        })
      })
    }
    return audioQueue.current
  }

  async function postTts(text: string): Promise<ArrayBuffer | null> {
    try {
      const r = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, speaker: scenario?.voice }),
      })
      if (!r.ok) throw new Error()
      return await r.arrayBuffer()
    } catch {
      setTtsDown(true)
      return null
    }
  }
```

3. `runStt` 中 `pending.current = ...` 行改为 `pending.current = { turnId: data.turnId, audioUrl: data.audioUrl, userText: data.text, sttProvider: data.sttProvider }`；末行 `await runChat(data.text)` 改为 `await runChatStream(data.text)`
4. 原 `runChat(userText, mode?)` 整函数替换为以下两个函数：

```tsx
  async function runChatStream(userText: string) {
    setBusy(true); setFailed(null)
    setPhase({ label: "等待 AI 回复", since: Date.now() })
    const messages = bubbles
      .filter(b => b.role !== "coach")
      .map(b => ({ role: b.role === "user" ? "user" as const : "assistant" as const, content: b.text }))
    messages.push({ role: "user", content: userText })
    setBubbles(b => [...b, { role: "user", text: userText }, { role: "ai", text: "" }])
    let res: Response
    try {
      res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session!.id, scenarioId: session!.scenarioId, messages }),
      })
      if (!res.ok || !res.body) throw new Error(`stream ${res.status}`)
    } catch {
      setBubbles(b => b.slice(0, -2))
      setPhase(null)
      setBusy(false)
      setFailed({ name: "chat", retry: () => runChatStream(userText) })
      return
    }
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let buf = ""
    let reply = ""
    const goalsDone: number[] = []
    let errored = false
    let firstDeltaAt = -1
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      const frames = buf.split("\n\n")
      buf = frames.pop() ?? ""
      for (const f of frames) {
        const line = f.trim()
        if (!line.startsWith("data:")) continue
        let ev: { type: string; text?: string; reply?: string; goalsDone?: number[] }
        try {
          ev = JSON.parse(line.slice(5))
        } catch {
          continue
        }
        if (ev.type === "delta" && ev.text) {
          const t = ev.text
          setBubbles(b => b.map((x, i) => (i === b.length - 1 && x.role === "ai" ? { ...x, text: x.text + t } : x)))
          if (firstDeltaAt < 0) {
            firstDeltaAt = 1
            setPhase(null)
          }
        } else if (ev.type === "sentence") {
          // v2 勘误 F3：前端不再按句合成，整段在 done 后合成
        } else if (ev.type === "done") {
          reply = ev.reply ?? ""
          goalsDone.push(...(ev.goalsDone ?? []))
        } else if (ev.type === "error") {
          errored = true
        }
      }
    }
    if (errored || !reply) {
      setBubbles(b => b.slice(0, -2))
      setPhase(null)
      setBusy(false)
      setFailed({ name: "chat", retry: () => runChatStream(userText) })
      return
    }
    setBubbles(b => b.map((x, i) => (i === b.length - 1 && x.role === "ai" ? { ...x, text: reply } : x)))
    setGoalProgress(g => Array.from(new Set([...g, ...goalsDone])))
    const turn: Turn = {
      id: pending.current?.turnId ?? crypto.randomUUID(),
      userText, aiText: reply,
      audioUrl: pending.current?.audioUrl,
      sttProvider: pending.current?.sttProvider ?? "keyboard",
      createdAt: new Date().toISOString(),
    }
    const ok = await persistTurn(turn, goalsDone)
    if (!ok) return
    pending.current = null
    setBusy(false)
    setPhase({ label: "语音合成", since: Date.now() })
    queue().enqueue(() => postTts(reply).then(b => {
      setPhase(null)
      return b
    }))
  }

  async function runChat(mode: "simplify" | "hint") {
    setBusy(true); setFailed(null)
    const messages = bubbles
      .filter(b => b.role !== "coach")
      .map(b => ({ role: b.role === "user" ? "user" as const : "assistant" as const, content: b.text }))
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session!.id, scenarioId: session!.scenarioId, messages, mode }),
    })
    if (!r.ok) { setBusy(false); setFailed({ name: "chat", retry: () => runChat(mode) }); return }
    const { reply } = await r.json()
    setBubbles(b => [...b, { role: "coach", text: reply }])
    setBusy(false)
  }
```

5. `persistTurn` 内 retry 的 `playTts(turn.aiText)` 改为 `queue().enqueue(() => postTts(turn.aiText))`
6. 整体删除原 `playTts` 函数（职责已由 postTts + queue 承接）
7. 键盘 onKeyDown 内 `await runChat(t)` 改为 `await runChatStream(t)`
8. 两个教练按钮改为 `onClick={() => runChat("simplify")}` / `onClick={() => runChat("hint")}`
9. **F4 分相位耗时指示器**（勘误 v2）——四处精确编辑：

9.1 组件状态区（`audioQueue` ref 之后）追加：

```tsx
  const [phase, setPhase] = useState<{ label: string; since: number } | null>(null)
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!phase) return
    const id = setInterval(() => setTick(t => t + 1), 500)
    return () => clearInterval(id)
  }, [phase])
```

9.2 `runStt` 函数首行 `setBusy(true); setFailed(null)` 之后追加 `setPhase({ label: "语音识别", since: Date.now() })`；其 `if (!r.ok)` 与 catch 两个失败分支内各追加 `setPhase(null)`

9.3 phase 清理点位核对（勘误 v2 后 Step 5 代码已内置）：首个 delta 到达置 null、`!reply` 失败路径置 null、建连 catch 置 null、语音合成完成置 null——核对四处齐全即可

9.4 渲染区 `{busy && <p className="muted">思考中…</p>}` 一行替换为：

```tsx
        {phase && (
          <p className="muted" aria-live="polite">
            {phase.label}中… {((Date.now() - phase.since) / 1000).toFixed(0)}s
          </p>
        )}
        {busy && !phase && <p className="muted">处理中…</p>}
```

- [ ] **Step 5b: 健壮性修订（勘误 R1/R2——在 Step 5 完成后的页面上实施）**

R1——`runChatStream` 读取循环中 `const { done, value } = await reader.read()` 一行替换为：

```tsx
      const { done, value } = await reader.read().catch(() => ({ done: true, value: undefined }))
```

断流视为流结束：未收 done 事件时 `reply` 为空 → 落入既有 `!reply` 失败路径（撤临时气泡/busy 复位/重试）；已收 done 则正常收尾。

R2a——`runStt` 的 fetch 段替换为（原 `const r = await fetch(...)` 与 `if (!r.ok)` 合并处理传输层拒绝）：

```tsx
    let r: Response
    try {
      r = await fetch("/api/stt", { method: "POST", body: form })
    } catch {
      setBusy(false); setFailed({ name: "stt", retry: () => runStt(blob) }); return
    }
```

（其后 `if (!r.ok)` 分支保留。）

R2b——`runChat(mode)` 的 fetch 段同构：

```tsx
    let r: Response
    try {
      r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session!.id, scenarioId: session!.scenarioId, messages, mode }),
      })
    } catch {
      setBusy(false); setFailed({ name: "chat", retry: () => runChat(mode) }); return
    }
```

R2c——`persistTurn` 的请求与判定两行替换为单出口形式（失败分支体不变）：

```tsx
    const ok = await fetch(`/api/sessions/${session!.id}/turns`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turn, goalsDone }),
    }).then(r => r.ok, () => false)
    if (!ok) {
```

R2d——`endPractice` 的 `} finally {` 前插入：

```tsx
    } catch {
      setBusy(false)
      setFailed({ name: "chat", retry: endPractice })
```

- [ ] **Step 6: 验证**

Run: `npm test`（Expected: 74 passed）→ `npm run build` → `npm run dev` 手动走查：键盘输入两轮（第二轮 goals 打勾、气泡无标记字样）、“听不懂/提示”黄色教练气泡、结束练习报告正常。

- [ ] **Step 7: Commit**

```powershell
git add lib/audio-queue.ts tests/audio-queue.test.ts "app/practice/[id]/page.tsx"
git commit -m "feat: streaming conversation with sequential audio queue"
```

---

### Task 8: warmup 真实接线 + 仪表盘双预热

**Files:**
- Modify: `app/api/tts/warmup/route.ts`（no-op → provider 感知转发）
- Create: `app/api/stt/warmup/route.ts`
- Modify: `app/page.tsx`（fire-and-forget 双预热）
- Test: `tests/warmup-routes.test.ts`

**Interfaces:**
- Produces: `POST /api/tts/warmup` → mock 模式 `{ok:true}` 空操作；`qwen3-local` 模式转发 `TTS_BASE_URL/warmup`（`AbortSignal.timeout(180000)`，spike 冷载 145s 余量）；失败 `{ok:false}` 不抛 500。`POST /api/stt/warmup` 同构（`STT_BASE_URL`，超时 90000）。仪表盘加载时两个都 fire-and-forget。

- [ ] **Step 1: 写失败测试**

`tests/warmup-routes.test.ts`：

```ts
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
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/warmup-routes.test.ts`
Expected: 第二条 FAIL（现 no-op 实现恒返回 `{ok:true}`）

- [ ] **Step 3: 实现**

`app/api/tts/warmup/route.ts` 整体替换为：

```ts
import { NextResponse } from "next/server"

export async function POST() {
  if ((process.env.TTS_PROVIDER ?? "mock") !== "qwen3-local") {
    return NextResponse.json({ ok: true })
  }
  try {
    const base = process.env.TTS_BASE_URL ?? "http://127.0.0.1:8101"
    const r = await fetch(`${base}/warmup`, { method: "POST", signal: AbortSignal.timeout(180000) })
    return NextResponse.json({ ok: r.ok })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
```

`app/api/stt/warmup/route.ts`：

```ts
import { NextResponse } from "next/server"

export async function POST() {
  if ((process.env.STT_PROVIDER ?? "mock") !== "qwen3-local") {
    return NextResponse.json({ ok: true })
  }
  try {
    const base = process.env.STT_BASE_URL ?? "http://127.0.0.1:8100"
    const r = await fetch(`${base}/warmup`, { method: "POST", signal: AbortSignal.timeout(90000) })
    return NextResponse.json({ ok: r.ok })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
```

`app/page.tsx` 的 useEffect 中 warmup 行改为：

```tsx
    fetch("/api/tts/warmup", { method: "POST" }).catch(() => {})
    fetch("/api/stt/warmup", { method: "POST" }).catch(() => {})
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/warmup-routes.test.ts`
Expected: 2 passed

- [ ] **Step 5: Commit**

```powershell
git add app/api/tts/warmup/route.ts app/api/stt/warmup app/page.tsx tests/warmup-routes.test.ts
git commit -m "feat: provider-aware warmup routes with dashboard dual preheat"
```

---

### Task 9: 配置与文档

**Files:**
- Modify: `.env.example`、`README.md`

**Interfaces:**
- Produces: 完整 env 矩阵与真实语音/Chat 启用说明

- [ ] **Step 1: .env.example 整体替换为**

```text
STT_PROVIDER=mock
CHAT_PROVIDER=mock
TTS_PROVIDER=mock
STT_BASE_URL=http://127.0.0.1:8100
TTS_BASE_URL=http://127.0.0.1:8101
CHAT_BASE_URL=https://api.deepseek.com/v1
CHAT_API_KEY=
CHAT_MODEL=deepseek-chat
```

（`CHAT_*` 三项为 OpenAI 兼容任意厂商示例——DeepSeek/GLM/Kimi/Qwen 等换 BaseURL 与 Model 即可；mock 三项保持即全流程零依赖。）

- [ ] **Step 2: README「真实语音」章节替换为**

```markdown
## 真实语音 + 真实 Chat

1. 部署 ai-server 双服务（`docs/superpowers/plans/2026-10-01-speakloop-phase0-ai-server.md`），`scripts/start-ai.ps1` 一键拉起（asr :8100 / tts :8101，冷载约 2-3 分钟）
2. `.env` 设置：`STT_PROVIDER=qwen3-local`、`TTS_PROVIDER=qwen3-local`
3. 真实 Chat（可选）：`CHAT_PROVIDER=openai-compatible` + `CHAT_BASE_URL`/`CHAT_API_KEY`/`CHAT_MODEL`（任意 OpenAI 兼容厂商）
4. `npm run doctor` 自检 → 打开首页（自动双预热）
```

- [ ] **Step 3: 验证与提交**

```powershell
npm run build
git add .env.example README.md
git commit -m "docs: mvp2 env matrix and real voice setup"
```

---

### Task 10: 全量验证 + 真实语音联调清单

**Files:** 无新增（验证任务）

- [ ] **Step 1: 自动化全量**

先在 package.json 的 scripts 中增加（勘误 R4 门禁）：

```json
    "typecheck": "tsc --noEmit",
```

然后：

```powershell
npm test
npm run typecheck
npm run build
```

Expected: **76 passed**（47 基线 + 29 新增：T1×2 T2×8 T3×3 T4×4 T5×4 T6×3 T7×3 T8×2）；typecheck **0 error**；build 成功。

- [ ] **Step 2: 真实语音联调（需 GPU，手动清单）**

前置：`scripts/start-ai.ps1` 拉起双服务 → `.env` 三 provider 全开（含真实 Chat Key）→ `npm run dev` → 首页加载触发双预热（等 `/health` 双 `model_loaded:true`，TTS 冷载 ~145s）。

| # | 检查点 | 通过标准 |
|---|---|---|
| 1 | 语音说一句 → 对话 | STT 文本上屏正确（口音鲁棒）；goal 打勾逻辑正常 |
| 2 | **感知延迟** | 首句语音在说完后 ~3s 内开始播（STT 2.4s + 首句 LLM/TTS 流水线）；对照 spike 整段 10.44s 的改善幅度记入验收 |
| 3 | 分句顺序播放 | 多句回复逐句顺序播、不重叠不丢句 |
| 4 | 标记不可见 | 全程任何气泡/音频文本中无 `[GOAL_DONE` 字样 |
| 5 | 降级：关掉 tts-server | 文字流式照常 + "语音服务离线"芯片 |
| 6 | 降级：关掉 asr-server | 录音失败→键盘输入继续 |
| 7 | 真实 Chat 流式 | 打字机效果平滑；断网中途→chat 失败重试按钮 |
| 8 | 回归 | 报告/生词/仪表盘/422 报告页全部正常 |

- [ ] **Step 3: 收尾提交**

```powershell
git add -A
git commit -m "chore: mvp2 real voice verification complete"
```

（若联调发现偏差，按 `AGENTS.md` 记录证据转设计方裁定，不擅自改 docs。）



