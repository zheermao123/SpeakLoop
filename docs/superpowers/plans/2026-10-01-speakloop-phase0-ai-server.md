# SpeakLoop ai-server 实施计划（阶段 0 Spike → 可用服务）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在本机 Windows + RTX 3070 上跑通**双服务** asr-server(:8100) 与 tts-server(:8101)，暴露 `/health` `/stt` `/tts` `/warmup`，各自模型常驻（Qwen3-ASR-0.6B + Qwen3-TTS-1.7B-CustomVoice），并产出 spike 实测报告（显存/延迟/webm 解码）。

**Architecture:** 独立 Python 服务（`ai-server/`），与 Node 侧零依赖耦合；**双 conda 环境双进程**——qwen-asr(0.0.6) 钉 `transformers==4.57.6`、qwen-tts(0.1.1) 钉 `==4.57.3`，PyPI 元数据核实互斥，单环境无确定解；同一份 `server.py` 按 env `AI_ROLE=asr|tts` 条件加载模型与注册路由；模型懒加载，`/warmup` 触发本服务加载+首推理；音频解码统一走 PyAV 归一 16kHz float32 mono。

**Tech Stack:** Python 3.12（conda env `speakloop-asr` / `speakloop-tts`）、qwen-asr 0.0.6、qwen-tts 0.1.1、FastAPI、uvicorn、PyAV、PyTorch CUDA (bf16 + sdpa)。

## Global Constraints

- OS：Windows，shell：PowerShell 5.1；所有命令在仓库根 `E:\EnglishDemo` 执行
- **双 conda 环境**（transformers 钉版互斥的确定性解）：`speakloop-asr`（transformers 4.57.6 + qwen-asr）与 `speakloop-tts`（transformers 4.57.3 + qwen-tts），Python 3.12
- **端口约定**：asr-server `127.0.0.1:8100`，tts-server `127.0.0.1:8101`；仅服务端调用，无需 CORS
- **角色化**：同一份 `ai-server/server.py`，启动时 env `AI_ROLE=asr|tts` 必填，否则进程退出；进程内只 import/注册本角色的模型与路由
- ASR 默认 `Qwen/Qwen3-ASR-0.6B`（env `ASR_MODEL` 可切 `Qwen/Qwen3-ASR-1.7B`）
- TTS 固定 `Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice`，默认音色 `Aiden`，language 固定 `English`
- 精度 bf16，attention 用 `sdpa`（**不得**用 flash_attention_2——Windows 编译困难）
- PyAV（`av`）在 asr 环境**显式声明**——qwen-asr/qwen-tts 的依赖均不含它，缺省会挂解码
- 权重用 ModelScope 预下载到 `ai-server/models/`，运行时不联网拉取
- `.gitignore` 必须包含 `ai-server/models/`、`ai-server/__pycache__/`
- GPU：RTX 3070 8GB——任一步 OOM 即停下记录，不擅自降级模型规格

---

### Task 1: 双 conda 环境与依赖

**Files:**
- Create: `ai-server/requirements-asr.txt`、`ai-server/requirements-tts.txt`
- Create: `.gitignore`（仓库根）

**Interfaces:**
- Produces: 两个可用 conda env——`speakloop-asr`（含 qwen-asr + av）与 `speakloop-tts`（含 qwen-tts），后续任务按角色选用

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

- [ ] **Step 2: 创建两份 requirements**

`ai-server/requirements-asr.txt`：

```text
qwen-asr
fastapi
uvicorn[standard]
python-multipart
av
```

`ai-server/requirements-tts.txt`：

```text
qwen-tts
fastapi
uvicorn[standard]
python-multipart
```

- [ ] **Step 3: 建 asr 环境并装 CUDA torch（先于 requirements，避免装成 CPU 版）**

```powershell
conda create -n speakloop-asr python=3.12 -y
conda activate speakloop-asr
pip install torch --index-url https://download.pytorch.org/whl/cu121
pip install -r ai-server/requirements-asr.txt
```

Expected: `Successfully installed torch-2.x.x+cu121` 及后续依赖安装成功。若 pip 报 transformers 版本冲突则停下核查（不应发生——单环境只有 qwen-asr 一个钉版方）。

- [ ] **Step 4: 建 tts 环境（同样先装 CUDA torch）**

```powershell
conda create -n speakloop-tts python=3.12 -y
conda activate speakloop-tts
pip install torch --index-url https://download.pytorch.org/whl/cu121
pip install -r ai-server/requirements-tts.txt
```

- [ ] **Step 5: 分别验证导入**

```powershell
conda activate speakloop-asr
python -c "import torch; print(torch.cuda.is_available()); import qwen_asr, av; print('asr env ok')"
conda activate speakloop-tts
python -c "import torch; print(torch.cuda.is_available()); import qwen_tts; print('tts env ok')"
```

Expected: 两次均输出 `True` 与 `ok`。若 `torch.cuda.is_available()` 为 False，停止并排查驱动（`nvidia-smi`）。

- [ ] **Step 6: Commit**

```powershell
git add .gitignore ai-server/requirements-asr.txt ai-server/requirements-tts.txt
git commit -m "chore: dual-env ai-server deps and gitignore"
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

- [ ] **Step 2: 安装 modelscope 并执行（任一 ai 环境均可，用 asr 环境）**

```powershell
conda activate speakloop-asr
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

### Task 3: server.py 骨架（AI_ROLE 角色化）+ /health

**Files:**
- Create: `ai-server/server.py`

**Interfaces:**
- Produces: 单文件 FastAPI app，按 env `AI_ROLE` 分角色；`GET /health -> {"status":"ok","role":"asr|tts","model_loaded":bool}`；内部函数 `get_asr()` / `get_tts()` 供后续任务追加的路由使用（每个进程只有本角色的会被调用）

- [ ] **Step 1: 编写 server.py**

```python
import io
import os
import time

import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

ROLE = os.environ.get("AI_ROLE", "")
if ROLE not in ("asr", "tts"):
    raise SystemExit("env AI_ROLE must be 'asr' or 'tts'")

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
ASR_NAME = os.environ.get("ASR_MODEL", "Qwen3-ASR-0.6B")
TTS_NAME = "Qwen3-TTS-12Hz-1.7B-CustomVoice"

app = FastAPI(title=f"speakloop-{ROLE}-server")
_loaded: dict = {"asr": None, "tts": None}


def get_asr():
    if _loaded["asr"] is None:
        from qwen_asr import Qwen3ASRModel

        _loaded["asr"] = Qwen3ASRModel.from_pretrained(
            os.path.join(MODELS_DIR, ASR_NAME),
            dtype=torch.bfloat16,
            device_map="cuda:0",
            attn_implementation="sdpa",
            max_new_tokens=512,
        )
    return _loaded["asr"]


def get_tts():
    if _loaded["tts"] is None:
        from qwen_tts import Qwen3TTSModel

        _loaded["tts"] = Qwen3TTSModel.from_pretrained(
            os.path.join(MODELS_DIR, TTS_NAME),
            device_map="cuda:0",
            dtype=torch.bfloat16,
            attn_implementation="sdpa",
        )
    return _loaded["tts"]


@app.get("/health")
def health():
    return {"status": "ok", "role": ROLE, "model_loaded": _loaded[ROLE] is not None}
```

（注：`get_asr`/`get_tts` 两个定义都在文件里，但角色包只在对应环境安装——错误角色下只要不调用对应函数就不会触发 import；路由注册在 Task 4/5 中按 `if ROLE == ...` 条件包裹。）

- [ ] **Step 2: 双角色启动验证 /health**

tts 角色（:8101）：

```powershell
conda activate speakloop-tts
Set-Location ai-server
$env:AI_ROLE = "tts"
uvicorn server:app --host 127.0.0.1 --port 8101
```

asr 角色（:8100，另开终端）：

```powershell
conda activate speakloop-asr
Set-Location ai-server
$env:AI_ROLE = "asr"
uvicorn server:app --host 127.0.0.1 --port 8100
```

验证：

```powershell
curl.exe -s http://127.0.0.1:8101/health
curl.exe -s http://127.0.0.1:8100/health
```

Expected: `{"status":"ok","role":"tts","model_loaded":false}` 与 `{"status":"ok","role":"asr","model_loaded":false}`。
另验证缺 AI_ROLE 时退出：不设 env 直接 `uvicorn server:app` → 启动即报 `AI_ROLE must be 'asr' or 'tts'` 退出。

- [ ] **Step 3: Commit**

```powershell
git add ai-server/server.py
git commit -m "feat(ai-server): role-based fastapi skeleton with /health"
```

---

### Task 4: /tts 端点（tts 角色）

**Files:**
- Modify: `ai-server/server.py`（文件末尾追加角色化路由块）

**Interfaces:**
- Produces: `POST /tts {text, speaker?, instruct?} -> audio/wav`（仅 tts 角色进程注册）；`POST /tts/warmup`（见 Task 6 前的占位说明——warmup 在 Task 6 追加）

- [ ] **Step 1: 文件末尾追加**

```python
if ROLE == "tts":
    import soundfile as sf
    from fastapi.responses import Response

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

- [ ] **Step 2: 重启 tts 进程（speakloop-tts，:8101），curl 验证 + 计时（spike 数据点 1）**

```powershell
curl.exe -s -o E:\EnglishDemo\tts_out.wav -w "%{time_total}" -X POST http://127.0.0.1:8101/tts -H "Content-Type: application/json" -d "{\"text\":\"Hello, this is a warmup sentence for the speak loop project.\",\"speaker\":\"Aiden\"}"
```

Expected: 输出秒数（首含加载，记为冷启动）；再执行一次记为热延迟。`tts_out.wav` 大小 > 100KB。冷启动期间另开 `nvidia-smi` 记录显存（spike 数据点 2）。

- [ ] **Step 3: Commit**

```powershell
git add ai-server/server.py
git commit -m "feat(ai-server): /tts endpoint with qwen3-tts"
```

---

### Task 5: /stt 端点（asr 角色，PyAV 解码 + 回环测试）

**Files:**
- Modify: `ai-server/server.py`（末尾追加 asr 路由块）
- Create: `ai-server/make_test_webm.py`

**Interfaces:**
- Produces: `POST /stt`（仅 asr 角色进程注册；multipart 字段 `file`，任意 PyAV 可解容器）`-> {"text": str, "elapsed": s}`

- [ ] **Step 1: 文件末尾追加**

```python
if ROLE == "asr":
    import av
    from fastapi import File, UploadFile

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

- [ ] **Step 2: 重启 asr 进程（speakloop-asr，:8100），wav 回环测试（spike 数据点 3）**

```powershell
curl.exe -s -X POST http://127.0.0.1:8100/stt -F "file=@E:\EnglishDemo\tts_out.wav"
```

Expected: `{"text":"Hello, this is a warmup sentence for the speak loop project.","elapsed":...}`（文本基本一致即算通过；记 elapsed 与 wav 时长比）。跨服务回环天然验证了双进程并存。

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
conda activate speakloop-asr
Set-Location ai-server
python make_test_webm.py
curl.exe -s -X POST http://127.0.0.1:8100/stt -F "file=@test_webm.webm"
```

Expected: HTTP 200，`text` 为空或极少（正弦波无人声）——**验证点仅是解码不报错**。若需带语音的 webm，用浏览器真实录音在 MVP-2 联调时验证。

- [ ] **Step 4: Commit**

```powershell
git add ai-server/server.py ai-server/make_test_webm.py
git commit -m "feat(ai-server): /stt endpoint with pyav decode"
```

---

### Task 6: /warmup（各自角色）+ 启动脚本 + spike 报告

**Files:**
- Modify: `ai-server/server.py`（两个角色块内各追加 /warmup）
- Create: `scripts/start-ai.ps1`
- Create: `docs/superpowers/specs/2026-10-01-ai-server-spike-results.md`

**Interfaces:**
- Produces: `POST /warmup -> {"ok":true,"elapsed":s}`（两服务各自注册，触发本服务模型加载+一次首推理）；`scripts/start-ai.ps1` 一键拉起双进程；spike 报告（MVP-2 计划的输入）

- [ ] **Step 1: tts 角色块末尾（`if ROLE == "tts":` 内）追加**

```python
    @app.post("/warmup")
    def tts_warmup():
        t0 = time.time()
        get_tts().generate_custom_voice(text="Hi.", language="English", speaker="Aiden")
        return {"ok": True, "elapsed": round(time.time() - t0, 2)}
```

asr 角色块末尾（`if ROLE == "asr":` 内）追加

```python
    @app.post("/warmup")
    def asr_warmup():
        t0 = time.time()
        silence = np.zeros(16000, dtype=np.float32)
        get_asr().transcribe(audio=(silence, 16000), language="English")
        return {"ok": True, "elapsed": round(time.time() - t0, 2)}
```

（说明：warmup 语义为"本服务"预热——模型加载 + 首次 CUDA 上下文建立；ASR 用 1 秒静音，目的在预热不在识别精度。）

- [ ] **Step 2: 启动脚本（拉起双进程）**

```powershell
# scripts/start-ai.ps1 —— 拉起 asr(:8100) 与 tts(:8101) 双服务
$ErrorActionPreference = "Stop"
$serverDir = Join-Path $PSScriptRoot "..\ai-server"

Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "conda activate speakloop-asr; Set-Location '$serverDir'; `$env:AI_ROLE='asr'; uvicorn server:app --host 127.0.0.1 --port 8100"
)
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "conda activate speakloop-tts; Set-Location '$serverDir'; `$env:AI_ROLE='tts'; uvicorn server:app --host 127.0.0.1 --port 8101"
)
Write-Host "asr -> http://127.0.0.1:8100   tts -> http://127.0.0.1:8101"
```

- [ ] **Step 3: 全链路冒烟**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-ai.ps1
# 等两个窗口各自出现 Uvicorn running 后：
curl.exe -s -X POST http://127.0.0.1:8100/warmup
curl.exe -s -X POST http://127.0.0.1:8101/warmup
curl.exe -s http://127.0.0.1:8100/health
curl.exe -s http://127.0.0.1:8101/health
```

Expected: 两个 warmup 各返回 `{"ok":true,"elapsed":<本服务冷启动总耗时>}`；两个 health 均变 `model_loaded:true`。

- [ ] **Step 4: 写 spike 报告**

`docs/superpowers/specs/2026-10-01-ai-server-spike-results.md`，模板：

```markdown
# ai-server Spike 实测报告（2026-10-01）

| 指标 | 实测值 | 判定 |
|---|---|---|
| 双环境独立运行（asr: transformers 4.57.6 / tts: 4.57.3） | （通过/失败+原因） | |
| 双进程并存（:8100 + :8101 同卡） | （通过/失败） | |
| webm 解码 | （通过/失败） | |
| 双模型常驻总显存（两进程合计，nvidia-smi） | （实测 MB / 8192MB） | ≤7000MB 通过 |
| TTS 冷启动 / 热延迟（≤3 句） | （s / s） | 热 ≤5s 通过 |
| ASR 耗时（≤15s 音频） | （s） | ≤3s 通过 |
| /health /warmup 双服务行为 | （描述） | |

结论与偏差：（若 OOM：记录现象，方案改 ASR 0.6B→（确认后）或 TTS 降 0.6B；若延迟超标：在 MVP-2 优先启用 SSE+分句）
```

- [ ] **Step 5: 清理临时产物并提交**

```powershell
Remove-Item E:\EnglishDemo\tts_out.wav, ai-server\test_webm.webm -ErrorAction SilentlyContinue
git add ai-server/server.py scripts/start-ai.ps1 docs/superpowers/specs/2026-10-01-ai-server-spike-results.md
git commit -m "feat(ai-server): per-role warmup, dual-process start script, spike report"
```
