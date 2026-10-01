# SpeakLoop ai-server 实施计划（阶段 0 Spike → 可用服务）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在本机 Windows + RTX 3070 上跑通单进程 FastAPI 服务，暴露 `/health` `/stt` `/tts` `/warmup`，双模型常驻（Qwen3-ASR-0.6B + Qwen3-TTS-1.7B-CustomVoice），并产出 spike 实测报告（显存/延迟/webm 解码）。

**Architecture:** 独立 Python 服务（`ai-server/`），与 Node 侧零依赖耦合；模型懒加载，`/warmup` 触发加载+首推理；音频解码统一走 PyAV 归一 16kHz float32 mono。

**Tech Stack:** Python 3.12（conda env `speakloop-ai`）、qwen-tts、qwen-asr、FastAPI、uvicorn、PyAV、PyTorch CUDA (bf16 + sdpa)。

## Global Constraints

- OS：Windows，shell：PowerShell 5.1；所有命令在仓库根 `E:\EnglishDemo` 执行
- conda 环境名固定 `speakloop-ai`（Python 3.12）
- ASR 默认 `Qwen/Qwen3-ASR-0.6B`（env `ASR_MODEL` 可切 `Qwen/Qwen3-ASR-1.7B`）
- TTS 固定 `Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice`，默认音色 `Aiden`，language 固定 `English`
- 精度 bf16，attention 用 `sdpa`（**不得**用 flash_attention_2——Windows 编译困难）
- 权重用 ModelScope 预下载到 `ai-server/models/`，运行时不联网拉取
- 服务监听 `127.0.0.1:8100`；仅服务端调用，无需 CORS
- `.gitignore` 必须包含 `ai-server/models/`、`ai-server/__pycache__/`
- GPU：RTX 3070 8GB——任一步 OOM 即停下记录，不擅自降级模型规格

---

### Task 1: conda 环境与依赖

**Files:**
- Create: `ai-server/requirements.txt`
- Create: `.gitignore`（仓库根）

**Interfaces:**
- Produces: 可用的 conda env `speakloop-ai`，后续所有 Python 命令的前提

- [ ] **Step 1: 创建 .gitignore**

```gitignore
node_modules/
.next/
data/
.env
ai-server/models/
ai-server/__pycache__/
__pycache__/
*.pyc
```

- [ ] **Step 2: 创建 requirements.txt**

```text
qwen-tts
qwen-asr
fastapi
uvicorn[standard]
python-multipart
```

- [ ] **Step 3: 建环境并装 CUDA 版 torch（先于 requirements，避免装成 CPU 版）**

```powershell
conda create -n speakloop-ai python=3.12 -y
conda activate speakloop-ai
pip install torch --index-url https://download.pytorch.org/whl/cu121
```

Expected: `Successfully installed torch-2.x.x+cu121`

- [ ] **Step 4: 安装其余依赖**

```powershell
pip install -r ai-server/requirements.txt
```

- [ ] **Step 5: 验证导入**

```powershell
python -c "import torch; print(torch.cuda.is_available()); import qwen_tts, qwen_asr, av; print('imports ok')"
```

Expected: `True` 与 `imports ok`。若 `torch.cuda.is_available()` 为 False，停止并排查驱动（`nvidia-smi`）。

- [ ] **Step 6: Commit**

```powershell
git add .gitignore ai-server/requirements.txt
git commit -m "chore: ai-server deps and gitignore"
```

---

### Task 2: 模型权重下载

**Files:**
- Create: `ai-server/download_models.ps1`

**Interfaces:**
- Produces: `ai-server/models/Qwen3-ASR-0.6B`、`ai-server/models/Qwen3-TTS-Tokenizer-12Hz`、`ai-server/models/Qwen3-TTS-12Hz-1.7B-CustomVoice` 三个本地目录

- [ ] **Step 1: 编写下载脚本**

```powershell
# ai-server/download_models.ps1
$ErrorActionPreference = "Stop"
$models = @(
  "Qwen/Qwen3-ASR-0.6B",
  "Qwen/Qwen3-TTS-Tokenizer-12Hz",
  "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice"
)
Set-Location $PSScriptRoot
foreach ($m in $models) {
  $name = $m.Split("/")[1]
  if (Test-Path "models/$name") { Write-Host "exists: $name"; continue }
  modelscope download --model $m --local_dir "models/$name"
}
```

- [ ] **Step 2: 安装 modelscope 并执行**

```powershell
conda activate speakloop-ai
pip install -U modelscope
powershell -ExecutionPolicy Bypass -File ai-server/download_models.ps1
```

Expected: 三个目录生成，总大小约 1.5GB + 0.7GB + 3.4GB。

- [ ] **Step 3: Commit**

```powershell
git add ai-server/download_models.ps1
git commit -m "chore: model download script"
```

---

### Task 3: server.py 骨架 + /health

**Files:**
- Create: `ai-server/server.py`

**Interfaces:**
- Produces: FastAPI app；`GET /health -> {"status":"ok","asr":bool,"tts":bool}`；内部函数 `get_asr()` / `get_tts()` 供后续端点使用

- [ ] **Step 1: 编写 server.py**

```python
import io
import os
import time

import numpy as np
import soundfile as sf
import torch
import av
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
ASR_NAME = os.environ.get("ASR_MODEL", "Qwen3-ASR-0.6B")
TTS_NAME = "Qwen3-TTS-12Hz-1.7B-CustomVoice"

app = FastAPI(title="speakloop-ai-server")
_state: dict = {"asr": None, "tts": None}


def get_asr():
    if _state["asr"] is None:
        from qwen_asr import Qwen3ASRModel

        _state["asr"] = Qwen3ASRModel.from_pretrained(
            os.path.join(MODELS_DIR, ASR_NAME),
            dtype=torch.bfloat16,
            device_map="cuda:0",
            attn_implementation="sdpa",
            max_new_tokens=512,
        )
    return _state["asr"]


def get_tts():
    if _state["tts"] is None:
        from qwen_tts import Qwen3TTSModel

        _state["tts"] = Qwen3TTSModel.from_pretrained(
            os.path.join(MODELS_DIR, TTS_NAME),
            device_map="cuda:0",
            dtype=torch.bfloat16,
            attn_implementation="sdpa",
        )
    return _state["tts"]


@app.get("/health")
def health():
    return {
        "status": "ok",
        "asr": _state["asr"] is not None,
        "tts": _state["tts"] is not None,
    }
```

- [ ] **Step 2: 启动验证 /health**

```powershell
conda activate speakloop-ai
uvicorn server:app --host 127.0.0.1 --port 8100
```

另开终端：`curl http://127.0.0.1:8100/health`
Expected: `{"status":"ok","asr":false,"tts":false}`（模型未加载）

- [ ] **Step 3: Commit**

```powershell
git add ai-server/server.py
git commit -m "feat(ai-server): fastapi skeleton with /health"
```

---

### Task 4: /tts 端点

**Files:**
- Modify: `ai-server/server.py`（追加端点）

**Interfaces:**
- Produces: `POST /tts {text, speaker?, instruct?} -> audio/wav`（HTTP 200）；失败返回 500

- [ ] **Step 1: 追加端点代码**

```python
class TTSRequest(BaseModel):
    text: str
    speaker: str = "Aiden"
    instruct: str | None = None


@app.post("/tts")
def tts(req: TTSRequest):
    try:
        model = get_tts()
        kwargs = dict(text=req.text, language="English", speaker=req.speaker)
        if req.instruct:
            kwargs["instruct"] = req.instruct
        wavs, sr = model.generate_custom_voice(**kwargs)
        buf = io.BytesIO()
        sf.write(buf, wavs[0], sr, format="WAV")
        return Response(content=buf.getvalue(), media_type="audio/wav")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e)) from e
```

- [ ] **Step 2: 重启 uvicorn，curl 验证 + 计时（spike 数据点 1）**

```powershell
curl.exe -s -o E:\EnglishDemo\tts_out.wav -w "%{time_total}" -X POST http://127.0.0.1:8100/tts -H "Content-Type: application/json" -d "{\"text\":\"Hello, this is a warmup sentence for the speak loop project.\",\"speaker\":\"Aiden\"}"
```

Expected: 输出秒数（首含加载，记为冷启动）；再执行一次记为热延迟。`tts_out.wav` 大小 > 100KB。冷启动期间另开 `nvidia-smi` 记录显存（spike 数据点 2）。

- [ ] **Step 3: Commit**

```powershell
git add ai-server/server.py
git commit -m "feat(ai-server): /tts endpoint with qwen3-tts"
```

---

### Task 5: /stt 端点（PyAV 解码 + 回环测试）

**Files:**
- Modify: `ai-server/server.py`（追加端点与解码函数）
- Create: `ai-server/make_test_webm.py`

**Interfaces:**
- Produces: `POST /stt`（multipart 字段 `file`，任意 PyAV 可解容器）`-> {"text": str}`

- [ ] **Step 1: 追加解码函数与端点**

```python
def decode_audio(data: bytes) -> np.ndarray:
    """任意容器(webm/wav/mp3) -> 16kHz mono float32 [-1,1]"""
    container = av.open(io.BytesIO(data))
    resampler = av.AudioResampler(format="s16", layout="mono", rate=16000)
    chunks = []
    for frame in container.decode(audio=0):
        rf = resampler.resample(frame)
        for f in (rf if isinstance(rf, list) else [rf]):
            chunks.append(np.frombuffer(f.planes[0].to_bytes(), dtype=np.int16))
    if not chunks:
        raise ValueError("no audio stream found")
    return np.concatenate(chunks).astype(np.float32) / 32768.0


@app.post("/stt")
async def stt(file: UploadFile = File(...)):
    try:
        data = await file.read()
        pcm = decode_audio(data)
        model = get_asr()
        t0 = time.time()
        results = model.transcribe(audio=(pcm, 16000), language="English")
        elapsed = time.time() - t0
        return {"text": results[0].text, "elapsed": round(elapsed, 2)}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e)) from e
```

- [ ] **Step 2: wav 回环测试（spike 数据点 3）**

```powershell
curl.exe -s -X POST http://127.0.0.1:8100/stt -F "file=@E:\EnglishDemo\tts_out.wav"
```

Expected: `{"text":"Hello, this is a warmup sentence for the speak loop project.","elapsed":...}`（文本基本一致即算通过；记 elapsed 与 wav 时长比）。

- [ ] **Step 3: webm 解码验证（spike 数据点 4）**

`ai-server/make_test_webm.py`（用 PyAV 造一个 opus-in-webm）：

```python
"""生成 440Hz 正弦波 webm/opus 测试文件（验证 /stt 解码链路用）"""
import av
import numpy as np

sr = 16000
t = np.linspace(0, 2, sr * 2, endpoint=False)
samples = (np.sin(2 * np.pi * 440 * t) * 10000).astype(np.int16)

container = av.open("test_webm.webm", mode="w", format="webm")
stream = container.add_stream("libopus", rate=sr)
stream.layout = "mono"
for i in range(0, len(samples), 1024):
    frame = av.AudioFrame.from_ndarray(
        samples[i : i + 1024].reshape(1, -1), format="s16", layout="mono"
    )
    frame.rate = sr
    for packet in stream.encode(frame):
        container.mux(packet)
for packet in stream.encode():
    container.mux(packet)
container.close()
print("test_webm.webm written")
```

```powershell
conda activate speakloop-ai
python ai-server/make_test_webm.py
curl.exe -s -X POST http://127.0.0.1:8100/stt -F "file=@ai-server/test_webm.webm"
```

Expected: HTTP 200，`text` 为空或极少（正弦波无人声）——**验证点仅是解码不报错**。若需带语音的 webm，用浏览器真实录音在 MVP-2 联调时验证。

- [ ] **Step 4: Commit**

```powershell
git add ai-server/server.py ai-server/make_test_webm.py
git commit -m "feat(ai-server): /stt endpoint with pyav decode"
```

---

### Task 6: /warmup + 启动脚本 + spike 报告

**Files:**
- Modify: `ai-server/server.py`（追加 /warmup）
- Create: `scripts/start-ai.ps1`
- Create: `docs/superpowers/specs/2026-10-01-ai-server-spike-results.md`

**Interfaces:**
- Produces: `POST /warmup -> {"ok":true,"elapsed":s}`（触发双模型加载+各一次首推理）；`scripts/start-ai.ps1` 一键启动；spike 报告（MVP-2 计划的输入）

- [ ] **Step 1: 追加 /warmup**

```python
WARMUP_TEXT = "Hello, this is a warmup sentence."


@app.post("/warmup")
def warmup():
    t0 = time.time()
    tts_req = TTSRequest(text=WARMUP_TEXT)
    wavs, sr = get_tts().generate_custom_voice(
        text=tts_req.text, language="English", speaker=tts_req.speaker
    )
    pcm = wavs[0].astype(np.float32)
    if pcm.ndim > 1:
        pcm = pcm.mean(axis=0)
    # 重采样到 16k 不是必须：ASR 接受 (ndarray, sr)
    get_asr().transcribe(audio=(pcm, sr), language="English")
    return {"ok": True, "elapsed": round(time.time() - t0, 2)}
```

- [ ] **Step 2: 启动脚本**

```powershell
# scripts/start-ai.ps1
$ErrorActionPreference = "Stop"
conda activate speakloop-ai
Set-Location "$PSScriptRoot\..\ai-server"
uvicorn server:app --host 127.0.0.1 --port 8100
```

- [ ] **Step 3: 全链路冒烟**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-ai.ps1
# 另开终端：
curl.exe -s -X POST http://127.0.0.1:8100/warmup
curl.exe -s http://127.0.0.1:8100/health
```

Expected: warmup 返回 `{"ok":true,"elapsed":<冷启动总耗时>}`；health 变为 `asr:true, tts:true`。

- [ ] **Step 4: 写 spike 报告**

`docs/superpowers/specs/2026-10-01-ai-server-spike-results.md`，模板：

```markdown
# ai-server Spike 实测报告（2026-10-01）

| 指标 | 实测值 | 判定 |
|---|---|---|
| 环境共存（qwen-tts + qwen-asr 单 env） | （通过/失败+原因） | |
| webm 解码 | （通过/失败） | |
| 双模型常驻显存 | （nvidia-smi 实测 MB / 8192MB） | ≤7000MB 通过 |
| TTS 冷启动 / 热延迟（≤3 句） | （s / s） | 热 ≤5s 通过 |
| ASR 耗时（≤15s 音频） | （s） | ≤3s 通过 |
| /health /warmup 行为 | （描述） | |

结论与偏差：（若 OOM：记录现象，方案改 ASR 0.6B→（确认后）或 TTS 降 0.6B；若延迟超标：在 MVP-2 优先启用 SSE+分句）
```

- [ ] **Step 5: 清理临时产物并提交**

```powershell
Remove-Item E:\EnglishDemo\tts_out.wav, ai-server\test_webm.webm -ErrorAction SilentlyContinue
git add ai-server/server.py scripts/start-ai.ps1 docs/superpowers/specs/2026-10-01-ai-server-spike-results.md
git commit -m "feat(ai-server): warmup, start script, spike report"
```
