# SpeakLoop 自动停止竞态修复（勘误 2026-10-19）

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or executing-plans. Steps use checkbox syntax.

**Goal:** 修复心跳与离页宽限的周期竞态——根治"浏览器仍开着、服务却被看门狗杀掉"的反向不同步；并消除后台标签强化节流误杀。

**背景（2026-10-18 验收发现）：** tts-progress 验收中途全栈被自动停止（三服务 down、GPU 释放），导致「播放中/清除」无法观测。取证：`logs/start-all.log`、验收脚本 `scripts/acceptance-check.mjs` 10/13；翻译三项全过，失败项全部由中途停栈引起。

**根因分析（双缺陷）：**

1. **周期竞态**：`LEAVE_GRACE_MS = 5000` 与心跳间隔 `5000` **相等**。任一标签 pagehide → 离页信标 → 5s 后停栈；存活标签的下一次心跳恰在第 5s 到期——只要心跳稍晚（后台节流/主线程繁忙/相位擦边），宽限先到 → **浏览器还开着、服务被杀**（用户明令禁止的不同步，反向发生）
2. **后台节流误杀**：Chrome 对后台 >5 分钟标签强化节流（定时器约 1 次/分钟）→ 心跳间隔被拉至 ~60s > 现 idle 兜底 `12000` → 后台开着的标签也会被兜底杀栈

**Tech Stack:** 既有基线 **129 tests**（本修订不改测试数量，仅更新 1 处断言值）。

## Global Constraints

- 离页语义不变：正常关闭 → 信标 + **5s 宽限** → 停栈（"约 5 秒后自动停止"的承诺保持）
- 心跳 2s：5s 宽限窗口内至少可收 2 次心跳，竞态窗口消除
- idle 兜底 75s：> 强化节流 ~60s 周期 + 15s 余量；崩溃/强杀无信标时的最坏收尸时间 75-80s（可接受，文档注明）
- tick 与 intervalMs（看门狗检查节拍 5s）不变

---

### Task 1: 心跳间隔与兜底阈值修正

**Files:**
- Modify: `components/Heartbeat.tsx`（:12）
- Modify: `lib/auto-stop.ts`（:67）
- Test: `tests/auto-stop.test.ts`（:99-102 断言更新）

- [ ] **Step 1: 心跳间隔 5000 → 2000**

`components/Heartbeat.tsx`：

```tsx
    const id = setInterval(beat, 2000)
```

- [ ] **Step 2: idle 兜底默认 12000 → 75000**

`lib/auto-stop.ts`：

```ts
export function idleMsFromEnv(): number {
  const v = Number(process.env.AUTO_STOP_IDLE_MS)
  return Number.isFinite(v) && v >= 5000 ? v : 75000
}
```

- [ ] **Step 3: 测试断言同步**（`tests/auto-stop.test.ts`）

```ts
it("默认空闲兜底阈值 75s（>强化节流 60s 周期；崩溃收尸最坏 75-80s）", async () => {
  delete process.env.AUTO_STOP_IDLE_MS
  const { idleMsFromEnv } = await import("@/lib/auto-stop")
  expect(idleMsFromEnv()).toBe(75000)
})
```

- [ ] **Step 4: 全量门禁** — `npm test`（129，数量不变）/ typecheck 0 / build 绿

- [ ] **Step 5: Commit** — `git add components/Heartbeat.tsx lib/auto-stop.ts tests/auto-stop.test.ts` → `fix: auto-stop heartbeat race (2s beat, 75s idle backstop)`

---

### Task 2: 验收复跑

- [ ] **Step 1: 重启 server 挂载新构建**（杀 node → `start-all.ps1 -Silent -NoBrowser`）

- [ ] **Step 2: 行为回归（真实浏览器，Playwright 或手动）**

| # | 场景 | 期望 |
|---|---|---|
| 1 | 单个标签：关闭浏览器 | ~5s 后全栈停止（信标路径不变） |
| 2 | **双标签：关闭其中一个** | 栈**存活**（另一标签 2s 心跳在宽限内取消——本次修复的核心） |
| 3 | 刷新页面 | 栈存活 |
| 4 | 后台放置 >6 分钟再切回 | 栈存活（idle 75s > 节流 60s）——可选，耗时较长 |

- [ ] **Step 3: acceptance-check 复跑**

```powershell
node scripts/acceptance-check.mjs
```

Expected: **13/13 PASS**（翻译 5 项 + 朗读进度 3 项 + 回归 4 项 + 控制台 1 项）

- [ ] **Step 4: Commit**（如验收脚本有调整）— `git add -A` → `chore: acceptance re-run green`
