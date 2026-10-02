# SpeakLoop 设计文档

- 日期：2026-10-01（v1.3，经两轮外部评审 + 实现方联合复核修订；勘误记录见 `docs/superpowers/plans/2026-10-01-speakloop-mvp1-erratum.md`）
- 状态：已确认
- 仓库：E:\EnglishDemo（全新仓库，本设计为首个交付物）

## 1. 一句话定义

一个装在浏览器里的 AI 英语口语私教——围绕职场真实场景进行语音对话练习，每次练习后给出纠错复盘报告（含原声回放），并把生词带回后续对话中反复使用。

闭环：学 → 用 → 反馈 → 再用。

## 2. 已确认决策

| 决策点 | 结论 | 理由 |
|---|---|---|
| 产品定位 | 自用 MVP，无登录，本地运行 | 先验证体验，不建账号体系 |
| 对话交互 | 轮次交替式（录音→STT→LLM→TTS） | 实现简单、成本低、易调试，每轮有明确边界便于积累复盘数据 |
| 编排方式 | 前端编排，后端细粒度 API | 每步可见可重试，天然适合 AI 产品调试 |
| 分层 | API Route 薄路由 + services 业务层 | 防路由变胖，业务逻辑可迁移（NestJS/FastAPI） |
| STT | **本地 Qwen3-ASR-0.6B**（RTX 3070/8GB；env 可切 1.7B） | 带口音英语 WER 16.62(0.6B)/16.07(1.7B)，优于 Whisper-large-v3(21.3)、GPT-4o-Transcribe(28.6)——口音鲁棒性是本应用命门 |
| TTS | **本地 Qwen3-TTS-12Hz-1.7B-CustomVoice** | 零调用成本、9 种预置音色（英语母语 Aiden/Ryan）+ 语气指令 |
| STT/TTS 部署形态 | **双 conda 环境双服务**（speakloop-asr :8100 / speakloop-tts :8101） | qwen-asr(0.0.6) 钉 `transformers==4.57.6`、qwen-tts(0.1.1) 钉 `==4.57.3`，PyPI 元数据核实互斥，单环境无解；拆分后官方包零改动 |
| Chat 服务商 | 未定，Provider 抽象 + Mock 先行 | 全链路唯一外部云端依赖 |
| 复盘形式 | 练后报告（纠错 + 亮点 + 生词候选 + 原声回放） | 不打断对话沉浸感 |
| 生词闭环 | 自动提取 + 确认 → 结构化注入后续对话 | 真正形成"再用"闭环 |
| 场景库 | 内置 4 个 + 自然语言自定义（预览可编辑） | 覆盖典型职场场景，保留灵活性 |
| 技术栈 | Next.js 全栈（App Router + TypeScript） | 前端页面与 API 代理单应用一键启动 |
| 存储 | 服务端 JSON 文件（`data/`），写队列 + 原子写 | 单用户体量足够，防 hot-reload 竞态与半文件损坏 |
| MVP 分期 | MVP-1 文字闭环（Mock 语音）→ MVP-2 真实语音 | 文字先行验证教学闭环；语音风险由阶段 0 spike 前置化解 |

## 3. 系统架构

```
┌─ 浏览器 ──────────────────────────────────────────────┐
│  React UI (App Router)                                 │
│  · MediaRecorder 录音 (webm/opus) + 键盘输入降级        │
│  · 前端编排每轮: 录音→/stt→/chat→/tts→播放             │
│  · AI 回复文字先显, TTS 异步生成完自动播放              │
└──────────────┬─────────────────────────────────────────┘
               │ fetch /api/*
┌──────────────▼─────────────────────────────────────────┐
│  Next.js API Routes（薄路由: 参数解析 + 调 service）     │
│  POST /api/stt {sessionId}+音频 → {turnId,text,audioUrl}│
│  POST /api/chat {sessionId,scenarioId,messages}→{reply} │
│  POST /api/tts {text,speaker?} → audio/wav              │
│  POST /api/report {sessionId} → Report                  │
│  /api/sessions /api/scenarios /api/vocab (CRUD)         │
└──────────────┬─────────────────────────────────────────┘
               │
┌──────────────▼─────────────────────────────────────────┐
│  lib/services（业务逻辑）                                │
│  practice / report / vocab / scenario                   │
│  ├─ lib/store/json-store.ts  update(key,fn) 写队列+原子写│
│  │   → data/*.json + data/audio/{sessionId}/            │
│  └─ lib/providers（供应商抽象）                          │
│      STTProvider / ChatProvider / TTSProvider           │
│      mock ×3 + qwen3-local(STT/TTS) → 云端 Chat 可后补  │
└──────────────┬──────────────────────────────────────────┘
               │ HTTP（STT_BASE_URL / TTS_BASE_URL）
   ┌───────────▼──────────────────┐  ┌───────────────────────────┐
   │ asr-server :8100              │  │ tts-server :8101           │
   │ env speakloop-asr             │  │ env speakloop-tts          │
   │ transformers==4.57.6          │  │ transformers==4.57.3       │
   │ qwen-asr 0.0.6                │  │ qwen-tts 0.1.1             │
   │ /stt  Qwen3-ASR-0.6B          │  │ /tts  Qwen3-TTS-1.7B-      │
   │ （webm→PyAV 16kHz→transcribe） │  │      CustomVoice → wav     │
   │ /health /warmup               │  │ /health /warmup            │
   └───────────────────────────────┘  └───────────────────────────┘
     同一份 ai-server/server.py，按 env AI_ROLE=asr|tts 加载对应模型
     CUDA bf16 + sdpa · 同卡双模型常驻 · 前端编排天然错峰 · 显存 ≈6GB/8GB
```

要点：

- **前端编排**：客户端按步调用 `/api/stt` → `/api/chat` → `/api/tts`，每步独立成功/失败/重试。
- **薄路由 + services**：API Route 只做参数解析与调用 service，业务逻辑全部在 `lib/services`，可独立测试、可迁移。
- **语音是增强不是依赖**：STT 可用键盘输入降级；TTS 不可用时纯文字对话，均不阻断。
- **仅 Chat 依赖外部云端**：STT/TTS 全本地，隐私与成本最优。

## 4. 项目结构

```
EnglishDemo/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # 仪表盘（统计+入口）
│   ├── scenarios/page.tsx        # 场景选择 + 自定义
│   ├── practice/[id]/page.tsx    # 对话页
│   ├── report/[id]/page.tsx      # 报告页
│   ├── vocab/page.tsx            # 生词本
│   └── api/
│       ├── stt/route.ts
│       ├── chat/route.ts
│       ├── tts/route.ts
│       ├── report/route.ts
│       ├── sessions/route.ts
│       ├── sessions/[id]/turns/route.ts
│       ├── scenarios/route.ts
│       └── vocab/route.ts
├── lib/
│   ├── domain/types.ts           # 全部数据模型（单一出处）
│   ├── services/
│   │   ├── practice.ts           # 会话/轮次/音频落盘
│   │   ├── report.ts             # 报告生成+校验+回填
│   │   ├── vocab.ts              # 生词状态机+注入选择
│   │   └── scenario.ts           # 内置种子+自定义生成
│   ├── store/json-store.ts       # update(key,fn) 写队列+原子写
│   ├── providers/
│   │   ├── types.ts              # 三大 Provider 接口
│   │   ├── stt/mock.ts  chat/mock.ts  tts/mock.ts
│   │   ├── stt/qwen3-local.ts
│   │   └── tts/qwen3-local.ts
│   ├── prompts.ts                # system prompt 构建+结构化生词注入
│   └── report-schema.ts          # zod schema + 容错解析
├── components/                   # Recorder/ChatBubble/ReportCard/VocabList 等
├── tests/                        # Vitest 单测
├── data/                         # scenarios/sessions/vocab.json + audio/{sessionId}/
├── ai-server/                    # Python 独立服务（与 Node 依赖隔离）
│   ├── server.py                 # FastAPI（按 AI_ROLE 注册 /stt 或 /tts、/health、/warmup）
│   ├── requirements-asr.txt      # qwen-asr, fastapi, uvicorn, python-multipart
│   └── requirements-tts.txt      # qwen-tts, fastapi, uvicorn, python-multipart
├── scripts/
│   ├── start-ai.ps1              # 拉起双进程（speakloop-asr :8100 + speakloop-tts :8101）
│   └── doctor.ts                 # npm run doctor 环境自检
└── .env.example                  # Provider 开关 + STT_BASE_URL + TTS_BASE_URL
```

## 5. 数据模型（lib/domain/types.ts）

```ts
interface Scenario {
  id: string
  title: string                    // 中文标题，如"周会汇报"
  persona: string                  // AI 角色设定（英文，喂给 system prompt）
  goals: string[]                  // 本场景练习目标（英文），驱动进度条
  difficulty: 'easy' | 'medium' | 'hard'
  builtin: boolean
  voice?: string                   // Qwen3-TTS 音色，缺省全局默认 Aiden
}

interface Turn {
  id: string
  userText: string
  aiText: string
  audioUrl?: string                // data/audio/{sessionId}/{turnId}.webm（原声回放）
  duration?: number                // 用户语音时长（秒）
  sttProvider: string              // 'qwen3-asr-local' | 'mock' | 'keyboard'(键盘输入)
  confidence?: number              // 预留字段：qwen-asr 现不返回，恒 undefined
  createdAt: string
}

interface Session {
  id: string
  scenarioId: string
  startedAt: string
  endedAt?: string
  turns: Turn[]
  goalProgress?: number[]          // 已完成 goals 下标（由 [GOAL_DONE:n] 累积）
}

interface ReportCorrection {
  turnId: string                   // 强制引用具体轮次（回填校验依据）
  original: string                 // 该轮用户原句
  type: 'grammar' | 'vocab' | 'idiom'
  improved: string                 // 更地道的表达
  explanation: string              // 中文解释
}

interface Report {
  sessionId: string
  summary: string                  // 总评（中文）
  highlights: string[]             // 亮点（做得好的地方，中文）
  corrections: ReportCorrection[]
  vocabCandidates: { word: string; translation: string; example: string }[]
}

type VocabStatus = 'new' | 'learning' | 'mastered' | 'ignored'

interface VocabWord {
  id: string
  word: string
  translation: string
  example: string
  sourceSessionId: string
  status: VocabStatus
  timesEncountered: number         // 后续对话中被使用次数（注入轮换排序）
  lastUsedAt?: string              // 供未来"30 天未用重新激活"（v1.1+）
  createdAt: string
}
```

生词状态机：

```
报告候选 ──采纳──▶ new ──首次注入──▶ learning ──用户标记──▶ mastered（停止注入）
   │
   └──忽略──────▶ ignored（不再作为候选推荐）
```

- 注入选择：`status ∈ {new, learning}`，按 `timesEncountered` 升序取前 5 个（用得少的优先，简化遗忘曲线）。
- 存储三文件：`data/scenarios.json`、`data/sessions.json`、`data/vocab.json`（均为数组）；音频 `data/audio/{sessionId}/{turnId}.webm`。

## 6. 核心流程

### 6.1 对话轮次

1. 用户点击录音 → MediaRecorder 采集（webm/opus）；**键盘输入作为并行入口**（开发调试 + STT 故障降级双用途，`sttProvider='keyboard'`）
2. 停止 → `POST /api/stt`（multipart：sessionId + 音频）→ practice-service 转发 ai-server、音频落盘、生成 turnId → 返回 `{turnId, text, audioUrl, duration}` 上屏可核对
3. `POST /api/chat {sessionId, scenarioId, messages}` → chat-service 从 store 读取待注入生词、构建 prompt → AI 回复文本**立即显示**，并解析 `[GOAL_DONE:n]`：命中则更新 `goalProgress` 并驱动进度条，标记本身从显示文本剥离；**容错：缺失/格式错误静默忽略，不影响对话**
4. **轮次落盘 `POST /api/sessions/{id}/turns`——可失败步骤**：失败→内联重试（标签"轮次保存"），**不播 TTS、不进入下一轮**；重试成功后补播 TTS
5. `POST /api/tts {text: 完整回复, speaker}` → **整段一次合成**（v2 勘误：自然度优先，弃分句）→ `await play()` 播放；合成期间状态行实时显示耗时（`语音合成中… Ns`），播放被拒视同语音离线
6. 任一步失败：该步内联显示重试按钮，已完成轮次不丢失
7. **分相位耗时指示器**（v2 勘误 F4）：`语音识别中 / 等待 AI 回复中 / 语音合成中` 三相位实时秒数（500ms 刷新，`aria-live` 播报）——慢可接受，但不允许用户疑心卡死

> 管道顺序（v1.3 勘误修正）：**stt → chat → save → tts**——轮次落盘先于语音播放，杜绝"气泡已显示但数据未落库"。

### 6.2 辅助按钮

- **听不懂**：向 Chat 发送预设请求「请用更简单的英语重新表达刚才的话」，不推进对话目标
- **提示**：请求一句当前情境可用的句式（中文说明+英文句式），不推进对话目标

### 6.3 练后报告（report-service）

1. 读 session，抽取全部用户轮次（turnId + 原句）
2. 构建约束 prompt：只分析给定轮次，每条 correction 必须携带 turnId 且 original 必须原样引用该轮原句（防幻觉）
3. ChatProvider 生成 JSON → zod 校验（剥离 markdown 围栏、缺失字段兜底）
4. **确定性回填校验**：corrections 的 original 与 turnId 对应 userText 归一化比对，不匹配→丢弃该条并记日志；**归一化后为空的轮次（如中文/纯标点输入）不参与任何匹配分支，视为无候选**
5. 词形归一化比对本次转写（用户+AI）与 active 生词 → `timesEncountered+1`、`lastUsedAt` 更新
6. 持久化 report → 报告页呈现：总评、亮点 highlights、逐句纠错（**原声回放按钮** + 改进表达对照）、生词候选（采纳/忽略）

### 6.4 生词闭环

结构化注入模板（prompts.ts），拒绝裸词表：

```
目标词汇（每次 ≤5 个，按使用次数升序轮换）：
- stakeholder：本轮目标=让用户听到并理解；使用语境=业务会议讨论
教练规则：
1. 自然地使用目标词汇，绝不生硬堆砌
2. 创造机会引导用户使用（提问、情境设计），每次最多引导 1-2 个
3. 用户正确使用时给予明确的正向强化
4. 回复保持英文、每次不超过 3 句（口语陪练短句多轮）
```

**目标归属纪律（v2 勘误 F2）**：goals 是**学习者**的练习目标——仅当学习者最近 1-2 轮原话清楚达成该目标时才可标记 `[GOAL_DONE:n]`；学习者回答短/空泛/跑题时改用追问引导，宁缺勿滥；AI 自己推进对话**不算**达成。

### 6.5 场景管理

- 内置 4 个：英文面试、周会汇报、向上沟通（manager 1:1）、同事寒暄 small talk
- 自定义：自然语言描述 → ChatProvider 生成 `{title, persona, goals, difficulty}` → **预览+可编辑** → 确认入库

### 6.6 延迟预算

| 步骤 | 预估 | 实测（spike 2026-10-01，3070 干净环境） |
|---|---|---|
| STT（0.6B，≤15s 音频） | 1-3s | **2.42s**（3.6s 音频，双进程并存时；单独跑 1.44s）✅ 达标 |
| Chat（云端非流式） | 1-5s | 待 MVP-2 云端接入后补测 |
| TTS（1.7B，≤3 句） | 2-5s | **10.44s**（11 词句/3.6s 音频）❌ **超标**（干净环境复测排除游戏抢占，系模型/管线本身） |
| 串行合计 | 最坏 ~10s | 文字先显对策下感知延迟≈STT+Chat |

MVP 对策（均已纳入）：文字先显 + TTS 异步播放（感知延迟≈STT+Chat，3-8s）；回复 ≤3 句；`/warmup` 预热。
升级路径（**v2 修订**）：SSE 流式已落地（打字机+goals 回收）；**分句 TTS 实机验证后按用户决策降为可选实验**——单句独立合成机械停顿明显、自然度差，最终采用整段合成。实测锚点：单句 TTS 合成 ~10.9s（3070+sdpa 本征吞吐）、整段感知延迟 ~13s 为已知限制，配套分相位耗时指示器缓解"卡死"疑虑；后续优化候选：0.6B 模型实测对比 / int8 量化。

## 7. ai-server 本地部署

### 7.1 模型与服务

- **双 conda 环境双服务**（transformers 钉版互斥的确定性解）：`speakloop-asr`（qwen-asr 0.0.6 / transformers 4.57.6）与 `speakloop-tts`（qwen-tts 0.1.1 / transformers 4.57.3）
- 代码：同一份 `ai-server/server.py`，按 env `AI_ROLE=asr|tts` 条件 import 与注册路由，各自只加载本服务模型
- 模型：`Qwen/Qwen3-ASR-0.6B`（默认，env `ASR_MODEL` 可切 1.7B）+ `Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice`
- 精度与注意力：bf16 + PyTorch 原生 sdpa（Windows 免 flash-attn）
- 显存：≈3.4GB(TTS) + ≈1.5GB(ASR) + 运行时开销 ≈ 6GB / 8GB（3070），同卡双进程常驻，前端编排天然错峰，spike 实测
- 权重：ModelScope 预下载到本地目录，运行时不拉取
- 启动：`scripts/start-ai.ps1` 一次拉起双进程（asr → 127.0.0.1:8100，tts → 127.0.0.1:8101）

### 7.2 端点（两服务路径一致，语义同前）

- `POST /stt`（:8100）：multipart 音频（webm/opus 原样）→ PyAV 解码归一 16kHz → `transcribe(language="English")` → `{text}`
- `POST /tts`（:8101）：`{text, speaker?, instruct?}` → `audio/wav`（language 固定 English）
- `GET /health`（各自）：`{status:'ok', asr:bool}` / `{status:'ok', tts:bool}`
- `POST /warmup`（各自）：对本服务模型执行一次首推理，把冷启动挪到无感时机（前端仪表盘加载时 fire-and-forget 触发两服务）

### 7.3 Next.js 侧与降级

- `STT_BASE_URL`（默认 `http://127.0.0.1:8100`）与 `TTS_BASE_URL`（默认 `http://127.0.0.1:8101`）；`sttProvider/ttsProvider = 'mock' | 'qwen3-local'` 按 env 选择
- 任一服务离线：STT→键盘输入降级提示；TTS→503 纯文字继续 + “语音服务离线”标识；Mock 模式返回模拟文本/本地提示音 wav

## 8. UI 页面

| 路由 | 内容 |
|---|---|
| `/` | **学习仪表盘**：本周练习次数、生词状态分布（new/learning/mastered 计数）、错误类型 Top3（聚合历史 report 的 corrections.type）；最近练习记录、开始练习、生词本入口 |
| `/scenarios` | 内置场景卡片（4 个）+ 自定义表单（生成→预览编辑→保存） |
| `/practice/[id]` | 场景目标 + **goals 进度条** + 气泡对话流 + 录音按钮/键盘输入切换 + “听不懂”/“提示”按钮 + 实时识别文本 + 结束练习 |
| `/report/[id]` | 总评 + 亮点 + 逐句纠错卡片（**原声回放** + 改进对照）+ 生词候选采纳/忽略 |
| `/vocab` | 生词列表（状态、来源场次、使用次数、lastUsedAt）、标记掌握、删除 |

### 8.1 视觉设计（活泼学习风 · Claymorphism，2026-10-01 评审后增补）

依据：ui-ux-pro-max 技能库命中结果——product 域 "Language Learning App"（进度可视化优先）+ style 域 claymorphism + color 域 LMS 教育色板。

- **色彩 token（LMS 教育色板）**：primary `#0D9488` 深青（on-primary 黑字）/ accent `#D97706` 琥珀（进度与成就）/ secondary `#2DD4BF` / background `#F0FDFA` / foreground `#134E4A` / card `#FFFFFF` / muted `#E8F1F4` / muted-fg `#475569`（白底 ≈7:1）/ border `#5EEAD4` / destructive `#DC2626` / ring `#0D9488`
- **造型 token（Claymorphism）**：圆角 16-24px（`--radius-md/lg`）；3px 厚边框；双阴影 `inset -2px -2px 8px` + `4px 4px 8px`；软按压 `scale(0.97)` 200ms ease-out；完成态弹跳 `cubic-bezier(0.34,1.56,0.64,1)`（仅微动效）
- **字体**：Baloo 2（标题）+ Plus Jakarta Sans（正文），system-ui 回退
- **无障碍硬性**（该风格 accessibility=conditional）：文字对比 ≥4.5:1；`:focus-visible` 2px ring 焦点环；`prefers-reduced-motion` 兜底；按钮 min-height 44px；图标一律 Phosphor 矢量（`@phosphor-icons/react`），禁止 emoji 作结构性图标；录音按钮 `aria-pressed`、录音状态 `aria-live`
- **间距节奏**：`--space-1..5` = 4/8/16/24/32px

## 9. 错误处理

| 场景 | 处理 |
|---|---|
| STT/Chat/TTS 任一步失败 | 该步骤内联错误 + 重试按钮，已完成轮次保留 |
| 麦克风权限拒绝 | 引导开启，可切键盘输入继续 |
| 任一 ai 服务未启动 | STT→键盘降级；TTS→纯文字 + 离线标识 |
| 报告 JSON 解析失败 | zod 容错（剥围栏/兜底）→ 仍失败展示原始文本 + 重试 |
| 报告幻觉 | turnId 回填校验丢弃不实条目 |
| 无任何云端 Key | 全 Mock：模拟 STT 文本、模板 Chat 回复、提示音 TTS，全流程零成本可演示 |
| 页面数据加载/动作请求失败 | 显式错误提示；加载态必须终结；busy 必须 try/finally 复位；路由跳转前校验目标 id，禁止 undefined 路由（v1.3 增补） |
| 环境异常 | `npm run doctor`：Node 版本、data/ 可写、asr/tts 双服务 /health、GPU 显存（nvidia-smi） |

## 10. 测试策略（Vitest，全部基于 Mock，不依赖 Key 与 GPU）

- `json-store`：写队列顺序性、原子写（无半文件）、并发 update
- `vocab-service`：状态机迁移（new/learning/mastered/ignored）、注入选择（≤5、timesEncountered 升序、排除 mastered/ignored）
- 词形归一化匹配：时态/单复数变化命中
- `[GOAL_DONE:n]` 解析：正常/缺失/格式错（静默忽略）
- `report-schema`：zod 正常/围栏包裹/字段缺失/非法输入
- `report-service` 回填校验：turnId 不匹配的 correction 被丢弃
- `prompts`：结构化注入模板（有/无生词）
- E2E（Playwright，可选收尾）：Mock 模式走通 练习→报告→生词入库→再练习注入 完整闭环

## 11. MVP 明确不做（Non-Goals）

- 登录/多用户
- 专项发音评分（原声回放仅自助对比）
- 实时连续对话、分句 TTS 管线（v1.1）
- confidence 展示（qwen-asr 无数据源，字段仅预留）
- 移动端深度适配、云端部署
- 语音克隆（Base）/ 音色设计（VoiceDesign）——`instruct` 字段已预留
- lastUsedAt 驱动的复习调度（v1.1+）

## 12. 实施阶段

**阶段 0 —— 半天 spike（风险前置）**
ai-server 双服务跑通 `/health` `/stt`（:8100）与 `/tts`（:8101）；验证：双环境独立运行（asr 4.57.6 / tts 4.57.3）、webm 解码、8GB 双模型显存实测、3070 上 STT/TTS 耗时实测（校准延迟预算）。**此阶段失败则架构支柱重议。**

**MVP-1 —— 文字闭环（Mock 语音）**
脚手架（目录结构/domain/json-store/doctor）、mock providers、内置场景+自定义、对话页（键盘输入+Mock STT+文字回复+Mock TTS 提示音）、goals 进度、报告（zod+回填+highlights）、生词闭环（四态+结构化注入）、仪表盘统计。**结束态：无 GPU 无 Key 全流程可跑。**

**MVP-2 —— 真实语音**
`stt/qwen3-local` + `tts/qwen3-local` 接入、真实录音链路（音频落盘+原声回放）、warmup 预热、错误降级实测；**SSE 流式 chat 为必做项**；~~分句 TTS 管线~~（v2 修订：实机验证后按用户决策降为可选实验，采用整段合成+相位耗时指示器，见 §6.6）。

**收尾 —— 打磨**
辅助按钮体验、报告页排版、测试补齐、E2E（可选）。

每阶段结束应用保持可运行。
