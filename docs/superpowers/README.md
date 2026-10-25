# docs/superpowers 索引

本目录为 SpeakLoop 的受控文档区（规则见仓库根 `AGENTS.md`）。

## 目录约定

| 目录 | 用途 |
|---|---|
| `specs/` | **唯一设计规格书**（单文件，文件名稳定；版本号写在文内第 3 行"日期"字段） |
| `plans/` | 实施计划与勘误记录（每份对应一个里程碑或一次修复包） |
| `reports/` | 一次性实测报告（延迟/显存/spike 数据等），不属于规格与计划 |

## 命名约定

- 文件名 = `YYYY-MM-DD-<主题>.md`，日期为**文档创建日期**（历史记录不随后续工作改名）
- 规格书**不带版本号后缀**：路径 `specs/2026-10-01-speakloop-design.md` 被 `AGENTS.md`/`README.md` 硬引用，保持稳定；当前版本 **v1.6**（见文内）
- 计划完成后保持原名，状态以本索引为准

## 当前规格书

| 文档 | 版本 | 状态 |
|---|---|---|
| `specs/2026-10-01-speakloop-design.md` | **v1.6**（iOS HIG + Electron 桌面端；含对比度例外备案） | 生效中 |

## 计划与状态

| 文档 | 里程碑 | 状态 |
|---|---|---|
| `plans/2026-10-01-speakloop-phase0-ai-server.md` | ai-server 双服务 + spike | ✅ 已完成并验收 |
| `plans/2026-10-01-speakloop-mvp1-text-loop.md` | MVP-1 文字闭环 | ✅ 已完成并验收（E1-E10 勘误闭环） |
| `plans/2026-10-01-speakloop-mvp1-erratum.md` | MVP-1 勘误审计 | 📜 存档 |
| `plans/2026-10-01-speakloop-mvp2-real-voice.md` | MVP-2 真实语音 + Chat | ✅ 已完成并验收（R1-R5 修复） |
| `plans/2026-10-01-speakloop-mvp2-erratum.md` | MVP-2 勘误审计（含 F1-F4、累计清算） | 📜 存档 |
| `plans/2026-10-01-speakloop-mock-removal.md` | 生产零 Mock（假件下沉 tests） | ✅ 已完成并验收 |
| `plans/2026-10-02-speakloop-mvp21-settings.md` | MVP-2.1 设置页 | ✅ 已完成并验收（A1-A5 勘误） |
| `plans/2026-10-18-speakloop-voice-status.md` | 语音预热状态（双行四态） | ✅ 已完成并验收（已知缺陷 DO-NOT-FIX 备案） |
| `plans/2026-10-18-speakloop-mvp22-reading.md` | MVP-2.2 阅读增强 | ✅ 已完成并验收 |
| `plans/2026-10-18-speakloop-mvp22b-reading-coverage.md` | 阅读增强 II：全元素覆盖 | ✅ 已完成并验收 |
| `plans/2026-10-18-speakloop-translation-fixes.md` | 翻译修复 F1/F2/F3 | ✅ 已完成并验收（13/13） |
| `plans/2026-10-18-speakloop-tts-progress.md` | 朗读进度 + 队列防死 + 失败反馈 | ✅ 已完成并验收 |
| `plans/2026-10-19-speakloop-auto-stop-race-fix.md` | 自动停止竞态修复（心跳 2s/兜底 75s） | ✅ 已完成并验收 |
| `plans/2026-10-25-speakloop-ios-electron.md` | **iOS HIG 重构 + Electron EXE** | 🚧 **待执行**（当前任务） |
| `reports/2026-10-01-ai-server-spike-results.md` | ai-server 实测数据（显存/延迟/双进程） | 📜 存档（240s 预热阈值与 10.44s TTS 基线依据） |

## 勘误链（按时间）

`mvp1-erratum` → `mvp2-erratum`（R1-R5 → F1-F4 → §六/§七 累计清算）→ 各修复包计划内的「勘误清算」注记。修复包完成后以代码与测试为准，文档仅作追溯。
