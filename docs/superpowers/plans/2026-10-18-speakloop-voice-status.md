# SpeakLoop 语音预热状态可见化实施计划（voice-status）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. implement this plan task-by-task. Steps use checkbox syntax.

**Goal:** 页面级语音预热状态可见化：STT/TTS **双行独立显示**四态（就绪/预热中·计时/离线·恢复指引/异常·超时警示），预热失败与加载中同为可见的一等状态；F4 相位计时器在预热期追加原因后缀。

**Architecture:** `GET /api/voice-status` Next 代理聚合双服务 `/health`；`lib/voice-status.ts` 纯函数状态机（全单测）；`VoiceStatus` 组件 10s 轮询、按服务独立计时、双就绪即停轮询；静态图标无闪烁动画（F1 教训）。

**Tech Stack:** 既有基线（**112 tests**，MVP-2.2 阅读增强后）。

## Global Constraints

- 基线写作时 112；**实际执行序在 22b 之后（基线 113）**：推进 **113→117→120**（T1×4、T2×3）——勘误清算 2026-10-18：两并行计划各按 112 基线写作致计数滑移，组合实况终态 **120 + typecheck 0 + build 绿**
- 四态判定源为各服务 `/health` 的可达性与 `model_loaded`（不依赖 warmup 请求成败）
- 超时阈值 **240s**（依据 spike 实测冷载 115-176s，留 35%-100% 余量）
- 双行分显：STT 行与 TTS 行各自独立状态与计时（两模型加载不同步）
- 显示纪律：静态图标（Phosphor `CheckCircle`/`CircleNotch`/`SpeakerSlash`），禁止闪烁/脉冲动画
- F4 语音合成相位后缀仅在**对应服务**预热中时追加（`语音识别中→STT loading`、`语音合成中→TTS loading`）

---

### Task 1: GET /api/voice-status 路由

**Files:**
- Create: `app/api/voice-status/route.ts`
- Test: `tests/voice-status-route.test.ts`

**Interfaces:**
- Produces: `GET /api/voice-status → { stt: "ready"|"loading"|"offline"|"disabled", tts: ... }`
  - `ready`：health 200 且 `model_loaded === true`
  - `loading`：health 200 且 `model_loaded === false`
  - `offline`：health 不可达/非 200（**预热失败可见性**：服务未启动或已崩溃）
  - `disabled`：provider 非 `qwen3-local`（未来其他 provider 的占位分支）
  - 单服务探活超时 3s（`AbortSignal.timeout(3000)`）；上游异常不抛 500

- [ ] **Step 1: 写失败测试**

`tests/voice-status-route.test.ts`：

```ts
import { mkdtempSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { createServer } from "node:http"
import { afterEach, beforeEach, expect, it } from "vitest"

let srv: ReturnType<typeof createServer> | null = null
let port = 0

beforeEach(() => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "sl-vs-"))
  for (const k of ["STT_PROVIDER", "STT_BASE_URL", "TTS_PROVIDER", "TTS_BASE_URL"]) delete process.env[k]
})

afterEach(async () => {
  await new Promise<void>(r => srv?.close(() => r()) ?? r())
  srv = null
})

function fakeHealth(loaded: boolean) {
  srv = createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ status: "ok", role: "asr", model_loaded: loaded }))
  })
  return new Promise<void>(resolve => srv!.listen(0, "127.0.0.1", () => resolve()))
}

async function get() {
  const { GET } = await import("@/app/api/voice-status/route")
  return GET()
}

it("health 可达且已载 → ready", async () => {
  await fakeHealth(true)
  const addr = srv!.address() as { port: number }
  writeFileSync(path.join(process.env.DATA_DIR!, "config.json"), JSON.stringify({
    stt: { provider: "qwen3-local", baseUrl: `http://127.0.0.1:${addr.port}` },
  }))
  const j = await (await get()).json()
  expect(j.stt).toBe("ready")
})

it("health 可达未载 → loading", async () => {
  await fakeHealth(false)
  const addr = srv!.address() as { port: number }
  writeFileSync(path.join(process.env.DATA_DIR!, "config.json"), JSON.stringify({
    stt: { provider: "qwen3-local", baseUrl: `http://127.0.0.1:${addr.port}` },
  }))
  const j = await (await get()).json()
  expect(j.stt).toBe("loading")
})

it("health 不可达 → offline（失败可见）", async () => {
  writeFileSync(path.join(process.env.DATA_DIR!, "config.json"), JSON.stringify({
    tts: { provider: "qwen3-local", baseUrl: "http://127.0.0.1:9" },
  }))
  const j = await (await get()).json()
  expect(j.tts).toBe("offline")
})

it("provider 非 qwen3-local → disabled", async () => {
  writeFileSync(path.join(process.env.DATA_DIR!, "config.json"), JSON.stringify({
    stt: { provider: "future-provider", baseUrl: "http://127.0.0.1:1" },
  }))
  const j = await (await get()).json()
  expect(j.stt).toBe("disabled")
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/voice-status-route.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 app/api/voice-status/route.ts**

```ts
import { NextResponse } from "next/server"
import { resolveConfig } from "@/lib/config"

type Probe = "ready" | "loading" | "offline" | "disabled"

async function probe(baseUrl: string, provider: string): Promise<Probe> {
  if (provider !== "qwen3-local") return "disabled"
  try {
    const r = await fetch(`${baseUrl.replace(/\/$/, "")}/health`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!r.ok) return "offline"
    const j = (await r.json().catch(() => ({}))) as { model_loaded?: boolean }
    return j.model_loaded === true ? "ready" : "loading"
  } catch {
    return "offline"
  }
}

export async function GET() {
  const cfg = await resolveConfig()
  const [stt, tts] = await Promise.all([
    probe(cfg.stt.baseUrl, cfg.stt.provider),
    probe(cfg.tts.baseUrl, cfg.tts.provider),
  ])
  return NextResponse.json({ stt, tts })
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/voice-status-route.test.ts`
Expected: 4 passed

- [ ] **Step 5: Commit**

```powershell
git add app/api/voice-status/route.ts tests/voice-status-route.test.ts
git commit -m "feat: voice-status route aggregating service health"
```

---

### Task 2: lib/voice-status.ts 纯状态机

**Files:**
- Create: `lib/voice-status.ts`
- Test: `tests/voice-status.test.ts`

**Interfaces:**
- Produces: `lineStatus(probe: "ready"|"loading"|"offline"|"disabled", elapsedSec: number, timeoutSec = 240): { level: "ready"|"loading"|"offline"|"error"; label: string }`
  - ready → `就绪`；loading 且 elapsed < timeout → `预热中 · Xs`；loading 且 ≥timeout → **error** `异常（已 Xs）`；offline → `离线`；disabled → `未启用`
  - 组件层负责拼装恢复指引文案（离线/异常的后缀建议），本函数只出级态与核心文案

- [ ] **Step 1: 写失败测试**

`tests/voice-status.test.ts`：

```ts
import { expect, it } from "vitest"
import { lineStatus } from "@/lib/voice-status"

it("ready/disabled/offline 直接映射", () => {
  expect(lineStatus("ready", 0)).toEqual({ level: "ready", label: "就绪" })
  expect(lineStatus("disabled", 0)).toEqual({ level: "loading", label: "未启用" })
  expect(lineStatus("offline", 0)).toEqual({ level: "offline", label: "离线" })
})

it("loading 计时显示", () => {
  expect(lineStatus("loading", 78)).toEqual({ level: "loading", label: "预热中 · 78s" })
})

it("超过阈值升级为 error（240s 默认）", () => {
  expect(lineStatus("loading", 239).level).toBe("loading")
  expect(lineStatus("loading", 240)).toEqual({ level: "error", label: "异常（已 240s）" })
  expect(lineStatus("loading", 300, 180).label).toBe("异常（已 300s）")
})

（勘误清算 2026-10-18：原文本行尾多处一个 `}` 致非法 TS；执行期经最小修复后落地（`b81f299`），上文为修正后文本。）
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/voice-status.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 lib/voice-status.ts**

```ts
export type VoiceProbe = "ready" | "loading" | "offline" | "disabled"

export interface LineStatus {
  level: "ready" | "loading" | "offline" | "error"
  label: string
}

export function lineStatus(probe: VoiceProbe, elapsedSec: number, timeoutSec = 240): LineStatus {
  if (probe === "ready") return { level: "ready", label: "就绪" }
  if (probe === "disabled") return { level: "loading", label: "未启用" }
  if (probe === "offline") return { level: "offline", label: "离线" }
  if (elapsedSec >= timeoutSec) return { level: "error", label: `异常（已 ${elapsedSec}s）` }
  return { level: "loading", label: `预热中 · ${elapsedSec}s` }
}
```

（勘误清算 2026-10-18，已知语义混同（用户裁定 DO-NOT-FIX）：`disabled` 复用 `loading` 级——独立 `"disabled"` 级为未来重构候选；当前无实际用户路径（仅 qwen3-local 已配置）。）

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/voice-status.test.ts`
Expected: 3 passed

- [ ] **Step 5: Commit**

```powershell
git add lib/voice-status.ts tests/voice-status.test.ts
git commit -m "feat: pure voice status line machine with 240s escalation"
```

---

### Task 3: VoiceStatus 组件 + 双页接线 + F4 后缀

**Files:**
- Create: `components/VoiceStatus.tsx`
- Modify: `app/page.tsx`（仪表盘）、`app/practice/[id]/page.tsx`（对话页）

**Interfaces:**
- Consumes: `GET /api/voice-status`、`lineStatus`
- Produces: `<VoiceStatus />` 双行组件；仪表盘置于统计卡行下方；对话页置于场景卡内 goals 区之后（与运行时 `ttsDown` 芯片**并存**——预热状态与请求失败不同源）

- [ ] **Step 1: 实现 components/VoiceStatus.tsx**

```tsx
"use client"

import { CheckCircle, CircleNotch, SpeakerSlash, Warning } from "@phosphor-icons/react"
import { useEffect, useRef, useState } from "react"
import { lineStatus } from "@/lib/voice-status"

type Probe = "ready" | "loading" | "offline" | "disabled"

const HINTS: Record<string, string> = {
  offline: "——双击启动器恢复，或查 logs/",
  error: "——建议停止后重启",
}

function Row({ name, probe, elapsed }: { name: string; probe: Probe; elapsed: number }) {
  const s = lineStatus(probe, elapsed)
  const hint = HINTS[s.level] ?? ""
  const icon =
    s.level === "ready" ? <CheckCircle size={16} weight="fill" aria-hidden="true" /> :
    s.level === "offline" || s.level === "error" ? (
      s.level === "error" ? <Warning size={16} weight="fill" aria-hidden="true" /> : <SpeakerSlash size={16} aria-hidden="true" />
    ) : <CircleNotch size={16} aria-hidden="true" />
  return (
    <div className={`row ${s.level === "ready" ? "goal-done" : "muted"}`}>
      {icon} {name}：{s.label}{hint}
    </div>
  )
}

export default function VoiceStatus() {
  const [probes, setProbes] = useState<{ stt: Probe; tts: Probe } | null>(null)
  const since = useRef<{ stt?: number; tts?: number }>({})
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let stopped = false
    const poll = async () => {
      try {
        const r = await fetch("/api/voice-status")
        if (!r.ok) return
        const j: { stt: Probe; tts: Probe } = await r.json()
        if (stopped) return
        setProbes(j)
        for (const k of ["stt", "tts"] as const) {
          if (j[k] === "loading" && !since.current[k]) since.current[k] = Date.now()
          if (j[k] !== "loading") since.current[k] = undefined
        }
        if (j.stt !== "loading" && j.tts !== "loading") {
          stopped = true
          return
        }
      } catch {
        if (!stopped && !probes) setProbes({ stt: "offline", tts: "offline" })
      }
    }
    const tick = setInterval(() => setNow(Date.now()), 10000)
    const timer = setInterval(poll, 10000)
    poll()
    return () => {
      stopped = true
      clearInterval(timer)
      clearInterval(tick)
    }
  }, [])

  if (!probes) return null
  const elapsed = (k: "stt" | "tts") =>
    since.current[k] ? Math.floor((now - since.current[k]!) / 1000) : 0
  return (
    <div aria-live="polite">
      <Row name="STT" probe={probes.stt} elapsed={elapsed("stt")} />
      <Row name="TTS" probe={probes.tts} elapsed={elapsed("tts")} />
    </div>
  )
}
```

- [ ] **Step 2: 仪表盘接线**（`app/page.tsx` 统计三卡行 `</div>` 之后、`<h3>最近练习</h3>` 之前插入）：

```tsx
      <div className="card">
        <VoiceStatus />
      </div>
```
（文件顶部 `import VoiceStatus from "@/components/VoiceStatus"`。）

- [ ] **Step 3: 对话页接线**（`app/practice/[id]/page.tsx` 场景卡内 `{ttsDown && …芯片}` 之前插入 `<VoiceStatus />`；同文件 F4 计时渲染处，`phase.label` 追加条件后缀：）

```tsx
            {phase.label}中… {((Date.now() - phase.since) / 1000).toFixed(0)}s
            {phase.label === "语音识别" && probesSttLoading ? "（模型预热中）" : null}
            {phase.label === "语音合成" && probesTtsLoading ? "（模型预热中）" : null}
```
（实现取径：本页引一个轻量 `useVoiceProbes()` 或直接 `fetch("/api/voice-status")` 单次+10s 轮询的本地 state，仅取布尔用于后缀；与 VoiceStatus 组件独立，避免耦合。以实现简洁为准，可抽 `useVoiceProbes` 到组件文件导出复用。）

- [ ] **Step 4: 验证**

Run: `npm test`（120）→ `npm run typecheck` → `npm run build`

手动验收（对照四条标准）：
1. 冷启动开页 → 双行"预热中·Xs"各自跳动（STT 通常先就绪）
2. 双就绪 → 变绿（**措辞修正 2026-10-18**：轮询在后台持续运行不停止——已知限制，Network 面板仍会见到 10s 间隔请求；UI 无变化）
3. **预热完成前**杀 tts-server → ≤10s TTS 行"离线"+恢复指引；**预热完成后**杀 → 界面冻结于"就绪"不再更新（已知限制，真实状态以 `npm run doctor` 为准）
4. 预热期说话 → F4 计时带"（模型预热中）"后缀

**已知缺陷注记（用户裁定 DO-NOT-FIX 2026-10-18，勘误清算）**：①`stopped` 闸门仅冻结状态更新，`setInterval` 未清理（仅卸载时清理）——轮询后台持续，验收 #2 已按实修正措辞；②闸门条件"both non-loading"≠"both ready"——首轮即全非 loading（含 offline）会永久冻结，恢复不可确认、预热完成后服务变化不可见——验收 #3 已限定成立条件；③双轮询：本页 VoiceStatus 组件与 `useVoiceProbes` 钩子并存（2 pollers/10s ≈ 4 上游探针），属有意取径（F4 后缀与双行显示解耦），成本可忽略，记录在案。

- [ ] **Step 5: Commit**

```powershell
git add components/VoiceStatus.tsx app/page.tsx "app/practice/[id]/page.tsx"
git commit -m "feat: dual-line voice warmup status on dashboard and practice"
```

---

### Task 4: 文档同步（设计侧）+ 门禁终验

**Files:** spec §6.1（预热状态节）/§8（两页行）；README 状态说明——**设计方落盘**，执行方仅跑门禁：

- [ ] **Step 1:**

```powershell
npm test
npm run typecheck
npm run build
```

Expected: **120 passed / 0 error / build 成功**（勘误清算：原写 119——执行序基线 113 而非 112）

- [ ] **Step 2: 收尾提交**

```powershell
git add -A
git commit -m "chore: voice-status complete"
```
