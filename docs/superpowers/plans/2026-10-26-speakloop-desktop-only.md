# SpeakLoop 网页端移除实施计划（桌面端唯一化）

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development 或 executing-plans。步骤用复选框跟踪。

**Goal:** 移除浏览器模式（网页端）全部运行时与工具链——自动停止看门狗、心跳 API、:3000 生产栈、浏览器启动器——桌面端（Electron EXE）成为唯一交付形态；启动 VBS 改为直启 EXE；测试 129 → 120。

**背景：** 产品已收敛为 Electron 桌面应用（standalone :3123 + Mica + 语音自动拉起 + 退出零残留）。浏览器模式（`next start` :3000 + 心跳看门狗）失去存在意义，且其看门狗曾反向误杀桌面语音服务（T8 冒烟实证）。本计划为纯删除型清理，桌面能力零回归。

**Architecture:** 桌面生命周期完全归 Electron 主进程（已有退出清理：杀 standalone + 直杀端口）；`AUTO_STOP` 环境变量机制整体废除；开发模式（`npm run dev` + `electron:dev`）保留。

## Global Constraints

- 测试 **129 → 120**（−9：auto-stop 7 例 + heartbeat-route 2 例）；每任务 `npm test` + `npm run typecheck` + `npm run build` 全绿
- **零残留引用验收**：`heartbeat|auto-stop|AUTO_STOP|shouldAutoStop|watchdog` 在 app/lib/components/electron/scripts(保留件) 中 grep = 0
- 桌面能力零回归：EXE 冷启动（语音拉起 → ready）→ 练习 → 退出零残留
- 开发模式保留：`npm run dev` + `npm run electron:dev`（dev :3000 仅供 Electron 加载，非"网页端"）
- 代码无注释；类名契约不变

---

### Task 1: 移除自动停止体系

**Files:** Delete `components/Heartbeat.tsx`、`app/api/heartbeat/route.ts`、`app/api/heartbeat/leave/route.ts`、`lib/auto-stop.ts`、`instrumentation.ts`、`scripts/auto-stop-check.mjs`、`tests/auto-stop.test.ts`、`tests/heartbeat-route.test.ts`；Modify `app/layout.tsx`（移除 Heartbeat import+渲染）、`electron/main.js`（移除 env `AUTO_STOP: "0"` 行）

- [ ] 删除上述 8 文件 + 2 处引用移除
- [ ] grep 验收：`heartbeat|auto-stop|AUTO_STOP|shouldAutoStop|Watchdog` 在 app/lib/components/electron/instrumentation = **0 命中**
- [ ] 门禁：`npm test` **120** / typecheck 0 / build 绿（无 instrumentation.ts 时 Next 正常）
- [ ] Commit：`refactor: remove browser auto-stop stack (desktop only)`

### Task 2: 启动器收敛

**Files:** Modify `scripts/start-all.ps1`、`scripts/stop-all.ps1`、`electron/main.js`、`package.json`；Delete `启动SpeakLoop.vbs`→替换内容、`停止SpeakLoop.vbs`

- [ ] start-all.ps1 精简：**移除** $nextWasDown/next 启动块/120s 等待循环/浏览器决策块/Wscript popup；**保留** asr/tts 启动+预热 POST+日志+`SPEAKLOOP_REPO_ROOT`；参数收敛
- [ ] stop-all.ps1：端口循环 `8100,8101`（移除 3000）；`-Quiet` 保留
- [ ] electron/main.js：startVoiceServices spawn args 同步移除已删参数
- [ ] package.json：删除 `"start": "next start"` 脚本
- [ ] `启动SpeakLoop.vbs` 内容替换为直启 EXE：
```vbs
CreateObject("WScript.Shell").Run """E:\EnglishDemo\dist\win-unpacked\SpeakLoop.exe""", 0, False
```
  `停止SpeakLoop.vbs` 删除（EXE 退出即停）
- [ ] grep：start-all 内 `3000|next|browser` = 0；stop-all 内 `3000` = 0
- [ ] 门禁：**120** / 0 / build 绿
- [ ] Commit：`refactor: slim launchers to voice-only (desktop only)`

### Task 3: README 桌面唯一化

- [ ] 移除：浏览器快速开始/`localhost:3000`/自动停止（5s 宽限/75s 兜底/`AUTO_STOP`）/VBS 相关段；启动方式改为：**EXE 安装版**（build:exe → 安装）或 `dist/win-unpacked/SpeakLoop.exe`；开发模式说明保留（`npm run dev` + `electron:dev`）
- [ ] 脚本表：`browser-check/acceptance-check/console-check` 标注「dev 工具，针对 `npm run dev`」；移除 auto-stop-check 行（如有）
- [ ] 门禁 + Commit：`docs: desktop-only readme`（仅 README.md）

### Task 4: 门禁终验 + 冒烟

- [ ] 自动化：`npm test` **120** / typecheck 0 / build 绿 / `npm run build:exe` 重打包成功
- [ ] 桌面冒烟（Playwright _electron 驱动打包 EXE，截图逐张自验）：冷启动 → 语音拉起 → 练习页布局 → 退出零残留（四端口 DOWN + 0 进程）
- [ ] dev 冒烟：`npm run dev` + `electron:dev` 可用（开发路径不回归）
- [ ] grep 终验：`heartbeat|auto-stop|AUTO_STOP|VBS|浏览器模式` 全仓（除 docs/历史文档与 node_modules）= 0 或仅历史存档
- [ ] 收尾提交：`chore: web removal complete (desktop only)`
