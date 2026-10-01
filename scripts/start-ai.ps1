# scripts/start-ai.ps1 —— 拉起 asr(:8100) 与 tts(:8101) 双服务
# 注: 本机 conda 未加入 PATH(AddToPath=0)，故直接用各环境 python.exe 启动（受控适配 g）
$ErrorActionPreference = "Stop"
$serverDir = Join-Path $PSScriptRoot "..\ai-server"

Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "Set-Location '$serverDir'; `$env:AI_ROLE='asr'; & 'E:\miniconda3\envs\speakloop-asr\python.exe' -m uvicorn server:app --host 127.0.0.1 --port 8100"
)
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "Set-Location '$serverDir'; `$env:AI_ROLE='tts'; & 'E:\miniconda3\envs\speakloop-tts\python.exe' -m uvicorn server:app --host 127.0.0.1 --port 8101"
)
Write-Host "asr -> http://127.0.0.1:8100   tts -> http://127.0.0.1:8101"
