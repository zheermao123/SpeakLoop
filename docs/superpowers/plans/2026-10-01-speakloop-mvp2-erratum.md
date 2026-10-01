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
