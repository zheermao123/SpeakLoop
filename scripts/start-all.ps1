# scripts/start-all.ps1 —— SpeakLoop 语音双服务启动器（无窗口）
# 用法：双击根目录 启动SpeakLoop.vbs；或 powershell -File scripts/start-all.ps1 [-Silent]
param([switch]$Silent)
$ErrorActionPreference = "Continue"
$root = if ($env:SPEAKLOOP_REPO_ROOT) { $env:SPEAKLOOP_REPO_ROOT } else { Split-Path $PSScriptRoot -Parent }
$logDir = Join-Path $root "logs"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$actionLog = Join-Path $logDir "start-all.log"
function Log($m) {
  Add-Content -Path $actionLog -Value ("[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $m)
}
Log ("start-all invoked (Silent=$Silent)")

function Test-Url($u) {
  try { return (Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200 } catch { return $false }
}

$asrPy = "E:\miniconda3\envs\speakloop-asr\python.exe"
$ttsPy = "E:\miniconda3\envs\speakloop-tts\python.exe"
$serverDir = Join-Path $root "ai-server"

if (-not (Test-Url "http://127.0.0.1:8100/health")) {
  Log "starting asr-server"
  $env:AI_ROLE = "asr"
  Start-Process -FilePath $asrPy `
    -ArgumentList "-m", "uvicorn", "server:app", "--host", "127.0.0.1", "--port", "8100" `
    -WorkingDirectory $serverDir -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir "asr.log") `
    -RedirectStandardError (Join-Path $logDir "asr.err")
}

if (-not (Test-Url "http://127.0.0.1:8101/health")) {
  Log "starting tts-server"
  $env:AI_ROLE = "tts"
  Start-Process -FilePath $ttsPy `
    -ArgumentList "-m", "uvicorn", "server:app", "--host", "127.0.0.1", "--port", "8101" `
    -WorkingDirectory $serverDir -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir "tts.log") `
    -RedirectStandardError (Join-Path $logDir "tts.err")
}

try {
  Invoke-WebRequest -Uri "http://127.0.0.1:8100/warmup" -Method POST -UseBasicParsing -TimeoutSec 5 | Out-Null
} catch {}
try {
  Invoke-WebRequest -Uri "http://127.0.0.1:8101/warmup" -Method POST -UseBasicParsing -TimeoutSec 5 | Out-Null
} catch {}
