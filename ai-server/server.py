import ctypes
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
                chunks.append(np.frombuffer(ctypes.string_at(f.planes[0].buffer_ptr, f.planes[0].buffer_size), dtype=np.int16))
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
