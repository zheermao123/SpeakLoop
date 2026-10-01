# ai-server Spike 实测报告（2026-10-01）

**机器**：RTX 3070 8192 MiB / Windows / PS 5.1 / conda envs `speakloop-asr`、`speakloop-tts`（模型均在 `ai-server\models\` 本地）。本轮冒烟时用户游戏已关闭，GPU 上仅剩桌面/壁纸应用（Task 4 中 ZenlessZoneZero.exe 常驻的情形已不复现）。

| 指标 | 实测值 | 判定 |
|---|---|---|
| 双环境独立运行（asr: transformers 4.57.6 / tts: 4.57.3） | 通过。两 env 的 python.exe 各自 `import transformers` 打印版本：asr-env=4.57.6，tts-env=4.57.3；依赖隔离无冲突 | 通过 |
| 双进程并存（:8100 + :8101 同卡） | 通过。`speakloop-asr`（PID 11488, :8100）与 `speakloop-tts`（PID 16432, :8101）同时 LISTENING；两者分别 `/warmup` 后均返回 `{"ok":true,...}`，`/health` 均变 `model_loaded:true`；全程无 500 / 无 OOM / 无互扰报错 | 通过 |
| webm 解码 | 通过（Task 5）：`ai-server/test_webm.webm` → POST /stt HTTP 200 `{"text":"The.","elapsed":0.46}`，PyAV 19 解码正常（修复后） | 通过 |
| 双模型常驻总显存（两进程合计，nvidia-smi） | 启动前整机基线 **1917 MiB**；两模型加载常驻后整机 **7560 MiB**（热推理后再测 7686 MiB）；两进程合计 ≈ **5643 MiB**（7560−1917，WDDM 下 nvidia-smi 单进程内存显示 N/A，用"总量−桌面基线"差值法，与 Task 4 TTS≈+3357MiB、Task 5 ASR≈+2.1GB 之和自洽）。8192MB 卡原始占用余量 ~632 MiB | ≤7000MB 通过 |
| TTS 冷启动 / 热延迟（≤3 句） | 冷启动（含模型加载，Task 4）**130.07 s**；热延迟（Task 6 本轮干净复测，11 词句 ≈3.6s 音频）**10.44 s**（HTTP 200, audio/wav, 180,524B >100KB）。Task 4 热测 11.36s 系与游戏抢卡时的数据，已被本轮干净复测取代：干净环境仍 ~10.4s，说明高延迟主因不是游戏抢占而是模型/管线本身 | 热 ≤5s **未达标**（实测记录，处理见结论） |
| ASR 耗时（≤15s 音频） | 热回环（Task 6 本轮，tts_out.wav 3.6s 音频）：服务端 `elapsed` **2.42 s** ≤3s；客户端全程 3.84 s（含上传+解码）。同卡 TTS 常驻并行时 2.42s vs Task 5 单独跑 1.44s，双进程下略有抬升但仍达标。识别文本 "Hello. This is a warm-up sentence for the SpeakLoop project." 与期望基本一致 | ≤3s 通过 |
| /health /warmup 双服务行为 | `/health`：随角色返回 `{"status":"ok","role":"asr|tts","model_loaded":bool}`，冷启为 false、各自 warmup 后变 true；两服务互不阻塞（TTS 加载期间 ASR /health 即刻响应）。`/warmup`：POST 无体，语义为"本服务预热"（模型加载 + 首推理 + CUDA 上下文建立），返回 `{"ok":true,"elapsed":s}`——asr **32.09 s**（页缓存温热，快于 Task 5 首次冷加载 64.9s）、tts **144.95 s**；均由服务端计时，返回 `{"ok":true}` 即成功路径（错误会返回 `{"detail":...}`/500） | 行为符合设计 |

## 结论与偏差

- **无 OOM**：双进程同卡 + 双模型常驻，原始总占用 7560~7686 / 8192 MiB，通过但余量偏薄（~600 MiB 级）。若后续再叠任何常驻 GPU 进程（游戏/浏览器大页面）有 OOM 风险；MVP 阶段建议提示用户关闭高显存应用。
- **TTS 热延迟 10.44s 超标（bar ≤5s）**：干净环境复测仍 ~10.4s，排除游戏抢占主因。**MVP-2 优先启用 SSE + 分句流式**（按任务既定预案），并继续压单句生成耗时（排查点：bf16/sdpa 本机吞吐、12Hz 编解码器逐 token 速率、首 token 前固定开销）。
- **ASR 热延迟达标**（2.42s ≤3s；双进程并存时 +0.98s vs 单独 1.44s，可接受）。
- **偏差记录**：
  1. **PyAV 19 `Plane.to_bytes()` 移除**（Task 5 BLOCKER）：经受控适配 (f) 以 ctypes 一行修复 `chunks.append(np.frombuffer(ctypes.string_at(f.planes[0].buffer_ptr, f.planes[0].buffer_size), dtype=np.int16))`，commit `cae79ef`；修复后 webm/wav 解码全部通过。
  2. **start-ai.ps1 原稿 `conda activate` 在本机不可用**（conda 未加入 PATH，AddToPath=0 安装）：经受控适配 (g) 改为两个 `-NoExit` powershell 窗口内直接调用各环境 `python.exe -m uvicorn`（保留双窗口体验与 8100/8101 端口不变）。
  3. **qwen-tts SoX CLI 警告**（"SoX could not be found!"）：非致命，生成端到端成功；后续若需后处理音频再补 SoX。
  4. **flash-attn 缺失 → sdpa 回退**：按设计显式指定 `attn_implementation="sdpa"`，无警告、无影响。
  5. Task 4 补测的 3rd hot 请求当时 >4.5min 未完成（游戏抢卡）；本轮干净环境热请求 ~10.4s 正常返回，进一步佐证当时异常为抢占所致。

## 执行适配记录（controller-authorized，非交互 PowerShell 执行模式）

- **(a) 服务启动**：`$env:AI_ROLE='<role>'` + `Start-Process -FilePath <env>\python.exe -ArgumentList -m,uvicorn,server:app,... -WorkingDirectory ai-server -WindowStyle Hidden -RedirectStandardError/-RedirectStandardOutput <temp log>`（子进程继承环境变量），再轮询 /health；端口被外来进程占用则报 BLOCKED。本轮：asr PID 11488、tts PID 16432。
- **(b) VRAM 采样**（Task 5）：分离进程 nvidia-smi 轮询器（Start-Job 首采样 >1s 不可靠）；本轮改为关键节点单点采样（基线/加载后/热推理后）。
- **(c) 长超时**：两次 /warmup 各预留 20 分钟上限（实际 asr 32s、tts 145s，远低于上限）。
- **(d) PS 5.1 原生参数引号陷阱**：`Start-Process -ArgumentList` 不加引号拼接 → 长命令改 `cmd /c "<verbatim>"` 直通；`-w` 格式串内含空格会被拆参（本轮实测踩坑两次，改用无空格格式 `%{http_code}_%{time_total}_...` 解决）。
- **(e) JSON 请求体**：经临时 payload 文件传递（`curl -d @file` + `-H "Content-Type:application/json"`），规避 PowerShell 5.1 对内嵌双引号的破坏。
- **(f) PyAV19 修复**：见偏差 1。
- **(g) 启动脚本重写**：见偏差 2。

## 冒烟证据（Task 6 本轮实测原始值）

- `/health`（两服务启动后、未预热）：`{"status":"ok","role":"asr","model_loaded":false}` / `{"status":"ok","role":"tts","model_loaded":false}`
- `POST :8100/warmup` → `{"ok":true,"elapsed":32.09}`（约 30s 后完成，含加载+静音首推理）
- `POST :8101/warmup` → `{"ok":true,"elapsed":144.95}`（约 141s 后完成，含加载+"Hi."首推理）
- `/health`（预热后）：两者 `model_loaded:true`
- 干净热 `/tts`：`200_audio/wav_10.439829_180524`（code/content-type/秒/字节；wav >100KB）
- 干净热 `/stt`（tts_out.wav 回环）：`{"text":"Hello. This is a warm-up sentence for the SpeakLoop project.","elapsed":2.42}` HTTP 200（客户端 3.84s）
- `scripts/start-ai.ps1` 按任务简报 Step 3 方式实跑一次：两窗口拉起、角色正确接线（`role":"asr"`/`role":"tts"`、端口 8100/8101）、/health 即刻可达（`model_loaded:false`，未预热状态）——脚本验证通过后窗口与进程已全部关闭。

## 清理确认

- 冒烟结束：`Stop-Process` 两个服务 PID + 关闭脚本窗口，端口 8100/8101 无 LISTENING，无 speakloop python 进程残留。
- 临时产物已删：`E:\EnglishDemo\tts_out.wav`、`ai-server\test_webm.webm`，及本轮/Task 4 冒烟 temp 日志（`%TEMP%\opencode\smoke-*` 等）。
