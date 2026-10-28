# SpeakLoop Workbench UI v3.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全站以 "Workbench" 桌面工作台视觉（spec: `docs/superpowers/specs/2026-10-27-speakloop-workbench-ui-design.md`）取代 iOS HIG：新 token + 左侧栏壳 + 仪表盘重构 + 五页换肤，练习页布局红线保留。

**Architecture:** CSS 变量层全量重写但**保留全部既有类名**（card/bubble/goal-*/zh-line 等被脚本与页面引用），仅新增侧栏与仪表盘类；壳从顶部 titlebar 迁移为 ExeTitlebar(拖拽条) + Sidebar；六页中 dashboard/vocab/scenarios/report 改 JSX，practice/settings 仅吃新 CSS。

**Tech Stack:** Next.js 15 App Router、React 19、@phosphor-icons/react、framer-motion（已有依赖）、手写 CSS 变量、Vitest。

## Global Constraints

- Node ≥ 20；PowerShell 5.1 环境——**含中文的文件一律用 Write/Edit 工具**，禁 shell heredoc；git commit message 用 ASCII。
- **docs/ 受控**：执行方只允许改 `app/`、`components/`、`lib/`、`scripts/browser-check.mjs`（一处断言）与 `.superpowers/sdd/progress.md`；禁改 `docs/**`。
- 生产零 Mock；语音相关红线不回退：录音键红色静态（F1）、悬停翻译 JS 瞬时 `zhShown`（F3，禁 `:hover` 实现）、TTS 队列/进度/挂死守卫（T1-T3）、心跳 2s/兜底 75s。
- **测试契约（E2E 脚本选择器，改动须同一提交同步）**：`scripts/browser-check.mjs` 依赖 `.stat`（Task 3 改为 `.briefing`）、`.card.row`、`button` 文本「开始练习/听不懂/提示/结束练习」、`input[placeholder*='键盘']`、`.bubble-ai`、`.bubble-coach`、`.goal-row.done`；`scripts/acceptance-check.mjs` 依赖 `.zh-line`、`[role="listitem"]`、`button[aria-label="朗读目标 0"]`；`scripts/console-check.mjs` 遍历 `/`、`/scenarios`、`/settings`、`/vocab` 且 body 不得含 "Application error"。Vitest 133 项不断言类名，须保持全绿。
- **颜色红线（spec §7.3）**：`app/`、`components/` 的 TSX 内联样式不得出现 `var(--ios-*)` 或 iOS 旧色值；`#007AFF` 仅允许存在于 globals.css 的 `--tint` 与 `.vocab-status-pill.new`。四场景磁贴色重映射为：interview `#5B5BD6`、standup `#FFB300`、oneonone `#34C759`、smalltalk `#FF7847`（对 spec §4.1 "复用现有四场景色" 的修订，设计侧已备案）。
- 数据驱动文案：Report/Session **无分数字段**——简报卡与动态流不出现"得分"，用纠错数/轮次（对 spec §4.1 的修订，已备案）。
- 每个任务收尾命令：`npm test`（133 全绿）、`npm run typecheck`（0 错误）、`npm run build`（成功）。视觉验收另跑 console-check（需 `npm run dev` 运行中）。

---

### Task 1: globals.css v3.0 全量重写（token + 组件类换肤）

**Files:**
- Modify: `app/globals.css`（整文件替换，922 行 → 新版）

**Interfaces:**
- Consumes: 无
- Produces: 新 CSS 变量（`--brand-grad`、`--indigo`、`--amber`、`--orange`、`--green`、`--red`、`--warn` 等）+ 全部既有类名（换肤）+ 新类（`app-shell`/`sidebar`/`nav-item`/`voice-capsule`/`hero-greet`/`briefing*`/`dash-grid`/`feed-*`/`day-head`/`right-col`/`sc-grid`/`sc-tile`/`tile`/`group-head`/`check`/`corr-*`/`summary-hero`/`pill-indigo`/`btn-ghost-danger`/`briefing-link`）。Task 2-6 的 JSX 直接消费这些类名。

- [ ] **Step 1: 用 Write 工具整文件替换 `app/globals.css` 为下述内容**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ==========================================================================
   SpeakLoop — Workbench Design System (v3.0)
   Light mode · Sidebar shell · Amber briefing · Colored tiles
   （iOS HIG v2.0 已退役；类名契约保持，仅换肤）
   ========================================================================== */

:root {
  color-scheme: light;

  /* Workbench palette */
  --bg-grouped: #f5f5f7;
  --bg-card: #ffffff;
  --label: #1d1d1f;
  --label-2: #86868b;
  --label-3: rgba(60, 60, 67, 0.3);
  --tint: #007aff; /* 链接/焦点环保留蓝 */

  --amber: #ffb300;
  --orange: #ff7847;
  --indigo: #5b5bd6;
  --green: #34c759;
  --blue: #007aff;
  --red: #ff3b30;
  --warn: #ff9500;

  --brand-grad: linear-gradient(135deg, #ffb800, #ff9500);

  --fill-1: rgba(120, 120, 128, 0.2);
  --fill-2: rgba(120, 120, 128, 0.16);
  --fill-3: rgba(120, 120, 128, 0.12);
  --fill-4: rgba(120, 120, 128, 0.08);
  --bg-inset: rgba(120, 120, 128, 0.1);

  --separator: rgba(60, 60, 67, 0.36);
  --separator-soft: rgba(60, 60, 67, 0.12);

  --material-nav: rgba(255, 255, 255, 0.72);
  --material-dock: rgba(255, 255, 255, 0.85);
  --material-popover: rgba(255, 255, 255, 0.9);
  --material-blur: saturate(180%) blur(20px);

  --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.04), 0 8px 24px rgba(0, 0, 0, 0.05);
  --shadow-hero: 0 12px 32px rgba(255, 169, 0, 0.22);
  --shadow-dock: 0 -1px 0 var(--separator-soft), 0 -4px 20px rgba(0, 0, 0, 0.04);

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-pill: 999px;

  --s1: 4px;
  --s2: 8px;
  --s3: 12px;
  --s4: 16px;
  --s5: 20px;
  --s6: 24px;
  --s8: 32px;

  --font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif;

  --h-control: 44px;
  --h-nav: 56px;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: var(--font);
  font-size: 16px;
  line-height: 1.47;
  color: var(--label);
  background: var(--bg-grouped);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

html.electron body { background: rgba(245, 245, 247, 0.72); }

h1, h2, h3 { font-weight: 700; letter-spacing: -0.02em; }

a { color: var(--tint); }

:focus { outline: none; }
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.35);
  border-radius: var(--radius-sm);
}

::selection { background: rgba(0, 122, 255, 0.2); }

* { scrollbar-width: thin; scrollbar-color: var(--fill-1) transparent; }
*::-webkit-scrollbar { width: 6px; height: 6px; }
*::-webkit-scrollbar-track { background: transparent; }
*::-webkit-scrollbar-thumb { background: var(--fill-1); border-radius: 3px; }
*::-webkit-scrollbar-thumb:hover { background: var(--fill-2); }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
}

/* ── App Shell（侧栏 + 内容） ─────────────────────────────────────────────── */

.app-shell { display: flex; align-items: stretch; min-height: 100vh; }

.sidebar {
  width: 232px;
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px 12px;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}
html.electron .sidebar { top: var(--h-nav); height: calc(100vh - var(--h-nav)); }

.sidebar-logo { display: flex; align-items: center; gap: 10px; padding: 6px 10px 18px; }
.sidebar-logo .mark {
  width: 32px; height: 32px; border-radius: 9px;
  background: var(--brand-grad); color: #fff;
  font-weight: 800; font-size: 17px;
  display: grid; place-items: center;
  box-shadow: 0 4px 12px rgba(255, 169, 0, 0.35);
}
.sidebar-logo .name { font-weight: 700; font-size: 15px; letter-spacing: -0.01em; }

.nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 10px; border-radius: 10px;
  font-size: 14px; font-weight: 500; font-family: var(--font);
  color: var(--label); cursor: pointer;
  border: none; background: none; width: 100%; text-align: left;
  text-decoration: none;
  transition: background 150ms ease;
}
.nav-item:hover { background: rgba(0, 0, 0, 0.03); }
.nav-item.active { background: rgba(0, 0, 0, 0.05); font-weight: 600; }
.nav-item .ic { color: var(--label-2); flex: none; }
.nav-item.active .ic { color: var(--label); }
.nav-item .badge {
  margin-left: auto; min-width: 20px; height: 20px; padding: 0 6px;
  border-radius: var(--radius-pill);
  background: rgba(0, 0, 0, 0.06); color: var(--label-2);
  font-size: 11px; font-weight: 600;
  display: grid; place-items: center;
}

.side-spacer { flex: 1; }

.voice-capsule {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 12px; border-radius: var(--radius-md);
  border: none; font-family: var(--font);
  font-size: 13px; font-weight: 600; cursor: pointer;
  width: 100%;
}
.voice-capsule .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.voice-capsule.state-ready { background: rgba(52, 199, 89, 0.12); color: #1f7a3d; }
.voice-capsule.state-ready .dot { background: var(--green); }
.voice-capsule.state-loading { background: rgba(255, 149, 0, 0.14); color: #a85b00; }
.voice-capsule.state-loading .dot { background: var(--warn); }
.voice-capsule.state-offline { background: rgba(255, 59, 48, 0.1); color: #d70015; }
.voice-capsule.state-offline .dot { background: var(--red); }

/* ── 内容列 ──────────────────────────────────────────────────────────────── */

.container {
  flex: 1;
  min-width: 0;
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--s6) var(--s8) 64px;
}

/* ── Electron 拖拽标题条（仅窗口按钮，导航已入侧栏） ──────────────────────── */

.exe-titlebar {
  position: sticky;
  top: 0;
  z-index: 100;
  height: var(--h-nav);
  -webkit-app-region: drag;
  background: transparent;
  display: flex;
  align-items: center;
  padding: 0 12px;
}

.no-drag { -webkit-app-region: no-drag; }

.window-traffic-lights { display: flex; gap: 8px; }

.traffic-dot {
  width: 44px; height: 44px;
  display: grid; place-items: center;
  background: transparent; border: 0;
  position: relative; cursor: pointer;
}
.traffic-dot::before {
  content: "";
  width: 12px; height: 12px; border-radius: 50%;
  background: #febc2e;
}
.traffic-dot-close::before { background: #ff5f57; }
.traffic-dot-min::before { background: #febc2e; }
.traffic-dot-max::before { background: #28c840; }

/* ── Cards ──────────────────────────────────────────────────────────────── */

.card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  padding: var(--s4);
  margin-bottom: var(--s3);
}

.card-section-title {
  font-size: 13px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--label-2);
  margin: 0 0 var(--s3);
  display: flex; align-items: center; justify-content: space-between;
}
.card-section-title .dot {
  width: 7px; height: 7px; border-radius: 50%;
  display: inline-block; margin-right: 5px;
}

/* ── Buttons ────────────────────────────────────────────────────────────── */

.btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: var(--s2);
  min-height: 44px; padding: 0 var(--s5);
  border: none; border-radius: var(--radius-md);
  background: var(--brand-grad);
  color: #ffffff;
  font-family: var(--font); font-size: 16px; font-weight: 600;
  cursor: pointer; text-decoration: none;
  transition: opacity 150ms ease, transform 150ms ease, filter 150ms ease;
  -webkit-tap-highlight-color: transparent;
}
.btn:hover { filter: brightness(1.05); }
.btn:active { opacity: 0.7; transform: scale(0.98); }
.btn:disabled { opacity: 0.35; cursor: not-allowed; transform: none; filter: none; }

.btn-secondary { background: var(--fill-1); color: var(--label); }
.btn-secondary:active { background: var(--fill-2); }
.btn-secondary:hover { filter: none; }

.btn-plain { background: transparent; color: var(--tint); padding: 0 var(--s2); }
.btn-plain:hover { opacity: 0.7; filter: none; }

.btn-danger { background: var(--red); color: #ffffff; }
.btn-danger:active { background: #e0332a; }

.btn-ghost-danger { background: transparent; color: var(--red); }
.btn-ghost-danger:active { background: rgba(255, 59, 48, 0.08); }

/* ── Inputs ─────────────────────────────────────────────────────────────── */

.input, textarea.input, select.input {
  width: 100%;
  min-height: 44px;
  padding: var(--s2) var(--s3);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: var(--radius-md);
  font-family: var(--font);
  font-size: 16px;
  background: var(--bg-card);
  color: var(--label);
  transition: box-shadow 150ms ease;
}
.input:focus, textarea.input:focus, select.input:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--tint);
}
textarea.input { min-height: 72px; resize: vertical; }

label.field {
  display: block;
  font-size: 13px; font-weight: 600;
  color: var(--label-2);
  margin: var(--s3) 0 var(--s1);
}

/* ── Bubbles（形状红线：18px + 6px 尾角） ────────────────────────────────── */

.bubble {
  max-width: 82%;
  padding: var(--s2) var(--s3);
  border-radius: 18px;
  margin: var(--s1) 0;
  font-size: 16px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}
.bubble-user {
  background: var(--indigo);
  color: #ffffff;
  margin-left: auto;
  border-bottom-right-radius: 6px;
}
.bubble-ai {
  background: var(--bg-card);
  color: var(--label);
  margin-right: auto;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-bottom-left-radius: 6px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}
.bubble-coach {
  background: #fff8e1;
  border: 1px solid #ffe082;
  color: #8a6100;
  font-size: 14px;
  max-width: 92%;
  border-bottom-left-radius: 6px;
}

.bubble-actions { display: flex; align-items: center; gap: var(--s2); margin-top: var(--s1); }

/* ── Lists ──────────────────────────────────────────────────────────────── */

.list-group { background: var(--bg-card); border-radius: var(--radius-lg); overflow: hidden; }
.list-group + .list-group { margin-top: var(--s3); }

.list-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: var(--s3);
  padding: var(--s3) var(--s4);
  min-height: 44px;
  transition: background 120ms ease;
  cursor: pointer;
}
.list-row:active { background: var(--fill-3); }
.list-row + .list-row { border-top: 0.5px solid var(--separator-soft); }

.ios-grouped-list { background: var(--bg-card); border-radius: var(--radius-lg); overflow: hidden; }
.ios-grouped-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; padding: 12px 16px; min-height: 44px;
  position: relative; transition: background 120ms ease;
}
.ios-grouped-row:hover { background: var(--fill-4); }
.ios-grouped-row::after {
  content: ""; position: absolute; left: 20px; right: 0; bottom: 0;
  height: 1px; background: var(--separator-soft);
}
.ios-grouped-row:last-child::after { display: none; }

/* ── Pills & Chips ──────────────────────────────────────────────────────── */

.pill {
  display: inline-flex; align-items: center; gap: var(--s1);
  padding: 3px var(--s3);
  border-radius: var(--radius-pill);
  font-size: 12px; font-weight: 500; line-height: 1.4;
}
.pill-gray { background: var(--fill-1); color: var(--label-2); }
.pill-blue { background: rgba(0, 122, 255, 0.12); color: var(--blue); }
.pill-green { background: rgba(52, 199, 89, 0.14); color: #1f7a3d; }
.pill-orange { background: rgba(255, 149, 0, 0.14); color: #c46a00; }
.pill-red { background: rgba(255, 59, 48, 0.1); color: #d70015; }
.pill-indigo { background: rgba(91, 91, 214, 0.12); color: var(--indigo); }

.chip {
  display: inline-flex; align-items: center;
  padding: 2px var(--s2);
  border-radius: var(--radius-pill);
  font-size: 12px; font-weight: 500;
  background: var(--fill-1); color: var(--label-2);
}

.vocab-status-pill {
  display: inline-flex; align-items: center;
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  border: 0;
  font-size: 12px; font-weight: 500;
  font-family: var(--font);
  cursor: pointer;
}
.vocab-status-pill.new { background: rgba(0, 122, 255, 0.12); color: #007aff; }
.vocab-status-pill.learning { background: rgba(255, 149, 0, 0.14); color: #c46a00; }
.vocab-status-pill.mastered { background: rgba(52, 199, 89, 0.14); color: #1f7a3d; }
.vocab-status-pill.ignored { background: var(--fill-1); color: var(--label-2); }

.status-select-new { color: var(--blue); }
.status-select-learning { color: var(--warn); }
.status-select-mastered { color: var(--green); }
.status-select-ignored { color: var(--label-3); }

.pos-chip {
  display: inline;
  font-size: 11px; font-weight: 600;
  color: var(--tint);
  background: rgba(0, 122, 255, 0.08);
  padding: 1px 6px; border-radius: 4px;
  margin-right: var(--s1);
}

/* ── Stats & Section Headers ────────────────────────────────────────────── */

.stat { font-size: 32px; font-weight: 700; letter-spacing: -0.02em; color: var(--label); font-variant-numeric: tabular-nums; }
.stat-accent { color: var(--tint); }
.stat-number { font-size: 34px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; font-variant-numeric: tabular-nums; }
.stat-unit { font-size: 14px; font-weight: 500; color: var(--label-2); }

.section-header { display: flex; align-items: center; justify-content: space-between; padding: var(--s2) var(--s1); margin-bottom: var(--s2); }
.section-header h3 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }

/* ── Utility ────────────────────────────────────────────────────────────── */

.row { display: flex; align-items: center; gap: var(--s2); }
.mt-1 { margin-top: var(--s1); }
.mt-2 { margin-top: var(--s2); }
.mt-3 { margin-top: var(--s4); }
.muted { color: var(--label-2); font-size: 13px; }
.mono { font-variant-numeric: tabular-nums; }
.grow { flex: 1; min-width: 0; }
.divider { height: 0.5px; background: var(--separator-soft); margin: 0 var(--s4); }
.empty-state { text-align: center; padding: var(--s8) var(--s4); color: var(--label-2); }
.req { color: var(--red); margin-left: 2px; }

/* ── 仪表盘（Workbench 新增） ────────────────────────────────────────────── */

.hero-greet {
  font-size: 28px; font-weight: 700; letter-spacing: -0.02em;
  margin: 0 0 var(--s5);
  display: flex; align-items: center; gap: 10px;
}

.briefing {
  background: var(--brand-grad);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-hero);
  padding: var(--s6);
  color: #ffffff;
  margin-bottom: var(--s6);
}
.briefing .date-row {
  display: flex; align-items: center; gap: 8px;
  font-weight: 700; font-size: 15px;
  margin-bottom: var(--s3);
}
.briefing .rich {
  font-size: 22px; line-height: 1.5;
  color: rgba(255, 255, 255, 0.94);
  max-width: 720px;
  margin: 0;
}
.briefing .rich b { font-weight: 700; color: #ffffff; }
.briefing-link {
  color: #ffffff; font-weight: 700;
  text-decoration: underline; text-underline-offset: 4px;
}
.briefing .insights {
  margin-top: var(--s5);
  padding-top: var(--s4);
  border-top: 1px solid rgba(255, 255, 255, 0.35);
  display: flex; align-items: center; gap: 10px;
  font-size: 14px;
}
.briefing .insights .tip { font-weight: 500; }
.briefing .nav-arrows { margin-left: auto; display: flex; align-items: center; gap: 10px; }
.briefing .nav-arrows button {
  background: none; border: none; color: #fff; cursor: pointer;
  display: grid; place-items: center;
  width: 24px; height: 24px; border-radius: 6px;
}
.briefing .nav-arrows button:hover { background: rgba(255, 255, 255, 0.2); }
.briefing .dots { display: flex; gap: 4px; }
.briefing .dots i { width: 5px; height: 5px; border-radius: 50%; background: rgba(255, 255, 255, 0.45); }
.briefing .dots i.on { background: #ffffff; }

.dash-grid { display: grid; grid-template-columns: 2fr 1fr; gap: var(--s6); align-items: start; }

.day-head {
  display: flex; align-items: center; gap: 10px;
  margin: var(--s4) 0 var(--s1);
  font-size: 13px; color: var(--label-2);
}
.day-head::after { content: ""; flex: 1; height: 1px; background: var(--separator-soft); }

.feed-row {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 4px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  text-decoration: none; color: inherit;
}
.feed-row:last-child { border-bottom: none; }
.feed-rich { flex: 1; min-width: 0; font-size: 15px; line-height: 1.45; }
.feed-time { flex: none; font-size: 13px; color: var(--label-2); }

.right-col { display: flex; flex-direction: column; gap: var(--s6); }

.tile {
  width: 40px; height: 40px; border-radius: var(--radius-md);
  flex: none; display: grid; place-items: center; color: #ffffff;
}
.tile-sm { width: 34px; height: 34px; }

.vocab-row {
  display: flex; align-items: center; gap: 10px;
  padding: 11px 2px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}
.vocab-row:last-child { border-bottom: none; }
.vocab-main { flex: 1; min-width: 0; }
.vocab-row .w { font-weight: 700; font-size: 15px; }
.vocab-row .ph { font-size: 13px; color: var(--label-2); }

.group-head { display: flex; align-items: center; gap: 8px; margin: var(--s5) 0 var(--s1); font-size: 16px; font-weight: 700; }
.group-head:first-child { margin-top: 0; }
.group-head .cnt {
  min-width: 22px; height: 22px; padding: 0 7px;
  border-radius: var(--radius-pill);
  background: rgba(0, 0, 0, 0.06);
  font-size: 12px; font-weight: 600; color: var(--label-2);
  display: grid; place-items: center;
}

.check {
  width: 22px; height: 22px; border-radius: 50%;
  border: 2px solid rgba(0, 0, 0, 0.15);
  flex: none; display: grid; place-items: center;
  color: transparent; cursor: pointer;
  background: transparent; padding: 0;
}
.check.done { background: var(--green); border-color: var(--green); color: #ffffff; }

.sc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.sc-tile {
  display: flex; align-items: center; gap: 12px;
  padding: 12px; border-radius: var(--radius-md);
  cursor: pointer; border: 1px solid rgba(0, 0, 0, 0.05);
  background: var(--bg-card);
  text-decoration: none; color: inherit;
  transition: box-shadow 150ms ease;
}
.sc-tile:hover { box-shadow: var(--shadow-card); }
.sc-tile .nm { font-weight: 600; font-size: 14px; }
.sc-tile .ic-chev { margin-left: auto; color: var(--label-2); flex: none; }

/* ── 场景页 ──────────────────────────────────────────────────────────────── */

.sc-row { padding: 18px 20px; }
.sc-row .desc { font-size: 13px; color: var(--label-2); margin-top: 3px; }

/* ── 报告页 ──────────────────────────────────────────────────────────────── */

.summary-hero {
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-card);
  background: var(--bg-card);
  padding: var(--s5) var(--s6);
  position: relative;
  overflow: hidden;
  margin-bottom: var(--s3);
}
.summary-hero::before {
  content: "";
  position: absolute; top: 0; left: 0; right: 0; height: 6px;
  background: var(--brand-grad);
}
.corr-row {
  display: flex; align-items: flex-start; gap: 14px;
  padding: var(--s4) 4px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}
.corr-row:last-child { border-bottom: none; }
.corr-main { flex: 1; min-width: 0; }
.corr-wrong { font-size: 15px; color: var(--label-2); }
.corr-right { font-size: 15px; font-weight: 700; margin-top: 3px; }

/* ── 练习页（布局红线：仅换肤） ──────────────────────────────────────────── */

.practice-grid {
  display: grid;
  grid-template-columns: 310px 1fr;
  gap: var(--s4);
  align-items: start;
}
.practice-left-col { position: sticky; top: calc(var(--h-nav) + var(--s3)); display: flex; flex-direction: column; gap: var(--s3); }
.practice-right-col { display: flex; flex-direction: column; gap: var(--s3); min-height: calc(100vh - 160px); }
.practice-right-col .bubble-stream { flex: 1; }
.bubble-stream { display: flex; flex-direction: column; gap: var(--s3); min-height: 320px; padding-bottom: var(--s3); }

.phase-timer-bar {
  align-self: center;
  background: var(--fill-2);
  border-radius: var(--radius-pill);
  padding: 5px var(--s4);
  font-size: 12px;
  color: var(--label-2);
  font-variant-numeric: tabular-nums;
}

.practice-dock {
  position: sticky;
  bottom: var(--s3);
  background: var(--material-dock);
  -webkit-backdrop-filter: var(--material-blur);
  backdrop-filter: var(--material-blur);
  border-radius: var(--radius-lg);
  padding: var(--s3) var(--s4);
  box-shadow: var(--shadow-dock);
  display: flex;
  flex-direction: column;
  gap: var(--s2);
}
.dock-assist-row { display: flex; align-items: center; justify-content: space-between; }
.dock-input-row { display: flex; align-items: center; gap: var(--s2); }

.goal-list { display: flex; flex-direction: column; gap: var(--s2); margin-top: var(--s2); }
.goal-row {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: var(--s2);
  font-size: 14px;
  padding: var(--s2);
  border-radius: var(--radius-sm);
  transition: background 120ms ease;
}
.goal-checkbox {
  width: 20px; height: 20px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  border: 1.5px solid var(--label-3);
  font-size: 11px;
  color: transparent;
  margin-top: 1px;
}
.goal-row.done .goal-checkbox { background: var(--green); border-color: var(--green); color: #ffffff; }
.goal-main { flex: 1; min-width: 0; line-height: 1.5; }
.goal-done { color: var(--green); }
.goal-done .goal-index { opacity: 0.5; }
.goal-check { display: flex; align-items: center; gap: var(--s2); font-size: 15px; color: var(--label); padding: var(--s2) 0; }
.goal-check.done-text { color: var(--green); font-weight: 500; }

.ios-input {
  flex: 1;
  min-height: 44px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: var(--radius-md);
  padding: 0 12px;
  font-size: 15px;
  font-family: var(--font);
  background: var(--bg-card);
  color: var(--label);
}

.record-btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: var(--s2);
  min-height: 44px; padding: 0 var(--s4);
  border: none; border-radius: var(--radius-pill);
  background: var(--indigo);
  color: #ffffff;
  font-family: var(--font); font-size: 15px; font-weight: 600;
  cursor: pointer;
  transition: background 150ms ease, transform 100ms ease;
}
.record-btn:active { transform: scale(0.96); }
/* F1 红线：录音态红色、静态、无脉冲动画 */
.record-btn.is-recording { background: var(--red); }

.speak-progress {
  font-size: 12px;
  color: var(--label-2);
  font-variant-numeric: tabular-nums;
  margin-left: var(--s1);
}

.zh-line {
  font-size: 13px;
  color: var(--label-2);
  border-top: 1px dashed var(--separator-soft);
  margin-top: 6px;
  padding-top: 6px;
}
.zh-label { font-size: 12px; color: var(--label-2); margin-right: 8px; }

.word-chip { cursor: pointer; border-radius: 3px; transition: background 120ms ease; }
.word-chip:hover { background: rgba(0, 122, 255, 0.06); }
.word-chip.active { background: rgba(0, 122, 255, 0.1); }

/* ── 图标与弹层 ──────────────────────────────────────────────────────────── */

.icon-tile {
  width: 36px; height: 36px; border-radius: var(--radius-md);
  display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

.icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: var(--s1);
  min-width: 44px; min-height: 44px;
  padding: 0 var(--s2);
  border: none; border-radius: var(--radius-md);
  background: transparent;
  color: var(--label-2);
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}
.icon-btn:hover { background: var(--fill-2); color: var(--label); }
.icon-btn:active { background: var(--fill-1); }
.icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }

.icon-inline {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px;
  border: none; border-radius: 50%;
  background: transparent; cursor: pointer;
  color: var(--label-2);
  transition: background 120ms ease, color 120ms ease;
}
.icon-inline:hover { background: var(--fill-2); color: var(--label); }
.icon-inline:disabled { opacity: 0.3; cursor: not-allowed; }

.popover, .dict-popover-card {
  position: fixed;
  z-index: 300;
  background: var(--material-popover);
  -webkit-backdrop-filter: var(--material-blur);
  backdrop-filter: var(--material-blur);
  border: 0.5px solid var(--separator);
  border-radius: var(--radius-lg);
  box-shadow: 0 10px 34px rgba(0, 0, 0, 0.14), 0 0 0 0.5px rgba(0, 0, 0, 0.06);
  padding: var(--s3) var(--s4);
}

/* ── 报告/生词文本 ──────────────────────────────────────────────────────── */

.vocab-word { font-size: 17px; font-weight: 600; color: var(--label); }
.vocab-meaning { font-size: 14px; color: var(--label-2); margin-top: 2px; }
.vocab-meta { font-size: 12px; color: var(--label-3); margin-top: var(--s1); }
.phonetic { font-size: 15px; color: var(--label-2); font-style: italic; }
.example-text { font-size: 14px; color: var(--label-2); font-style: italic; margin-top: var(--s1); }

/* ── 语音状态横幅（页面内联态，VoiceBanner 用） ──────────────────────────── */

.voice-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
.voice-dot-ready { background: var(--green); }
.voice-dot-offline { background: var(--red); }

.voice-status-banner {
  background: rgba(255, 149, 0, 0.12);
  color: #a85b00;
  border-radius: var(--radius-md);
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  margin-bottom: var(--s4);
}

.alert-banner {
  display: flex; align-items: center;
  gap: var(--s3);
  padding: var(--s3) var(--s4);
  border-radius: var(--radius-md);
  font-size: 14px;
  margin-bottom: var(--s3);
}
.alert-amber { background: #fff8e1; border: none; color: #8a6100; }
.alert-red { background: rgba(255, 59, 48, 0.08); color: #d70015; }

/* ── Toast ──────────────────────────────────────────────────────────────── */

.toast {
  position: fixed;
  bottom: var(--s8);
  left: 50%;
  transform: translateX(-50%);
  background: var(--label);
  color: var(--bg-card);
  font-size: 13px; font-weight: 500;
  padding: var(--s2) var(--s4);
  border-radius: var(--radius-pill);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 999;
  animation: toast-in 200ms ease-out;
}
@keyframes toast-in {
  from { opacity: 0; transform: translateX(-50%) translateY(8px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

.page-container { max-width: 1200px; margin: 0 auto; }

/* ── 响应式 ──────────────────────────────────────────────────────────────── */

@media (max-width: 1100px) {
  .dash-grid { grid-template-columns: 1fr; }
}
@media (max-width: 900px) {
  .practice-grid { grid-template-columns: 1fr; }
  .practice-left-col { position: static; }
  .sidebar { display: none; }
  .app-shell { display: block; }
}
```

- [ ] **Step 2: 验证构建与测试（旧 JSX + 新 CSS 应可渲染）**

Run: `npm test` → Expected: 133 passed
Run: `npm run typecheck` → Expected: 0 errors
Run: `npm run build` → Expected: Compiled successfully

（此刻 ios-segmented 等被删类的老 JSX 在 Task 2 前会短暂时髦度下降，属预期中间态；不截图验收。）

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(ui): rewrite globals.css to Workbench v3.0 tokens (class contract kept)"
```

---

### Task 2: 壳改造——Sidebar + VoiceCapsule + ExeTitlebar 瘦身 + layout

**Files:**
- Create: `components/Sidebar.tsx`
- Create: `components/VoiceCapsule.tsx`
- Modify: `components/ExeTitlebar.tsx`（整文件替换）
- Modify: `app/layout.tsx`
- Delete: 无（Nav.tsx 在 Task 7 删）

**Interfaces:**
- Consumes: Task 1 的 `.sidebar/.nav-item/.voice-capsule` 类；`@/lib/use-voice-status` 的 `useVoiceStatus()`（既有 hook，ExeTitlebar 现用）；`preload.cjs` 的 `electronAPI.restartVoiceServices/isDesktopApp/close/minimize/toggleMaximize`。
- Produces: `Sidebar`（default export，无 props）、`VoiceCapsule`（default export，无 props）。layout.tsx 消费两者。

- [ ] **Step 1: 创建 `components/VoiceCapsule.tsx`（从 ExeTitlebar 抽取四态胶囊 + 一键恢复）**

```tsx
"use client"

import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import { useVoiceStatus } from "@/lib/use-voice-status"

type ElectronAPI = {
  restartVoiceServices?: () => Promise<void> | void
}

function getApi(): ElectronAPI | undefined {
  if (typeof window === "undefined") return undefined
  return (window as unknown as { electronAPI?: ElectronAPI }).electronAPI
}

export default function VoiceCapsule() {
  const [waking, setWaking] = useState(false)
  const voice = useVoiceStatus()

  useEffect(() => {
    if (!waking) return
    const t = setTimeout(() => setWaking(false), 90000)
    return () => clearTimeout(t)
  }, [waking])

  async function handleClick() {
    const api = getApi()
    if (!api?.restartVoiceServices) {
      voice.refresh()
      return
    }
    setWaking(true)
    try {
      await Promise.race([
        Promise.resolve(api.restartVoiceServices()),
        new Promise<void>(resolve => setTimeout(resolve, 90000)),
      ])
    } catch {
    }
    voice.refresh()
    setWaking(false)
  }

  const state = waking ? "loading" : voice.ready ? "ready" : voice.loading ? "loading" : "offline"
  const text = waking
    ? "正在唤醒…"
    : voice.ready
      ? "语音就绪"
      : voice.loading
        ? `预热中 · ${Math.max(voice.busyElapsed.stt, voice.busyElapsed.tts)}s`
        : "语音离线 · 点击恢复"
  const label = waking
    ? "正在唤醒语音服务"
    : voice.ready
      ? "语音服务就绪，点击重启语音服务"
      : voice.loading
        ? "语音服务预热中，点击重新检查"
        : "语音引擎离线，点击一键恢复"

  return (
    <motion.button
      type="button"
      className={`voice-capsule state-${state}`}
      aria-label={label}
      onClick={handleClick}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
    >
      <span className="dot" aria-hidden="true" />
      {text}
    </motion.button>
  )
}
```

- [ ] **Step 2: 创建 `components/Sidebar.tsx`**

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { BookOpen, House, Gear, SquaresFour } from "@phosphor-icons/react"
import VoiceCapsule from "@/components/VoiceCapsule"
import { VocabWord } from "@/lib/domain/types"

const NAV_ITEMS = [
  { href: "/", label: "仪表盘", Icon: House },
  { href: "/scenarios", label: "场景", Icon: SquaresFour },
  { href: "/vocab", label: "生词本", Icon: BookOpen },
  { href: "/settings", label: "设置", Icon: Gear },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [dueCount, setDueCount] = useState<number | null>(null)

  useEffect(() => {
    let stopped = false
    fetch("/api/vocab")
      .then(r => (r.ok ? r.json() : []))
      .then((words: VocabWord[]) => {
        if (stopped) return
        setDueCount(words.filter(w => w.status === "new" || w.status === "learning").length)
      })
      .catch(() => {})
    return () => {
      stopped = true
    }
  }, [pathname])

  return (
    <aside className="sidebar" aria-label="主导航">
      <div className="sidebar-logo">
        <div className="mark" aria-hidden="true">S</div>
        <div className="name">SpeakLoop</div>
      </div>
      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const active = pathname === href || (href !== "/" && pathname.startsWith(href))
        return (
          <Link key={href} href={href} className={active ? "nav-item active" : "nav-item"}>
            <Icon size={18} className="ic" aria-hidden="true" />
            {label}
            {href === "/vocab" && dueCount !== null && dueCount > 0 && (
              <span className="badge">{dueCount}</span>
            )}
          </Link>
        )
      })}
      <div className="side-spacer" />
      <VoiceCapsule />
    </aside>
  )
}
```

- [ ] **Step 3: 整文件替换 `components/ExeTitlebar.tsx`（纯拖拽条 + 窗口按钮，网页端不渲染）**

```tsx
"use client"

import { useEffect, useState } from "react"

type ElectronAPI = {
  isDesktopApp?: boolean
  minimize?: () => void
  toggleMaximize?: () => void
  close?: () => void
}

function getApi(): ElectronAPI | undefined {
  if (typeof window === "undefined") return undefined
  return (window as unknown as { electronAPI?: ElectronAPI }).electronAPI
}

export default function ExeTitlebar() {
  const [mounted, setMounted] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    setMounted(true)
    setIsDesktop(Boolean(getApi()?.isDesktopApp))
  }, [])

  if (!mounted || !isDesktop) return null

  return (
    <header className="exe-titlebar">
      <div className="window-traffic-lights">
        <button
          type="button"
          className="traffic-dot traffic-dot-close no-drag"
          aria-label="关闭"
          onClick={() => getApi()?.close?.()}
        />
        <button
          type="button"
          className="traffic-dot traffic-dot-min no-drag"
          aria-label="最小化"
          onClick={() => getApi()?.minimize?.()}
        />
        <button
          type="button"
          className="traffic-dot traffic-dot-max no-drag"
          aria-label="最大化"
          onClick={() => getApi()?.toggleMaximize?.()}
        />
      </div>
    </header>
  )
}
```

（注：`@squircle-js/react` 与 `framer-motion` 从本组件移除；若全仓无其他 Squircle 引用，依赖保留在 package.json 不动——YAGNI 不做依赖清理。）

- [ ] **Step 4: 修改 `app/layout.tsx` 为 app-shell 结构**

```tsx
import type { Metadata } from "next"
import ExeTitlebar from "@/components/ExeTitlebar"
import KonstaApp from "@/components/KonstaApp"
import Sidebar from "@/components/Sidebar"
import "./globals.css"

export const metadata: Metadata = { title: "SpeakLoop" }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body>
        <KonstaApp>
          <ExeTitlebar />
          <div className="app-shell">
            <Sidebar />
            <main className="container">{children}</main>
          </div>
        </KonstaApp>
      </body>
    </html>
  )
}
```

- [ ] **Step 5: 验证**

Run: `npm test` → 133 passed；`npm run typecheck` → 0 errors；`npm run build` → success
确保 `npm run dev` 运行中，Run: `node scripts/console-check.mjs` → Expected: 四页 `loaded=true consoleErrors=0`
人工抽查：`http://localhost:3000/` 出现左侧栏（logo/四项/底部语音胶囊），网页端无顶部 titlebar。

- [ ] **Step 6: Commit**

```bash
git add components/Sidebar.tsx components/VoiceCapsule.tsx components/ExeTitlebar.tsx app/layout.tsx
git commit -m "feat(ui): sidebar shell with voice capsule; exe titlebar becomes drag strip"
```

---

### Task 3: 仪表盘重构（简报卡 + 活动流 + 待复习 + 场景磁贴）

**Files:**
- Create: `lib/scenario-icons.ts`
- Create: `lib/speak-once.ts`
- Modify: `app/page.tsx`（整文件替换）
- Modify: `scripts/browser-check.mjs:19`（`.stat` → `.briefing`，契约同步，见 Global Constraints）

**Interfaces:**
- Consumes: `GET /api/sessions|scenarios|vocab`（既有）；`relativeTime`（`@/lib/format`，签名 `(iso: string) => string`）；`VoiceBanner`（`@/components/VoiceStatus`）；Task 1 类名。
- Produces: `scenarioIcon(scenarioId: string): { Icon: IconType; color: string }`（Task 4 消费）；`speakOnce(text: string): Promise<void>`（Task 5 消费）。

- [ ] **Step 1: 创建 `lib/scenario-icons.ts`（四场景色重映射已备案，见 Global Constraints）**

```ts
import { Briefcase, ChatCircleDots, Coffee, Presentation, Users } from "@phosphor-icons/react"
import type { Icon } from "@phosphor-icons/react"

const MAP: Record<string, { Icon: Icon; color: string }> = {
  "builtin-interview": { Icon: Briefcase, color: "#5B5BD6" },
  "builtin-standup": { Icon: Presentation, color: "#FFB300" },
  "builtin-oneonone": { Icon: Users, color: "#34C759" },
  "builtin-smalltalk": { Icon: Coffee, color: "#FF7847" },
}

export function scenarioIcon(scenarioId: string): { Icon: Icon; color: string } {
  return MAP[scenarioId] ?? { Icon: ChatCircleDots, color: "#86868B" }
}
```

（注：`@phosphor-icons/react` 的类型导出名若为 `IconType` 而非 `Icon`，以 `import type { IconType }` 为准——两个名字在不同大版本中二选一，typecheck 会指路。）

- [ ] **Step 2: 创建 `lib/speak-once.ts`（生词发音最小组件逻辑，失败静默——离线时不打扰）**

```ts
export async function speakOnce(text: string, speaker?: string): Promise<void> {
  try {
    const r = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, speaker }),
    })
    if (!r.ok) return
    const buf = await r.arrayBuffer()
    const a = new Audio(URL.createObjectURL(new Blob([buf], { type: "audio/wav" })))
    a.onended = () => URL.revokeObjectURL(a.src)
    await a.play()
  } catch {
    /* 语音离线：静默降级为纯文字 */
  }
}
```

- [ ] **Step 3: 整文件替换 `app/page.tsx`**

```tsx
"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { CalendarBlank, CaretLeft, CaretRight, HandWave, Lightbulb } from "@phosphor-icons/react"
import { VoiceBanner } from "@/components/VoiceStatus"
import { relativeTime } from "@/lib/format"
import { scenarioIcon } from "@/lib/scenario-icons"
import { speakOnce } from "@/lib/speak-once"
import { Scenario, Session, VocabWord } from "@/lib/domain/types"

const typeLabel: Record<string, string> = { grammar: "语法", vocab: "用词", idiom: "地道表达" }

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (same(d, now)) return "今天"
  if (same(d, new Date(now.getTime() - 86400_000))) return "昨天"
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

export default function Dashboard() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [words, setWords] = useState<VocabWord[]>([])
  const [loading, setLoading] = useState(true)
  const [greeting, setGreeting] = useState("")
  const [dateText, setDateText] = useState("")
  const [tipIdx, setTipIdx] = useState(0)

  useEffect(() => {
    Promise.all([
      fetch("/api/sessions").then(r => r.json()).then(setSessions).catch(() => {}),
      fetch("/api/scenarios").then(r => r.json()).then(setScenarios).catch(() => {}),
      fetch("/api/vocab").then(r => r.json()).then(setWords).catch(() => {}),
    ]).then(() => setLoading(false))
    fetch("/api/tts/warmup", { method: "POST" }).catch(() => {})
    fetch("/api/stt/warmup", { method: "POST" }).catch(() => {})
  }, [])

  useEffect(() => {
    const h = new Date().getHours()
    setGreeting(h < 12 ? "早上好" : h < 18 ? "下午好" : "晚上好")
    setDateText(new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" }))
  }, [])

  const weekAgo = Date.now() - 7 * 86400_000
  const weekSessions = sessions.filter(s => new Date(s.startedAt).getTime() > weekAgo)
  const weekTurns = weekSessions.reduce((n, s) => n + s.turns.length, 0)
  const dueWords = words.filter(w => w.status === "new" || w.status === "learning")
  const dist = words.reduce<Record<string, number>>((acc, w) => ({ ...acc, [w.status]: (acc[w.status] ?? 0) + 1 }), {})
  const errorTypes = sessions
    .flatMap(s => s.report?.corrections ?? [])
    .reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.type]: (acc[c.type] ?? 0) + 1 }), {})
  const topErrors = Object.entries(errorTypes).sort((a, b) => b[1] - a[1]).slice(0, 3)
  const tips = topErrors.length
    ? topErrors.map(([t, n]) => <>你最常出现的错误是<b>{typeLabel[t] ?? t}</b>——已累计 {n} 次，练习时多留意。</>)
    : [<>暂无足够数据，完成一次练习后这里会给出建议。</>]
  const tip = tips[tipIdx % tips.length]

  const sorted = [...sessions].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  )
  const feed: { label: string; items: Session[] }[] = []
  for (const s of sorted.slice(0, 20)) {
    const label = dayLabel(s.startedAt)
    const last = feed[feed.length - 1]
    if (last && last.label === label) last.items.push(s)
    else feed.push({ label, items: [s] })
  }
  const tiles = [...scenarios.filter(s => s.builtin), ...scenarios.filter(s => !s.builtin)].slice(0, 4)

  if (loading) return <p className="muted">加载中…</p>
  return (
    <div>
      <VoiceBanner />

      <h1 className="hero-greet">
        {greeting} <HandWave size={26} weight="fill" aria-hidden="true" />
      </h1>

      <section className="briefing" aria-label="学习简报">
        <div className="date-row">
          <CalendarBlank size={16} weight="fill" aria-hidden="true" />
          {dateText}
        </div>
        <p className="rich">
          本周你完成了 <b>{weekSessions.length} 次对话</b>、{weekTurns} 轮练习，还有{" "}
          <Link className="briefing-link" href="/vocab">{dueWords.length} 个生词</Link>待复习。
        </p>
        <div className="insights">
          <Lightbulb size={18} weight="fill" aria-hidden="true" />
          <span className="tip">{tip}</span>
          <div className="nav-arrows">
            <button type="button" aria-label="上一条建议" onClick={() => setTipIdx(i => (i - 1 + tips.length) % tips.length)}>
              <CaretLeft size={14} weight="bold" aria-hidden="true" />
            </button>
            <div className="dots" aria-hidden="true">
              {tips.map((_, i) => <i key={i} className={i === tipIdx % tips.length ? "on" : ""} />)}
            </div>
            <button type="button" aria-label="下一条建议" onClick={() => setTipIdx(i => (i + 1) % tips.length)}>
              <CaretRight size={14} weight="bold" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      <div className="dash-grid">
        <section aria-label="练习动态">
          <div className="section-header"><h3>练习动态</h3></div>
          <div className="card" style={{ padding: "6px 20px" }}>
            {feed.length === 0 && <p className="muted" style={{ padding: "16px 4px" }}>还没有练习记录，去 <Link href="/scenarios">选一个场景</Link> 开始吧。</p>}
            {feed.map(group => (
              <div key={group.label}>
                <div className="day-head">{group.label}</div>
                {group.items.map(s => {
                  const sc = scenarios.find(x => x.id === s.scenarioId)
                  const { Icon, color } = scenarioIcon(s.scenarioId)
                  const n = s.report?.corrections.length
                  return (
                    <Link
                      key={s.id}
                      className="feed-row"
                      href={s.report ? `/report/${s.id}` : `/practice/${s.id}`}
                    >
                      <span className="tile" style={{ background: color }}>
                        <Icon size={20} weight="fill" aria-hidden="true" />
                      </span>
                      <span className="feed-rich">
                        {s.report
                          ? <>你完成了 <b>{sc?.title ?? "未知场景"}</b>
                              {n ? <>，有 <b>{n} 处</b>可改进。</> : <>，表达干净无改进点。</>}
                            </>
                          : <>你练习了 <b>{sc?.title ?? "未知场景"}</b>，{s.turns.length} 轮对话。</>}
                      </span>
                      <span className="feed-time">{relativeTime(s.startedAt)}</span>
                    </Link>
                  )
                })}
              </div>
            ))}
          </div>
        </section>

        <div className="right-col">
          <section aria-label="待复习生词">
            <div className="section-header">
              <h3>待复习</h3>
              <span className="pill pill-gray">{dueWords.length}</span>
            </div>
            <div className="card" style={{ padding: "6px 16px" }}>
              {dueWords.length === 0 && <p className="muted" style={{ padding: "12px 4px" }}>暂无待复习生词。</p>}
              {dueWords.slice(0, 5).map(w => (
                <div key={w.id} className="vocab-row">
                  <div className="vocab-main">
                    <div className="w">{w.word}</div>
                    <div className="ph">{w.translation}</div>
                  </div>
                  <span className={`vocab-status-pill ${w.status}`}>
                    {w.status === "new" ? "未学" : w.status === "learning" ? "认识中" : w.status === "mastered" ? "已掌握" : "已忽略"}
                  </span>
                  <button
                    type="button"
                    className="icon-btn"
                    style={{ minWidth: 32, minHeight: 32, width: 32, height: 32 }}
                    aria-label={`朗读 ${w.word}`}
                    onClick={() => speakOnce(w.word)}
                  >
                    🔊
                  </button>
                </div>
              ))}
            </div>
            <p className="muted" style={{ marginTop: 8 }}>
              新词 {dist.new ?? 0} · 学习中 {dist.learning ?? 0} · 已掌握 {dist.mastered ?? 0}
            </p>
          </section>

          <section aria-label="场景入口">
            <div className="section-header"><h3>场景入口</h3></div>
            <div className="sc-grid">
              {tiles.map(sc => {
                const { Icon, color } = scenarioIcon(sc.id)
                return (
                  <Link key={sc.id} className="sc-tile" href={`/practice/${sc.id}/start`} onClick={e => e.preventDefault()} style={{ cursor: "pointer" }}
                    onClickCapture={() => {
                      fetch("/api/sessions", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ scenarioId: sc.id }),
                      })
                        .then(r => (r.ok ? r.json() : null))
                        .then(s => { if (s?.id) window.location.assign(`/practice/${s.id}`) })
                        .catch(() => {})
                    }}
                  >
                    <span className="tile tile-sm" style={{ background: color }}>
                      <Icon size={16} weight="fill" aria-hidden="true" />
                    </span>
                    <span className="nm">{sc.title}</span>
                  </Link>
                )
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
```

**实现者注意（两处修正，写码时按此执行）：**
1. 上面 `<Link className="sc-tile" href="/practice/${sc.id}/start" onClick={...} onClickCapture={...}>` 的写法是错误的——Link 的 href 指向不存在路由。**正确写法**：用 `<a className="sc-tile" role="button" tabIndex={0} onClick={startPractice}>`，`startPractice` 为页面内函数：

```tsx
async function startPractice(scenarioId: string) {
  try {
    const r = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId }),
    })
    if (!r.ok) return
    const s = await r.json()
    if (s?.id) window.location.assign(`/practice/${s.id}`)
  } catch {
    /* 保持当前页 */
  }
}
```

2. 生词发音按钮里的 `🔊` emoji 违反 Phosphor 图标红线——**正确写法**：`import { SpeakerHigh } from "@phosphor-icons/react"` 并渲染 `<SpeakerHigh size={16} aria-hidden="true" />`。

- [ ] **Step 4: 同步 `scripts/browser-check.mjs:19` 断言（契约变更，Global Constraints 授权）**

将 `check("仪表盘渲染", await page.locator(".stat").first().isVisible())` 改为：
```js
check("仪表盘渲染", await page.locator(".briefing").first().isVisible())
```

- [ ] **Step 5: 验证**

Run: `npm test` → 133 passed；`npm run typecheck` → 0 errors；`npm run build` → success
`node scripts/console-check.mjs` → `/` 页 loaded=true consoleErrors=0
人工抽查：简报卡渐变、数字可点（生词数跳 /vocab）、动态流按今天/昨天分组、磁贴点击直接进入练习页。

- [ ] **Step 6: Commit**

```bash
git add lib/scenario-icons.ts lib/speak-once.ts app/page.tsx scripts/browser-check.mjs
git commit -m "feat(ui): workbench dashboard with briefing card, activity feed, due vocab and scenario tiles"
```

---

### Task 4: 场景页换肤（行卡 + 图标磁贴 + 难度胶囊）

**Files:**
- Modify: `app/scenarios/page.tsx`（仅渲染层：import 与列表 JSX；表单逻辑零改动）

**Interfaces:**
- Consumes: Task 3 的 `scenarioIcon`；既有 `POST /api/sessions`、`POST /api/scenarios/draft`、`POST /api/scenarios`。
- Produces: 无（下游无消费）。**契约**：`.card.row` 与按钮文本「开始练习」保留（browser-check 依赖）。

- [ ] **Step 1: 修改 `app/scenarios/page.tsx` 的列表渲染段**

顶部追加 import：
```tsx
import { scenarioIcon } from "@/lib/scenario-icons"

const difficultyLabel: Record<Scenario["difficulty"], string> = { easy: "入门", medium: "进阶", hard: "挑战" }
const difficultyPill: Record<Scenario["difficulty"], string> = { easy: "pill-blue", medium: "pill-orange", hard: "pill-red" }
```

将 `{list.map(s => ...)}` 整段替换为：
```tsx
{list.map(s => {
  const { Icon, color } = scenarioIcon(s.id)
  return (
    <div key={s.id} className="card row sc-row">
      <span className="tile" style={{ background: color }}>
        <Icon size={20} weight="fill" aria-hidden="true" />
      </span>
      <div className="grow">
        <b>{s.title}</b>{" "}
        <span className={`pill ${difficultyPill[s.difficulty]}`}>{difficultyLabel[s.difficulty]}</span>
        {s.personaZh && <div className="desc">{s.personaZh}</div>}
        <div className="muted">{s.persona}</div>
      </div>
      <button className="btn" disabled={busy} onClick={() => startPractice(s.id)}>开始练习</button>
    </div>
  )
})}
```

页面两个 `<h3>` 保持不变（CSS 已换肤）。自定义表单区零改动。

- [ ] **Step 2: 验证**

Run: `npm test` → 133 passed；`npm run typecheck` → 0 errors；`npm run build` → success
`node scripts/console-check.mjs` → `/scenarios` loaded=true consoleErrors=0

- [ ] **Step 3: Commit**

```bash
git add app/scenarios/page.tsx
git commit -m "feat(ui): scenarios page workbench restyle with icon tiles and difficulty pills"
```

---

### Task 5: 生词本 To Do 化（去 konsta List + 分组计数 + 掌握勾选 + 发音键）

**Files:**
- Modify: `app/vocab/page.tsx`（整文件替换）

**Interfaces:**
- Consumes: `GET/PATCH/DELETE /api/vocab`（既有）；`relativeTime`；Task 3 的 `speakOnce`；Task 1 的 `.group-head/.check/.vocab-row` 类。
- Produces: 无。**注意**：本页删除 `konsta/react` 的 `List/ListItem` 引用后，全仓不再有 konsta 组件消费（KonstaApp 的 `App` 外壳保留不动）。

- [ ] **Step 1: 整文件替换 `app/vocab/page.tsx`**

```tsx
"use client"

import { Check } from "@phosphor-icons/react"
import { useEffect, useState } from "react"
import { relativeTime } from "@/lib/format"
import { speakOnce } from "@/lib/speak-once"
import { SpeakerHigh } from "@phosphor-icons/react"
import { VocabStatus, VocabWord } from "@/lib/domain/types"

const statusLabel: Record<VocabStatus, string> = { new: "未学", learning: "认识中", mastered: "已掌握", ignored: "已忽略" }
const GROUP_ORDER: VocabStatus[] = ["learning", "new", "mastered", "ignored"]

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

  async function toggleMastered(w: VocabWord) {
    await change(w.id, w.status === "mastered" ? "learning" : "mastered")
  }

  return (
    <div>
      <h3>生词本（{words.length}）</h3>
      {words.length === 0 && <p className="muted">暂无生词。完成一次练习并在报告中采纳候选后，这里会有内容。</p>}
      {words.length > 0 && (
        <div className="card" style={{ padding: "6px 20px" }}>
          {GROUP_ORDER.map(status => {
            const group = words.filter(w => w.status === status)
            if (group.length === 0) return null
            return (
              <div key={status}>
                <div className="group-head">
                  {statusLabel[status]} <span className="cnt">{group.length}</span>
                </div>
                {group.map(w => (
                  <div key={w.id} className="vocab-row">
                    <button
                      type="button"
                      className={"check" + (w.status === "mastered" ? " done" : "")}
                      aria-label={`标记掌握：${w.word}`}
                      aria-pressed={w.status === "mastered"}
                      onClick={() => toggleMastered(w)}
                    >
                      <Check size={12} weight="bold" aria-hidden="true" />
                    </button>
                    <div className="vocab-main">
                      <div>
                        <span className="w">{w.word}</span>{" "}
                        <span className="ph">{w.translation}</span>
                      </div>
                      <div className="ph" style={{ fontStyle: "italic" }}>{w.example}</div>
                      <div className="ph">
                        已使用 {w.timesEncountered} 次{w.lastUsedAt ? ` · 上次使用 ${relativeTime(w.lastUsedAt)}` : ""}
                      </div>
                    </div>
                    <span className={`vocab-status-pill ${w.status}`} aria-label={`状态：${statusLabel[status]}`}>
                      {statusLabel[status]}
                    </span>
                    <button
                      type="button"
                      className="icon-btn"
                      style={{ minWidth: 32, minHeight: 32, width: 32, height: 32 }}
                      aria-label={`朗读 ${w.word}`}
                      onClick={() => speakOnce(w.word)}
                    >
                      <SpeakerHigh size={16} aria-hidden="true" />
                    </button>
                    <button type="button" className="btn btn-ghost-danger" style={{ minHeight: 32, padding: "4px 10px", fontSize: 13 }} onClick={() => remove(w.id)}>
                      删除
                    </button>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

（原状态 `<select>` 被勾选框 + 胶囊替代：勾选 = 快速标记掌握/退回认识中；`PATCH` 通道保留。若需四态精调，后续 fast-follow 再补下拉——YAGNI。）

- [ ] **Step 2: 验证**

Run: `npm test` → 133 passed；`npm run typecheck` → 0 errors；`npm run build` → success
`node scripts/console-check.mjs` → `/vocab` loaded=true consoleErrors=0
人工抽查：分组头带计数、勾选即变"已掌握"（绿）、发音键朗读、删除可用。

- [ ] **Step 3: Commit**

```bash
git add app/vocab/page.tsx
git commit -m "feat(ui): vocab page to-do style groups with mastery check and speak button"
```

---

### Task 6: 报告页换肤（总评 Hero + 彩色纠错行）

**Files:**
- Modify: `app/report/[id]/page.tsx`（仅渲染层；数据流/regenerate/候选采纳逻辑零改动）

**Interfaces:**
- Consumes: 既有 `GET /api/sessions/[id]`、`POST /api/report`、`POST /api/vocab`。
- Produces: 无。

- [ ] **Step 1: 修改渲染段（加载态与失败态之后的正式报告 JSX）**

顶部追加：
```tsx
const typePill: Record<string, string> = { grammar: "pill-red", vocab: "pill-orange", idiom: "pill-indigo" }
```

将 `return (<div>...` 的正式报告段替换为：
```tsx
return (
  <div>
    <h3>练习报告</h3>
    <div className="summary-hero">
      <b>总评</b>
      <p style={{ marginTop: 8 }}>{report.summary}</p>
    </div>
    {report.highlights.length > 0 && (
      <div className="card">
        <b>亮点</b>
        <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>{report.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul>
      </div>
    )}
    {report.corrections.map((c, i) => {
      const turn = session.turns.find(t => t.id === c.turnId)
      return (
        <div key={i} className="card">
          <span className={`pill ${typePill[c.type] ?? "pill-gray"}`}>{typeLabel[c.type] ?? c.type}</span>
          <div className="corr-row" style={{ borderBottom: "none", padding: "12px 0 0" }}>
            <div className="corr-main">
              <div className="corr-wrong">你说：{c.original}</div>
              <div className="corr-right">建议：{c.improved}</div>
              <p className="muted" style={{ marginTop: 6 }}>{c.explanation}</p>
            </div>
          </div>
          {turn?.audioUrl && (
            <div className="row" style={{ marginTop: 8 }}>
              <SpeakerHigh size={20} aria-hidden="true" />
              <audio controls src={turn.audioUrl} aria-label={`原声回放：${c.original}`} />
            </div>
          )}
        </div>
      )
    })}
    {report.vocabCandidates.length > 0 && (
      <div className="card">
        <b>生词候选</b>
        {report.vocabCandidates.map(v => (
          <div key={v.word} className="row" style={{ marginTop: 8 }}>
            <div className="grow">
              <b>{v.word}</b> <span className="muted">{v.translation}</span>
              <div className="muted">{v.example}</div>
            </div>
            {handled[v.word] ? (
              <span className="chip">{handled[v.word] === "new" ? "已加入" : "已忽略"}</span>
            ) : (
              <>
                <button className="btn" style={{ minHeight: 36 }} onClick={() => handleCandidate(v.word, v.translation, v.example, "new")}>采纳</button>
                <button className="btn btn-secondary" style={{ minHeight: 36 }} onClick={() => handleCandidate(v.word, v.translation, v.example, "ignored")}>忽略</button>
              </>
            )}
          </div>
        ))}
      </div>
    )}
    <Link className="btn btn-secondary" href="/">返回首页</Link>
  </div>
)
```

（文件顶部已 import `SpeakerHigh`——保留原 import 即可。）

- [ ] **Step 2: 验证**

Run: `npm test` → 133 passed；`npm run typecheck` → 0 errors；`npm run build` → success
（报告页无数据时不做 console-check——该路由不在脚本清单；由 Task 8 走查。）

- [ ] **Step 3: Commit**

```bash
git add "app/report/[id]/page.tsx"
git commit -m "feat(ui): report page workbench restyle with summary hero and typed correction rows"
```

---

### Task 7: 练习页红线核查 + 死代码清理 + 颜色 grep

**Files:**
- Delete: `components/Nav.tsx`（死代码：仅旧计划文档引用，无运行时 import）
- Verify: `app/practice/[id]/page.tsx`（**零改动**——Task 1 CSS 已完成其换肤）

**Interfaces:**
- Consumes: Task 1 的 `.bubble-user`（靛蓝）等换肤。
- Produces: 无。

- [ ] **Step 1: 删除 `components/Nav.tsx`**

```bash
git rm components/Nav.tsx
```

- [ ] **Step 2: 确认无残留引用**

Run: `rg -n "components/Nav" app components lib scripts` → Expected: 无输出（docs/ 命中可忽略）

- [ ] **Step 3: 颜色红线 grep（spec §7.3）**

Run: `rg -n "var\(--ios-|#007AFF|#8E8E93|#5856D6|#30B0C7|#FF2D55|#AF52DE" app components --glob "*.tsx"`
Expected: 仅允许命中 `components/ExeTitlebar.tsx` 若其仍含旧渐变——若有，将该行 `background` 改为 `var(--brand-grad)` 后重跑直至无命中。`app/practice/[id]/page.tsx`、`components/Recorder.tsx` 等应零命中。

- [ ] **Step 4: 练习页红线人工核查（读码确认，不改码）**

确认 `app/practice/[id]/page.tsx` 仍满足：`zhShown` 瞬时逻辑（onMouseEnter 300ms 定时 + onMouseLeave 清除，无 `:hover` CSS 依赖）；`Recorder` 录音态 `is-recording` 静态红（无 animation/pulse）；`AudioQueue` 挂死守卫 60s；键盘输入 placeholder 含「键盘」；按钮文本「听不懂/提示/结束练习」；`aria-label="朗读目标 {i}"` 与 `[role="listitem"]` 保留。

- [ ] **Step 5: 验证**

Run: `npm test` → 133 passed；`npm run typecheck` → 0 errors；`npm run build` → success
`node scripts/console-check.mjs` → 四页全绿（练习页不在清单，Task 8 处理）

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(ui): remove dead Nav component; verify practice red lines and color grep"
```

---

### Task 8: 全量验收

**Files:**
- 无新改动（若前序任务发现回归，回对应任务修）

- [ ] **Step 1: 测试三件套**

Run: `npm test` → Expected: 133 passed
Run: `npm run typecheck` → Expected: 0 errors
Run: `npm run build` → Expected: Compiled successfully

- [ ] **Step 2: console-check 四页**

确保 `npm run dev` 运行中。Run: `node scripts/console-check.mjs`
Expected: `/: loaded=true consoleErrors=0`、`/scenarios`、`/settings`、`/vocab` 同。

- [ ] **Step 3: 练习页走查（需 GPU 双服务，最终联合验收时执行）**

Run: `scripts/start-all.ps1 -Silent -NoBrowser`（若服务未起）
Run: `node scripts/acceptance-check.mjs` → Expected: 全部断言 PASS（悬停翻译瞬时、朗读目标、报告闭环）
Run: `node scripts/browser-check.mjs` → Expected: 11 项 check 全 PASS（含改后的 `.briefing` 断言）
若 GPU 不可用（如用户游戏中），此项挂起并在 progress.md 记录"待联合验收"，不阻塞 1-2 步交付。

- [ ] **Step 4: 颜色红线终查**

Run: `rg -n "var\(--ios-|#007AFF|#8E8E93|#5856D6|#30B0C7" app components --glob "*.tsx"`
Expected: 零命中。

- [ ] **Step 5: Electron 冒烟清单（用户手测项，执行方记录到 progress.md）**

- `npm run build` 后 `npm run electron:start`（或既有启动方式）：侧栏渲染、标题栏拖拽、红黄绿关闭/最小化/最大化可用、Mica 透出壁纸、底部语音胶囊四态切换。

- [ ] **Step 6: 收尾 Commit（如有零星修正）**

```bash
git add -A
git commit -m "chore(ui): workbench acceptance pass"
```

---

## Self-Review 记录

1. **Spec 覆盖**：§2 token→Task 1；§3 壳→Task 2；§4.1 仪表盘→Task 3；§4.2 场景→Task 4；§4.3 练习（零改动+红线）→Task 1 CSS + Task 7 核查；§4.4 报告→Task 6；§4.5 生词→Task 5；§4.6 设置→Task 1 CSS 换肤（.card/.input/.btn 已覆盖，无 JSX 改动需求，spec 允许"控件换肤、语义零改动"）；§6 测试契约→Task 3 Step 4；§7 验收→Task 8；§8 Non-Goals 未实现即符合。
2. **占位符扫描**：无 TBD/TODO；Task 3 的两处"实现者注意"是显式修正而非占位。
3. **类型一致性**：`scenarioIcon`/`speakOnce` 在 Task 3 定义、Task 4/5 消费，签名一致；`VoiceCapsule`/`Sidebar` 无 props 导出与 layout 用法一致；Phosphor 类型名 `Icon`/`IconType` 差异已标注由 typecheck 仲裁。
