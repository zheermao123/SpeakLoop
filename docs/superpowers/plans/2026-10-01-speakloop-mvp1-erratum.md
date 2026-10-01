# SpeakLoop MVP-1 计划勘误记录（Erratum v1）

- 日期：2026-10-01
- 背景：MVP-1 各任务逐任务评审 + 实现方联合复核的结论——**绝大多数缺陷源于计划文本（plan-verbatim），实现与计划逐字一致，实现问题几乎为零**。本文档为审计轨迹；权威修复内容已就地写入 spec v1.3 与计划 B 正文，此处只留痕。
- 责任声明：计划文本缺陷归设计方（计划作者）；实现侧仅需按修订后的计划做分钟级对齐，无需返工。

## 一、已闭环（历史修复，计划与代码双向同修）

| 缺陷 | 计划出处 | 修复提交 |
|---|---|---|
| 短语归一化只处理查询词、不处理原文（撇号/标点失配） | Task 4 containsWord | `c48b62c`（normalizePhrase 对称归一 + 撇号删除语义） |
| tolerantParse 首尾大括号截取遇花括号散文失败 | Task 6 | `6b86bfc`（字符串感知平衡扫描候选序列） |
| SEED_SCENARIOS 共享引用逃逸 | Task 8 listScenarios | `fe33c1d`（structuredClone） |

## 二、本轮勘误（v1.3，计划正文已就地修订，执行方对齐代码）

| # | 缺陷 | 计划出处 | 修订要点 | spec 对应 |
|---|---|---|---|---|
| E1 | backfill 空归一化回退恒真，幻觉纠错吸附空轮 | Task 10 | 回退分支 `u.length > 0` 守卫 + 中文轮次测试（6 passed） | S1 |
| E2 | goals 编辑态类型翻转（string[] 被 String() 逗号粘连） | Task 12 | 独立 `goalsText` 编辑态；draft 恒为规范 Scenario；删除全部 `as unknown as`（关闭台账 M2） | — |
| E3 | /turns 落盘无 r.ok；play() 未 await（离线芯片失效） | Task 13 | 落盘为可失败步骤（save，失败不播 TTS、重试后补播）；`await play()` 后再清标识 | S2 |
| E4 | addWord 去重不迁移状态（忽略失效）；芯片无条件翻转 | Task 4 + Task 14 | 显式 status 即迁移（setStatus）；芯片 r.ok 后翻转（7 passed） | — |
| E5 | 页面 fetch 无错误处理（永久 loading/永久禁用/undefined 路由） | Task 12 | UI 不变量入全局约束；仪表盘 Promise.all 终结；场景页 error 态 + try/finally | S3 |
| E6 | 422 报告 UI（spec §9 要求）从未排期，与报告死页叠加 | Task 13/14 增补 | endPractice 422→sessionStorage raw + 跳转；报告页 `<pre>` 原文 + 重新生成 | §9 既有行 |
| E7* | `.env.example` 落盘文件含无人读取的 AI_SERVER_URL，缺 doctor 实读的 STT/TTS_BASE_URL | Task 1 执行产物 | 计划文本 5afee71 已对；**文件修正归执行侧**（一行改两行） | §7.3 |
| E8 | nav 链接无 44px 命中区（违反 spec §8.1 自定规则） | Task 1 CSS | `.nav a` 增 min-height/display:inline-flex/align-items | §8.1 |
| E9 | doctor.mjs `access` 死导入 | Task 15 | 移除该导入 | — |
| E10 | goals 断言盲区（复核已指认：`tests/practice-service.test.ts:17-24`，断言 `:24`） | Task 9 测试 | **已闭环（`e7cf402`）**：第 3 次 `appendTurn(…, [])` 区分并集 vs 覆盖语义——覆盖实现会使 `goalProgress` 变 `[]` 而断言失败 | — |

\* E7 为执行侧待办，非计划文本修订。

## 三、合理偏差（实现侧 2 处，均接受）

| 偏差 | 说明 |
|---|---|
| `@phosphor-icons/react ^2.2.3` → `^2.1.10` | 计划写了不存在的版本号（设计方责任）；执行方按注册表现实修正，正确 |
| tsconfig 出现 `allowJs` | `next build` 工具自动行为，非人工引入 |

## 四、有意设计取舍（非缺陷，防误读）

- stemFamily 宽松词族匹配（前缀差 ≤4 可能少量误报）——用于使用计数，可接受
- Mock 报告单条 correction——测试契约，非产品行为
- `*_PROVIDER` 工厂 MVP-2 才分流——mock 先行设计
- ~~单进程 ai-server 假设~~——已被双环境双服务修订（`5afee71`）取代，作废

## 五、Minor 台账（累计，最终验收裁量）

| # | 位置 | 内容 | 状态 |
|---|---|---|---|
| M1 | Task 13 | sttProvider 硬编码 "mock"，未用 /api/stt 返回字段 | 待 MVP-2 重构 |
| M2 | Task 12 | goals 双重断言 hack | **E2 顺带关闭** |
| M3 | Task 11 | chat 路由收 sessionId 但不用 | 保留（日志/ MVP-2 预留） |
| M4-M8 | Task 13 | load/endPractice 无错误处理、录音中 busy 锁定 stop、role=list 结构等 | 台账 |
| M9+ | Task 14/12 | report 页 fetch 错误处理、快速点击竞态、key={v.word} 重复风险等 | 台账 |

## 六、执行清单（执行方）

1. 按 E1-E6、E8、E9 对齐代码（计划正文已含精确规格与验收点；预计每项分钟级）
2. E7：`.env.example` 改为 `STT_BASE_URL` / `TTS_BASE_URL` 两行
3. ~~E10：指认具体断言位置~~ **已闭环**（复核确认 `e7cf402`，见 §二）
4. 全量 `npm test`（预期 **47 passed** = 基线 45 + E1/E4 各 1）+ `npm run build` 通过
