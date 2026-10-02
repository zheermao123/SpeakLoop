# SpeakLoop MVP-2.1 实施计划（应用内设置页 + 配置层）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** 网页 `/settings` 配置入口：Chat（provider/BaseURL/Key/Model）、STT/TTS（provider/服务地址）、TTS 默认音色，改完即时生效无需重启；**Key 永不回显**（仅尾 4 位）；每分区带"测试连接"当场验证。

**Architecture:** `data/config.json`（对象存储，写队列+原子写）为最高优先层——**设置页 > .env > 内置默认**；`lib/config.ts` 统一解析，工厂改读解析结果（调用点零改动）；GET 脱敏 / PUT 留空保 Key。

**Tech Stack:** 既有基线（**76 tests**，Mock 已移除、测试假件在 `tests/fixtures/fake-providers.ts`）。

## Global Constraints

- 基线 76；推进 **76→82→83→87→90**（T1×6、T2 +1、T3×4、T4×3）
- 每任务 `npm test` 全绿 + `npm run typecheck`（R4 门禁）+ `npm run build`
- **Key 安全硬规则**：GET 永不返回完整 Key（`{configured, tail}`）；PUT 的 `apiKey === ""` 表示保持原值（路由层剥离该字段后再落盘）
- 工厂 fail-fast 语义调整（本计划确认）：openai-compatible 必填 **baseUrl + model**，**apiKey 可空**（兼容本地代理型服务）——既有"缺 Key 即拒"测试同步修改
- UI 不变量（spec §9）延续：fetch 检查 r.ok、busy try/finally 复位、无 undefined 路由

---

### Task 1: lib/config.ts 配置层（解析/保存/脱敏）

**Files:**
- Create: `lib/config.ts`
- Test: `tests/config.test.ts`

**Interfaces:**
- Produces:
  - `interface AppConfig { chat: { provider: string; baseUrl: string; apiKey: string; model: string }; stt: { provider: string; baseUrl: string }; tts: { provider: string; baseUrl: string; speaker: string } }`
  - `resolveConfig(): Promise<AppConfig>`——三层合并（`data/config.json` 覆盖 > env > 默认；分段 Object.assign 浅合并）
  - `saveConfig(patch): Promise<AppConfig>`——与当前解析结果合并后原子落盘（写队列同 json-store 模式）
  - `maskKey(key): { configured: boolean; tail: string }`——尾 4 位脱敏

- [ ] **Step 1: 写失败测试**

`tests/config.test.ts`：

```ts
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const KEYS = ["CHAT_PROVIDER", "CHAT_BASE_URL", "CHAT_API_KEY", "CHAT_MODEL", "STT_PROVIDER", "STT_BASE_URL", "TTS_PROVIDER", "TTS_BASE_URL", "TTS_SPEAKER"] as const

beforeEach(() => {
  vi.resetModules()
  for (const k of KEYS) delete process.env[k]
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "sl-cfg-"))
})
afterEach(() => {
  rmSync(process.env.DATA_DIR!, { recursive: true, force: true })
  for (const k of KEYS) delete process.env[k]
})

it("无 env 无存储：返回默认值", async () => {
  const { resolveConfig } = await import("@/lib/config")
  const cfg = await resolveConfig()
  expect(cfg.chat.provider).toBe("openai-compatible")
  expect(cfg.stt.baseUrl).toBe("http://127.0.0.1:8100")
  expect(cfg.tts.speaker).toBe("Aiden")
})

it("env 层生效", async () => {
  process.env.CHAT_BASE_URL = "https://api.example.com"
  process.env.TTS_SPEAKER = "Serena"
  const { resolveConfig } = await import("@/lib/config")
  const cfg = await resolveConfig()
  expect(cfg.chat.baseUrl).toBe("https://api.example.com")
  expect(cfg.tts.speaker).toBe("Serena")
})

it("存储层覆盖 env 层（设置页优先）", async () => {
  process.env.CHAT_MODEL = "env-model"
  writeFileSync(path.join(process.env.DATA_DIR!, "config.json"), JSON.stringify({ chat: { model: "stored-model" } }))
  const { resolveConfig } = await import("@/lib/config")
  expect((await resolveConfig()).chat.model).toBe("stored-model")
})

it("saveConfig 合并落盘且原子", async () => {
  const { saveConfig, resolveConfig } = await import("@/lib/config")
  await saveConfig({ chat: { model: "m2" }, tts: { speaker: "Ryan" } })
  const raw = JSON.parse(readFileSync(path.join(process.env.DATA_DIR!, "config.json"), "utf-8"))
  expect(raw.chat.model).toBe("m2")
  expect(raw.tts.speaker).toBe("Ryan")
  expect((await resolveConfig()).chat.model).toBe("m2")
})

it("saveConfig 未触及的 env 值仍在解析结果中", async () => {
  process.env.CHAT_BASE_URL = "https://from-env"
  const { saveConfig, resolveConfig } = await import("@/lib/config")
  await saveConfig({ chat: { model: "only-model" } })
  const cfg = await resolveConfig()
  expect(cfg.chat.baseUrl).toBe("https://from-env")
  expect(cfg.chat.model).toBe("only-model")
})

it("maskKey 脱敏", async () => {
  const { maskKey } = await import("@/lib/config")
  expect(maskKey("sk-abcdef1234")).toEqual({ configured: true, tail: "1234" })
  expect(maskKey("")).toEqual({ configured: false, tail: "" })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/config.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 lib/config.ts**

```ts
import { promises as fs } from "node:fs"
import path from "node:path"

export interface AppConfig {
  chat: { provider: string; baseUrl: string; apiKey: string; model: string }
  stt: { provider: string; baseUrl: string }
  tts: { provider: string; baseUrl: string; speaker: string }
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

const DEFAULTS: AppConfig = {
  chat: { provider: "openai-compatible", baseUrl: "", apiKey: "", model: "" },
  stt: { provider: "qwen3-local", baseUrl: "http://127.0.0.1:8100" },
  tts: { provider: "qwen3-local", baseUrl: "http://127.0.0.1:8101", speaker: "Aiden" },
}

function file() {
  return path.join(process.env.DATA_DIR ?? path.join(process.cwd(), "data"), "config.json")
}

async function readStored(): Promise<DeepPartial<AppConfig>> {
  try {
    return JSON.parse(await fs.readFile(file(), "utf-8"))
  } catch {
    return {}
  }
}

function merge(base: AppConfig, patch: DeepPartial<AppConfig>): AppConfig {
  const out = structuredClone(base)
  if (patch.chat) Object.assign(out.chat, patch.chat)
  if (patch.stt) Object.assign(out.stt, patch.stt)
  if (patch.tts) Object.assign(out.tts, patch.tts)
  return out
}

export async function resolveConfig(): Promise<AppConfig> {
  const fromEnv: AppConfig = {
    chat: {
      provider: process.env.CHAT_PROVIDER ?? DEFAULTS.chat.provider,
      baseUrl: process.env.CHAT_BASE_URL ?? "",
      apiKey: process.env.CHAT_API_KEY ?? "",
      model: process.env.CHAT_MODEL ?? "",
    },
    stt: {
      provider: process.env.STT_PROVIDER ?? DEFAULTS.stt.provider,
      baseUrl: process.env.STT_BASE_URL ?? DEFAULTS.stt.baseUrl,
    },
    tts: {
      provider: process.env.TTS_PROVIDER ?? DEFAULTS.tts.provider,
      baseUrl: process.env.TTS_BASE_URL ?? DEFAULTS.tts.baseUrl,
      speaker: process.env.TTS_SPEAKER ?? DEFAULTS.tts.speaker,
    },
  }
  return merge(fromEnv, await readStored())
}

let queue: Promise<unknown> = Promise.resolve()

export async function saveConfig(patch: DeepPartial<AppConfig>): Promise<AppConfig> {
  const job = queue.then(async () => {
    const merged = merge(await resolveConfig(), patch)
    const target = file()
    const tmp = `${target}.${process.pid}.tmp`
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(tmp, JSON.stringify(merged, null, 2), "utf-8")
    await fs.rename(tmp, target)
    return merged
  })
  queue = job.catch(() => undefined)
  return job
}

export function maskKey(key: string): { configured: boolean; tail: string } {
  if (!key) return { configured: false, tail: "" }
  return { configured: true, tail: key.slice(-4) }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/config.test.ts`
Expected: 6 passed

- [ ] **Step 5: Commit**

```powershell
git add lib/config.ts tests/config.test.ts
git commit -m "feat: app config layer with precedence resolve and atomic save"
```

---

### Task 2: 工厂改读解析配置（含 Key 可空语义）

**Files:**
- Modify: `lib/providers/types.ts`、`app/api/tts/route.ts`
- Test: `tests/providers-factory.test.ts`（改 1 用例 + 增 1 用例）

**Interfaces:**
- Produces: 三工厂内部改 `const cfg = await resolveConfig()` 后分支（错误消息引导"`.env` **或设置页**"）；`getChat` 必填校验放宽为 **baseUrl + model**（apiKey 可空）；`/api/tts` 的 speaker 回退链：`body.speaker ?? cfg.tts.speaker`

- [ ] **Step 1: 工厂替换为**

```ts
import { resolveConfig } from "@/lib/config"

export async function getSTT(): Promise<STTProvider> {
  const cfg = await resolveConfig()
  if (cfg.stt.provider !== "qwen3-local") {
    throw new Error("语音识别未配置：请在 .env 或设置页配置 STT_PROVIDER=qwen3-local")
  }
  const { Qwen3LocalStt } = await import("@/lib/providers/stt/qwen3-local")
  return new Qwen3LocalStt(cfg.stt.baseUrl)
}

export async function getChat(): Promise<ChatProvider> {
  const cfg = await resolveConfig()
  if (cfg.chat.provider !== "openai-compatible") {
    throw new Error("对话未配置：请在 .env 或设置页配置 CHAT_PROVIDER=openai-compatible")
  }
  if (!cfg.chat.baseUrl || !cfg.chat.model) {
    throw new Error("openai-compatible 需要 CHAT_BASE_URL 与 CHAT_MODEL（apiKey 可空）")
  }
  const { OpenAICompatibleChatProvider } = await import("@/lib/providers/chat/openai-compatible")
  return new OpenAICompatibleChatProvider({ baseUrl: cfg.chat.baseUrl, apiKey: cfg.chat.apiKey, model: cfg.chat.model })
}

export async function getTTS(): Promise<TTSProvider> {
  const cfg = await resolveConfig()
  if (cfg.tts.provider !== "qwen3-local") {
    throw new Error("语音合成未配置：请在 .env 或设置页配置 TTS_PROVIDER=qwen3-local")
  }
  const { Qwen3LocalTts } = await import("@/lib/providers/tts/qwen3-local")
  return new Qwen3LocalTts(cfg.tts.baseUrl)
}
```

`app/api/tts/route.ts`：`const { text, speaker } = await req.json()` 后合成调用改为 `synthesize(text, { speaker: speaker ?? cfg.tts.speaker })`（`cfg` 由 `resolveConfig()` 取得）。（fast-follow 观察项：路由与工厂各自 `resolveConfig` 重复解析，可改为工厂接受可选 cfg 注入去重——非本任务范围。）

- [ ] **Step 2: 测试更新（providers-factory.test.ts）**

1. 既有用例"openai-compatible 缺 env 时 fail-fast"改为**缺 CHAT_MODEL 拒绝 + 缺 CHAT_API_KEY 通过**：

```ts
it("openai-compatible：缺 model 拒绝、缺 apiKey 可通过", async () => {
  process.env.CHAT_PROVIDER = "openai-compatible"
  process.env.CHAT_BASE_URL = "https://api.example.com/v1"
  const { getChat } = await freshTypes()
  await expect(getChat()).rejects.toThrow("CHAT_MODEL")
  process.env.CHAT_MODEL = "m1"
  expect((await getChat()).constructor.name).toBe("OpenAICompatibleChatProvider")
})

it("存储层覆盖 env：工厂读取设置页配置", async () => {
  process.env.STT_PROVIDER = "qwen3-local"
  process.env.STT_BASE_URL = "http://127.0.0.1:9999"
  writeFileSync(path.join(process.env.DATA_DIR!, "config.json"), JSON.stringify({ stt: { baseUrl: "http://127.0.0.1:8100" } }))
  const { getSTT } = await freshTypes()
  const stt = await getSTT()
  expect((stt as unknown as { baseUrl: string }).baseUrl).toBe("http://127.0.0.1:8100")
})
```

（文件头部补 `writeFileSync`/`path` import 与 DATA_DIR beforeEach——沿用 config.test 的环境模板。**裁定溯源 2026-10-02 pre-flight**：新语义下 env 未配置时 STT/TTS/Chat 均落默认 provider 值（不再抛错）——原"未配置 provider 抛出指引"用例**整体替换**为显式未知值版本：）

```ts
it("未知 provider 抛出配置指引", async () => {
  process.env.STT_PROVIDER = "foo"
  process.env.TTS_PROVIDER = "foo"
  process.env.CHAT_PROVIDER = "foo"
  const { getSTT, getChat, getTTS } = await freshTypes()
  await expect(getSTT()).rejects.toThrow("qwen3-local")
  await expect(getChat()).rejects.toThrow("openai-compatible")
  await expect(getTTS()).rejects.toThrow("qwen3-local")
})
```

- [ ] **Step 3: 全量回归**

Run: `npm test`
Expected: **83 passed**（76 + T1×6 + 本任务 4→5 用例净 +1）

- [ ] **Step 4: Commit**

```powershell
git add lib/providers/types.ts app/api/tts/route.ts tests/providers-factory.test.ts
git commit -m "feat: factories read resolved config, api key optional"
```

---

### Task 3: GET/PUT /api/settings（脱敏/合并/校验）

**Files:**
- Create: `app/api/settings/route.ts`
- Test: `tests/settings-route.test.ts`

**Interfaces:**
- Produces:
  - `GET /api/settings` → `{ chat: { provider, baseUrl, model, apiKey: { configured, tail } }, stt: { provider, baseUrl }, tts: { provider, baseUrl, speaker } }`
  - `PUT /api/settings` body 为 DeepPartial：校验（provider 枚举 `openai-compatible|qwen3-local`、非空 baseUrl 需 `http(s)://` 前缀、openai-compatible 需 baseUrl+model）→ **`apiKey === ""` 时从 patch 剥离**（保原值）→ `saveConfig` → 返回 GET 同形脱敏结果；校验失败 400 `{ error }`
  - 辅助 `toMasked(cfg): 上述 GET 形状`（路由内函数，供 GET/PUT 共用）

- [ ] **Step 1: 写失败测试**

`tests/settings-route.test.ts`：

```ts
import { mkdtempSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { beforeEach, expect, it } from "vitest"
import { NextRequest } from "next/server"

beforeEach(() => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "sl-set-"))
  for (const k of ["CHAT_PROVIDER", "CHAT_BASE_URL", "CHAT_API_KEY", "CHAT_MODEL"]) delete process.env[k]
})

async function get() {
  const { GET } = await import("@/app/api/settings/route")
  return GET()
}

async function put(body: unknown) {
  const { PUT } = await import("@/app/api/settings/route")
  const req = new Request("http://localhost/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return PUT(req as unknown as NextRequest)
}

it("GET 默认脱敏：无 Key 时 configured=false", async () => {
  const r = await get()
  const j = await r.json()
  expect(j.chat.apiKey).toEqual({ configured: false, tail: "" })
  expect(j.tts.speaker).toBe("Aiden")
})

it("PUT 保存并回显脱敏", async () => {
  const r = await put({ chat: { baseUrl: "https://api.x.com", apiKey: "sk-abcd9999", model: "m" }, tts: { speaker: "Ryan" } })
  const j = await r.json()
  expect(j.chat.apiKey).toEqual({ configured: true, tail: "9999" })
  expect(j.tts.speaker).toBe("Ryan")
  expect(JSON.stringify(j)).not.toContain("sk-abcd9999")
})

it("PUT apiKey 留空保持原值", async () => {
  await put({ chat: { baseUrl: "https://api.x.com", apiKey: "sk-keep123", model: "m" } })
  const r = await put({ chat: { model: "m2", apiKey: "" } })
  const j = await r.json()
  expect(j.chat.model).toBe("m2")
  expect(j.chat.apiKey).toEqual({ configured: true, tail: "p123" })
})

it("非法 provider 返回 400", async () => {
  const r = await put({ chat: { provider: "gpt4all" } })
  expect(r.status).toBe(400)
  expect((await r.json()).error).toBeTruthy()
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/settings-route.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 app/api/settings/route.ts**

```ts
import { NextRequest, NextResponse } from "next/server"
import { AppConfig, maskKey, resolveConfig, saveConfig } from "@/lib/config"

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

function toMasked(cfg: AppConfig) {
  return {
    chat: { provider: cfg.chat.provider, baseUrl: cfg.chat.baseUrl, model: cfg.chat.model, apiKey: maskKey(cfg.chat.apiKey) },
    stt: { provider: cfg.stt.provider, baseUrl: cfg.stt.baseUrl },
    tts: { provider: cfg.tts.provider, baseUrl: cfg.tts.baseUrl, speaker: cfg.tts.speaker },
  }
}

export async function GET() {
  return NextResponse.json(toMasked(await resolveConfig()))
}

export async function PUT(req: NextRequest) {
  const patch = (await req.json()) as DeepPartial<AppConfig>
  const errors: string[] = []
  if (patch.chat?.provider && patch.chat.provider !== "openai-compatible") errors.push("chat.provider 仅支持 openai-compatible")
  if (patch.stt?.provider && patch.stt.provider !== "qwen3-local") errors.push("stt.provider 仅支持 qwen3-local")
  if (patch.tts?.provider && patch.tts.provider !== "qwen3-local") errors.push("tts.provider 仅支持 qwen3-local")
  for (const u of [patch.chat?.baseUrl, patch.stt?.baseUrl, patch.tts?.baseUrl]) {
    if (u && !/^https?:\/\//.test(u)) errors.push("baseUrl 必须以 http:// 或 https:// 开头")
  }
  if (errors.length) return NextResponse.json({ error: errors.join("；") }, { status: 400 })
  if (patch.chat) {
    if (patch.chat.apiKey === "") delete patch.chat.apiKey
    const mergedChat = { ...(await resolveConfig()).chat, ...patch.chat }
    if (mergedChat.provider === "openai-compatible" && (!mergedChat.baseUrl || !mergedChat.model)) {
      return NextResponse.json({ error: "openai-compatible 需要 CHAT_BASE_URL 与 CHAT_MODEL" }, { status: 400 })
    }
  }
  const saved = await saveConfig(patch)
  return NextResponse.json(toMasked(saved))
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/settings-route.test.ts`
Expected: 4 passed

- [ ] **Step 5: Commit**

```powershell
git add app/api/settings/route.ts tests/settings-route.test.ts
git commit -m "feat: settings api with masked get and key-preserving put"
```

---

### Task 4: POST /api/settings/test（测试连接）

**Files:**
- Create: `app/api/settings/test/route.ts`
- Test: `tests/settings-test-route.test.ts`

**Interfaces:**
- Produces: `POST /api/settings/test { target: "chat" | "stt" | "tts" }` → `{ ok: boolean, detail: string, ms: number }`——chat 用**当前已存配置**发一句最小对话（`"You are a health probe. Reply with the single word: pong."` / user `"ping"`，detail 取回复前 80 字符）；stt/tts 探活各自 `/health`（detail 含 `model_loaded`）；任何失败 `{ ok:false, detail: 错误消息, ms }` 不抛 500

- [ ] **Step 1: 写失败测试**

`tests/settings-test-route.test.ts`：

```ts
import { mkdtempSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { beforeEach, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/providers/chat/openai-compatible", async () => {
  const { FakeChatProvider } = await import("./fixtures/fake-providers")
  return { OpenAICompatibleChatProvider: FakeChatProvider }
})

beforeEach(() => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "sl-tst-"))
  for (const k of ["CHAT_PROVIDER", "CHAT_BASE_URL", "CHAT_API_KEY", "CHAT_MODEL", "STT_BASE_URL", "TTS_BASE_URL"]) delete process.env[k]
})

async function post(body: unknown) {
  const { POST } = await import("@/app/api/settings/test/route")
  const req = new Request("http://localhost/api/settings/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return POST(req as unknown as NextRequest)
}

it("chat 未配置：ok=false 且带指引消息", async () => {
  const r = await post({ target: "chat" })
  expect(r.status).toBe(200)
  const j = await r.json()
  expect(j.ok).toBe(false)
  expect(j.detail).toContain("openai-compatible")
})

it("chat 已配置（vi.mock 假件）：ok=true 带 detail 与耗时", async () => {
  writeFileSync(path.join(process.env.DATA_DIR!, "config.json"), JSON.stringify({
    chat: { provider: "openai-compatible", baseUrl: "https://api.x.com", apiKey: "sk-1", model: "m" },
  }))
  const r = await post({ target: "chat" })
  const j = await r.json()
  expect(j.ok).toBe(true)
  expect(j.detail.length).toBeGreaterThan(0)
  expect(j.ms).toBeGreaterThanOrEqual(0)
})

it("stt 不可达：ok=false", async () => {
  writeFileSync(path.join(process.env.DATA_DIR!, "config.json"), JSON.stringify({
    stt: { provider: "qwen3-local", baseUrl: "http://127.0.0.1:9" },
  }))
  const r = await post({ target: "stt" })
  const j = await r.json()
  expect(j.ok).toBe(false)
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/settings-test-route.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 app/api/settings/test/route.ts**

```ts
import { NextRequest, NextResponse } from "next/server"
import { resolveConfig } from "@/lib/config"
import { getChat } from "@/lib/providers/types"

export async function POST(req: NextRequest) {
  const { target } = await req.json()
  const t0 = Date.now()
  try {
    if (target === "chat") {
      const chat = await getChat()
      const reply = await chat.chat(
        "You are a health probe. Reply with the single word: pong.",
        [{ role: "user", content: "ping" }]
      )
      return NextResponse.json({ ok: true, detail: reply.slice(0, 80), ms: Date.now() - t0 })
    }
    const cfg = await resolveConfig()
    const base = target === "stt" ? cfg.stt.baseUrl : cfg.tts.baseUrl
    const r = await fetch(`${base}/health`, { signal: AbortSignal.timeout(5000) })
    const j = await r.json().catch(() => ({}) as Record<string, unknown>)
    return NextResponse.json({
      ok: r.ok,
      detail: `health ${r.status} model_loaded=${String(j.model_loaded ?? "?")}`,
      ms: Date.now() - t0,
    })
  } catch (e) {
    return NextResponse.json({ ok: false, detail: (e as Error).message, ms: Date.now() - t0 })
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/settings-test-route.test.ts`
Expected: 3 passed

- [ ] **Step 5: Commit**

```powershell
git add app/api/settings/test/route.ts tests/settings-test-route.test.ts
git commit -m "feat: settings connection test endpoint"
```

---

### Task 5: /settings 页面 + Nav 入口

**Files:**
- Create: `app/settings/page.tsx`
- Modify: `components/Nav.tsx`（增"设置"链接 `/settings`）

**Interfaces:**
- Consumes: `GET/PUT /api/settings`、`POST /api/settings/test`
- Produces: 三卡片表单（Chat：provider 只读标识+BaseURL+Key[password，占位显示尾 4 位]+Model；语音服务：STT/TTS 地址；通用：TTS 默认音色 select [Aiden, Ryan, Serena, Vivian, Dylan, Eric]）；每区"测试连接"按钮显示 `{ok, detail, ms}`；顶部保存按钮（busy try/finally、错误横幅、r.ok 全检）

- [ ] **Step 1: 实现 app/settings/page.tsx**

```tsx
"use client"

import { useEffect, useState } from "react"

type Masked = {
  chat: { provider: string; baseUrl: string; model: string; apiKey: { configured: boolean; tail: string } }
  stt: { provider: string; baseUrl: string }
  tts: { provider: string; baseUrl: string; speaker: string }
}

type TestResult = { ok: boolean; detail: string; ms: number }

export default function SettingsPage() {
  const [cfg, setCfg] = useState<Masked | null>(null)
  const [apiKey, setApiKey] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const [results, setResults] = useState<Record<string, TestResult>>({})

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(setCfg).catch(() => setError("加载设置失败"))
  }, [])

  async function save() {
    if (!cfg) return
    setBusy(true); setError(""); setSaved(false)
    try {
      const body: Record<string, unknown> = {
        chat: { baseUrl: cfg.chat.baseUrl, model: cfg.chat.model },
        stt: { baseUrl: cfg.stt.baseUrl },
        tts: { baseUrl: cfg.tts.baseUrl, speaker: cfg.tts.speaker },
      }
      if (apiKey.trim()) (body.chat as Record<string, unknown>).apiKey = apiKey.trim()
      const r = await fetch("/api/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error((await r.json()).error ?? `保存失败 (${r.status})`)
      setCfg(await r.json())
      setApiKey("")
      setSaved(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function test(target: "chat" | "stt" | "tts") {
    setResults(r => ({ ...r, [target]: { ok: false, detail: "测试中…", ms: 0 } }))
    try {
      const r = await fetch("/api/settings/test", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target }),
      })
      if (!r.ok) throw new Error((await r.json()).detail ?? `测试失败 (${r.status})`)
      const j = await r.json()
      setResults(prev => ({ ...prev, [target]: j }))
    } catch (e) {
      setResults(prev => ({ ...prev, [target]: { ok: false, detail: (e as Error).message, ms: 0 } }))
    }
  }

  if (!cfg) return <p className="muted">加载中…</p>
  return (
    <div>
      <h3>设置</h3>
      {error && <div className="card"><span className="muted">{error}</span></div>}
      {saved && <div className="card"><span className="muted">已保存，即时生效。</span></div>}

      <div className="card">
        <b>对话（{cfg.chat.provider}）</b>
        <label className="field">BaseURL</label>
        <input className="input" value={cfg.chat.baseUrl}
          onChange={e => setCfg({ ...cfg, chat: { ...cfg.chat, baseUrl: e.target.value } })} />
        <label className="field">API Key {cfg.chat.apiKey.configured ? `（已配置 ····${cfg.chat.apiKey.tail}，留空保持）` : "（未配置）"}</label>
        <input className="input" type="password" placeholder={cfg.chat.apiKey.configured ? "••••留空保持原值" : "sk-..."}
          value={apiKey} onChange={e => setApiKey(e.target.value)} />
        <label className="field">Model</label>
        <input className="input" value={cfg.chat.model}
          onChange={e => setCfg({ ...cfg, chat: { ...cfg.chat, model: e.target.value } })} />
        <button className="btn btn-secondary mt-2" onClick={() => test("chat")}>测试连接</button>
        {results.chat && <p className="muted">{results.chat.ok ? "✓" : "✗"} {results.chat.detail}（{results.chat.ms}ms）</p>}
      </div>

      <div className="card">
        <b>语音服务</b>
        <label className="field">STT 地址（qwen3-local）</label>
        <input className="input" value={cfg.stt.baseUrl}
          onChange={e => setCfg({ ...cfg, stt: { ...cfg.stt, baseUrl: e.target.value } })} />
        <label className="field">TTS 地址（qwen3-local）</label>
        <input className="input" value={cfg.tts.baseUrl}
          onChange={e => setCfg({ ...cfg, tts: { ...cfg.tts, baseUrl: e.target.value } })} />
        <button className="btn btn-secondary mt-2" onClick={() => test("stt")}>测试 STT</button>
        <button className="btn btn-secondary mt-2" onClick={() => test("tts")}>测试 TTS</button>
        {results.stt && <p className="muted">{results.stt.ok ? "✓" : "✗"} {results.stt.detail}（{results.stt.ms}ms）</p>}
        {results.tts && <p className="muted">{results.tts.ok ? "✓" : "✗"} {results.tts.detail}（{results.tts.ms}ms）</p>}
      </div>

      <div className="card">
        <b>通用</b>
        <label className="field">TTS 默认音色</label>
        <select className="input" value={cfg.tts.speaker}
          onChange={e => setCfg({ ...cfg, tts: { ...cfg.tts, speaker: e.target.value } })}>
          {["Aiden", "Ryan", "Serena", "Vivian", "Dylan", "Eric"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <button className="btn" disabled={busy} onClick={save}>{busy ? "保存中…" : "保存设置"}</button>
    </div>
  )
}
```

`components/Nav.tsx` links 数组追加 `{ href: "/settings", label: "设置" }`。

- [ ] **Step 2: 验证**

Run: `npm test`（90）→ `npm run typecheck` → `npm run build` → 手动：`/settings` 加载回显（Key 显示尾 4 位）→ 改 Model 保存 → 测试连接三按钮 → Nav"设置"高亮。

- [ ] **Step 3: Commit**

```powershell
git add app/settings components/Nav.tsx
git commit -m "feat: settings page with connection tests and nav entry"
```

---

### Task 6: README 增补"应用内设置"

**Files:** Modify: `README.md`

- [ ] **Step 1:** 「配置说明」章节开头追加：

```markdown
**应用内设置（推荐）**：打开 `/settings`（导航栏"设置"）即可配置 Chat/语音服务/音色——改完即时生效无需重启；API Key 仅本地存储、界面永不明文回显（只显示尾 4 位）。`.env` 仍可用作初始默认层（设置页优先于 `.env`）。
```

- [ ] **Step 2: Commit**

```powershell
git add README.md
git commit -m "docs: settings page section in readme"
```

---

### Task 7: 全量终验

- [ ] **Step 1: 自动化门禁**

```powershell
npm test
npm run typecheck
npm run build
```

Expected: **90 passed**（76 + T1×6 + T2 净+1 + T3×4 + T4×3）/ 0 error / build 成功

- [ ] **Step 2: 手动走查**

1. `/settings` 修改 Chat Model 保存 → 立即对话验证新模型生效（无需重启）
2. 故意填错 BaseURL → 测试连接 → `✗` + 明确错误详情
3. Key 留空保存 → 尾 4 位不变、对话仍通（原 Key 保留）
4. 设置页改 TTS 音色 → 对话页语音换声
5. `data/config.json` 手工检查：Key 明文仅在本地该文件（gitignore 覆盖）

- [ ] **Step 3: 收尾提交**

```powershell
git add -A
git commit -m "chore: mvp2.1 settings complete"
```


