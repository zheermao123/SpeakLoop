# SpeakLoop TTS 反馈修复包实施计划（队列防死 + 朗读进度 + 失败可见）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** ①根治"点朗读没反应"缺陷类——播放队列被未结束的播放冻结后静默失效；②朗读按钮内联进度（合成中 Ns / 播放中），消除 ~10-19s 静默等待；③朗读失败（挂死/离线）可见反馈，不再无声。

**背景（2026-10-18 实机事件 + 诊断取证）：** 用户报告"点朗读没反应"；三服务健康、后端直连与转发均 200/字节完整（诊断脚本 `scripts/tts-debug*.mjs` 留存）；根因判定为**页面内 AudioQueue 链冻结**——`play()` 若永不 settle（播放未触发 ended/error），`chain` 阻塞，后续 enqueue 连 fetchAudio 都不执行 → 完全无反应。同类隐患：链一旦 rejection 传播同样永久静默。

**Architecture:** AudioQueue 加固（链终止 catch + 逐项挂死超时 race + 生命周期钩子 onSynthDone/onPlayStart/onSettle）；页面播放实现加 60s 挂死守卫与 `setTtsDown(true)` 反馈；`SpeakButton` 增 `status` 渲染，页面以 `speakStatus` 槽位驱动（点击起算"合成中 Ns"→ 播放开始切换"播放中"→ 结束清除）。

**Tech Stack:** 既有基线 **125 tests**（本包 +2 → 127；与 translation-fixes 计划并行时组合终态按执行序计）。

## Global Constraints

- 基线 125；本包 **+2**（T1 队列用例；T2/T3 纯 UI，build+手动验收）
- 每任务 `npm test` + `npm run typecheck` + `npm run build` 全绿
- 60s 挂死阈值双层：AudioQueue 层 race（通用兜底）+ 页面播放实现层守卫（含失败反馈）——同值常量 60000
- 失败反馈语义：挂死/离线 → `setTtsDown(true)`（既有"语音服务离线（文字模式）"芯片），不新增 UI 元素
- 进度秒数复用页面既有 tick 机制（F4 每 500ms 刷新），不新增定时器族
- 代码无注释；Phosphor/aria/44px 既有规则延续（状态文本 `aria-live="polite"`）

---

### Task 1: AudioQueue 防死加固（链必活 + 挂死兜底 + 生命周期钩子）

**Files:**
- Modify: `lib/audio-queue.ts`
- Test: `tests/audio-queue.test.ts`（+2；文件头 import 增 `vi`）

**Interfaces:**
- Produces: `enqueue(fetchAudio, opts?: { timeoutMs?: number; onSynthDone?: () => void; onPlayStart?: () => void; onSettle?: () => void }): void`——链尾 `.catch(() => undefined)` 保证永不死链；`Promise.race([play, 超时])` 保证单项挂死不冻结后续；钩子时序：fetch 成功 → onSynthDone → onPlayStart（调用 play 前）→ onSettle（settle 后，含超时与失败路径）

- [ ] **Step 1: 写失败测试**（`tests/audio-queue.test.ts` 追加）

```ts
it("播放挂死时超时兜底，链继续（防队列冻结）", async () => {
  vi.useFakeTimers()
  const played: number[] = []
  const q = new AudioQueue(buf => {
    const n = new Uint8Array(buf)[0]
    played.push(n)
    return n === 1 ? new Promise<void>(() => {}) : Promise.resolve()
  })
  q.enqueue(async () => ab(1), { timeoutMs: 5000 })
  q.enqueue(async () => ab(2))
  await vi.advanceTimersByTimeAsync(5000)
  await q.idle
  expect(played).toEqual([1, 2])
  vi.useRealTimers()
})

it("fetchAudio 同步抛错链不死（防静默失效）", async () => {
  const played: number[] = []
  const q = new AudioQueue(async buf => {
    played.push(new Uint8Array(buf)[0])
  })
  q.enqueue((() => {
    throw new Error("sync boom")
  }) as () => Promise<ArrayBuffer | null>)
  q.enqueue(async () => ab(7))
  await q.idle
  expect(played).toEqual([7])
})
```

- [ ] **Step 2: 运行确认失败** — `npx vitest run tests/audio-queue.test.ts`（第一条挂死用例超时失败）

- [ ] **Step 3: 实现**（`lib/audio-queue.ts` 整体替换）

```ts
export interface EnqueueHooks {
  timeoutMs?: number
  onSynthDone?: () => void
  onPlayStart?: () => void
  onSettle?: () => void
}

export class AudioQueue {
  private chain: Promise<void> = Promise.resolve()
  constructor(private readonly play: (buf: ArrayBuffer) => Promise<void>) {}

  enqueue(fetchAudio: () => Promise<ArrayBuffer | null>, opts?: EnqueueHooks): void {
    const timeoutMs = opts?.timeoutMs ?? 60000
    this.chain = this.chain
      .then(async () => {
        const buf = await fetchAudio().catch(() => null)
        if (!buf || buf.byteLength === 0) {
          opts?.onSettle?.()
          return
        }
        opts?.onSynthDone?.()
        let timer: ReturnType<typeof setTimeout> | null = null
        opts?.onPlayStart?.()
        await Promise.race([
          this.play(buf).catch(() => undefined),
          new Promise<void>(resolve => {
            timer = setTimeout(resolve, timeoutMs)
          }),
        ])
        if (timer) clearTimeout(timer)
        opts?.onSettle?.()
      })
      .catch(() => undefined)
  }

  get idle(): Promise<void> {
    return this.chain
  }
}
```

- [ ] **Step 4: 全量门禁** — `npm test` **127** / typecheck 0 / build 绿

- [ ] **Step 5: Commit** — `git add lib/audio-queue.ts tests/audio-queue.test.ts` → `fix: harden audio queue against dead chain and hung playback`

---

### Task 2: 页面播放挂死守卫（失败可见）

**Files:**
- Modify: `app/practice/[id]/page.tsx`（`queue()` 的播放实现一处）

**Interfaces:**
- Produces: 播放实现内 60s 守卫——超时未 settle → `setTtsDown(true)` + resolve（链继续）；防"播放无声挂死"静默

- [ ] **Step 1: 替换播放实现**（`audioQueue.current = new AudioQueue(async buf => {` 整块内 Promise 体替换为）

```tsx
        await new Promise<void>(resolve => {
          const a = new Audio(URL.createObjectURL(new Blob([buf], { type: "audio/wav" })))
          let guard: ReturnType<typeof setTimeout> | null = null
          const settle = () => {
            if (guard) clearTimeout(guard)
            resolve()
          }
          guard = setTimeout(() => {
            setTtsDown(true)
            settle()
          }, 60000)
          a.onended = () => {
            URL.revokeObjectURL(a.src)
            setTtsDown(false)
            settle()
          }
          a.onerror = () => settle()
          a.play().catch(() => {
            setTtsDown(true)
            settle()
          })
        })
```

- [ ] **Step 2: 验证** — `npm test`（127 不变）/ typecheck / build

- [ ] **Step 3: Commit** — `git add "app/practice/[id]/page.tsx"` → `fix: playback stall guard with offline feedback`

---

### Task 3: 朗读进度（合成中 Ns / 播放中）

**Files:**
- Modify: `components/SpeakButton.tsx`、`app/practice/[id]/page.tsx`（状态槽 + 三处朗读点接线）

**Interfaces:**
- Produces: `SpeakButton` 新增可选 `status?: { phase: "synth" | "play"; seconds: number } | null`（渲染于按钮旁：synth → `合成中 Ns`、play → `播放中`，`aria-live="polite"`）；页面 `speakStatus` 槽 + `speakNow(key, text)` 助手；persona/goals/气泡三处 `onSpeak` 改走 `speakNow`（key 分别 `"persona"`、`` `goal-${i}` ``、`` `bubble-${i}` ``）

- [ ] **Step 1: SpeakButton 扩展**

```tsx
"use client"

import { SpeakerHigh } from "@phosphor-icons/react"

export default function SpeakButton({
  onSpeak,
  label,
  disabled,
  status,
}: {
  onSpeak: () => void
  label?: string
  disabled?: boolean
  status?: { phase: "synth" | "play"; seconds: number } | null
}) {
  return (
    <span className="row" style={{ gap: "var(--space-1)" }}>
      <button type="button" className="icon-btn" onClick={onSpeak} disabled={disabled} aria-label={label ?? "朗读"}>
        <SpeakerHigh size={16} aria-hidden="true" />
      </button>
      <span className="muted" aria-live="polite" style={{ fontSize: 12 }}>
        {status?.phase === "synth" ? `合成中 ${status.seconds}s` : status?.phase === "play" ? "播放中" : ""}
      </span>
    </span>
  )
}
```

- [ ] **Step 2: 页面接线**

① 状态与助手（`zhMap` 声明附近）：

```tsx
  const [speakStatus, setSpeakStatus] = useState<{ key: string; phase: "synth" | "play"; since: number } | null>(null)

  function speakNow(key: string, text: string) {
    setSpeakStatus({ key, phase: "synth", since: Date.now() })
    queue().enqueue(() => postTts(text), {
      onSynthDone: () =>
        setSpeakStatus(prev => (prev && prev.key === key && prev.phase === "synth" ? { key, phase: "play", since: Date.now() } : prev)),
      onSettle: () => setSpeakStatus(prev => (prev && prev.key === key ? null : prev)),
    })
  }

  function speakStatusOf(key: string): { phase: "synth" | "play"; seconds: number } | null {
    if (!speakStatus || speakStatus.key !== key) return null
    return { phase: speakStatus.phase, seconds: Math.floor((Date.now() - speakStatus.since) / 1000) }
  }
```

② tick 生效范围扩展（既有 F4 effect 依赖从 `[phase]` 改为 `[phase, speakStatus]`，条件为 `!phase && !(speakStatus && speakStatus.phase === "synth")` 时直接 return）

③ 三处朗读点替换：

```tsx
<SpeakButton onSpeak={() => speakNow("persona", scenario.persona)} label="朗读角色设定" status={speakStatusOf("persona")} />
```

```tsx
<SpeakButton onSpeak={() => speakNow(`goal-${i}`, g)} label={`朗读目标 ${i}`} status={speakStatusOf(`goal-${i}`)} />
```

```tsx
<SpeakButton onSpeak={() => speakNow(`bubble-${i}`, b.text)} label="朗读本句" disabled={speakingNow} status={speakStatusOf(`bubble-${i}`)} />
```

（`persistTurn` 重试补播处保持原 `queue().enqueue(() => postTts(turn.aiText))` 不加进度。）

- [ ] **Step 3: 验证**

Run: `npm test`（127）/ typecheck / build

手动验收：
1. 点任意朗读 → 按钮旁出现 `合成中 Ns` 递增 → 转 `播放中` → 播完消失
2. 连点同元素/不同元素 → 队列滚动显示当前处理项；挂死场景（可选模拟）→ 60s 后芯片亮起、队列放行
3. 语音服务停机时点朗读 → 芯片"语音服务离线（文字模式）"，无静默
4. 刷新后回归：全部朗读点工作；conversation 主流程（F4"语音合成中"）不受影响

- [ ] **Step 4: Commit** — `git add components/SpeakButton.tsx "app/practice/[id]/page.tsx"` → `feat: inline speak progress (synth timer and playing state)`

---

### Task 4: 门禁终验

- [ ] **Step 1:**

```powershell
npm test
npm run typecheck
npm run build
```

Expected: **127 passed / 0 error / build 成功**

- [ ] **Step 2: 收尾提交**

```powershell
git add -A
git commit -m "chore: tts feedback fixes complete"
```
