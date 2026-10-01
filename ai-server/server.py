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
