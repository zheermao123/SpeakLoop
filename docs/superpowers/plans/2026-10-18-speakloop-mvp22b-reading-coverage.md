# SpeakLoop MVP-2.2b 实施计划（阅读增强 II：全元素覆盖）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** 阅读三件套（播报/悬停译/逐词词典）覆盖对话页**全部英文元素，无角色排除**——本计划补齐 coach 气泡（听不懂/提示）与 user 气泡（学习者句子）；含中文段**跳过翻译**（播报与分词照常）；persona 维持 personaZh 常显（用户裁定 2026-10-18，不补悬停）。

**背景（文档审计结论 2026-10-18）：** MVP-2.2 计划原文「教练/用户气泡不动」与用户新需求「不做任何角色或类型排除」冲突；实现实况——persona/goals/AI 气泡已有三件套（goals 为执行方超计划扩展），coach/user 缺失。本计划为唯一范围差量，其余能力全部复用。

**Architecture:** 复用既有底座零新造——WordText/DictPopover/SpeakButton、`/api/translate`+`/api/dictionary` 持久缓存（新元素自动共享全局按词/按句缓存）、AudioQueue 队列、语音离线降级、Esc/外点单开。唯一新增逻辑：`hasCjk` 纯函数（翻译能力开关）。

**Tech Stack:** 既有基线（**112 tests**；voice-status 计划另行推进至 119，与本计划互不依赖）。

## Global Constraints

- 基线 112；本计划 **+2 → 114**（T1 纯函数 ×2；T2 组件任务不加单测，build+手动验证；两计划合并终态以执行序为准）
- 每任务 `npm test` 全绿 + `npm run typecheck` + `npm run build`
- **混合文本策略（用户裁定）**：含中文段——跳过翻译（不显「译」按钮、悬停不触发 ensureZh）；播报与逐词照常（中文自然落 text 段不可点，无副作用）
- persona 零改动（personaZh 常显已在，不补悬停）
- 触屏等价/aria/44px/Phosphor/无 emoji 既有规则延续；代码无注释
- 已知小项（注记，不阻塞）：混合文本整段送 TTS——中文部分由 Qwen3-TTS 多语模型朗读（language 参数仍 English 引导韵律），实机不自然后再列 fast-follow

---

### Task 1: hasCjk 纯函数

**Files:**
- Modify: `lib/word-token.ts`（追加导出）
- Test: `tests/word-token.test.ts`（追加用例）

**Interfaces:**
- Produces: `hasCjk(text: string): boolean`——检测中日韩统一表意文字（含扩展 A 与兼容区），用于翻译能力开关（含中文 ⇔ 跳过翻译）

- [ ] **Step 1: 追加失败测试**（`tests/word-token.test.ts` 末尾）

```ts
it("hasCjk：中英判定（翻译能力开关）", () => {
  expect(hasCjk("你好")).toBe(true)
  expect(hasCjk("Hello 你好")).toBe(true)
  expect(hasCjk("情景演练：和外国客户谈判")).toBe(true)
  expect(hasCjk("Hello, world! 42.")).toBe(false)
  expect(hasCjk("")).toBe(false)
})
```

同文件顶部 import 增补 `hasCjk`。

- [ ] **Step 2: 确认 FAIL** — `npx vitest run tests/word-token.test.ts`

- [ ] **Step 3: 实现**（`lib/word-token.ts` 追加）

```ts
export function hasCjk(text: string): boolean {
  return /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(text)
}
```

- [ ] **Step 4: 全量门禁** — `npm test` **114** / typecheck 0 / build 绿

- [ ] **Step 5: Commit** — `git add lib/word-token.ts tests/word-token.test.ts` → `feat: cjk detector for translation gating`

---

### Task 2: 气泡渲染统一（coach/user 接入三件套）

**Files:**
- Modify: `app/practice/[id]/page.tsx`（bubbles 渲染区，约 :322-344）
- Modify: `app/globals.css`（user/coach 气泡内控件对比度）

**Interfaces:**
- Consumes: `hasCjk`、既有 `WordText`/`SpeakButton`/`ensureZh`/`handleWordClick`/`queue`/`postTts`/`zhMap`
- Produces: 全体气泡富渲染——`canTranslate = !hasCjk(b.text)` 门控悬停与「译」按钮；播报/逐词全角色可选（无中文判定限制）；user 气泡内 word-chip/icon-btn 高对比样式

- [ ] **Step 1: 替换 bubbles 渲染**（`{bubbles.map(...)}` 整块替换为）

```tsx
        {bubbles.map((b, i) => {
          const canTranslate = !hasCjk(b.text)
          const speakingNow = busy && b.role === "ai" && i === bubbles.length - 1
          return (
            <div
              key={i}
              className={`bubble ${b.role === "user" ? "bubble-user" : b.role === "ai" ? "bubble-ai" : "bubble-coach"}`}
              onMouseEnter={canTranslate && !busy ? () => { hoverTimer.current = setTimeout(() => ensureZh(b.text), 300) } : undefined}
              onMouseLeave={canTranslate ? () => { if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null } } : undefined}
            >
              <WordText text={b.text} onWordClick={handleWordClick(b.text)} activeWord={dict?.word} />
              <div className="bubble-actions">
                <SpeakButton
                  onSpeak={() => queue().enqueue(() => postTts(b.text))}
                  label="朗读本句"
                  disabled={speakingNow}
                />
                {canTranslate && (
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="显示中文翻译"
                    aria-pressed={!!zhMap[b.text]}
                    onClick={() => ensureZh(b.text)}
                  >
                    <Translate size={16} weight="regular" aria-hidden="true" />
                  </button>
                )}
              </div>
              {canTranslate && zhMap[b.text] && (
                <div className="zh-line"><span className="zh-label">译文</span>{zhMap[b.text]}</div>
              )}
            </div>
          )
        })}
```

文件顶部按需增补 `import { hasCjk } from "@/lib/word-token"`。

- [ ] **Step 2: globals.css 追加**（user 气泡为深青底白字，需高对比控件样式）

```css
.bubble-user .word-chip { border-bottom-color: rgba(255, 255, 255, 0.5); }
.bubble-user .word-chip:hover,
.bubble-user .word-chip.active { background: rgba(255, 255, 255, 0.2); border-bottom-color: #ffffff; }
.bubble-user .icon-btn { color: rgba(255, 255, 255, 0.85); }
.bubble-user .icon-btn:hover { background: rgba(255, 255, 255, 0.2); color: #ffffff; }
.bubble-coach .word-chip { border-bottom-color: rgba(217, 119, 6, 0.45); }
```

- [ ] **Step 3: 验证**

Run: `npm test`（114）→ `npm run typecheck` → `npm run build`

手动走查清单（浏览器）：
1. user 气泡（自己的句子）：喇叭可点播报、单词可点出词意菜单、纯英文句悬停出译文
2. coach 气泡（点「听不懂」「提示」触发）：同上三件套
3. coach 中文段（hint 的"提示：…"中文说明部分）：**无「译」按钮、悬停不出译文**，播报与分词照常
4. AI 气泡与 goals：回归不变（悬停/译按钮/译文行/查词/加生词本）
5. 语音服务停机：所有播报静默降级不阻断
6. 历史会话进入：同样生效

- [ ] **Step 4: Commit**（历史注入场景按既有库流程提交）

```powershell
git add "app/practice/[id]/page.tsx" app/globals.css
git commit -m "feat: reading aids for coach and user bubbles (no role exclusion)"
```

---

### Task 3: 文档同步（设计侧）——本任务由设计方完成，执行方跳过

**内容：**
- 主 spec 增补 §6.7「对话页阅读辅助」（I+II 一次性记载：三件套定义/全元素无排除/混合文本跳过翻译/personaZh 常显裁定/缓存与成本/触屏与 a11y 硬规则）
- `2026-10-18-speakloop-mvp22-reading.md` 追加「实现漂移与排除注记」：goals 超计划实做、coach/user 排除原委与 II 期覆盖、persona 翻译裁定
- README 阅读增强 bullet 更新为全元素口径

- [ ] **Step 1: 门禁终验**（执行方）

```powershell
npm test
npm run typecheck
npm run build
```

Expected: **114 passed / 0 error / build 成功**

- [ ] **Step 2: 收尾提交**

```powershell
git add -A
git commit -m "chore: reading coverage II complete"
```
