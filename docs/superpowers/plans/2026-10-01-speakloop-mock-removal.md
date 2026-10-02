# SpeakLoop Mock 移除实施计划（生产零 Mock + 测试夹具下沉）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** 生产代码彻底移除 Mock（用户裁定：Mock 是测试脚手架，不该出现在产品里）；测试假件下沉 `tests/fixtures/` 保持 76 全绿；README 重定位为真实路径文档。

**背景：** Mock 三重动机（测试隔离/零依赖起步/演示）中，前两者要求它**只存在于测试侧**；README 主推 Mock 是文档定位错误（MVP-1 遗留未清理）。

**Tech Stack:** 既有基线（76 tests 目标、typecheck、build；勘误清算：原写 77 系算术错误——旧工厂测试文件实有 4 用例而非 3，76−4+4=76）。

## Global Constraints

- 基线 76 tests；工厂用例 4→4（重写）→ **76**（勘误清算：原算术 +1 有误，旧文件本就有 4 用例）
- 每任务 `npm test` 全绿；最后 `npm run typecheck && npm run build`
- 删除的三个 mock 文件的行为逻辑**原样迁移**到 `tests/fixtures/fake-providers.ts`（不许丢断言行为）
- 所有涉及 `getChat()` 的服务改为**可选注入**（默认仍走工厂），路由调用点不变

---

### Task 1: 测试夹具下沉 + 生产工厂重写

**Files:**
- Create: `tests/fixtures/fake-providers.ts`
- Delete: `lib/providers/stt/mock.ts`、`lib/providers/chat/mock.ts`、`lib/providers/tts/mock.ts`
- Modify: `lib/providers/types.ts`
- Test: `tests/providers-factory.test.ts`（重写）、`tests/fixtures-providers.test.ts`（由 tests/providers-mock.test.ts 迁移改名）

**Interfaces:**
- Produces: `tests/fixtures/fake-providers.ts` 导出 `FakeSttProvider` / `FakeChatProvider` / `FakeTtsProvider`（行为=原三个 mock：固定识别文本/模板对话含 GOAL_DONE 与报告 JSON 分支/静音 wav；FakeChatProvider 构造器接受可选 cfg 以兼容工厂签名）
- 工厂新契约：`getSTT()` 仅认 `STT_PROVIDER=qwen3-local`，`getTTS()` 仅认 `TTS_PROVIDER=qwen3-local`，`getChat()` 仅认 `CHAT_PROVIDER=openai-compatible`（且 R3 fail-fast 保留）；**未配置或不认识的一律 throw 配置指引**（不再有 mock 兜底）

- [ ] **Step 1: 创建 tests/fixtures/fake-providers.ts**（内容=原三个 mock 文件逻辑合并，类名加 Fake 前缀，构造器容忍多余参数）

```ts
import { ChatProvider, STTProvider, STTResult, TTSProvider } from "@/lib/providers/types"

export class FakeSttProvider implements STTProvider {
  async transcribe(_audio: Blob): Promise<STTResult> {
    return { text: "This is a mock transcription for local development." }
  }
}

export class FakeChatProvider implements ChatProvider {
  constructor(_cfg?: unknown) {}
  async chat(
    system: string,
    messages: { role: "user" | "assistant"; content: string }[]
  ): Promise<string> {
    const last = messages[messages.length - 1]?.content ?? ""
    if (system.includes("report analyzer")) {
      const m = last.match(/\[([^\]]+)\]\s*(.+)/s)
      const turnId = m?.[1] ?? "unknown"
      const original = m?.[2]?.split("\n")[0] ?? "I go yesterday"
      return JSON.stringify({
        summary: "Mock 报告：整体表达清晰，注意时态与介词的使用。",
        highlights: ["能够主动展开话题", "语速与流利度良好"],
        corrections: [
          { turnId, original, type: "grammar", improved: "I went there yesterday.", explanation: "yesterday 提示过去时间，动词需用过去式。" },
        ],
        vocabCandidates: [{ word: "blocker", translation: "阻碍；卡点", example: "We hit a blocker in the API integration." }],
      })
    }
    if (system.includes("simpler English")) return "OK, simply: what do you mean? Please say it again in short words."
    if (system.includes("sentence pattern")) return "提示：表达建议时可以说 —— I'd suggest we ... / How about ...ing?"
    const userCount = messages.filter(x => x.role === "user").length
    if (userCount <= 1) return "Hi! Nice to meet you. Let's get started — tell me a bit about yourself."
    if (userCount === 2) return "That sounds good. Could you tell me more about it? [GOAL_DONE:0]"
    if (userCount >= 4) return "Great, I think we've covered a lot today. Thanks! [GOAL_DONE:1]"
    return "Interesting. Please go on."
  }
  async chatStream(
    system: string,
    messages: { role: "user" | "assistant"; content: string }[],
    onDelta: (delta: string) => void
  ): Promise<string> {
    const full = await this.chat(system, messages)
    for (let i = 0; i < full.length; i += 16) onDelta(full.slice(i, i + 16))
    return full
  }
}

export class FakeTtsProvider implements TTSProvider {
  async synthesize(_text: string, _options?: { speaker?: string }): Promise<ArrayBuffer> {
    const sampleRate = 8000
    const n = Math.floor((sampleRate * 150) / 1000)
    const buf = new ArrayBuffer(44 + n * 2)
    const v = new DataView(buf)
    const w = (o: number, s: string) => {
      for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i))
    }
    w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt ")
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
    v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true)
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true)
    return buf
  }
}
```

- [ ] **Step 2: 重写 tests/providers-factory.test.ts**（4 用例）

```ts
import { afterEach, expect, it, vi } from "vitest"

function freshTypes() {
  vi.resetModules()
  return import("@/lib/providers/types")
}

const KEYS = ["STT_PROVIDER", "TTS_PROVIDER", "CHAT_PROVIDER", "STT_BASE_URL", "TTS_BASE_URL", "CHAT_BASE_URL", "CHAT_API_KEY", "CHAT_MODEL"] as const

afterEach(() => {
  vi.resetModules()
  for (const k of KEYS) delete process.env[k]
})

it("qwen3-local 分流", async () => {
  process.env.STT_PROVIDER = "qwen3-local"
  process.env.TTS_PROVIDER = "qwen3-local"
  const { getSTT, getTTS } = await freshTypes()
  expect((await getSTT()).constructor.name).toBe("Qwen3LocalStt")
  expect((await getTTS()).constructor.name).toBe("Qwen3LocalTts")
})

it("openai-compatible 完整 env 分流", async () => {
  process.env.CHAT_PROVIDER = "openai-compatible"
  process.env.CHAT_BASE_URL = "https://api.example.com/v1"
  process.env.CHAT_API_KEY = "sk-x"
  process.env.CHAT_MODEL = "m1"
  const { getChat } = await freshTypes()
  expect((await getChat()).constructor.name).toBe("OpenAICompatibleChatProvider")
})

it("openai-compatible 缺 env 时 fail-fast", async () => {
  process.env.CHAT_PROVIDER = "openai-compatible"
  process.env.CHAT_API_KEY = "sk-x"
  const { getChat } = await freshTypes()
  await expect(getChat()).rejects.toThrow("CHAT_BASE_URL")
})

it("未配置 provider 抛出配置指引（mock 兜底已移除）", async () => {
  const { getSTT, getChat, getTTS } = await freshTypes()
  await expect(getSTT()).rejects.toThrow("STT_PROVIDER")
  await expect(getChat()).rejects.toThrow("CHAT_PROVIDER")
  await expect(getTTS()).rejects.toThrow("TTS_PROVIDER")
})
```

- [ ] **Step 3: 重写 lib/providers/types.ts 工厂**（删除 mock 分支与静态 mock import；动态 import 保留）

```ts
export async function getSTT(): Promise<STTProvider> {
  if ((process.env.STT_PROVIDER ?? "") !== "qwen3-local") {
    throw new Error("请在 .env 配置 STT_PROVIDER=qwen3-local（本地语音识别服务，Mock 模式已移除）")
  }
  const { Qwen3LocalStt } = await import("@/lib/providers/stt/qwen3-local")
  return new Qwen3LocalStt(process.env.STT_BASE_URL ?? "http://127.0.0.1:8100")
}

export async function getChat(): Promise<ChatProvider> {
  if ((process.env.CHAT_PROVIDER ?? "") !== "openai-compatible") {
    throw new Error("请在 .env 配置 CHAT_PROVIDER=openai-compatible 及 CHAT_BASE_URL / CHAT_API_KEY / CHAT_MODEL（Mock 模式已移除）")
  }
  const baseUrl = process.env.CHAT_BASE_URL
  const apiKey = process.env.CHAT_API_KEY
  const model = process.env.CHAT_MODEL
  if (!baseUrl || !apiKey || !model) {
    throw new Error("CHAT_PROVIDER=openai-compatible 需要 CHAT_BASE_URL / CHAT_API_KEY / CHAT_MODEL 全部配置")
  }
  const { OpenAICompatibleChatProvider } = await import("@/lib/providers/chat/openai-compatible")
  return new OpenAICompatibleChatProvider({ baseUrl, apiKey, model })
}

export async function getTTS(): Promise<TTSProvider> {
  if ((process.env.TTS_PROVIDER ?? "") !== "qwen3-local") {
    throw new Error("请在 .env 配置 TTS_PROVIDER=qwen3-local（本地语音合成服务，Mock 模式已移除）")
  }
  const { Qwen3LocalTts } = await import("@/lib/providers/tts/qwen3-local")
  return new Qwen3LocalTts(process.env.TTS_BASE_URL ?? "http://127.0.0.1:8101")
}
```

- [ ] **Step 4: 删除三个 mock 文件；迁移 providers-mock.test.ts → tests/fixtures-providers.test.ts**（import 改自 fixtures，用例不变 4 个）

- [ ] **Step 5: 验证与提交**

Run: `npx vitest run tests/providers-factory.test.ts tests/fixtures-providers.test.ts`
Expected: 4 + 4 passed（全量此时会红——report/scenario/route 测试待 Task 2/3 接线，属预期）

```powershell
git add -A
git commit -m "refactor: remove mock providers from production, fixtures moved to tests"
```

---

### Task 2: 服务层可选注入 + 受影响测试迁移

**Files:**
- Modify: `lib/services/report.ts`、`lib/services/scenario.ts`
- Modify: `tests/report-service.test.ts`、`tests/scenario-service.test.ts`、`tests/providers-chat-stream.test.ts`、`tests/chat-stream-route.test.ts`

**Interfaces:**
- Produces: `generateReport(sessionId: string, chat: ChatProvider | null = null)`；`draftScenario(description: string, chat: ChatProvider | null = null)`——生产调用点（路由）不传参行为不变；测试显式传 FakeChatProvider
- chat-stream-route 测试用 `vi.mock("@/lib/providers/chat/openai-compatible")` 把工厂产物替换为 FakeChatProvider（路由无注入点，模块级替换）

- [ ] **Step 1: 服务签名改造**

`lib/services/report.ts`：

```ts
import { ChatProvider } from "@/lib/providers/types"
export async function generateReport(sessionId: string, chat: ChatProvider | null = null): Promise<Report> {
```
（函数体内原 `await getChat()` 改用参数 `chat`；`getChat` 保留 import 供默认值。）

`lib/services/scenario.ts`：

```ts
import { ChatProvider } from "@/lib/providers/types"
export async function draftScenario(description: string, chat: ChatProvider | null = null): Promise<Scenario> {
```
（体内 `getChat()` 改用 `chat`。）

- [ ] **Step 2: 测试迁移**

1. `tests/report-service.test.ts`：顶部 `import { FakeChatProvider } from "./fixtures/fake-providers"`；两处 `generateReport(s.id)` → `generateReport(s.id, new FakeChatProvider())`；`generateReport("nope")` 处同样传 fake（先到 session 检查，行为不变）
2. `tests/scenario-service.test.ts`：`draftScenario("和外国客户谈判交期")` → `draftScenario("和外国客户谈判交期", new FakeChatProvider())`
3. `tests/providers-chat-stream.test.ts`：改用 `import { FakeChatProvider } from "./fixtures/fake-providers"`，`const c = new FakeChatProvider()`（两用例逻辑不变）
4. `tests/chat-stream-route.test.ts`：顶部追加

```ts
vi.mock("@/lib/providers/chat/openai-compatible", async () => {
  const { FakeChatProvider } = await import("./fixtures/fake-providers")
  return { OpenAICompatibleChatProvider: FakeChatProvider }
})
```

- [ ] **Step 3: 全量回归**

Run: `npm test`
Expected: **76 passed**（76 基线 − 4 旧工厂用例 + 4 新工厂用例）

- [ ] **Step 4: Commit**

```powershell
git add -A
git commit -m "refactor: services accept injectable chat provider, tests use fixtures"
```

---

### Task 3: README 重定位 + .env.example 调整

**Files:**
- Modify: `README.md`、`.env.example`

**Interfaces:**
- Produces: 真实路径为主角的 README（删除 Mock 快速开始/"全 Mock 演示"提法/mock 环境行）；`.env.example` 无 mock 行

- [ ] **Step 1: README 修订点**

1. 删除「快速开始（Mock 模式，无需 GPU/Key）」整节
2. 功能特性最后一条「智能降级」改为：`智能降级：语音服务离线 → 文字模式不阻断；STT 失败 → 键盘输入兜底`（删除"；无 GPU/Key → 全 Mock 演示"）
3. 环境要求表删除 Mock 列，改为：Node ≥ 20（必需）/ NVIDIA 8GB+（语音必需）/ OpenAI 兼容 Key（对话必需）
4. 「快速开始」章节改为：

```markdown
## 快速开始

1. 部署 ai-server 双服务（首次下载权重 ~5GB，见 docs/superpowers/plans/2026-10-01-speakloop-phase0-ai-server.md）
2. 配置 `.env`（STT/TTS/CHAT 三项 provider，见配置说明）
3. 双击 `启动SpeakLoop.vbs`，或 `npm run doctor` 自检后 `npm run start`
```

5. FAQ 的「没有 GPU 能用吗」改为：`不能。语音与对话均需真实服务：语音需本地 GPU（ai-server），对话需任一 OpenAI 兼容厂商 Key。`

- [ ] **Step 2: .env.example 替换为**

```text
STT_PROVIDER=qwen3-local
TTS_PROVIDER=qwen3-local
CHAT_PROVIDER=openai-compatible
STT_BASE_URL=http://127.0.0.1:8100
TTS_BASE_URL=http://127.0.0.1:8101
CHAT_BASE_URL=https://api.deepseek.com
CHAT_API_KEY=
CHAT_MODEL=deepseek-chat
```

- [ ] **Step 3: 验证与提交**

Run: `npm test`（76）→ `npm run typecheck` → `npm run build`

```powershell
git add README.md .env.example
git commit -m "docs: reposition readme to real-mode, drop mock quickstart"
```

---

### Task 4: spec 同步（设计方）+ 全量终验

**Files:**（设计方负责 spec；执行方跑门禁）

- spec §2 决策表 Chat/STT/TTS 行去除 mock 取值；§3 架构图 mock 分支移除；§9 删「无任何云端 Key→全 Mock」行，改「provider 未配置 → 调用即报配置指引」；§10 测试策略注明「假件位于 tests/fixtures，生产零 mock」

- [ ] **Step 1: 全量门禁**

```powershell
npm test
npm run typecheck
npm run build
npm run doctor
```

Expected: 76 passed / 0 error / build 成功 / doctor 双服务健康

- [ ] **Step 2: 手动走查**

断开 `.env`（改名）后 `npm run start` → 对话页发消息 → 应收到明确配置指引错误（非静默假回复）；恢复 `.env` 后一切正常。

- [ ] **Step 3: Commit**

```powershell
git add -A
git commit -m "chore: mock removal complete, real-mode only"
```
