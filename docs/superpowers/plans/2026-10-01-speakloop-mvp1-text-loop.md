# SpeakLoop MVP-1 实施计划（文字闭环 · Mock 语音）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付可日常使用的 SpeakLoop 文字闭环：场景（内置4+自定义）→ 键盘/Mock-STT 对话（goals 进度）→ 练后报告（zod+回填防幻觉）→ 生词四态闭环（结构化注入 ≤5 轮换）→ 仪表盘统计。无 GPU、无 API Key 全流程可跑。

**Architecture:** Next.js App Router 单应用；API Route 薄路由 → `lib/services` 业务层 → `lib/store/json-store`（写队列+原子写）；Provider 抽象默认全 Mock。Report 内嵌于 Session 持久化。

**Tech Stack:** Next.js 15 + React 19 + TypeScript(strict) + zod 3 + Vitest 2；Node ≥20；Windows/PowerShell。

## Global Constraints

- 仓库根 `E:\EnglishDemo`，PowerShell 5.1；每任务一次 commit，消息格式 `feat|fix|chore|test: <内容>`
- 目录约定：`lib/domain/types.ts` 唯一类型出处；`lib/services/*` 业务；`lib/store/json-store.ts` 唯一存储入口；`lib/providers/*` 供应商
- 存储目录 `data/`（gitignore）；测试用 `process.env.DATA_DIR` 指向临时目录，`json-store` 每次调用时读取该 env
- Provider env：`STT_PROVIDER`/`CHAT_PROVIDER`/`TTS_PROVIDER`（本计划内只有 `mock`）；`AI_SERVER_URL` 默认 `http://127.0.0.1:8100`（本计划不使用）
- 文案规则：AI 对话内容全英文；报告/解释/UI 全中文
- TTS mock 返回 150ms 静音 WAV；STT mock 返回固定文本；Chat mock 按 system 前缀分流（对话/报告/场景草稿/模式）
- 每任务完成时 `npm test` 全绿；UI 任务以 `npm run build` 通过为验证

---

### Task 1: Next.js 手动脚手架

**Files:**
- Create: `package.json`、`tsconfig.json`、`next.config.mjs`、`vitest.config.ts`、`app/layout.tsx`、`app/globals.css`、`app/page.tsx`、`.env.example`

**Interfaces:**
- Produces: 可 `npm run dev` 的空应用；`@/*` 路径别名；`npm test` 可运行

- [ ] **Step 1: package.json**

```json
{
  "name": "speakloop",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "doctor": "node scripts/doctor.mjs"
  },
  "dependencies": {
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.8"
  },
  "engines": { "node": ">=20" }
}
```

- [ ] **Step 2: tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "ai-server"]
}
```

- [ ] **Step 3: next.config.mjs / vitest.config.ts**

```js
export default {}
```

```ts
import path from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: { environment: "node" },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
})
```

- [ ] **Step 4: app 三件套 + .env.example**

`app/layout.tsx`：

```tsx
import type { Metadata } from "next"
import Link from "next/link"
import "./globals.css"

export const metadata: Metadata = { title: "SpeakLoop" }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body>
        <nav className="nav">
          <Link href="/">SpeakLoop</Link>
          <Link href="/scenarios">场景</Link>
          <Link href="/vocab">生词本</Link>
        </nav>
        <main className="container">{children}</main>
      </body>
    </html>
  )
}
```

`app/globals.css`：

```css
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, "Segoe UI", sans-serif; background: #f6f7f9; color: #1a1a1a; }
.nav { display: flex; gap: 16px; padding: 12px 24px; background: #111827; }
.nav a { color: #f9fafb; text-decoration: none; font-weight: 600; }
.container { max-width: 880px; margin: 0 auto; padding: 24px; }
.card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin-bottom: 12px; }
.btn { display: inline-block; border: 0; border-radius: 8px; padding: 8px 16px; background: #2563eb; color: #fff; cursor: pointer; font-size: 15px; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-secondary { background: #6b7280; }
.btn-danger { background: #dc2626; }
.input, textarea, select { width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 15px; }
.bubble { max-width: 78%; padding: 10px 14px; border-radius: 12px; margin: 6px 0; white-space: pre-wrap; }
.bubble-user { background: #2563eb; color: #fff; margin-left: auto; }
.bubble-ai { background: #fff; border: 1px solid #e5e7eb; }
.bubble-coach { background: #fef9c3; border: 1px solid #fde047; font-size: 14px; }
.row { display: flex; gap: 8px; align-items: center; }
.muted { color: #6b7280; font-size: 13px; }
.chip { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; background: #e5e7eb; }
.stat { font-size: 28px; font-weight: 700; }
```

`app/page.tsx`（占位，Task 12 替换）：

```tsx
export default function Home() {
  return <p>SpeakLoop</p>
}
```

`.env.example`：

```text
STT_PROVIDER=mock
CHAT_PROVIDER=mock
TTS_PROVIDER=mock
AI_SERVER_URL=http://127.0.0.1:8100
```

- [ ] **Step 5: 安装并验证**

```powershell
npm install
npm run build
```

Expected: build 成功退出。

- [ ] **Step 6: Commit**

```powershell
git add package.json package-lock.json tsconfig.json next.config.mjs vitest.config.ts app .env.example
git commit -m "chore: nextjs scaffold with vitest and zod"
```

---

### Task 2: json-store（写队列 + 原子写）

**Files:**
- Create: `lib/store/json-store.ts`
- Test: `tests/json-store.test.ts`

**Interfaces:**
- Produces: `type Collection = "scenarios" | "sessions" | "vocab"`；`read<T>(c: Collection): Promise<T[]>`；`update<T>(c: Collection, fn: (data: T[]) => T[]): Promise<T[]>`（串行队列 + 临时文件 rename 原子写）

- [ ] **Step 1: 写失败测试**

`tests/json-store.test.ts`：

```ts
import { mkdtempSync, readFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { beforeEach, expect, it } from "vitest"
import { read, update } from "@/lib/store/json-store"

beforeEach(() => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "sl-test-"))
})

it("read 空集合返回 []", async () => {
  expect(await read("vocab")).toEqual([])
})

it("update 持久化且为合法 JSON", async () => {
  await update("vocab", d => [...d, { id: "a" }])
  const raw = readFileSync(path.join(process.env.DATA_DIR!, "vocab.json"), "utf-8")
  expect(JSON.parse(raw)).toEqual([{ id: "a" }])
  expect(await read("vocab")).toEqual([{ id: "a" }])
})

it("并发 update 串行执行，无丢失", async () => {
  await update<{ id: string; v: number }>("vocab", d => [...d, { id: "a", v: 0 }])
  await Promise.all(
    Array.from({ length: 10 }, () =>
      update<{ id: string; v: number }>("vocab", d => d.map(x => ({ ...x, v: x.v + 1 }))))
  )
  expect((await read<{ id: string; v: number }>("vocab"))[0].v).toBe(10)
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/json-store.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 lib/store/json-store.ts**

```ts
import { promises as fs } from "node:fs"
import path from "node:path"

export type Collection = "scenarios" | "sessions" | "vocab"

function dataDir() {
  return process.env.DATA_DIR ?? path.join(process.cwd(), "data")
}

function fileOf(c: Collection) {
  return path.join(dataDir(), `${c}.json`)
}

export async function read<T>(c: Collection): Promise<T[]> {
  await fs.mkdir(dataDir(), { recursive: true })
  try {
    return JSON.parse(await fs.readFile(fileOf(c), "utf-8")) as T[]
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return []
    throw e
  }
}

const queues = new Map<Collection, Promise<unknown>>()

export async function update<T>(c: Collection, fn: (data: T[]) => T[]): Promise<T[]> {
  const prev = queues.get(c) ?? Promise.resolve()
  const job = prev.then(async () => {
    const data = await read<T>(c)
    const next = fn(data)
    const tmp = `${fileOf(c)}.${process.pid}.tmp`
    await fs.mkdir(dataDir(), { recursive: true })
    await fs.writeFile(tmp, JSON.stringify(next, null, 2), "utf-8")
    await fs.rename(tmp, fileOf(c))
    return next
  })
  queues.set(c, job.catch(() => undefined))
  return job
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/json-store.test.ts`
Expected: 3 passed

- [ ] **Step 5: Commit**

```powershell
git add lib/store/json-store.ts tests/json-store.test.ts
git commit -m "feat: json store with write queue and atomic rename"
```

---

### Task 3: domain 类型 + goal-marker 解析

**Files:**
- Create: `lib/domain/types.ts`、`lib/goal-marker.ts`
- Test: `tests/goal-marker.test.ts`

**Interfaces:**
- Produces: `Scenario`/`Turn`/`Session`/`Report`/`ReportCorrection`/`VocabWord`/`VocabStatus`（见代码）；`parseGoalMarker(text: string): { clean: string; goals: number[] }`

- [ ] **Step 1: lib/domain/types.ts**

```ts
export interface Scenario {
  id: string
  title: string
  persona: string
  goals: string[]
  difficulty: "easy" | "medium" | "hard"
  builtin: boolean
  voice?: string
}

export interface Turn {
  id: string
  userText: string
  aiText: string
  audioUrl?: string
  duration?: number
  sttProvider: string
  confidence?: number
  createdAt: string
}

export interface ReportCorrection {
  turnId: string
  original: string
  type: "grammar" | "vocab" | "idiom"
  improved: string
  explanation: string
}

export interface Report {
  sessionId: string
  summary: string
  highlights: string[]
  corrections: ReportCorrection[]
  vocabCandidates: { word: string; translation: string; example: string }[]
}

export interface Session {
  id: string
  scenarioId: string
  startedAt: string
  endedAt?: string
  turns: Turn[]
  goalProgress?: number[]
  report?: Report
}

export type VocabStatus = "new" | "learning" | "mastered" | "ignored"

export interface VocabWord {
  id: string
  word: string
  translation: string
  example: string
  sourceSessionId: string
  status: VocabStatus
  timesEncountered: number
  lastUsedAt?: string
  createdAt: string
}
```

- [ ] **Step 2: 写失败测试 tests/goal-marker.test.ts**

```ts
import { expect, it } from "vitest"
import { parseGoalMarker } from "@/lib/goal-marker"

it("解析并剥离单个标记", () => {
  const r = parseGoalMarker("Great point. [GOAL_DONE:0]")
  expect(r).toEqual({ clean: "Great point.", goals: [0] })
})

it("解析多个标记", () => {
  const r = parseGoalMarker("A [GOAL_DONE:0] and [GOAL_DONE:2] done")
  expect(r.goals).toEqual([0, 2])
  expect(r.clean).toBe("A and done")
})

it("无标记时原样返回", () => {
  expect(parseGoalMarker("Nothing here.")).toEqual({ clean: "Nothing here.", goals: [] })
})

it("格式错误的标记静默保留原文", () => {
  const r = parseGoalMarker("Odd [GOAL_DONE:x] marker")
  expect(r.goals).toEqual([])
  expect(r.clean).toBe("Odd [GOAL_DONE:x] marker")
})
```

- [ ] **Step 3: 运行确认失败**

Run: `npx vitest run tests/goal-marker.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 4: 实现 lib/goal-marker.ts**

```ts
export function parseGoalMarker(text: string): { clean: string; goals: number[] } {
  const goals: number[] = []
  const clean = text
    .replace(/\[GOAL_DONE:(\d+)\]/g, (_, n: string) => {
      goals.push(Number(n))
      return ""
    })
    .trim()
  return { clean, goals }
}
```

- [ ] **Step 5: 运行确认通过**

Run: `npx vitest run tests/goal-marker.test.ts`
Expected: 4 passed

- [ ] **Step 6: Commit**

```powershell
git add lib/domain/types.ts lib/goal-marker.ts tests/goal-marker.test.ts
git commit -m "feat: domain types and goal marker parser"
```

---

### Task 4: vocab-service（状态机 + 注入选择 + 词形匹配）

**Files:**
- Create: `lib/services/vocab.ts`
- Test: `tests/vocab-service.test.ts`

**Interfaces:**
- Consumes: json-store 的 `read`/`update`，Task 3 的 `VocabWord`/`VocabStatus`
- Produces: `listWords(): Promise<VocabWord[]>`；`addWord(input: { word: string; translation: string; example: string; sourceSessionId: string; status?: VocabStatus }): Promise<VocabWord>`（按 word 小写去重，已存在直接返回既有）；`setStatus(id: string, status: VocabStatus): Promise<void>`；`deleteWord(id: string): Promise<void>`；`selectForInjection(words: VocabWord[], limit?: number): VocabWord[]`（status ∈ {new,learning}，timesEncountered 升序，≤limit）；`containsWord(text: string, word: string): boolean`（词干归一化，支持短语）；`markUsedInSession(active: VocabWord[], transcript: string): Promise<void>`（命中则 timesEncountered+1、lastUsedAt、new→learning）

- [ ] **Step 1: 写失败测试 tests/vocab-service.test.ts**

```ts
import { mkdtempSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { beforeEach, expect, it } from "vitest"
import { VocabWord } from "@/lib/domain/types"
import { addWord, containsWord, listWords, markUsedInSession, selectForInjection } from "@/lib/services/vocab"

beforeEach(() => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "sl-test-"))
})

const w = (over: Partial<VocabWord>): VocabWord => ({
  id: over.id ?? "w1", word: "negotiate", translation: "谈判", example: "ex",
  sourceSessionId: "s1", status: "learning", timesEncountered: 0,
  createdAt: "2026-10-01T00:00:00Z", ...over,
})

it("selectForInjection 过滤 mastered/ignored 并按次数升序取前5", () => {
  const words = [
    w({ id: "a", word: "alpha", timesEncountered: 3 }),
    w({ id: "b", word: "beta", timesEncountered: 1 }),
    w({ id: "c", word: "gamma", status: "mastered" }),
    w({ id: "d", word: "delta", status: "ignored" }),
    ...["e", "f", "g", "h", "i", "j"].map((x, i) => w({ id: x, word: x, timesEncountered: 10 + i })),
  ]
  const picked = selectForInjection(words)
  expect(picked.map(p => p.id)).toEqual(["b", "a", "e", "f", "g"])
})

it("containsWord 命中词形变化", () => {
  expect(containsWord("We negotiated the deadline yesterday.", "negotiate")).toBe(true)
  expect(containsWord("He negotiates hard.", "negotiate")).toBe(true)
  expect(containsWord("The negotiation is tough.", "negotiation")).toBe(true)
  expect(containsWord("totally unrelated text", "negotiate")).toBe(false)
})

it("containsWord 支持短语（子串）", () => {
  expect(containsWord("Let's touch base tomorrow.", "touch base")).toBe(true)
})

it("addWord 去重（大小写不敏感）", async () => {
  await addWord({ word: "Blocker", translation: "阻碍", example: "e", sourceSessionId: "s1" })
  const again = await addWord({ word: "blocker", translation: "x", example: "y", sourceSessionId: "s2" })
  const all = await listWords()
  expect(all).toHaveLength(1)
  expect(again.translation).toBe("阻碍")
})

it("markUsedInSession 更新计数与状态", async () => {
  await addWord({ word: "blocker", translation: "阻碍", example: "e", sourceSessionId: "s1" })
  const active = (await listWords()).filter(x => x.status !== "ignored" && x.status !== "mastered")
  await markUsedInSession(active, "We hit a blocker in the API integration.")
  const [after] = await listWords()
  expect(after.timesEncountered).toBe(1)
  expect(after.status).toBe("learning")
  expect(after.lastUsedAt).toBeTruthy()
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/vocab-service.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 lib/services/vocab.ts**

```ts
import { randomUUID } from "node:crypto"
import { VocabStatus, VocabWord } from "@/lib/domain/types"
import { read, update } from "@/lib/store/json-store"

export async function listWords(): Promise<VocabWord[]> {
  return read<VocabWord>("vocab")
}

export async function addWord(input: {
  word: string
  translation: string
  example: string
  sourceSessionId: string
  status?: VocabStatus
}): Promise<VocabWord> {
  const key = input.word.trim().toLowerCase()
  const existing = (await listWords()).find(x => x.word.toLowerCase() === key)
  if (existing) return existing
  const word: VocabWord = {
    id: randomUUID(),
    word: input.word.trim(),
    translation: input.translation,
    example: input.example,
    sourceSessionId: input.sourceSessionId,
    status: input.status ?? "new",
    timesEncountered: 0,
    createdAt: new Date().toISOString(),
  }
  await update<VocabWord>("vocab", d => [...d, word])
  return word
}

export async function setStatus(id: string, status: VocabStatus): Promise<void> {
  await update<VocabWord>("vocab", d => d.map(x => (x.id === id ? { ...x, status } : x)))
}

export async function deleteWord(id: string): Promise<void> {
  await update<VocabWord>("vocab", d => d.filter(x => x.id !== id))
}

export function selectForInjection(words: VocabWord[], limit = 5): VocabWord[] {
  return words
    .filter(x => x.status === "new" || x.status === "learning")
    .sort((a, b) => a.timesEncountered - b.timesEncountered)
    .slice(0, limit)
}

function stem(word: string): string {
  const w = word.toLowerCase().replace(/[^a-z]/g, "")
  for (const suf of ["ing", "ed", "es", "s"]) {
    if (w.endsWith(suf) && w.length - suf.length >= 3) return w.slice(0, -suf.length)
  }
  return w
}

function stemTokens(text: string): string[] {
  return text.split(/[^A-Za-z]+/).filter(Boolean).map(stem)
}

export function containsWord(text: string, word: string): boolean {
  const target = word.trim().toLowerCase()
  if (target.includes(" ")) {
    return text.toLowerCase().includes(target.replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim())
  }
  const t = stem(target)
  return stemTokens(text).some(tok => tok === t)
}

export async function markUsedInSession(active: VocabWord[], transcript: string): Promise<void> {
  const now = new Date().toISOString()
  await update<VocabWord>("vocab", words =>
    words.map(x => {
      if (!active.some(a => a.id === x.id) || !containsWord(transcript, x.word)) return x
      return {
        ...x,
        timesEncountered: x.timesEncountered + 1,
        lastUsedAt: now,
        status: x.status === "new" ? ("learning" as VocabStatus) : x.status,
      }
    })
  )
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/vocab-service.test.ts`
Expected: 5 passed

- [ ] **Step 5: Commit**

```powershell
git add lib/services/vocab.ts tests/vocab-service.test.ts
git commit -m "feat: vocab service with status machine and stem matching"
```

---

### Task 5: prompts.ts（结构化注入 + 模式指令）

**Files:**
- Create: `lib/prompts.ts`
- Test: `tests/prompts.test.ts`

**Interfaces:**
- Consumes: Task 3 的 `Scenario`/`VocabWord`
- Produces: `buildSystemPrompt(scenario: Scenario, vocab: VocabWord[]): string`；`modeInstruction(mode?: "simplify" | "hint"): string`

- [ ] **Step 1: 写失败测试 tests/prompts.test.ts**

```ts
import { expect, it } from "vitest"
import { Scenario, VocabWord } from "@/lib/domain/types"
import { buildSystemPrompt, modeInstruction } from "@/lib/prompts"

const scenario: Scenario = {
  id: "s1", title: "面试", persona: "You are Sarah, a hiring manager.",
  goals: ["Introduce yourself", "Describe a project"], difficulty: "medium", builtin: true,
}
const word: VocabWord = {
  id: "v1", word: "stakeholder", translation: "利益相关方",
  example: "Let's align with stakeholders first.", sourceSessionId: "x",
  status: "learning", timesEncountered: 0, createdAt: "2026-10-01T00:00:00Z",
}

it("包含 persona、goals、3 句上限与 GOAL_DONE 指令", () => {
  const p = buildSystemPrompt(scenario, [])
  expect(p).toContain("Sarah")
  expect(p).toContain("Introduce yourself")
  expect(p).toContain("at most 3 sentences")
  expect(p).toContain("[GOAL_DONE:n]")
})

it("生词为空时不出现词汇段", () => {
  expect(buildSystemPrompt(scenario, [])).not.toContain("Target vocabulary")
})

it("结构化注入包含词、例句与教练规则", () => {
  const p = buildSystemPrompt(scenario, [word])
  expect(p).toContain("Target vocabulary")
  expect(p).toContain("stakeholder")
  expect(p).toContain("align with stakeholders")
  expect(p).toContain("positive reinforcement")
})

it("modeInstruction 分流", () => {
  expect(modeInstruction()).toBe("")
  expect(modeInstruction("simplify")).toContain("simpler English")
  expect(modeInstruction("hint")).toContain("sentence pattern")
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/prompts.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 lib/prompts.ts**

```ts
import { Scenario, VocabWord } from "@/lib/domain/types"

export function buildSystemPrompt(scenario: Scenario, vocab: VocabWord[]): string {
  const lines: string[] = []
  lines.push(
    `You are an English speaking coach. Role-play this persona: ${scenario.persona}`,
    `Practice goals: ${scenario.goals.map((g, i) => `${i}. ${g}`).join(" | ")}`,
    "Rules: Always reply in English. Keep each reply to at most 3 sentences (short turns fit speaking practice). Stay in character."
  )
  if (vocab.length > 0) {
    lines.push("Target vocabulary for this session:")
    for (const w of vocab) {
      lines.push(`- ${w.word}: goal=let the user hear it and get a chance to use it; usage=${w.example}`)
    }
    lines.push(
      "Vocabulary coach rules: use target words naturally, never force them; create chances for the learner to use them (at most 1-2 prompts per turn); give clear positive reinforcement when the learner uses a target word correctly."
    )
  }
  lines.push(
    "When a practice goal is achieved in the conversation, append the marker [GOAL_DONE:n] (n = goal index, starting from 0) at the very end of your reply. Use each index at most once."
  )
  return lines.join("\n")
}

export function modeInstruction(mode?: "simplify" | "hint"): string {
  if (mode === "simplify") {
    return "\n[MODE] The learner did not understand your last reply. Rephrase it in simpler English. Do not advance the conversation goals and do not emit [GOAL_DONE:n]."
  }
  if (mode === "hint") {
    return "\n[MODE] Give ONE useful sentence pattern the learner could say next: a short Chinese note plus the English pattern. Do not advance the conversation goals and do not emit [GOAL_DONE:n]."
  }
  return ""
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/prompts.test.ts`
Expected: 4 passed

- [ ] **Step 5: Commit**

```powershell
git add lib/prompts.ts tests/prompts.test.ts
git commit -m "feat: system prompt builder with structured vocab injection"
```

---

### Task 6: report-schema（zod + 容错解析）

**Files:**
- Create: `lib/report-schema.ts`
- Test: `tests/report-schema.test.ts`

**Interfaces:**
- Produces: `reportSchema`（zod object）；`type RawReport`；`tolerantParse(text: string): RawReport | null`（剥 markdown 围栏、截取首尾大括号、zod 兜底默认值）

- [ ] **Step 1: 写失败测试 tests/report-schema.test.ts**

```ts
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
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/report-schema.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 lib/report-schema.ts**

```ts
import { z } from "zod"

export const reportSchema = z.object({
  summary: z.string().default(""),
  highlights: z.array(z.string()).default([]),
  corrections: z
    .array(
      z.object({
        turnId: z.string().default(""),
        original: z.string(),
        type: z.enum(["grammar", "vocab", "idiom"]).default("vocab"),
        improved: z.string().default(""),
        explanation: z.string().default(""),
      })
    )
    .default([]),
  vocabCandidates: z
    .array(z.object({ word: z.string(), translation: z.string().default(""), example: z.string().default("") }))
    .default([]),
})

export type RawReport = z.infer<typeof reportSchema>

export function tolerantParse(text: string): RawReport | null {
  let t = text.trim()
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) t = fenced[1].trim()
  const start = t.indexOf("{")
  const end = t.lastIndexOf("}")
  if (start === -1 || end <= start) return null
  try {
    return reportSchema.parse(JSON.parse(t.slice(start, end + 1)))
  } catch {
    return null
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/report-schema.test.ts`
Expected: 5 passed

- [ ] **Step 5: Commit**

```powershell
git add lib/report-schema.ts tests/report-schema.test.ts
git commit -m "feat: report zod schema with tolerant parsing"
```

---

### Task 7: Provider 层（接口 + Mock 实现）

**Files:**
- Create: `lib/providers/types.ts`、`lib/providers/stt/mock.ts`、`lib/providers/chat/mock.ts`、`lib/providers/tts/mock.ts`
- Test: `tests/providers-mock.test.ts`

**Interfaces:**
- Produces: `interface STTResult { text: string; confidence?: number; segments?: unknown[] }`；`interface STTProvider { transcribe(audio: Blob, options?: { language?: string }): Promise<STTResult> }`；`interface ChatProvider { chat(system: string, messages: { role: "user" | "assistant"; content: string }[]): Promise<string> }`；`interface TTSProvider { synthesize(text: string, options?: { speaker?: string }): Promise<ArrayBuffer> }`；工厂 `getSTT()`/`getChat()`/`getTTS()`（env `*_PROVIDER`，默认/未知值 → mock）
- Mock 行为契约：STT 固定文本；Chat 按 system 分流（含 "report analyzer" → 报告 JSON（从 user 内容提取首个 `[turnId] 句子`）；含 "simpler English" → 简化回复；含 "sentence pattern" → 句式提示；否则对话模板，第 2 次用户输入起带 `[GOAL_DONE:0]`，第 4 次起带 `[GOAL_DONE:1]`）；TTS 返回 150ms 静音 WAV

- [ ] **Step 1: 写失败测试 tests/providers-mock.test.ts**

```ts
import { expect, it } from "vitest"
import { getChat, getSTT, getTTS } from "@/lib/providers/types"

it("mock STT 返回固定文本", async () => {
  const r = await getSTT().transcribe(new Blob(["x"]))
  expect(r.text).toContain("mock")
})

it("mock Chat 对话流带 GOAL_DONE 标记", async () => {
  const c = getChat()
  const sys = "You are an English speaking coach."
  const m1 = await c.chat(sys, [{ role: "user", content: "hi" }])
  expect(m1).not.toContain("[GOAL_DONE")
  const m2 = await c.chat(sys, [
    { role: "user", content: "hi" }, { role: "assistant", content: m1 },
    { role: "user", content: "second" },
  ])
  expect(m2).toContain("[GOAL_DONE:0]")
})

it("mock Chat 报告流返回合法 JSON 且引用 turnId", async () => {
  const out = await getChat().chat("You are a spoken-English report analyzer.", [
    { role: "user", content: "[abc-123] I go yesterday" },
  ])
  const parsed = JSON.parse(out)
  expect(parsed.corrections[0].turnId).toBe("abc-123")
  expect(parsed.corrections[0].original).toBe("I go yesterday")
  expect(Array.isArray(parsed.highlights)).toBe(true)
})

it("mock TTS 返回 WAV 头", async () => {
  const buf = await getTTS().synthesize("hello")
  const v = new DataView(buf)
  expect(String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3))).toBe("RIFF")
  expect(buf.byteLength).toBeGreaterThan(44)
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/providers-mock.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 lib/providers/types.ts**

```ts
export interface STTResult {
  text: string
  confidence?: number
  segments?: unknown[]
}

export interface STTProvider {
  transcribe(audio: Blob, options?: { language?: string }): Promise<STTResult>
}

export interface ChatProvider {
  chat(
    system: string,
    messages: { role: "user" | "assistant"; content: string }[]
  ): Promise<string>
}

export interface TTSProvider {
  synthesize(text: string, options?: { speaker?: string }): Promise<ArrayBuffer>
}

export function getSTT(): STTProvider {
  return new MockSttProvider()
}

export function getChat(): ChatProvider {
  return new MockChatProvider()
}

export function getTTS(): TTSProvider {
  return new MockTtsProvider()
}
```

（注：文件顶部需 `import { MockSttProvider } from "@/lib/providers/stt/mock"` 等三个静态导入。MVP-2 在此按 `process.env.*_PROVIDER === "qwen3-local"` 分支用 `await import()` 动态加载真实实现并将工厂改为 async；本计划内只有 mock，保持同步。）

- [ ] **Step 4: 实现 mock 三件套**

`lib/providers/stt/mock.ts`：

```ts
import { STTProvider, STTResult } from "@/lib/providers/types"

export class MockSttProvider implements STTProvider {
  async transcribe(_audio: Blob): Promise<STTResult> {
    return { text: "This is a mock transcription for local development." }
  }
}
```

`lib/providers/chat/mock.ts`：

```ts
import { ChatProvider } from "@/lib/providers/types"

export class MockChatProvider implements ChatProvider {
  async chat(system: string, messages: { role: "user" | "assistant"; content: string }[]): Promise<string> {
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
}
```

`lib/providers/tts/mock.ts`：

```ts
import { TTSProvider } from "@/lib/providers/types"

function silentWav(ms = 150, sampleRate = 8000): ArrayBuffer {
  const n = Math.floor((sampleRate * ms) / 1000)
  const buf = new ArrayBuffer(44 + n * 2)
  const v = new DataView(buf)
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt ")
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true)
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true)
  return buf
}

export class MockTtsProvider implements TTSProvider {
  async synthesize(_text: string): Promise<ArrayBuffer> {
    return silentWav()
  }
}
```

- [ ] **Step 5: 运行确认通过**

Run: `npx vitest run tests/providers-mock.test.ts`
Expected: 4 passed

- [ ] **Step 6: Commit**

```powershell
git add lib/providers tests/providers-mock.test.ts
git commit -m "feat: provider interfaces with mock implementations"
```

---

### Task 8: scenario-service（内置种子 + 自定义草稿）

**Files:**
- Create: `lib/services/scenario.ts`
- Test: `tests/scenario-service.test.ts`

**Interfaces:**
- Consumes: json-store、Task 3 `Scenario`、Task 7 `getChat`
- Produces: `listScenarios(): Promise<Scenario[]>`（首次自动种子 4 个内置）；`getScenario(id: string): Promise<Scenario | undefined>`；`createScenario(input: { title: string; persona: string; goals: string[]; difficulty: Scenario["difficulty"] }): Promise<Scenario>`；`draftScenario(description: string): Promise<Scenario>`（经 ChatProvider 生成草稿，不落库；mock 返回含 description 的模板草稿，id 为空串表示未保存）

- [ ] **Step 1: 写失败测试 tests/scenario-service.test.ts**

```ts
import { mkdtempSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { beforeEach, expect, it } from "vitest"
import { createScenario, draftScenario, getScenario, listScenarios } from "@/lib/services/scenario"

beforeEach(() => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "sl-test-"))
})

it("listScenarios 首次调用种子 4 个内置场景，幂等", async () => {
  const first = await listScenarios()
  expect(first).toHaveLength(4)
  expect(first.every(s => s.builtin)).toBe(true)
  expect(await listScenarios()).toHaveLength(4)
})

it("内置场景含英文 persona 与 goals", async () => {
  const list = await listScenarios()
  const itv = list.find(s => s.title.includes("面试"))!
  expect(itv.persona).toMatch(/[a-zA-Z]/)
  expect(itv.goals.length).toBeGreaterThanOrEqual(3)
})

it("createScenario 保存并可查询", async () => {
  const s = await createScenario({ title: "谈判", persona: "You are Chris.", goals: ["a", "b"], difficulty: "hard" })
  expect((await getScenario(s.id))?.title).toBe("谈判")
})

it("draftScenario 返回未落库草稿（id 为空）", async () => {
  const d = await draftScenario("和外国客户谈判交期")
  expect(d.id).toBe("")
  expect(d.title).toContain("谈判")
  expect((await listScenarios()).length).toBe(4)
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/scenario-service.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 lib/services/scenario.ts**

```ts
import { randomUUID } from "node:crypto"
import { Scenario } from "@/lib/domain/types"
import { getChat } from "@/lib/providers/types"
import { read, update } from "@/lib/store/json-store"

const SEED_SCENARIOS: Scenario[] = [
  {
    id: "builtin-interview",
    title: "英文面试",
    persona: "You are Sarah, a friendly hiring manager at a tech company, interviewing the learner for a senior engineer position.",
    goals: ["Introduce yourself and your experience", "Describe a challenging project you worked on", "Ask a question about the role"],
    difficulty: "medium",
    builtin: true,
    voice: "Serena",
  },
  {
    id: "builtin-standup",
    title: "周会汇报",
    persona: "You are the team lead running the weekly sync. The learner reports their progress, blockers and plans.",
    goals: ["Report last week's progress", "Describe a blocker and ask for help", "Agree on next steps"],
    difficulty: "easy",
    builtin: true,
  },
  {
    id: "builtin-oneonone",
    title: "向上沟通（1:1）",
    persona: "You are Alex, the learner's manager, having a relaxed one-on-one conversation.",
    goals: ["Share a concern about workload", "Propose an idea for improvement", "Negotiate a deadline"],
    difficulty: "medium",
    builtin: true,
    voice: "Ryan",
  },
  {
    id: "builtin-smalltalk",
    title: "同事寒暄",
    persona: "You are Jamie, a friendly colleague from another team, chatting with the learner at the office coffee corner.",
    goals: ["Greet and make small talk about the weekend", "Talk casually about current projects", "End the conversation politely"],
    difficulty: "easy",
    builtin: true,
  },
]

export async function listScenarios(): Promise<Scenario[]> {
  const existing = await read<Scenario>("scenarios")
  if (existing.length > 0) return existing
  await update<Scenario>("scenarios", () => SEED_SCENARIOS)
  return SEED_SCENARIOS
}

export async function getScenario(id: string): Promise<Scenario | undefined> {
  return (await listScenarios()).find(s => s.id === id)
}

export async function createScenario(input: {
  title: string
  persona: string
  goals: string[]
  difficulty: Scenario["difficulty"]
}): Promise<Scenario> {
  const scenario: Scenario = { id: randomUUID(), ...input, builtin: false }
  await update<Scenario>("scenarios", d => [...d, scenario])
  return scenario
}

export async function draftScenario(description: string): Promise<Scenario> {
  const system =
    "You are a scenario designer for workplace English practice. Output ONLY a JSON object: " +
    '{"title":string(中文),"persona":string(English role-play setting),"goals":string[](3 English goals),"difficulty":"easy"|"medium"|"hard"}'
  const raw = await getChat().chat(system, [{ role: "user", content: description }])
  let draft: Scenario
  try {
    const j = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""))
    draft = {
      id: "",
      title: String(j.title ?? description),
      persona: String(j.persona ?? "You are a friendly colleague."),
      goals: Array.isArray(j.goals) && j.goals.length ? j.goals.map(String) : ["Keep the conversation going"],
      difficulty: j.difficulty === "easy" || j.difficulty === "hard" ? j.difficulty : "medium",
      builtin: false,
    }
  } catch {
    draft = {
      id: "",
      title: `自定义：${description.slice(0, 12)}`,
      persona: `Role-play a workplace scenario: ${description}`,
      goals: ["Open the conversation", "Discuss the main topic", "Wrap up politely"],
      difficulty: "medium",
      builtin: false,
    }
  }
  return draft
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/scenario-service.test.ts`
Expected: 4 passed

- [ ] **Step 5: Commit**

```powershell
git add lib/services/scenario.ts tests/scenario-service.test.ts
git commit -m "feat: scenario service with builtin seeds and ai drafting"
```

---

### Task 9: practice-service（会话/轮次/音频）

**Files:**
- Create: `lib/services/practice.ts`
- Test: `tests/practice-service.test.ts`

**Interfaces:**
- Consumes: json-store、Task 3 `Session`/`Turn`/`Report`
- Produces: `newId(): string`；`createSession(scenarioId: string): Promise<Session>`；`getSession(id): Promise<Session | undefined>`；`listSessions(): Promise<Session[]>`（startedAt 降序）；`appendTurn(sessionId: string, turn: Turn, goalsDone?: number[]): Promise<Session>`（按 id 去重合并、goalProgress 并集）；`endSession(id): Promise<void>`；`saveReport(sessionId: string, report: Report): Promise<void>`；`saveAudio(sessionId: string, turnId: string, buf: Buffer): Promise<string>`（写 `data/audio/{sessionId}/{turnId}.webm`，返回 `/api/audio/{sessionId}/{turnId}.webm`）

- [ ] **Step 1: 写失败测试 tests/practice-service.test.ts**

```ts
import { existsSync, mkdtempSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { beforeEach, expect, it } from "vitest"
import { Turn } from "@/lib/domain/types"
import { appendTurn, createSession, getSession, listSessions, saveAudio, saveReport } from "@/lib/services/practice"

beforeEach(() => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "sl-test-"))
})

const turn = (id: string, n: number): Turn => ({
  id, userText: `u${n}`, aiText: `a${n}`, sttProvider: "keyboard",
  createdAt: new Date(Date.now() + n).toISOString(),
})

it("createSession + appendTurn + goalProgress 并集", async () => {
  const s = await createSession("sc1")
  await appendTurn(s.id, turn("t1", 1), [0])
  await appendTurn(s.id, turn("t2", 2), [0, 1])
  const after = (await getSession(s.id))!
  expect(after.turns.map(t => t.id)).toEqual(["t1", "t2"])
  expect(after.goalProgress).toEqual([0, 1])
})

it("appendTurn 同 id 去重（重试幂等）", async () => {
  const s = await createSession("sc1")
  await appendTurn(s.id, turn("t1", 1))
  await appendTurn(s.id, { ...turn("t1", 1), aiText: "fixed" })
  expect((await getSession(s.id))!.turns).toHaveLength(1)
  expect((await getSession(s.id))!.turns[0].aiText).toBe("fixed")
})

it("listSessions 按开始时间降序", async () => {
  const a = await createSession("sc1")
  await new Promise(r => setTimeout(r, 5))
  const b = await createSession("sc1")
  expect((await listSessions()).map(s => s.id)).toEqual([b.id, a.id])
})

it("saveAudio 写文件并返回 URL", async () => {
  const s = await createSession("sc1")
  const url = await saveAudio(s.id, "t1", Buffer.from("fake"))
  expect(url).toBe(`/api/audio/${s.id}/t1.webm`)
  expect(existsSync(path.join(process.env.DATA_DIR!, "audio", s.id, "t1.webm"))).toBe(true)
})

it("saveReport 内嵌到 session", async () => {
  const s = await createSession("sc1")
  await saveReport(s.id, { sessionId: s.id, summary: "s", highlights: [], corrections: [], vocabCandidates: [] })
  expect((await getSession(s.id))!.report?.summary).toBe("s")
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/practice-service.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 lib/services/practice.ts**

```ts
import { randomUUID } from "node:crypto"
import { promises as fs } from "node:fs"
import path from "node:path"
import { Report, Session, Turn } from "@/lib/domain/types"
import { read, update } from "@/lib/store/json-store"

export function newId(): string {
  return randomUUID()
}

export async function createSession(scenarioId: string): Promise<Session> {
  const session: Session = {
    id: newId(),
    scenarioId,
    startedAt: new Date().toISOString(),
    turns: [],
  }
  await update<Session>("sessions", d => [...d, session])
  return session
}

export async function getSession(id: string): Promise<Session | undefined> {
  return (await read<Session>("sessions")).find(s => s.id === id)
}

export async function listSessions(): Promise<Session[]> {
  return (await read<Session>("sessions")).sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

export async function appendTurn(sessionId: string, turn: Turn, goalsDone: number[] = []): Promise<Session> {
  const result = await update<Session>("sessions", list =>
    list.map(s => {
      if (s.id !== sessionId) return s
      const turns = [...s.turns.filter(t => t.id !== turn.id), turn].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt)
      )
      const goalProgress = Array.from(new Set([...(s.goalProgress ?? []), ...goalsDone]))
      return { ...s, turns, goalProgress }
    })
  )
  const session = result.find(s => s.id === sessionId)
  if (!session) throw new Error("session not found")
  return session
}

export async function endSession(id: string): Promise<void> {
  await update<Session>("sessions", list =>
    list.map(s => (s.id === id ? { ...s, endedAt: new Date().toISOString() } : s))
  )
}

export async function saveReport(sessionId: string, report: Report): Promise<void> {
  await update<Session>("sessions", list =>
    list.map(s => (s.id === sessionId ? { ...s, report } : s))
  )
}

export async function saveAudio(sessionId: string, turnId: string, buf: Buffer): Promise<string> {
  const dir = path.join(process.env.DATA_DIR ?? path.join(process.cwd(), "data"), "audio", sessionId)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, `${turnId}.webm`), buf)
  return `/api/audio/${sessionId}/${turnId}.webm`
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/practice-service.test.ts`
Expected: 5 passed

- [ ] **Step 5: Commit**

```powershell
git add lib/services/practice.ts tests/practice-service.test.ts
git commit -m "feat: practice service with sessions turns and audio storage"
```

---

### Task 10: report-service（生成 + 回填校验 + 生词计数）

**Files:**
- Create: `lib/services/report.ts`
- Test: `tests/report-service.test.ts`

**Interfaces:**
- Consumes: Task 6 `tolerantParse`/`RawReport`、Task 7 `getChat`、Task 9 practice-service、Task 4 vocab-service、Task 8 getScenario
- Produces: `class ReportParseError extends Error { raw: string }`；`generateReport(sessionId: string): Promise<Report>`（生成→解析→回填→markUsedInSession→saveReport→endSession；session 不存在抛 Error）；`backfillCorrections(raw: RawReport, turns: Turn[]): ReportCorrection[]`（导出供测试；turnId 不存在时尝试按 original 匹配；都不匹配→丢弃+console.warn；空 original 直接丢弃）

- [ ] **Step 1: 写失败测试 tests/report-service.test.ts**

```ts
import { mkdtempSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { beforeEach, expect, it } from "vitest"
import { RawReport } from "@/lib/report-schema"
import { Turn } from "@/lib/domain/types"
import { addWord, listWords } from "@/lib/services/vocab"
import { createSession, appendTurn, getSession } from "@/lib/services/practice"
import { backfillCorrections, generateReport } from "@/lib/services/report"

beforeEach(() => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "sl-test-"))
})

const turn = (id: string, userText: string): Turn => ({
  id, userText, aiText: "ok", sttProvider: "keyboard",
  createdAt: new Date(Date.now() + Math.random()).toISOString(),
})

const raw = (over: Partial<RawReport> = {}): RawReport => ({
  summary: "s",
  highlights: ["h1"],
  corrections: [
    { turnId: "t1", original: "I go yesterday", type: "grammar", improved: "I went yesterday", explanation: "过去时" },
  ],
  vocabCandidates: [{ word: "blocker", translation: "阻碍", example: "a blocker" }],
  ...over,
})

it("回填校验：turnId 匹配则保留", () => {
  const out = backfillCorrections(raw(), [turn("t1", "I go yesterday")])
  expect(out).toHaveLength(1)
  expect(out[0].turnId).toBe("t1")
})

it("回填校验：turnId 不存在但原文匹配则修正 turnId", () => {
  const out = backfillCorrections(raw(), [turn("real-id", "I go yesterday")])
  expect(out).toHaveLength(1)
  expect(out[0].turnId).toBe("real-id")
})

it("回填校验：幻觉（无匹配）与空 original 被丢弃", () => {
  const r = raw({ corrections: [
    { turnId: "ghost", original: "never said this", type: "vocab", improved: "x", explanation: "y" },
    { turnId: "t1", original: "", type: "vocab", improved: "x", explanation: "y" },
  ] })
  expect(backfillCorrections(r, [turn("t1", "I go yesterday")])).toHaveLength(0)
})

it("generateReport 全链路：报告落库、生词计数、会话结束", async () => {
  const s = await createSession("builtin-interview")
  await appendTurn(s.id, turn("t1", "I go yesterday"))
  await addWord({ word: "blocker", translation: "阻碍", example: "We hit a blocker.", sourceSessionId: "other" })
  const report = await generateReport(s.id)
  expect(report.corrections[0].turnId).toBe("t1")
  const stored = (await getSession(s.id))!
  expect(stored.report?.summary).toBeTruthy()
  expect(stored.endedAt).toBeTruthy()
  expect((await listWords())[0].timesEncountered).toBe(1)
})

it("generateReport 会话不存在抛错", async () => {
  await expect(generateReport("nope")).rejects.toThrow("session not found")
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/report-service.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 lib/services/report.ts**

```ts
import { Report, ReportCorrection, Turn } from "@/lib/domain/types"
import { RawReport, tolerantParse } from "@/lib/report-schema"
import { getChat } from "@/lib/providers/types"
import { endSession, getSession, saveReport } from "@/lib/services/practice"
import { listWords, markUsedInSession } from "@/lib/services/vocab"

export class ReportParseError extends Error {
  constructor(public raw: string) {
    super("report parse failed")
  }
}

const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim()

export function backfillCorrections(raw: RawReport, turns: Turn[]): ReportCorrection[] {
  const out: ReportCorrection[] = []
  for (const c of raw.corrections) {
    const n = norm(c.original)
    if (!n) continue
    let turn = turns.find(t => t.id === c.turnId && norm(t.userText).length > 0)
    if (!turn) turn = turns.find(t => norm(t.userText).includes(n) || n.includes(norm(t.userText)))
    if (!turn) {
      console.warn("[report] drop hallucinated correction:", c.original)
      continue
    }
    out.push({ turnId: turn.id, original: c.original, type: c.type, improved: c.improved, explanation: c.explanation })
  }
  return out
}

const REPORT_SYSTEM =
  "You are a spoken-English report analyzer. Output ONLY a JSON object: " +
  '{"summary":string(中文总评),"highlights":string[](中文亮点,1-3条),' +
  '"corrections":[{turnId:string,original:string(原样引用该轮用户原句,不得改写),' +
  '"type":"grammar"|"vocab"|"idiom",improved:string(更地道英文),explanation:string(中文解释)}],' +
  '"vocabCandidates":[{word:string,translation:string,example:string(英文例句)}]}. ' +
  "Analyze ONLY the turns given in the transcript. Every correction MUST carry the turnId shown in [brackets]. Never invent sentences."

export async function generateReport(sessionId: string): Promise<Report> {
  const session = await getSession(sessionId)
  if (!session) throw new Error("session not found")
  const transcript = session.turns.map(t => `[${t.id}] ${t.userText}`).join("\n")
  const rawText = await getChat().chat(REPORT_SYSTEM, [
    { role: "user", content: `Transcript:\n${transcript}` },
  ])
  const parsed = tolerantParse(rawText)
  if (!parsed) throw new ReportParseError(rawText)
  const corrections = backfillCorrections(parsed, session.turns)
  const report: Report = {
    sessionId,
    summary: parsed.summary,
    highlights: parsed.highlights,
    corrections,
    vocabCandidates: parsed.vocabCandidates,
  }
  const all = await listWords()
  const active = all.filter(w => w.status === "new" || w.status === "learning")
  const fullText = session.turns.map(t => `${t.userText} ${t.aiText}`).join("\n")
  await markUsedInSession(active, fullText)
  await saveReport(sessionId, report)
  await endSession(sessionId)
  return report
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/report-service.test.ts`
Expected: 5 passed

- [ ] **Step 5: Commit**

```powershell
git add lib/services/report.ts tests/report-service.test.ts
git commit -m "feat: report service with backfill validation and vocab counting"
```

---

### Task 11: API 路由（薄路由）

**Files:**
- Create: `app/api/stt/route.ts`、`app/api/chat/route.ts`、`app/api/tts/route.ts`、`app/api/report/route.ts`、`app/api/sessions/route.ts`、`app/api/sessions/[id]/route.ts`、`app/api/sessions/[id]/turns/route.ts`、`app/api/scenarios/route.ts`、`app/api/scenarios/draft/route.ts`、`app/api/vocab/route.ts`、`app/api/audio/[...path]/route.ts`、`app/api/tts/warmup/route.ts`

**Interfaces:**
- Consumes: Task 4-10 全部 service 函数与 `getSTT`/`getChat`/`getTTS`、Task 3 `parseGoalMarker`、Task 5 `buildSystemPrompt`/`modeInstruction`
- Produces（前端将依赖的 HTTP 契约）:
  - `POST /api/stt` multipart(`sessionId`,`audio`) → `{turnId,text,audioUrl,sttProvider}`
  - `POST /api/chat` `{sessionId,scenarioId,messages,mode?}` → `{reply,goalsDone}`（marker 已剥离）
  - `POST /api/tts` `{text,speaker?}` → `audio/wav`
  - `POST /api/tts/warmup` → `{ok:true}`（MVP-1 固定空操作）
  - `POST /api/report` `{sessionId}` → 200 `Report` | 422 `{error:"parse",raw}` | 404
  - `GET /api/sessions` → `Session[]`；`POST /api/sessions` `{scenarioId}` → `Session`
  - `GET /api/sessions/[id]` → `Session | 404`；`POST /api/sessions/[id]/turns` `{turn,goalsDone?}` → `Session`
  - `GET /api/scenarios` → `Scenario[]`；`POST /api/scenarios`（save）→ `Scenario`
  - `POST /api/scenarios/draft` `{description}` → `Scenario`（id=""）
  - `GET /api/vocab` → `VocabWord[]`；`POST /api/vocab` `{word,translation,example,sourceSessionId,status?}` → `VocabWord`；`PATCH /api/vocab` `{id,status}` → 204；`DELETE /api/vocab?id=` → 204
  - `GET /api/audio/[...path]` → 文件流（403/404 兜底）

- [ ] **Step 1: 逐个创建路由文件**

`app/api/stt/route.ts`：

```ts
import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { getSTT } from "@/lib/providers/types"
import { saveAudio } from "@/lib/services/practice"

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const sessionId = String(form.get("sessionId") ?? "")
  const file = form.get("audio") as File | null
  if (!sessionId || !file) return NextResponse.json({ error: "sessionId and audio required" }, { status: 400 })
  const buf = Buffer.from(await file.arrayBuffer())
  const turnId = randomUUID()
  let audioUrl: string | undefined
  try {
    audioUrl = await saveAudio(sessionId, turnId, buf)
  } catch {
    audioUrl = undefined
  }
  const result = await getSTT().transcribe(new Blob([buf]))
  return NextResponse.json({
    turnId,
    text: result.text,
    audioUrl,
    sttProvider: process.env.STT_PROVIDER ?? "mock",
  })
}
```

`app/api/chat/route.ts`：

```ts
import { NextRequest, NextResponse } from "next/server"
import { parseGoalMarker } from "@/lib/goal-marker"
import { buildSystemPrompt, modeInstruction } from "@/lib/prompts"
import { getChat } from "@/lib/providers/types"
import { getScenario } from "@/lib/services/scenario"
import { listWords, selectForInjection } from "@/lib/services/vocab"

export async function POST(req: NextRequest) {
  const { scenarioId, messages, mode } = await req.json()
  const scenario = await getScenario(scenarioId)
  if (!scenario) return NextResponse.json({ error: "scenario not found" }, { status: 404 })
  const vocab = selectForInjection(await listWords())
  const system = buildSystemPrompt(scenario, vocab) + modeInstruction(mode)
  const raw = await getChat().chat(system, messages ?? [])
  const { clean, goals } = parseGoalMarker(raw)
  return NextResponse.json({ reply: clean, goalsDone: goals })
}
```

`app/api/tts/route.ts`：

```ts
import { NextRequest } from "next/server"
import { getTTS } from "@/lib/providers/types"

export async function POST(req: NextRequest) {
  const { text, speaker } = await req.json()
  if (!text) return new Response("text required", { status: 400 })
  const wav = await getTTS().synthesize(text, { speaker })
  return new Response(wav, { headers: { "Content-Type": "audio/wav" } })
}
```

`app/api/tts/warmup/route.ts`：

```ts
import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json({ ok: true })
}
```

`app/api/report/route.ts`：

```ts
import { NextRequest, NextResponse } from "next/server"
import { generateReport, ReportParseError } from "@/lib/services/report"

export async function POST(req: NextRequest) {
  const { sessionId } = await req.json()
  try {
    const report = await generateReport(sessionId)
    return NextResponse.json(report)
  } catch (e) {
    if (e instanceof ReportParseError) return NextResponse.json({ error: "parse", raw: e.raw }, { status: 422 })
    return NextResponse.json({ error: (e as Error).message }, { status: 404 })
  }
}
```

`app/api/sessions/route.ts`：

```ts
import { NextRequest, NextResponse } from "next/server"
import { createSession, listSessions } from "@/lib/services/practice"

export async function GET() {
  return NextResponse.json(await listSessions())
}

export async function POST(req: NextRequest) {
  const { scenarioId } = await req.json()
  if (!scenarioId) return NextResponse.json({ error: "scenarioId required" }, { status: 400 })
  return NextResponse.json(await createSession(scenarioId))
}
```

`app/api/sessions/[id]/route.ts`：

```ts
import { NextResponse } from "next/server"
import { getSession } from "@/lib/services/practice"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession(id)
  if (!session) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json(session)
}
```

`app/api/sessions/[id]/turns/route.ts`：

```ts
import { NextRequest, NextResponse } from "next/server"
import { appendTurn } from "@/lib/services/practice"
import { Turn } from "@/lib/domain/types"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { turn, goalsDone } = await req.json()
  if (!turn?.id || !turn?.userText) {
    return NextResponse.json({ error: "turn with id and userText required" }, { status: 400 })
  }
  try {
    return NextResponse.json(await appendTurn(id, turn as Turn, goalsDone ?? []))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 })
  }
}
```

`app/api/scenarios/route.ts`：

```ts
import { NextRequest, NextResponse } from "next/server"
import { createScenario, listScenarios } from "@/lib/services/scenario"

export async function GET() {
  return NextResponse.json(await listScenarios())
}

export async function POST(req: NextRequest) {
  const { title, persona, goals, difficulty } = await req.json()
  if (!title || !persona || !Array.isArray(goals) || goals.length === 0) {
    return NextResponse.json({ error: "title, persona, non-empty goals required" }, { status: 400 })
  }
  return NextResponse.json(await createScenario({ title, persona, goals, difficulty: difficulty ?? "medium" }))
}
```

`app/api/scenarios/draft/route.ts`：

```ts
import { NextRequest, NextResponse } from "next/server"
import { draftScenario } from "@/lib/services/scenario"

export async function POST(req: NextRequest) {
  const { description } = await req.json()
  if (!description?.trim()) return NextResponse.json({ error: "description required" }, { status: 400 })
  return NextResponse.json(await draftScenario(description))
}
```

`app/api/vocab/route.ts`：

```ts
import { NextRequest, NextResponse } from "next/server"
import { VocabStatus } from "@/lib/domain/types"
import { addWord, deleteWord, listWords, setStatus } from "@/lib/services/vocab"

export async function GET() {
  return NextResponse.json(await listWords())
}

export async function POST(req: NextRequest) {
  const { word, translation, example, sourceSessionId, status } = await req.json()
  if (!word?.trim()) return NextResponse.json({ error: "word required" }, { status: 400 })
  return NextResponse.json(
    await addWord({ word, translation: translation ?? "", example: example ?? "", sourceSessionId: sourceSessionId ?? "", status })
  )
}

export async function PATCH(req: NextRequest) {
  const { id, status } = await req.json()
  if (!id || !status) return NextResponse.json({ error: "id and status required" }, { status: 400 })
  await setStatus(id, status as VocabStatus)
  return new NextResponse(null, { status: 204 })
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  await deleteWord(id)
  return new NextResponse(null, { status: 204 })
}
```

`app/api/audio/[...path]/route.ts`：

```ts
import { promises as fs } from "node:fs"
import path from "node:path"

const TYPES: Record<string, string> = { ".webm": "audio/webm", ".wav": "audio/wav" }

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params
  const audioDir = path.join(process.env.DATA_DIR ?? path.join(process.cwd(), "data"), "audio")
  const safe = parts.map(p => path.basename(p))
  const target = path.join(audioDir, ...safe)
  if (!target.startsWith(audioDir)) return new Response("forbidden", { status: 403 })
  const ext = path.extname(target).toLowerCase()
  try {
    const buf = await fs.readFile(target)
    return new Response(buf, { headers: { "Content-Type": TYPES[ext] ?? "application/octet-stream" } })
  } catch {
    return new Response("not found", { status: 404 })
  }
}
```

- [ ] **Step 2: 构建 + 冒烟**

```powershell
npm run build
npm run dev
```

另开终端：

```powershell
curl.exe -s -X POST http://localhost:3000/api/sessions -H "Content-Type: application/json" -d "{\"scenarioId\":\"builtin-interview\"}"
curl.exe -s -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d "{\"scenarioId\":\"builtin-interview\",\"messages\":[{\"role\":\"user\",\"content\":\"hello\"},{\"role\":\"assistant\",\"content\":\"hi\"},{\"role\":\"user\",\"content\":\"second\"}]}"
curl.exe -s http://localhost:3000/api/scenarios
```

Expected: 分别返回 Session JSON、`reply` 不含 `[GOAL_DONE` 且 `goalsDone:[0]`、4 个场景。

- [ ] **Step 3: Commit**

```powershell
git add app/api
git commit -m "feat: thin api routes over services"
```

---

### Task 12: UI 外壳 + 仪表盘 + 场景页

**Files:**
- Modify: `app/page.tsx`（替换占位）
- Create: `app/scenarios/page.tsx`

**Interfaces:**
- Consumes: `GET /api/sessions`、`GET /api/vocab`、`GET /api/scenarios`、`POST /api/scenarios/draft`、`POST /api/scenarios`、`POST /api/sessions`、`POST /api/tts/warmup`
- Produces: 仪表盘（本周练习/生词分布/错误 Top3/最近练习）与场景选择页（卡片 + 自定义流程：描述→草稿→编辑→保存→开练）

- [ ] **Step 1: app/page.tsx（仪表盘）**

```tsx
"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Scenario, Session, VocabWord } from "@/lib/domain/types"

export default function Dashboard() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [words, setWords] = useState<VocabWord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/sessions").then(r => r.json()).then(setSessions)
    fetch("/api/scenarios").then(r => r.json()).then(setScenarios)
    fetch("/api/vocab").then(r => r.json()).then(setWords).then(() => setLoading(false))
    fetch("/api/tts/warmup", { method: "POST" }).catch(() => {})
  }, [])

  const weekAgo = Date.now() - 7 * 86400_000
  const weekCount = sessions.filter(s => new Date(s.startedAt).getTime() > weekAgo).length
  const dist = words.reduce<Record<string, number>>((acc, w) => ({ ...acc, [w.status]: (acc[w.status] ?? 0) + 1 }), {})
  const errorTypes = sessions
    .flatMap(s => s.report?.corrections ?? [])
    .reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.type]: (acc[c.type] ?? 0) + 1 }), {})
  const topErrors = Object.entries(errorTypes).sort((a, b) => b[1] - a[1]).slice(0, 3)
  const typeLabel: Record<string, string> = { grammar: "语法", vocab: "用词", idiom: "地道表达" }

  if (loading) return <p className="muted">加载中…</p>
  return (
    <div>
      <div className="row" style={{ alignItems: "stretch" }}>
        <div className="card" style={{ flex: 1 }}>
          <div className="muted">本周练习</div>
          <div className="stat">{weekCount} 次</div>
        </div>
        <div className="card" style={{ flex: 1 }}>
          <div className="muted">生词（new/learning/mastered）</div>
          <div className="stat">{dist.new ?? 0} / {dist.learning ?? 0} / {dist.mastered ?? 0}</div>
        </div>
        <div className="card" style={{ flex: 1 }}>
          <div className="muted">常见错误 Top3</div>
          {topErrors.length === 0 && <div className="muted">暂无数据</div>}
          {topErrors.map(([t, n]) => <div key={t}>{typeLabel[t] ?? t} × {n}</div>)}
        </div>
      </div>
      <h3>最近练习</h3>
      {sessions.length === 0 && <p className="muted">还没有练习记录，去 <Link href="/scenarios">选一个场景</Link> 开始吧。</p>}
      {sessions.slice(0, 8).map(s => {
        const sc = scenarios.find(x => x.id === s.scenarioId)
        return (
          <div key={s.id} className="card row">
            <span>{sc?.title ?? "未知场景"}</span>
            <span className="muted">{new Date(s.startedAt).toLocaleString("zh-CN")}</span>
            <span className="chip">{s.turns.length} 轮</span>
            {s.report && <Link className="btn btn-secondary" href={`/report/${s.id}`}>查看报告</Link>}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: app/scenarios/page.tsx**

```tsx
"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Scenario } from "@/lib/domain/types"

const emptyDraft: Scenario = {
  id: "", title: "", persona: "", goals: [], difficulty: "medium", builtin: false,
}

export default function ScenariosPage() {
  const router = useRouter()
  const [list, setList] = useState<Scenario[]>([])
  const [description, setDescription] = useState("")
  const [draft, setDraft] = useState<Scenario | null>(null)
  const [busy, setBusy] = useState(false)

  const load = () => fetch("/api/scenarios").then(r => r.json()).then(setList)
  useEffect(() => { load() }, [])

  async function startPractice(scenarioId: string) {
    const s = await fetch("/api/sessions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId }),
    }).then(r => r.json())
    router.push(`/practice/${s.id}`)
  }

  async function genDraft() {
    setBusy(true)
    const d = await fetch("/api/scenarios/draft", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    }).then(r => r.json())
    setDraft({ ...d, goals: d.goals.join("\n") } as unknown as Scenario)
    setBusy(false)
  }

  async function saveDraft() {
    if (!draft) return
    setBusy(true)
    const saved = await fetch("/api/scenarios", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draft.title, persona: draft.persona,
        goals: String(draft.goals).split("\n").map(s => s.trim()).filter(Boolean),
        difficulty: draft.difficulty,
      }),
    }).then(r => r.json())
    setBusy(false)
    setDraft(null)
    setDescription("")
    await load()
    await startPractice(saved.id)
  }

  return (
    <div>
      <h3>选择场景</h3>
      {list.map(s => (
        <div key={s.id} className="card row">
          <div style={{ flex: 1 }}>
            <b>{s.title}</b> <span className="chip">{s.difficulty}</span>
            <div className="muted">{s.persona}</div>
          </div>
          <button className="btn" onClick={() => startPractice(s.id)}>开始练习</button>
        </div>
      ))}
      <h3>自定义场景</h3>
      <div className="card">
        <textarea className="input" rows={2} placeholder="用中文描述场景，如：和外国客户谈判交期"
          value={description} onChange={e => setDescription(e.target.value)} />
        <button className="btn" style={{ marginTop: 8 }} disabled={busy || !description.trim()} onClick={genDraft}>
          生成草稿
        </button>
        {draft && (
          <div style={{ marginTop: 12 }}>
            <input className="input" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="标题" />
            <textarea className="input" rows={2} style={{ marginTop: 8 }} value={draft.persona}
              onChange={e => setDraft({ ...draft, persona: e.target.value })} placeholder="AI 角色设定（英文）" />
            <textarea className="input" rows={3} style={{ marginTop: 8 }} value={String(draft.goals)}
              onChange={e => setDraft({ ...draft, goals: e.target.value.split("\n") as unknown as string[] })}
              placeholder="练习目标（每行一个，英文）" />
            <select className="input" style={{ marginTop: 8 }} value={draft.difficulty}
              onChange={e => setDraft({ ...draft, difficulty: e.target.value as Scenario["difficulty"] })}>
              <option value="easy">easy</option><option value="medium">medium</option><option value="hard">hard</option>
            </select>
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn" disabled={busy} onClick={saveDraft}>保存并开始</button>
              <button className="btn btn-secondary" onClick={() => setDraft(null)}>取消</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 验证**

```powershell
npm run build
npm run dev
```

浏览器 `http://localhost:3000`：仪表盘三卡渲染、无练习记录提示；`/scenarios`：4 张卡片；自定义输入“和外国客户谈判交期”→ 生成草稿 → 编辑 → 保存并开始 → 跳转 `/practice/{id}`（Task 13 前显示 404 属预期）。

- [ ] **Step 4: Commit**

```powershell
git add app/page.tsx app/scenarios/page.tsx
git commit -m "feat: dashboard and scenarios pages"
```

---

### Task 13: 对话页（前端编排状态机）

**Files:**
- Create: `components/Recorder.tsx`、`app/practice/[id]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/sessions/[id]`、`GET /api/scenarios`、`POST /api/stt`、`POST /api/chat`、`POST /api/tts`、`POST /api/sessions/[id]/turns`、`POST /api/report`
- Produces: 完整对话闭环页面：录音（或键盘）→ STT → Chat（goals 进度更新）→ TTS 播放（失败降级）；“听不懂”/“提示”瞬时教练气泡（不落库）；结束练习跳报告页

- [ ] **Step 1: components/Recorder.tsx**

```tsx
"use client"

import { useRef, useState } from "react"

export default function Recorder({ onRecorded, disabled }: { onRecorded: (b: Blob) => void; disabled?: boolean }) {
  const [recording, setRecording] = useState(false)
  const [denied, setDenied] = useState(false)
  const ref = useRef<MediaRecorder | null>(null)

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : ""
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      const chunks: Blob[] = []
      rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        onRecorded(new Blob(chunks, { type: mime || "audio/webm" }))
      }
      ref.current = rec
      rec.start()
      setRecording(true)
      setDenied(false)
    } catch {
      setDenied(true)
    }
  }

  return (
    <div>
      <button className="btn" onClick={() => { if (recording) { ref.current?.stop(); setRecording(false) } else start() }}
        disabled={disabled}>
        {recording ? "■ 停止录音" : "🎤 说话"}
      </button>
      {denied && <p className="muted">麦克风不可用，请用键盘输入。</p>}
    </div>
  )
}
```

- [ ] **Step 2: app/practice/[id]/page.tsx**

```tsx
"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import Recorder from "@/components/Recorder"
import { Scenario, Session, Turn } from "@/lib/domain/types"

type Bubble = { role: "user" | "ai" | "coach"; text: string }
type Step = { name: "stt" | "chat"; retry: () => void }

export default function PracticePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [scenario, setScenario] = useState<Scenario | null>(null)
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [goalProgress, setGoalProgress] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [ttsDown, setTtsDown] = useState(false)
  const [failed, setFailed] = useState<Step | null>(null)
  const [keyboard, setKeyboard] = useState("")
  const pending = useRef<{ turnId?: string; audioUrl?: string; userText: string } | null>(null)

  useEffect(() => {
    (async () => {
      const { id } = await params
      const s: Session = await fetch(`/api/sessions/${id}`).then(r => r.json())
      setSession(s)
      setGoalProgress(s.goalProgress ?? [])
      const all: Scenario[] = await fetch("/api/scenarios").then(r => r.json())
      setScenario(all.find(x => x.id === s.scenarioId) ?? null)
      setBubbles(s.turns.map(t => [{ role: "user" as const, text: t.userText }, { role: "ai" as const, text: t.aiText }]).flat())
    })()
  }, [params])

  async function runStt(blob: Blob) {
    setBusy(true); setFailed(null)
    const form = new FormData()
    form.set("sessionId", session!.id)
    form.set("audio", blob, "turn.webm")
    const r = await fetch("/api/stt", { method: "POST", body: form })
    if (!r.ok) { setBusy(false); setFailed({ name: "stt", retry: () => runStt(blob) }); return }
    const data = await r.json()
    pending.current = { turnId: data.turnId, audioUrl: data.audioUrl, userText: data.text }
    await runChat(data.text)
  }

  async function runChat(userText: string, mode?: "simplify" | "hint") {
    setBusy(true); setFailed(null)
    const messages = bubbles
      .filter(b => b.role !== "coach")
      .map(b => ({ role: b.role === "user" ? "user" as const : "assistant" as const, content: b.text }))
    if (!mode) messages.push({ role: "user", content: userText })
    const r = await fetch("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session!.id, scenarioId: session!.scenarioId, messages, mode }),
    })
    if (!r.ok) { setBusy(false); setFailed({ name: "chat", retry: () => runChat(userText, mode) }); return }
    const { reply, goalsDone } = await r.json()
    if (mode) {
      setBubbles(b => [...b, { role: "coach", text: reply }])
      setBusy(false)
      return
    }
    setBubbles(b => [...b, { role: "user", text: userText }, { role: "ai", text: reply }])
    setGoalProgress(g => Array.from(new Set([...g, ...goalsDone])))
    const turn: Turn = {
      id: pending.current?.turnId ?? crypto.randomUUID(),
      userText, aiText: reply,
      audioUrl: pending.current?.audioUrl,
      sttProvider: pending.current?.turnId ? "mock" : "keyboard",
      createdAt: new Date().toISOString(),
    }
    await fetch(`/api/sessions/${session!.id}/turns`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turn, goalsDone }),
    })
    pending.current = null
    setBusy(false)
    playTts(reply)
  }

  async function playTts(text: string) {
    try {
      const wav = await fetch("/api/tts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, speaker: scenario?.voice }),
      }).then(r => { if (!r.ok) throw new Error(); return r.arrayBuffer() })
      new Audio(URL.createObjectURL(new Blob([wav], { type: "audio/wav" }))).play()
      setTtsDown(false)
    } catch {
      setTtsDown(true)
    }
  }

  async function endPractice() {
    setBusy(true)
    await fetch("/api/report", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session!.id }),
    })
    router.push(`/report/${session!.id}`)
  }

  if (!session || !scenario) return <p className="muted">加载中…</p>
  return (
    <div>
      <div className="card">
        <b>{scenario.title}</b>
        <div className="muted">{scenario.persona}</div>
        <div style={{ marginTop: 8 }}>
          {scenario.goals.map((g, i) => (
            <div key={i}>{goalProgress.includes(i) ? "✅" : "⬜"} {i}. {g}</div>
          ))}
        </div>
        {ttsDown && <span className="chip">语音服务离线（文字模式）</span>}
      </div>
      <div style={{ minHeight: 200 }}>
        {bubbles.map((b, i) => (
          <div key={i} className={`bubble ${b.role === "user" ? "bubble-user" : b.role === "ai" ? "bubble-ai" : "bubble-coach"}`}>
            {b.text}
          </div>
        ))}
        {busy && <p className="muted">思考中…</p>}
        {failed && (
          <div className="card">
            <span className="muted">{failed.name === "stt" ? "语音识别" : "对话"}失败</span>{" "}
            <button className="btn btn-secondary" onClick={failed.retry}>重试</button>
          </div>
        )}
      </div>
      <div className="card">
        <div className="row">
          <Recorder onRecorded={runStt} disabled={busy} />
          <input className="input" placeholder="或用键盘输入英文…" value={keyboard}
            onChange={e => setKeyboard(e.target.value)}
            onKeyDown={async e => {
              if (e.key === "Enter" && keyboard.trim() && !busy) {
                const t = keyboard.trim(); setKeyboard("")
                pending.current = { userText: t }
                await runChat(t)
              }
            }} />
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn btn-secondary" disabled={busy || bubbles.length === 0}
            onClick={() => runChat("", "simplify")}>听不懂</button>
          <button className="btn btn-secondary" disabled={busy || bubbles.length === 0}
            onClick={() => runChat("", "hint")}>提示</button>
          <button className="btn btn-danger" disabled={busy || bubbles.length === 0} onClick={endPractice}>
            结束练习
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 验证**

```powershell
npm run build
npm run dev
```

浏览器完整走一遍：选场景开始 → 键盘输入 "hello" → 收到回复（无 marker）→ 第二轮回复后 goal 0 打勾 → “听不懂”/“提示”出现黄色教练气泡 → “结束练习” → 跳转 `/report/{id}`（Task 14 前显示 404 属预期）。

- [ ] **Step 4: Commit**

```powershell
git add components/Recorder.tsx "app/practice/[id]/page.tsx"
git commit -m "feat: practice page with frontend turn orchestration"
```

---

### Task 14: 报告页 + 生词本页

**Files:**
- Create: `app/report/[id]/page.tsx`、`app/vocab/page.tsx`

**Interfaces:**
- Consumes: `GET /api/sessions/[id]`（含内嵌 report 与 turns）、`POST /api/vocab`（采纳 status=new / 忽略 status=ignored）、`GET /api/vocab`、`PATCH /api/vocab`、`DELETE /api/vocab`
- Produces: 报告页（总评/亮点/逐句纠错含原声回放/候选采纳-忽略）与生词本页（状态管理/删除）

- [ ] **Step 1: app/report/[id]/page.tsx**

```tsx
"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Report, Session } from "@/lib/domain/types"

const typeLabel: Record<string, string> = { grammar: "语法", vocab: "用词", idiom: "地道表达" }

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const [session, setSession] = useState<Session | null>(null)
  const [handled, setHandled] = useState<Record<string, string>>({})

  useEffect(() => {
    (async () => {
      const { id } = await params
      const s: Session = await fetch(`/api/sessions/${id}`).then(r => r.json())
      setSession(s)
    })()
  }, [params])

  if (!session) return <p className="muted">加载中…</p>
  const report: Report | undefined = session.report
  if (!report) return <p className="muted">报告尚未生成。<Link href="/">返回首页</Link></p>

  async function handleCandidate(word: string, translation: string, example: string, status: "new" | "ignored") {
    await fetch("/api/vocab", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word, translation, example, sourceSessionId: session!.id, status }),
    })
    setHandled(h => ({ ...h, [word]: status }))
  }

  return (
    <div>
      <h3>练习报告</h3>
      <div className="card"><b>总评</b><p>{report.summary}</p></div>
      {report.highlights.length > 0 && (
        <div className="card">
          <b>亮点</b>
          <ul>{report.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul>
        </div>
      )}
      {report.corrections.map((c, i) => {
        const turn = session.turns.find(t => t.id === c.turnId)
        return (
          <div key={i} className="card">
            <span className="chip">{typeLabel[c.type] ?? c.type}</span>
            <p>你说：{c.original}</p>
            <p>建议：{c.improved}</p>
            <p className="muted">{c.explanation}</p>
            {turn?.audioUrl && <audio controls src={turn.audioUrl} />}
          </div>
        )
      })}
      {report.vocabCandidates.length > 0 && (
        <div className="card">
          <b>生词候选</b>
          {report.vocabCandidates.map(v => (
            <div key={v.word} className="row" style={{ marginTop: 8 }}>
              <div style={{ flex: 1 }}>
                <b>{v.word}</b> <span className="muted">{v.translation}</span>
                <div className="muted">{v.example}</div>
              </div>
              {handled[v.word] ? (
                <span className="chip">{handled[v.word] === "new" ? "已加入" : "已忽略"}</span>
              ) : (
                <>
                  <button className="btn" onClick={() => handleCandidate(v.word, v.translation, v.example, "new")}>采纳</button>
                  <button className="btn btn-secondary" onClick={() => handleCandidate(v.word, v.translation, v.example, "ignored")}>忽略</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      <Link className="btn btn-secondary" href="/">返回首页</Link>
    </div>
  )
}
```

- [ ] **Step 2: app/vocab/page.tsx**

```tsx
"use client"

import { useEffect, useState } from "react"
import { VocabStatus, VocabWord } from "@/lib/domain/types"

const statusLabel: Record<VocabStatus, string> = { new: "新词", learning: "学习中", mastered: "已掌握", ignored: "已忽略" }

export default function VocabPage() {
  const [words, setWords] = useState<VocabWord[]>([])

  const load = () => fetch("/api/vocab").then(r => r.json()).then(setWords)
  useEffect(() => { load() }, [])

  async function change(id: string, status: VocabStatus) {
    await fetch("/api/vocab", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) })
    load()
  }

  async function remove(id: string) {
    await fetch(`/api/vocab?id=${id}`, { method: "DELETE" })
    load()
  }

  return (
    <div>
      <h3>生词本（{words.length}）</h3>
      {words.length === 0 && <p className="muted">暂无生词。完成一次练习并在报告中采纳候选后，这里会有内容。</p>}
      {words.map(w => (
        <div key={w.id} className="card row">
          <div style={{ flex: 1 }}>
            <b>{w.word}</b> <span className="muted">{w.translation}</span>
            <div className="muted">{w.example}</div>
            <div className="muted">使用 {w.timesEncountered} 次{w.lastUsedAt ? ` · 上次 ${new Date(w.lastUsedAt).toLocaleDateString("zh-CN")}` : ""}</div>
          </div>
          <select className="input" style={{ width: 120 }} value={w.status} onChange={e => change(w.id, e.target.value as VocabStatus)}>
            {(["new", "learning", "mastered", "ignored"] as VocabStatus[]).map(s => (
              <option key={s} value={s}>{statusLabel[s]}</option>
            ))}
          </select>
          <button className="btn btn-danger" onClick={() => remove(w.id)}>删除</button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: 验证（完整闭环手动走查）**

```powershell
npm run build
npm run dev
```

1. `/scenarios` → 开始练习 → 键盘两轮对话 → 结束练习
2. 报告页：总评/亮点/纠错卡（keyboard 轮无 audioUrl，不显示播放器）
3. 候选“blocker”点采纳 → `/vocab` 显示“新词”
4. 再开一次练习对话 → （mock STT 文本不含 blocker，计数不变——真实生效待 MVP-2 后用真实语音验证；用例见 tests）
5. 生词本改状态为“已掌握” → 下次对话 mock 场景不受影响（注入逻辑已在单测覆盖）

- [ ] **Step 4: Commit**

```powershell
git add "app/report/[id]/page.tsx" app/vocab/page.tsx
git commit -m "feat: report page with audio replay and vocab management"
```

---

### Task 15: doctor 自检 + README + 全量验证

**Files:**
- Create: `scripts/doctor.mjs`、`README.md`

**Interfaces:**
- Produces: `npm run doctor` 输出 Node/数据目录/ai-server 健康检查；README 记录启动方式与 env

- [ ] **Step 1: scripts/doctor.mjs**

```js
import { access, writeFile, unlink, mkdir } from "node:fs/promises"
import path from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

const run = promisify(execFile)
const results = []
const check = (name, ok, detail = "") => results.push({ name, ok, detail })

const [major] = process.versions.node.split(".").map(Number)
check("Node >= 20", major >= 20, `v${process.versions.node}`)

const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data")
try {
  await mkdir(path.join(dataDir, "audio"), { recursive: true })
  const probe = path.join(dataDir, ".write-probe")
  await writeFile(probe, "ok")
  await unlink(probe)
  check("数据目录可写", true, dataDir)
} catch (e) {
  check("数据目录可写", false, String(e))
}

const base = process.env.AI_SERVER_URL ?? "http://127.0.0.1:8100"
try {
  const r = await fetch(`${base}/health`)
  check("ai-server /health", r.ok, `${base} -> ${r.status}`)
} catch {
  check("ai-server /health", false, `${base} 不可达（文字模式仍可用）`)
}

try {
  const { stdout } = await run("nvidia-smi", ["--query-gpu=name,memory.total,memory.used", "--format=csv,noheader"])
  check("GPU", true, stdout.trim())
} catch {
  check("GPU", false, "nvidia-smi 不可用")
}

for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name} ${r.detail}`)
process.exit(results.every(r => r.ok) ? 0 : 1)
```

- [ ] **Step 2: README.md**

```markdown
# SpeakLoop

浏览器里的 AI 英语口语私教：职场场景语音对话 + 练后纠错报告 + 生词闭环。

## 快速开始（Mock 模式，无需 GPU/Key）

​```powershell
npm install
npm run dev
​```

打开 http://localhost:3000

## 真实语音（需 ai-server）

1. 按 `docs/superpowers/plans/2026-10-01-speakloop-phase0-ai-server.md` 部署
2. `.env` 设置：`STT_PROVIDER=qwen3-local`、`TTS_PROVIDER=qwen3-local`
3. `npm run doctor` 自检

## 环境变量

见 `.env.example`。设计文档：`docs/superpowers/specs/2026-10-01-speakloop-design.md`
```

（注：README 中反引号代码围栏按实际文件写入，上方 `​` 仅为计划文档嵌套示意。）

- [ ] **Step 3: 全量验证**

```powershell
npm test
npm run build
npm run doctor
```

Expected: 测试全绿（约 30 个用例）；build 成功；doctor 输出 ai-server 不可达但整体提示文字模式可用（退出码 1 属预期，此时无 GPU 服务）。

- [ ] **Step 4: Commit**

```powershell
git add scripts/doctor.mjs README.md
git commit -m "chore: doctor script and readme"
```
