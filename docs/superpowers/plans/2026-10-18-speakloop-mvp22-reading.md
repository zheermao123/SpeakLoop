# SpeakLoop MVP-2.2 实施计划（对话阅读增强：播报 / 悬停翻译 / 逐词词意）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** 对话页阅读三件套——① persona 英文行与每个 AI 气泡一键语音播报（复用 AudioQueue/postTts）；② AI 气泡悬停（300ms）或「译」按钮触发整段中文翻译，译文以 zh-line 附着气泡下方（触屏等价）；③ AI 气泡与 persona 英文逐词点击弹出词意菜单（音标/词性/中文释义/例句），菜单内一键加入生词本。历史会话自动生效。

**Architecture:** 渲染层三组件（WordText 分词渲染 / DictPopover 词意菜单 / SpeakButton 播报按钮），页面级单一 popover 状态；数据层两个薄 API（/api/dictionary、/api/translate）→ services 层调用 ChatProvider，json-store 持久缓存（`data/dictionary.json`、`data/translations.json`，键=word 小写 / trim 后原文）——同一词/同一句全局只花一次 token。词意数据源默认 LLM+缓存（服务层 `chat?` 注入缝保留，本地词典可后替）。翻译呈现采用**附着 zh-line**（优于浮层：学习场景更稳、触屏一致）。

**Tech Stack:** 既有基线（**100 tests**、typecheck 门禁、claymorphism tokens、Phosphor 图标）；新增组件零依赖。

## Global Constraints

- 基线 100；推进 **100→104→109→112**（T1×4、T2×5、T3×3；T4/T5 组件任务不加单测，以 build 验证）
- 每任务 `npm test` 全绿 + `npm run typecheck` + `npm run build`
- **触屏等价硬规则**（ui-ux-pro-max High 级）：悬停翻译必须有点击入口（「译」按钮）；词点击为 tap 原生
- 图标一律 Phosphor（SpeakerHigh/Translate）；图标控件 aria-label + ≥44px 命中区；词 span `cursor:pointer` + hover 虚线下划线
- a11y：词 span `role="button"` `tabIndex={-1}`（不入 tab 序，键盘可达性为已知限制）；Popover `role="dialog"`、Esc/外点关闭、全局单开
- **Key 安全/成本**：词典/翻译缓存文件位于 `data/`（gitignore 覆盖）；路由失败语义：400 缺参 / 502 上游失败 `{error}`
- 既有 UI 不变量延续（r.ok / busy try-finally / 无 undefined 路由）；代码无注释

---

### Task 1: lib/word-token.ts 分词器

**Files:**
- Create: `lib/word-token.ts`
- Test: `tests/word-token.test.ts`

**Interfaces:**
- Produces: `type WordToken = { type: "word" | "text"; value: string }`；`tokenizeWords(text): WordToken[]`——正则 `[A-Za-z]+(?:'[A-Za-z]+)?`（缩写 don't 保持完整），其余字符（标点/空白/换行/数字）按序聚合为 text 段；拼接还原原文。

- [ ] **Step 1: 写失败测试** `tests/word-token.test.ts`：

```ts
import { expect, it } from "vitest"
import { tokenizeWords } from "@/lib/word-token"

it("切分单词与文本段", () => {
  expect(tokenizeWords("Hello, world!")).toEqual([
    { type: "word", value: "Hello" },
    { type: "text", value: ", " },
    { type: "word", value: "world" },
    { type: "text", value: "!" },
  ])
})

it("缩写保持完整", () => {
  expect(tokenizeWords("I don't know.")).toEqual([
    { type: "word", value: "I" },
    { type: "text", value: " " },
    { type: "word", value: "don't" },
    { type: "text", value: " " },
    { type: "word", value: "know" },
    { type: "text", value: "." },
  ])
})

it("拼接还原原文", () => {
  const text = "It's 3 o'clock.\nLet's go!"
  expect(tokenizeWords(text).map(t => t.value).join("")).toBe(text)
})

it("无字母文本返回单段", () => {
  expect(tokenizeWords("42\n!!")).toEqual([{ type: "text", value: "42\n!!" }])
})
```

- [ ] **Step 2: 确认 FAIL** — `npx vitest run tests/word-token.test.ts`
- [ ] **Step 3: 实现**

```ts
export type WordToken = { type: "word" | "text"; value: string }

export function tokenizeWords(text: string): WordToken[] {
  const tokens: WordToken[] = []
  const re = /[A-Za-z]+(?:'[A-Za-z]+)?/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) tokens.push({ type: "text", value: text.slice(last, m.index) })
    tokens.push({ type: "word", value: m[0] })
    last = m.index + m[0].length
  }
  if (last < text.length) tokens.push({ type: "text", value: text.slice(last) })
  return tokens
}
```

- [ ] **Step 4: 全量门禁** — `npm test` **104** / typecheck 0 / build 绿
- [ ] **Step 5: Commit** — `git add lib/word-token.ts tests/word-token.test.ts` → `feat: word tokenizer for interactive reading`

---

### Task 2: 词意服务 + POST /api/dictionary

**Files:**
- Modify: `lib/store/json-store.ts`（Collection 增加 `"dictionary"` | `"translations"`）
- Create: `lib/services/dictionary.ts`、`app/api/dictionary/route.ts`
- Test: `tests/dictionary.test.ts`

**Interfaces:**
- Produces: `interface DictEntry { word; phonetic; pos; meaning; example; createdAt }`（word 存小写键）；`lookupWord(word, sentence?, chat?)`——缓存命中不调 LLM；未命中调 ChatProvider（prompt 输出 JSON phonetic(IPA)/pos(词性缩写)/meaning(简明中文释义)/example(语境英文例句)，容错解析剥围栏+截取大括号+默认值兜底）后原子落盘
- Route: `POST /api/dictionary {word, sentence?}` → 200 entry；400 缺 word；502 `{error}` 上游失败

- [ ] **Step 1: 写失败测试** `tests/dictionary.test.ts`：

```ts
import { mkdtempSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { beforeEach, expect, it } from "vitest"
import { ChatProvider } from "@/lib/providers/types"
import { read } from "@/lib/store/json-store"
import { lookupWord } from "@/lib/services/dictionary"

beforeEach(() => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "sl-dict-"))
})

function fakeChat(reply: string, calls: string[]): ChatProvider {
  return {
    async chat(_system, messages) {
      calls.push(messages[messages.length - 1].content)
      return reply
    },
    async chatStream() {
      return ""
    },
  }
}

it("未命中→调 LLM→解析并落盘", async () => {
  const calls: string[] = []
  const reply = "```json\n{\"phonetic\":\"/ˈniːɡoʊʃieɪt/\",\"pos\":\"v.\",\"meaning\":\"谈判；协商\",\"example\":\"We negotiated the deal.\"}\n```"
  const e = await lookupWord("Negotiate", "We negotiated the deal.", fakeChat(reply, calls))
  expect(calls).toHaveLength(1)
  expect(e.word).toBe("negotiate")
  expect(e.meaning).toBe("谈判；协商")
  expect((await read("dictionary")).length).toBe(1)
})

it("命中→零 LLM 调用", async () => {
  const calls: string[] = []
  const c = fakeChat("{}", calls)
  await lookupWord("blocker", "", c)
  await lookupWord("blocker", "", c)
  expect(calls).toHaveLength(1)
})

it("解析容错兜底", async () => {
  const e = await lookupWord("odd", "", fakeChat("not json at all", []))
  expect(e.meaning).toContain("odd")
  expect((await read("dictionary")).length).toBe(1)
})
```

- [ ] **Step 2: 确认 FAIL** — `npx vitest run tests/dictionary.test.ts`
- [ ] **Step 3: 实现** — json-store Collection 扩展；`lib/services/dictionary.ts`：

```ts
import { ChatProvider, getChat } from "@/lib/providers/types"
import { read, update } from "@/lib/store/json-store"

export interface DictEntry {
  word: string
  phonetic: string
  pos: string
  meaning: string
  example: string
  createdAt: string
}

export async function lookupWord(word: string, sentence: string, chat?: ChatProvider): Promise<DictEntry> {
  const key = word.trim().toLowerCase()
  const cached = (await read<DictEntry>("dictionary")).find(e => e.word === key)
  if (cached) return cached
  const provider = chat ?? (await getChat())
  const system =
    "You are an English dictionary for Chinese learners. Output ONLY a JSON object: " +
    '{"phonetic":string(IPA, empty if unsure),"pos":string(part of speech abbreviation like n./v./adj.),' +
    '"meaning":string(简明中文释义, 一行),"example":string(一句英文例句, 贴合给定句子语境)}'
  const raw = await provider.chat(system, [
    { role: "user", content: `word: ${word}${sentence ? `\nsentence: ${sentence}` : ""}` },
  ])
  let parsed: Partial<DictEntry>
  try {
    const t = raw.trim()
    const s = t.indexOf("{")
    const e = t.lastIndexOf("}")
    parsed = s >= 0 && e > s ? JSON.parse(t.slice(s, e + 1)) : {}
  } catch {
    parsed = {}
  }
  const entry: DictEntry = {
    word: key,
    phonetic: String(parsed.phonetic ?? ""),
    pos: String(parsed.pos ?? ""),
    meaning: String(parsed.meaning ?? "").trim() || `（释义生成失败）${key}`,
    example: String(parsed.example ?? ""),
    createdAt: new Date().toISOString(),
  }
  await update<DictEntry>("dictionary", d => [...d.filter(e => e.word !== key), entry])
  return entry
}
```

`app/api/dictionary/route.ts`：

```ts
import { NextRequest, NextResponse } from "next/server"
import { lookupWord } from "@/lib/services/dictionary"

export async function POST(req: NextRequest) {
  const { word, sentence } = await req.json()
  if (!word?.trim()) return NextResponse.json({ error: "word required" }, { status: 400 })
  try {
    return NextResponse.json(await lookupWord(word, sentence ?? ""))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
```

- [ ] **Step 4: 路由测试补两条**（追加至 tests/dictionary.test.ts）：400 缺 word；200 形状（`vi.mock` openai-compatible 模块 + beforeEach 设 CHAT_* env——沿用 settings-test 模式）→ 共 **5 测试**
- [ ] **Step 5: 全量门禁** — **109** / 0 / 绿
- [ ] **Step 6: Commit** — `git add lib/store/json-store.ts lib/services/dictionary.ts app/api/dictionary tests/dictionary.test.ts` → `feat: dictionary service with persistent cache and route`

---

### Task 3: 翻译服务 + POST /api/translate

**Files:**
- Create: `lib/services/translate.ts`、`app/api/translate/route.ts`
- Test: `tests/translate.test.ts`

**Interfaces:**
- Produces: `interface TranslationEntry { text; translation; createdAt }`（text 存 trim 后原文整段键）；`translateText(text, chat?)`——缓存命中零调用；未命中 system「Translate the English text to natural Chinese. Output ONLY the translation, no notes.」后 trim 落盘
- Route: `POST /api/translate {text}` → 200 `{text, translation, createdAt}`；400 缺 text；502 上游失败

- [ ] **Step 1: 写失败测试** `tests/translate.test.ts`（模式同 Task 2）：

```ts
import { mkdtempSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { beforeEach, expect, it } from "vitest"
import { ChatProvider } from "@/lib/providers/types"
import { translateText } from "@/lib/services/translate"

beforeEach(() => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "sl-tr-"))
})

it("翻译并缓存（命中零调用）", async () => {
  const calls: string[] = []
  const c: ChatProvider = {
    async chat(_s, m) {
      calls.push(m[m.length - 1].content)
      return " 你好，很高兴认识你。 "
    },
    async chatStream() {
      return ""
    },
  }
  const first = await translateText("  Hello, nice to meet you.  ", c)
  expect(first.translation).toBe("你好，很高兴认识你。")
  const second = await translateText("Hello, nice to meet you.", c)
  expect(second.translation).toBe("你好，很高兴认识你。")
  expect(calls).toHaveLength(1)
})
```

- [ ] **Step 2: 确认 FAIL**
- [ ] **Step 3: 实现**

```ts
import { ChatProvider, getChat } from "@/lib/providers/types"
import { read, update } from "@/lib/store/json-store"

export interface TranslationEntry {
  text: string
  translation: string
  createdAt: string
}

export async function translateText(text: string, chat?: ChatProvider): Promise<TranslationEntry> {
  const key = text.trim()
  const cached = (await read<TranslationEntry>("translations")).find(e => e.text === key)
  if (cached) return cached
  const provider = chat ?? (await getChat())
  const translation = (
    await provider.chat("Translate the English text to natural Chinese. Output ONLY the translation, no notes.", [
      { role: "user", content: key },
    ])
  ).trim()
  const entry: TranslationEntry = { text: key, translation, createdAt: new Date().toISOString() }
  await update<TranslationEntry>("translations", d => [...d.filter(e => e.text !== key), entry])
  return entry
}
```

`app/api/translate/route.ts`（同构 dictionary 路由：400 缺 text / 502）：

```ts
import { NextRequest, NextResponse } from "next/server"
import { translateText } from "@/lib/services/translate"

export async function POST(req: NextRequest) {
  const { text } = await req.json()
  if (!text?.trim()) return NextResponse.json({ error: "text required" }, { status: 400 })
  try {
    return NextResponse.json(await translateText(text))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
```

- [ ] **Step 4: 路由测试补两条**（200 形状 vi.mock 模式 / 400）→ 共 **3 测试**
- [ ] **Step 5: 全量门禁** — **112** / 0 / 绿
- [ ] **Step 6: Commit** — `git add lib/services/translate.ts app/api/translate tests/translate.test.ts` → `feat: translate service with persistent cache and route`

---

### Task 4: 组件三件套（无新单测，build 验证）

**Files:**
- Create: `components/SpeakButton.tsx`、`components/WordText.tsx`、`components/DictPopover.tsx`

**Interfaces:**
- `SpeakButton { onSpeak: () => void; label?: string; disabled?: boolean }`——`.icon-btn`（44px 命中区）+ SpeakerHigh size=16 aria-hidden；按钮 aria-label（默认「朗读」）
- `WordText { text; onWordClick?: (word: string, el: HTMLSpanElement) => void; activeWord?: string }`——tokenize 渲染；词 span `role="button"` `tabIndex={-1}` `aria-label={查询 X}` `className="word-chip"`（activeWord 命中加 active）
- `DictPopover { word; sentence; anchor: DOMRect; onClose; sessionId? }`——挂载即 fetch /api/dictionary（loading/error(重试，attempt 计数重发)/ready）；ready 态展示 word+phonetic+pos(chip)+meaning+example + 「加入生词本」按钮（POST /api/vocab status=new，成功态「已在生词本」disabled，失败可重试）；`position:fixed` 定位于 anchor.bottom+8、左缘 clamp `min(anchor.left, innerWidth-300)`；Esc/外点 mousedown 关闭（word-chip 内点击除外）；`role="dialog"` aria-label

- [ ] **Step 1: 实现三组件**（按上述契约，无注释）
- [ ] **Step 2: 门禁** — `npm test` 112 不变 / typecheck 0 / build 绿
- [ ] **Step 3: Commit** — `git add components` → `feat: speak button, word text, dict popover components`

---

### Task 5: 练习页接线

**Files:**
- Modify: `app/practice/[id]/page.tsx`

**Interfaces:**
- 页面级状态：`const [dict, setDict] = useState<{ word: string; sentence: string; anchor: DOMRect } | null>(null)`；`const [zhMap, setZhMap] = useState<Record<string, string>>({})`（键=气泡原文）；悬停计时器 useRef
- `onWordClick(word, el)`：`setDict({ word, sentence: <该气泡或 persona 英文全文>, anchor: el.getBoundingClientRect() })`
- `ensureZh(text)`：zhMap 已有则跳过；否则 setZhMap 占位「翻译中…」→ `POST /api/translate` → r.ok 检查 → 写入 zhMap（失败写「（翻译失败）」并保留重试可能）
- persona 行：`<WordText text={scenario.persona} onWordClick={...} activeWord={dict?.word} />` + SpeakButton（`postTts(scenario.persona)`，label=朗读角色设定）
- AI 气泡：文本区 WordText + `bubble-actions` 行（SpeakButton 朗读本句 / 「译」Translate 图标按钮 → ensureZh）；气泡容器 `onMouseEnter` 起 300ms 计时器 → ensureZh，`onMouseLeave` 清除；`zhMap[b.text]` 存在时渲染 `.zh-line`（标签「译文」+内容）
- 教练/用户气泡不动；popover 渲染于页面根部 `{dict && <DictPopover ... sessionId={session?.id} onClose={() => setDict(null)} />}`

- [ ] **Step 1: 实现接线**（手术式最小改动）
- [ ] **Step 2: 门禁** — 112 不变 / typecheck 0 / build 绿（/practice 路由在列）
- [ ] **Step 3: Commit** — `git add "app/practice/[id]/page.tsx"` → `feat: wire reading enhancements into practice page`

---

### Task 6: 样式 + README + 全量终验

**Files:**
- Modify: `app/globals.css`、`README.md`

- [ ] **Step 1: globals.css 追加**（token 化，无硬编码新色）：

```css
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  padding: 0 var(--space-2);
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-muted-foreground);
  cursor: pointer;
}
.icon-btn:hover { background: var(--color-muted); color: var(--color-foreground); }
.icon-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.word-chip { cursor: pointer; border-bottom: 2px dotted transparent; }
.word-chip:hover { border-bottom-color: var(--color-primary); background: var(--color-muted); }
.word-chip.active { background: var(--color-muted); border-bottom-color: var(--color-primary); }

.zh-line {
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-muted);
  border-radius: var(--radius-md);
  font-size: 14px;
}
.zh-line .zh-label { color: var(--color-muted-foreground); margin-right: var(--space-2); font-size: 12px; }

.bubble-actions { display: flex; gap: var(--space-1); margin-top: var(--space-1); }

.popover {
  z-index: 50;
  max-width: 280px;
  padding: var(--space-3);
  background: var(--color-card);
  color: var(--color-card-foreground);
  border: var(--border-thick) solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-inner), var(--shadow-outer);
}
```

- [ ] **Step 2: README 功能特性追加一条**：`对话阅读增强：角色设定与 AI 回复一键朗读；AI 回复悬停/点「译」显示中文；英文逐词点击查词意并可直接加入生词本`
- [ ] **Step 3: 全量门禁** — **112 passed** / typecheck 0 / build 绿
- [ ] **Step 4: 手动走查清单**（浏览器）：persona 行朗读出声；AI 气泡朗读；悬停 300ms 出译文、zh-line 持久；「译」按钮触屏等价；点词出菜单（音标/词性/释义/例句）；加入生词本 → /vocab 可见；Esc/外点关闭；历史会话进入同样生效；语音服务停机时播报走离线降级不阻断
- [ ] **Step 5: Commit** — `git add app/globals.css README.md` → `feat: reading enhancement styles and readme`


## 实现漂移与排除注记（2026-10-18 设计侧追记）

1. **goals 超计划实做**：本计划原文仅覆盖 persona 与 AI 气泡；执行方将三件套扩展至 goals 列表（悬停/点非词区译、播报、分词）——方向与用户「全元素无排除」原则一致，予以追认
2. **coach/user 气泡当时排除原委**：首版聚焦对话主线元素；用户 2026-10-18 裁定全元素覆盖后，由 II 期计划 `2026-10-18-speakloop-mvp22b-reading-coverage.md` 补齐（该计划取代本计划在此两项上的口径）
3. **persona 翻译方式裁定**：personaZh 常显中文优于悬停（零成本、常驻可见），不补悬停接口
4. **混合文本策略裁定**：含中文段跳过翻译（播报与分词照常）——见 spec §6.7