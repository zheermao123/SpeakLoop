# SpeakLoop

浏览器里的 **AI 英语口语私教**：围绕职场真实场景进行语音对话练习，每次练习后给出纠错复盘报告，并把生词带回后续对话中反复使用。

**闭环：学 → 用 → 反馈 → 再用。**

## 功能特性

- **职场场景语音对话**：内置面试/周会汇报/向上沟通/同事寒暄 4 个场景，支持自然语言自定义新场景（生成后可编辑）
- **真实语音链路**：本地部署 Qwen3-ASR（带口音英语识别）+ Qwen3-TTS（9 种预置音色），双服务同卡部署、零调用成本
- **SSE 流式对话**：AI 回复打字机式实时上屏；支持 DeepSeek/GLM/Kimi/Qwen 等任意 OpenAI 兼容厂商
- **练习目标进度**：每个场景带 3 个练习目标，AI 教练实时判定完成度（学习者言行驱动，宁缺勿滥）
- **练后纠错报告**：总评 + 亮点 + 逐句纠错（原声回放 vs 改进表达对照）+ 生词候选采纳
- **生词闭环**：报告候选 → 入库 → 结构化注入后续对话（每次 ≤5 个、按使用次数轮换）→ 标记掌握
- **辅助按钮**："听不懂"（换简单表达重说）/"提示"（给可用句式），新手不卡壳
- **智能降级**：语音服务离线 → 文字模式不阻断；STT 失败 → 键盘输入兜底

## 系统架构

```
浏览器（React UI，MediaRecorder 录音 / 键盘输入）
   │ fetch /api/*
Next.js 全栈（薄路由 → services 业务层 → json-store 存储）
   │ Provider 抽象（qwen3-local / openai-compatible 按 .env 配置）
   ├─ asr-server :8100（FastAPI + Qwen3-ASR-0.6B，本地 GPU）
   ├─ tts-server :8101（FastAPI + Qwen3-TTS-1.7B-CustomVoice，本地 GPU）
   └─ Chat 云端（任意 OpenAI 兼容厂商，需 Key）
```

## 环境要求

| 组件 | 要求 |
|---|---|
| Node.js | ≥ 20 |
| GPU | NVIDIA 8GB+（实测 3070 占用 ~5.6GB，语音必需） |
| Python | conda 双环境（语音必需，部署见计划文档） |
| Chat Key | 任一 OpenAI 兼容厂商（对话必需） |

## 快速开始

1. 部署 ai-server 双服务（首次下载权重 ~5GB，见 `docs/superpowers/plans/2026-10-01-speakloop-phase0-ai-server.md`）
2. 配置 `.env`（STT/TTS/CHAT 三项 provider，见配置说明）
3. 双击 `启动SpeakLoop.vbs`，或 `npm run doctor` 自检后 `npm run start`

打开 http://localhost:3000 —— 完整流程：语音对话 → 目标进度 → 练后报告 → 生词闭环。

## 一键启动（推荐）

双击根目录 **`启动SpeakLoop.vbs`**：无窗口拉起 ai-server 双服务 + Next.js，就绪后自动打开浏览器（语音预热约 2-3 分钟）。**`停止SpeakLoop.vbs`** 一键停止。日志见 `logs/`。

## 配置说明

`.env` 完整矩阵（模板见 `.env.example`）：

| 变量 | 取值 | 说明 |
|---|---|---|
| `STT_PROVIDER` | `qwen3-local` | 语音识别（本地） |
| `TTS_PROVIDER` | `qwen3-local` | 语音合成（本地） |
| `CHAT_PROVIDER` | `openai-compatible` | 对话大模型 |
| `STT_BASE_URL` | `http://127.0.0.1:8100` | asr-server 地址 |
| `TTS_BASE_URL` | `http://127.0.0.1:8101` | tts-server 地址 |
| `CHAT_BASE_URL` | 如 `https://api.deepseek.com` | OpenAI 兼容地址 |
| `CHAT_API_KEY` | `sk-...` | 厂商 Key（本地明文，已 gitignore） |
| `CHAT_MODEL` | 如 `deepseek-chat` | 模型名 |

**厂商对照**（任意 OpenAI 兼容厂商均可）：

| 厂商 | CHAT_BASE_URL | CHAT_MODEL |
|---|---|---|
| DeepSeek | `https://api.deepseek.com` | `deepseek-chat` |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-flash`（免费） |
| Kimi | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |
| 通义 Qwen | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |

**Key 安全**：Key 仅存本地 `.env`（gitignore 覆盖，不会入库）；对话请求从你的机器直达厂商，不经过任何第三方。

## 验证命令

| 命令 | 用途 |
|---|---|
| `npm test` | 单元测试（76 个，假件位于 tests/fixtures，生产零 mock） |
| `npm run typecheck` | 全量类型检查 |
| `npm run build` | 生产构建 |
| `npm run doctor` | 环境自检（Node/数据目录/双服务健康/GPU） |
| `node scripts/browser-check.mjs` | 真实浏览器 E2E 走查（需 Playwright + 服务在线） |

## 已知限制

- 整段语音合成感知延迟 ~13s（STT 1.6s + LLM 0.8s + TTS 合成 ~10.9s，3070 实测）——界面有分相位耗时指示器；优化候选：0.6B 模型对比 / int8 量化
- 语音预热约 2-3 分钟（模型冷载），期间文字模式可用
- 桌面端优先，移动端未深度适配
- 发音评分未实现（原声回放仅自助对比）

## FAQ

**Q：没有 GPU 能用吗？**
不能。语音与对话均需真实服务：语音需本地 GPU（ai-server），对话需任一 OpenAI 兼容厂商 Key。

**Q：API Key 会被上传或泄露吗？**
不会。Key 只存在本地 `.env`（gitignore 覆盖），对话请求从你的机器直达厂商。

**Q：8100/8101 端口被占用？**
`logs/` 下查看报错，或在 `start-ai.ps1` 修改端口并同步 `.env` 的 `STT_BASE_URL`/`TTS_BASE_URL`。

**Q：AI 回复是中文？**
设计上对话恒为英文（口语练习）；中文只出现在报告解释与界面文案。

## 项目文档

| 文档 | 路径 |
|---|---|
| 设计文档（v1.3） | `docs/superpowers/specs/2026-10-01-speakloop-design.md` |
| ai-server 部署计划 | `docs/superpowers/plans/2026-10-01-speakloop-phase0-ai-server.md` |
| MVP-1 实施计划 | `docs/superpowers/plans/2026-10-01-speakloop-mvp1-text-loop.md` |
| MVP-2 实施计划 | `docs/superpowers/plans/2026-10-01-speakloop-mvp2-real-voice.md` |
| 勘误记录（MVP-1/MVP-2） | `docs/superpowers/plans/*erratum*.md` |
| Mock 移除计划 | `docs/superpowers/plans/2026-10-01-speakloop-mock-removal.md` |

## License

见仓库 `LICENSE`。
