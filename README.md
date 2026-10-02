# SpeakLoop

浏览器里的 AI 英语口语私教：职场场景语音对话 + 练后纠错报告 + 生词闭环。

## 快速开始（Mock 模式，无需 GPU/Key）

```powershell
npm install
npm run dev
```

打开 http://localhost:3000

## 真实语音 + 真实 Chat

1. 部署 ai-server 双服务（`docs/superpowers/plans/2026-10-01-speakloop-phase0-ai-server.md`），`scripts/start-ai.ps1` 一键拉起（asr :8100 / tts :8101，冷载约 2-3 分钟）
2. `.env` 设置：`STT_PROVIDER=qwen3-local`、`TTS_PROVIDER=qwen3-local`
3. 真实 Chat（可选）：`CHAT_PROVIDER=openai-compatible` + `CHAT_BASE_URL`/`CHAT_API_KEY`/`CHAT_MODEL`（任意 OpenAI 兼容厂商）
4. `npm run doctor` 自检 → 打开首页（自动双预热）

## 环境变量

见 `.env.example`。设计文档：`docs/superpowers/specs/2026-10-01-speakloop-design.md`

## 一键启动（推荐）

双击根目录 `启动SpeakLoop.vbs`：无窗口拉起 ai-server 双服务 + Next.js，就绪后自动打开浏览器（语音预热约 2-3 分钟）。`停止SpeakLoop.vbs` 一键停止。日志见 `logs/`。
