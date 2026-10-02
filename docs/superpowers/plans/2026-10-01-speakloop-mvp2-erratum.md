# SpeakLoop MVP-2 计划勘误记录（Erratum v1）

- 日期：2026-10-01
- 背景：MVP-2 全分支终审裁定 **With fixes**——5 项 Important 全部成立（全部 ≤20 行修复），经设计方逐项技术核验确认。与前次一致：缺陷全部源于计划文本（plan-verbatim / plan-mandated），实现忠实。本文档为审计轨迹；权威修复已就地写入 MVP-2 计划正文。

## 一、裁定与修复规格

| # | 发现 | 定性 | 修复 | 测试 |
|---|---|---|---|---|
| R1 | SSE 读循环无 try/catch——中段断流 = busy 卡死 + unhandled rejection | 计划继承 | `reader.read().catch(() => ({ done: true, value: undefined }))`——断流视为流结束：未收 done 则落既有 `!reply` 失败路径（busy 复位+重试）；已收 done 则正常收尾 | 既有 T6/T7 覆盖 |
| R2 | runStt/runChat/persistTurn 裸 await fetch——传输层拒绝同类卡死（endPractice 缺 catch） | 计划继承 | 三处 fetch 各包 catch 走既有 `setFailed` 分支；persistTurn 改 `.then(r => r.ok, () => false)` 单出口；endPractice 补 catch | 手动断网走查（T10 清单 7） |
| R3 | openai-compatible 工厂 env 缺失以 "" 构造，请求时才 401/404 | 计划强制 | 工厂 fail-fast：`CHAT_BASE_URL/CHAT_API_KEY/CHAT_MODEL` 任一缺失即 throw 明确中文错误 | +1 factory 测试 |
| R4 | `tests/audio-queue.test.ts:25` 简洁箭头体隐式返回 `Promise<number>` → `tsc --noEmit` 红（vitest/build 均不查测试类型，门禁盲区） | 计划文本 bug | 改块体；**process 修复**：package.json 增 `"typecheck": "tsc --noEmit"`，Task 10 验证链加该命令，根除"类型红门禁绿" | typecheck 0 error 入门禁 |
| R5 | 流恰在标记中间结束时 `flush()` 把残段当句子念出（`hold = final ? 0` 释放回持的设计错误）；路由 `reply` 清理只剥完整标记，同缺陷 | 计划继承 | `drain(true)` 入口用 `trailingMarkerPrefix` 剥离尾部残段；路由 `reply` 清理链同构处理 | +2 sentence-stream 测试 |

## 二、测试计数修正

原推进链 `47→49→55→58→62→65→68→71→73` 修正为 **`47→49→57→60→64→68→71→74→76`**（T2 +2、T5 +1）；终态 **76 passed + typecheck 0 error**。

## 三、执行清单（执行方）

1. 按修订后计划 Task 2/5/6/7/10 对齐代码（R1-R5，分钟级×5）
2. package.json scripts 增 `typecheck`，验证链跑 `npm test && npm run typecheck && npm run build`
3. 全绿（76 + 0 error + build）后走 Task 10 真实语音联调清单

## 四、门禁结论记录

R4 暴露的门禁盲区（vitest/esbuild 不做类型检查、next build 不检查 tests 目录）已通过 typecheck 入验证链修复——此前所有阶段的"绿色"仅指测试与构建，不含全量类型检查；MVP-2 起类型红即为红。

## 五、v2 勘误：真实使用反馈（2026-10-01，F1-F4）

来源：用户实机使用反馈（含截图）。定性：F1/F3 设计取舍错误、F2 prompt 设计缺陷、F4 新增体验需求——全部计划层责任。

| # | 现象 | 根因 | 修复 |
|---|---|---|---|
| F1 | 录音中停止按钮无限脉冲闪烁 | v1.3 UI 修订加入 `.recording` 无限 pulse 动画 | 删除动画；录音态=红色按钮+aria-live"录音中"文本，足矣 |
| F2 | 用户仅说 "Yeah." 即被标记目标完成（1/3） | prompt 未声明目标归属（学习者目标）且无质量门槛——AI 把"自己问出问题"当作达成 | 教练规则强化：①goals 属学习者、仅其言行可达成 ②只依据其最近 1-2 轮原话判定 ③不达标改追问、宁缺勿滥 |
| F3 | 语音按句分段合成——机械停顿、自然度差 | 设计取向错误：以分句换首句延迟，真实体验否决（用户知情选择**自然度 > 延迟**） | 前端忽略 sentence 事件；done 后对完整 reply 一次合成播放；服务端 SSE 不动（sentence 事件保留、回滚成本零） |
| F4 | 整段合成 ~11s 期间无进度提示，用户疑卡死 | F3 决策的配套体验要求 | 分相位耗时指示器：语音识别/等待 AI 回复/语音合成（500ms 刷新 + aria-live） |

### 已知限制（用户知情接受）

- 整段合成下感知延迟 ≈ 13s（STT 1.6 + LLM 0.8 + 单段 TTS 10.9）——自然度优先的代价；F4 指示器消除"卡死"疑虑
- 分句 TTS 管线降为可选实验（服务端能力保留，前端不消费）

### 测试影响

prompts 断言更新（新规则文本）；计数不变，终态 76 passed。

## 六、设计侧累计勘误清算（2026-10-02，源自执行方台账 `.superpowers/sdd/progress.md` 全量查阅）

### 6.1 MVP-2 勘误候选 E-c1~c5 处置结论

| # | 内容 | 结论 |
|---|---|---|
| E-c1 | 计划 T7 测试片段 Promise&lt;number&gt; 类型 bug | **已闭环**（R4，勘误 v1 §二） |
| E-c2 | 计划 T7 页面片段违反 spec §9 busy try/finally | **已闭环**（R2） |
| E-c3 | 计划 T6 路由部分标记残段洞 | **已闭环**（R5） |
| E-c4 | 计划 T5 `?? ''` 回退迟失败 | **已闭环**（R3 fail-fast） |
| E-c5 | T2 测试字面量 12/14 与实现不符 | **今日溯源落盘**：mvp2 计划同步双断言（12→13、123→14）+ 裁定记录（b7b45de） |

### 6.2 Mock 移除计划修订（今日落盘）

- 计数 77→**76**：原算术 +1 有误——旧工厂测试文件实有 **4** 用例（非 3），76−4+4=76；README 同步
- T2 签名 `= await getChat()` 系 **TS2524**（await 不得入默认参数）——计划同步为 `null 默认 + ?? await getChat()`（与实施 6f23770 一致）
- 测试导入路径 `../fixtures` → `./fixtures`（tests/ 内相对路径）
- 补录执行方被迫偏离：chat-stream-route 测试需 beforeEach 环境清理（工厂 env 守卫先于 import 生效）

### 6.3 Mock 移除 Final Review 已知限制（用户裁定 2026-10-02：DO NOT FIX，记录在案）

- **配置指引死信**：provider 未配置时 4 个路由裸 500 / 报告路由映射 404 / SSE error 事件的 message 被客户端丢弃（仅置 errored）——指引诚实但不可达；**spec §9 fast-follow 候选**（统一错误契约：JSON 错误体 + 前端展示 message）
- Minor：stt/warmup 路由残留死 `?? "mock"` 字符串；warmup 测试名语义过期；report.ts provider 先于 session 检查求值（配置态不可观测）

### 6.4 spec/文档失真修正（今日落盘）

- spec §6.1：stt 响应剔除 `duration`（从未实现，字段预留不填充）
- spec §7.2：health 形状改为实装 `{status, role, model_loaded}`

### 6.5 工具链待办（流程项，非文档）

- 评审包 diff 工件字符损坏（MVP-1 起复发，homoglyph 乱码）——**下次阶段前修复生成器**，否则影响后续评审效率