# SpeakLoop iOS 化 + Electron EXE 实施计划（一次性合并交付）

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development 或 executing-plans。步骤用复选框跟踪。

**Goal:** 将 SpeakLoop 全站视觉重构为 iOS/Apple HIG 风格（浅灰分组底 + 无边框白卡 + 毛玻璃顶栏 + 分段导航 + Inset Grouped 列表 + 双栏练习页），并以 Electron 交付**真 EXE 安装版**（无边框窗口/红黄绿控制/麦克风自动放行/后台服务生命周期守护）。

**Architecture:** 视觉数值以用户提供的 iOS 模板为准（本计划只列必须偏离项）。Electron 主进程用 `ELECTRON_RUN_AS_NODE` 拉起 Next **standalone** 子进程（动态端口），注入 `DATA_DIR=userData` 与 `AUTO_STOP=0`；语音后端继续复用本机 conda 双服务（`start-all.ps1` 幂等）。

**Tech Stack:** 既有（Next 15 + React 19 + 手写 CSS 变量 + Vitest）；新增 Electron 33+ / electron-builder（NSIS）。

## 已锁定决策

| # | 决策 |
|---|---|
| A1 | **原生 iOS 色**：`#007AFF`/`#8E8E93`/`#FF3B30`（对比度记为例外，spec 修订备案） |
| A2 | 语音后端依赖本机 conda 双环境（模型不入包） |
| A3 | **一次性合并交付**（完成后统一终验） |
| A4 | 关闭窗口 = 退出应用（无系统托盘） |
| B1 | 录音按钮**无动画**（仅变红，F1 一致） |
| B2 | 悬停译文**保留 F3 JS 逻辑**（瞬时显示/离开即隐/懒加载/含中文跳过/译按钮切换），模板纯 CSS hover 不采用 |
| B3 | 导航「场景」→ `/scenarios`（模板 `/practice` 死链修正） |
| B4 | 练习页采纳**双栏布局**，内部编排逻辑零改动 |
| B5 | 顶栏语音胶囊常驻 + 页面横幅仅非就绪时显示 |
| B6 | EXE 首启自动迁移既有 `data/` → `userData/data` |
| B7 | 仅 NSIS 安装版 |
| B8 | 应用图标：蓝底 S 品牌标（512px PNG，builder 转换） |
| B9 | Electron 层仅手动冒烟清单（网页层保留全部自动化） |

## Global Constraints

- 测试基线 **129 → 133**（仅 T1 新增 4 个）；每任务 `npm test` + `npm run typecheck` + `npm run build` 全绿
- **类名稳定性契约**（验收脚本依赖，不得改名）：`muted / chip / zh-line / btn / btn-secondary / btn-danger / icon-btn / word-chip / bubble-user / bubble-ai / bubble-coach`；文案「合成中」「播放中」不变；`acceptance-check.mjs` / `console-check.mjs` 必须原样通过
- 禁 emoji 结构图标（一律 `@phosphor-icons/react`）；交互控件命中区 ≥44px（视觉可紧凑）；`:focus-visible` 焦点环与 `prefers-reduced-motion` 保留
- 浏览器模式与 Electron 模式双可用；Electron 内 `AUTO_STOP=0`（`lib/auto-stop.ts` 的 `shouldAutoStop()` 已支持）；浏览器模式自动停止行为不变
- Windows 11 目标；无 Tailwind、无组件库

---

## 交叉评审修正（2026-10-25，副审记录）

外部交叉评审提出 8 项，逐项核验后处置如下（已全部并入上文任务）：

| # | 评审项 | 核验与处置 |
|---|---|---|
| B-1 | asar 归档阻断 standalone spawn | ✅ 采纳：T9 设 **`asar:false`**；T8 spawn 显式传 `cwd=standalone 目录` |
| B-2 | extraResources 路径偏移 + 脚本相对路径失联 | ✅ 采纳：T8 脚本路径按 `isPacked ? process.resourcesPath : app.getAppPath()`；`start-all.ps1` 改造为 **`SPEAKLOOP_REPO_ROOT` 优先**（新增改造任务） |
| B-3 | "DATA_DIR 未被任何任务读取" | ❌ **驳回（与代码事实不符）**：三处数据路径早已支持 `process.env.DATA_DIR ?? cwd/data`——`lib/store/json-store.ts:7`、`lib/config.ts:19`、`lib/services/practice.ts:59`，注入即生效，无需改造；T8 验收增加实测项（迁移后数据可读）佐证 |
| B-4 | NSIS 安装后 B6 迁移源必然落空 | ✅ 采纳：T9 构建期写 `electron/build-meta.json {repoRoot}`；T8 迁移探测链改为 `SPEAKLOOP_DATA_SRC → build-meta.repoRoot/data → cwd/data`。**评审未列但同源的第五个坑一并修复**：`.env` 复制至 `userData/.env` 并在 spawn Next 前解析注入（否则安装版 Chat Key/provider 配置丢失） |
| M-1 | 拖拽区 `onDoubleClick` 不触发 | ✅ 采纳：删除自定义双击 IPC，依赖 Windows 原生（`resizable/maximizable: true`） |
| M-2 | 红黄绿 SSR/水合不一致 | ✅ 采纳：`useState(false)` + `useEffect` 挂载门控（否则 Hydration Mismatch 将挂掉 console-check 门禁） |
| M-3 | `.bubble-youser` 笔误；vocab pill 两套类名 | ✅ 采纳：已改 `.bubble-user`；统一组合类 `.vocab-status-pill.<status>` |
| M-4 | 44px 命中区与小红黄绿/小按钮冲突 | ✅ 采纳（分层执行）：红黄绿=44×44 透明热区包 12px 视觉圆点；`icon-btn` 保持 44；气泡 mini-pill 视觉紧凑、热区 44。注：`acceptance-check.mjs` **并不扫描全部按钮尺寸**（评审假设不成立），但 spec 规则照常执行 |

## Phase 1 · 基础层

### T1: relativeTime 工具（TDD）

**Files:** Create `lib/format.ts`、`tests/format.test.ts`

**Interfaces:**
```ts
export function relativeTime(iso: string, now?: Date): string
// 同日 → "今天 HH:mm"；昨日 → "昨天 HH:mm"；同年 → "M月D日 HH:mm"；跨年 → "YYYY年M月D日"
```

- [ ] 写 4 个失败用例（今天/昨天/同年更早/跨年，含时间零填充）
- [ ] `npx vitest run tests/format.test.ts` 确认 FAIL → 实现 → PASS
- [ ] 全量 `npm test` = **133**；typecheck；build
- [ ] Commit：`feat: relative time formatter`

### T2: Next standalone 输出

**Files:** Modify `next.config.mjs`

```js
export default { output: "standalone" }
```

- [ ] `npm run build` 验证 `.next/standalone/server.js` 生成
- [ ] Commit：`chore: enable next standalone output`

---

## Phase 2 · 设计系统（globals.css 全量重写）

**Files:** Modify `app/globals.css`（整文件重写，保留类名契约）

### Token 层（模板色板照搬 + 旧变量别名防白屏）

```css
:root {
  /* 模板 token：--bg-canvas #F2F2F7、--bg-card、--bg-inset、三档玻璃、--text-primary #1C1C1E、
     --text-secondary #3C3C43、--text-tertiary #8E8E93、--ios-blue/green/orange/red + tint、
     --bubble-* 全套、--hairline、--radius-card 18/bubble 18/control 12/pill 999、
     --shadow-sm/float/popover、--font-apple 系统栈（-apple-system, "SF Pro Text", "PingFang SC", "Microsoft YaHei"） */
  /* 旧变量别名（组件兼容） */
  --color-primary: var(--ios-blue);   --color-on-primary: #ffffff;
  --color-accent: var(--ios-orange);  --color-destructive: var(--ios-red);
  --color-background: var(--bg-canvas); --color-foreground: var(--text-primary);
  --color-card: var(--bg-card);       --color-card-foreground: var(--text-primary);
  --color-muted: #f2f2f7;             --color-muted-foreground: var(--text-tertiary);
  --color-border: var(--hairline);    --color-ring: var(--ios-blue);
  --radius-md: 12px; --radius-lg: 18px;
}
```

**删除**：Google Fonts `@import`、`--border-thick`、`--shadow-inner/--shadow-outer`、`pulse` keyframes。

### 组件类重绘（保留类名，替换内里）

| 类 | 新样式 |
|---|---|
| `.container` | max-width **1040px**；padding 20px 24px 48px |
| `.card` | 白底无边框；radius 18；`--shadow-sm`；padding 18-20；margin-bottom 16 |
| `.btn` | 胶囊（999）高 44；蓝底白字；`--shadow-sm`；active `scale(.97)`；hover 加深；`--btn-secondary` 灰胶囊 `#E5E5EA`/`#1C1C1E`；`.btn-danger` 红 |
| `.input/textarea/select` | 白底 + 1px hairline；radius 12；focus 边框 `--ios-blue` |
| `.bubble-user/.bubble-ai/.bubble-coach` | 模板三色（用户蓝渐变右对齐/尾 6px；AI 白左/尾 6；教练 `#FFF9E6`+`#FFE082` 边 + `#6E3B00` 字）；保留 `.bubble-* .word-chip` 适配（用户气泡白系、教练琥珀系） |
| `.word-chip` | hover 蓝 tint+变蓝（模板 `.clickable-word` 语义） |
| `.zh-line` | **仅样式**：上虚分割线 13px `--text-secondary`；显隐由 F3 JS（`zhShown`）控制，**禁止添加 `:hover` 显隐选择器** |
| `.icon-btn` `.chip` `.muted` `.stat` `.goal-done` `.bubble-actions` | 按模板语义微调；`.stat` 32px/700/`--text-primary` |
| `.popover` | 毛玻璃（`--bg-glass-popover` + blur）、hairline、radius 16、`--shadow-popover`、`z-index: 300` |
| 新增 | `.exe-titlebar(-inner)` `.no-drag` `.window-traffic-lights` `.traffic-dot{-close,-min,-max}` `.ios-segmented` `.ios-seg-item.active` `.voice-status-banner` `.ios-grouped-list/-row`（缩进分割线伪元素 left:20px） `.goal-list/-row(.done)/-checkbox` `.practice-grid`(310px+1fr) `.practice-left-col`(sticky top 72) `.bubble-stream` `.phase-timer-bar` `.practice-dock`(sticky bottom 玻璃) `.dock-assist-row` `.dock-input-row` `.ios-input` `.record-btn(.is-recording 仅变红，无动画)` `.dict-popover-card` `.vocab-status-pill（组合类：.vocab-status-pill.new/.learning/.mastered/.ignored，与 CSS 模板一致，禁止连字符式 -new）` |
| 拖拽区 | `.exe-titlebar { -webkit-app-region: drag }`；所有可点击元素加 `.no-drag` |

- [ ] 重写 globals.css 并 `npm run build` 通过（下一步视觉核对）
- [ ] Commit：`feat: ios design system tokens and components`

---

## Phase 3 · 组件与页面

### T3: ExeTitlebar（新建）+ layout 接线

**Files:** Create `components/ExeTitlebar.tsx`、`lib/use-voice-status.ts`；Modify `app/layout.tsx`（`Nav` 摘除；保留 `<Heartbeat />`）；`components/Nav.tsx` 可删除或留弃用

**Interfaces:**
- `useVoiceStatus(): { stt: Probe; tts: Probe; ready: boolean; loading: boolean; busyElapsed: {stt:number;tts:number} }`（10s 轮询 `/api/voice-status`；复用 `lineStatus` 计时语义）
- 顶栏结构：左（红黄绿三点——**hydration 安全门控**：`useState(false)` + `useEffect` 挂载后才依据 `window.electronAPI?.isDesktopApp` 渲染（SSR 首屏与服务端一致为空，避免 React 19 Hydration Mismatch 导致 console-check 门禁失败）；每点外层 44×44 透明命中区包裹 12px 视觉圆点；S 方标；SpeakLoop）· 中（`.ios-segmented`：首页 `/` 场景 `/scenarios` 生词本 `/vocab` 设置 `/settings`，`usePathname` 判 active）· 右（**语音胶囊**：就绪绿 tint「语音就绪」/ 预热橙「预热中 · Ns」/ 离线橙「引擎离线 · 一键恢复」；点击：`electronAPI.restartVoiceServices()`，浏览器 fallback 仅刷新状态；唤醒中「正在唤醒…」+ 轮询恢复；**`+ 新练习`** 蓝胶囊 → `/scenarios`）

- [ ] 实现 + layout 接入；`npm run build`；浏览器四页可导航
- [ ] Commit：`feat: ios titlebar with segmented nav and voice pill`

### T4: VoiceBanner（VoiceStatus 改写）

**Files:** Modify `components/VoiceStatus.tsx`（导出 `VoiceBanner`；**保留 `useVoiceProbes` 导出**，practice 页 F4 后缀依赖）

- 全就绪/未启用 → `return null`
- 预热中 → 琥珀单行：`语音预热中：STT 42s · TTS 88s`
- 离线/异常 → 琥珀警示条 + 右按钮：「一键恢复」（Electron IPC / 浏览器展开说明）与「如何恢复？」（展开：双击启动器 / 查 `logs/`）
- 首页与练习页替换旧卡片用法

- [ ] 实现；首页/练习页接入；build
- [ ] Commit：`feat: voice status banner (non-ready only)`

### T5: 首页重构（`app/page.tsx`）

- `VoiceBanner` → 三卡 Grid（gap 16）：①橙点+「本周练习」+右侧 Flame「活跃」+大数字+「次对话」；②绿点+「生词进度」+右侧「查看全部 ›」→/vocab+**三列迷你块**（蓝=新词/橙=学习中/绿=已掌握，`--bg-inset` 底、数字分色、11px 标签）；③红点+「常见错误 Top 3」+行式（类型 + 灰胶囊「N 次」）
- 最近练习：标题 + 右侧「共 N 条记录」；`.ios-grouped-list` 单容器；行=彩底 36px 瓦片（Briefcase 蓝/Presentation 靛/Users 翠/Coffee 橙/ChatCircleDots 灰）+ 标题 500 + `relativeTime(startedAt)` 12px + 右「N 轮」chip + `CaretRight`——**整行 `<Link>`**（有报告→`/report/{id}`，无→`/practice/{id}`），hover 行底微沉+标题变蓝
- 空态文案保留

- [ ] 实现；build；手动视觉核对（含空态与有记录两态）
- [ ] Commit：`feat: ios dashboard (health cards, inset grouped recent list)`

### T6: 练习页双栏（`app/practice/[id]/page.tsx` + `components/Recorder.tsx`）

**只改 JSX 结构与类名；全部业务逻辑零改动**（`runStt / runChatStream / persistTurn / speakNow / speakStatus / zhShown / ensureZh / phase / failed / endPractice`）

- 外层 `.page-container` + `<VoiceBanner />` + `.practice-grid`
- 左列 `.practice-left-col`（sticky）：场景卡（「当前练习场景」caption；标题；personaZh；`--bg-inset` 块：「EN PERSONA」caption + `WordText` + `SpeakButton`）+ 目标卡（Target 图标 + 「已完成 x/n」；`.goal-row(.done)`：勾选框（done 橙底白勾）+ `WordText` + `SpeakButton` + `zhShown===g` 条件译文行）
- 右列：`.bubble-stream`（沿用现有 map：三色气泡/`zhShown`/`word-chip`/`bubble-actions`[朗读·译·`tts-progress-label`]/AI disabled 逻辑）；相位 `<p>` → `.phase-timer-bar`（含 F4 后缀）；`.practice-dock`（sticky 玻璃）：上排 听不懂/提示 + 结束练习（红 tint）；下排 `ios-input`（Enter 逻辑不变）+ `Recorder`
- `Recorder.tsx`：`.record-btn` + 录音态 `.is-recording`（**仅变红无动画**）；保留 `aria-pressed`、`aria-live`、44px
- `DictPopover` 结构不动（`.popover` 新皮）

- [ ] 实现；build；手动：完整一轮 键盘对话→目标打勾→朗读进度→悬停译文→词典加词→结束报告
- [ ] Commit：`feat: ios two-column practice page`

### T7: 生词本与其余页

**Files:** Modify `app/vocab/page.tsx`；抽查 `app/scenarios/page.tsx`、`app/settings/page.tsx`、`app/report/[id]/page.tsx`

- 生词本：header + `.ios-grouped-list`；行=单词 700 + 释义 + 斜体例句 + 「已使用 N 次 · 上次使用 relativeTime(lastUsedAt)」+ 右侧组合类 `vocab-status-pill.` select（与 Phase 2 定义一致） + 「删除」红 tint 胶囊；**保留全部 fetch/r.ok 逻辑**
- 其余页继承 token；把残留硬编码色/旧 class 替换为 token（发现一处改一处，不重构）

- [ ] 实现 + 逐页抽查；build
- [ ] Commit：`feat: ios vocab page and token cleanup across pages`

---

## Phase 4 · Electron 壳

### T8: main / preload / 类型 / dev 脚本 / stop-all -Quiet

**Files:** Create `electron/main.js`、`electron/preload.js`、`types/electron.d.ts`、`scripts/electron-dev.mjs`；Modify `scripts/stop-all.ps1`、`scripts/start-all.ps1`（`SPEAKLOOP_REPO_ROOT` 优先解析仓库根）

`main.js` 契约（模板为底 + 修正项）：
1. **生产**：`spawn(process.execPath, [path.join(appPath, ".next/standalone/server.js")], { cwd: path.join(appPath, ".next/standalone"), env: {...process.env, ELECTRON_RUN_AS_NODE: "1", PORT: <freePort>, HOSTNAME: "127.0.0.1", DATA_DIR: path.join(app.getPath("userData"), "data"), AUTO_STOP: "0"} })`——**必须显式传 `cwd` 为 standalone 目录**（Next 内部按 cwd 寻址 `.next/static`）；**打包必须 `asar: false`**（见 T9）——asar 归档内无法 spawn/RUN_AS_NODE 读取且不可作 cwd（ENOTDIR/MODULE_NOT_FOUND 必现）；端口从 3123 起探测空闲；HTTP 200 后再 `loadURL`
2. **dev**：`ELECTRON_START_URL` 存在则直接加载该 URL（不 spawn Next）
3. **数据迁移（B6）**：`userData/data` 不存在时，按序探测 **`SPEAKLOOP_DATA_SRC` → `electron/build-meta.json` 的 `repoRoot`/data → `process.cwd()`/data**，存在则整目录复制 + 写 marker（`userData/.data-migrated`）。（`app.getAppPath()/../data` 在 NSIS 安装版必空，移除该探测；`build-meta.json` 由 T9 构建脚本写入，记录本机打包时的仓库根，如 `E:\\EnglishDemo`）；同时**复制 `.env` 至 `userData/.env`**，主进程解析后注入 Next 子进程 env（保证 Chat Key/provider 配置随包生效）
4. **语音进程**：窗口显示后异步 spawn `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File <脚本绝对路径> -Silent -NoBrowser`（windowsHide）。**脚本路径区分打包态**：`isPacked ? process.resourcesPath : app.getAppPath()` + `/scripts/start-all.ps1`（extraResources 落在 `resources/scripts`，不在 appPath 下）；**并以 env `SPEAKLOOP_REPO_ROOT` 传入仓库根**（打包态取 `build-meta.repoRoot`）——`start-all.ps1` 需改造：`$root = $env:SPEAKLOOP_REPO_ROOT` 优先，其次 `Split-Path $PSScriptRoot -Parent`（否则安装后按脚本相对路径找不到 `ai-server/` 与 `logs/`）
5. **窗口**：`frame:false, width:1120, height:760, minWidth:920, minHeight:640, backgroundColor:"#F2F2F7", roundedCorners:true, resizable:true, maximizable:true`；`setPermissionRequestHandler`（media→allow）；`will-navigate` 仅 `127.0.0.1:<port>`；`setWindowOpenHandler` deny。**双击最大化：依赖 Windows 对 `-webkit-app-region: drag` 区域的原生标题栏双击行为（拖拽区 DOM 事件会被 Chromium 接管，渲染层 onDoubleClick 不会触发）——不实现自定义双击 IPC**
6. **IPC**：`window:minimize / window:toggle-maximize / window:close(=quit) / service:restart-voice`（重跑 start-all 并轮询 8100/8101 health 后返回）
7. **退出清理**（幂等，`isQuitting` 防重入）：杀 Next 子进程 → `powershell stop-all.ps1 -Quiet` → quit

- `preload.js`：`contextBridge.exposeInMainWorld("electronAPI", { isDesktopApp: true, minimize, toggleMaximize, close, restartVoiceServices })`
- `types/electron.d.ts`：`declare global { interface Window { electronAPI?: {...} } }`
- `scripts/electron-dev.mjs`：spawn `next dev` + 轮询 3000 → spawn `electron .`（`ELECTRON_START_URL=http://localhost:3000`）；退出时同步清理
- `stop-all.ps1`：增 `param([switch]$Quiet)`，`-Quiet` 时不弹 Wscript 提示

- [ ] 实现；`npx electron .` 冒烟（见终验矩阵）
- [ ] Commit：`feat: electron desktop shell with lifecycle guard`

### T9: 打包配置与图标

**Files:** Modify `package.json`；Create `public/icon.png`、`scripts/prepare-standalone.mjs`；Add devDeps electron/electron-builder

- `package.json`：`"main": "electron/main.js"`；scripts：`electron:dev`、`build:exe: "next build && node scripts/prepare-standalone.mjs && electron-builder --win --x64"`；`build` 段：`appId com.speakloop.desktop / productName SpeakLoop / **asar: false**`（本地工具最省心，彻底规避 asar 内 spawn/ENOTDIR 问题）/ `win: { target: "nsis", icon: "public/icon.png" }` / `extraResources: scripts` / `files: [".next/standalone/**", ".next/static/**", "public/**", "electron/**", "package.json"]`
- `prepare-standalone.mjs`：复制 `.next/static` → `.next/standalone/.next/static`、`public` → `.next/standalone/public`；**写入 `electron/build-meta.json`：`{ "repoRoot": "<打包时的 process.cwd()>" }`**（供打包态数据迁移与语音脚本仓库根解析）
- `public/icon.png`：512×512 蓝圆角底 + 白色 S（PowerShell `System.Drawing` 生成）

- [ ] `npm i -D electron electron-builder`；生成图标；`npm run build:exe` 产出 `dist/SpeakLoop Setup x.x.x.exe`
- [ ] Commit：`chore: electron-builder packaging config and icon`

---

## Phase 5 · 文档（设计侧）

### T10: spec v1.6 + README

- spec 头 → v1.6；§8.1 重写为 **iOS HIG**（色板/材质/分段/Inset List/双栏/气泡/banner/胶囊；**对比度例外备案**；Claymorphism 退役记录）
- spec §3 增桌面端进程拓扑；新增 §7.5「桌面端（Electron）」（standalone/动态端口/userData/AUTO_STOP=0/退出清理/迁移）
- README：双模式说明（浏览器 VBS / EXE 安装版）、build:exe 命令、数据目录（userData）、已知限制

- [ ] 落盘 + Commit：`docs: spec v1.6 ios hig desktop and readme`

---

## 终验矩阵（一次性）

| 层 | 标准 |
|---|---|
| 门禁 | **133/133** + typecheck 0 + build 绿 |
| 网页回归 | `node scripts/console-check.mjs` 四页零错误；`node scripts/acceptance-check.mjs` **13/13**（类名契约保持） |
| 视觉 | 首页/练习/生词三页截图对照模板；无青绿粗边；毛玻璃顶栏、分段控件、Inset List、双栏气泡、玻璃 dock |
| 功能回归 | 悬停译文瞬时/离开隐/复悬停即时；朗读进度「合成中 Ns→播放中→清除」；目标橙色打勾；词典+加词；设置即时生效；报告/422 重试；浏览器模式关标签 ~5s 停 + 多标签保活 |
| Electron 冒烟 | 无边框+顶栏拖拽+红黄绿+双击最大化（原生行为）；麦克风免弹窗直接录音；语音胶囊一键恢复；关窗后 8100/8101/3000 零残留 |
| EXE | 安装 → 首启迁移（会话/生词/设置齐全，`.env` 配置生效）→ 完整练习闭环（**安装版内语音朗读可用**：`SPEAKLOOP_REPO_ROOT` 解析到仓库 ai-server）→ 退出零残留 |

**已知限制备案**：三色对比度例外（A1）；语音后端仅本机 conda（A2）；Electron 无自动化测试（B9）；NSIS 首次构建需联网下载 Electron 二进制。
