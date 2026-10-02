# scripts/start-all.ps1 —— 一键启动 SpeakLoop 全栈（无窗口）
# 用法：双击根目录 启动SpeakLoop.vbs；或 powershell -File scripts/start-all.ps1 [-Silent] [-NoBrowser]
param(
  [switch]$Silent,
  [switch]$NoBrowser
)
$ErrorActionPreference = "Continue"
$root = Split-Path $PSScriptRoot -Parent
$logDir = Join-Path $root "logs"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

function Test-Url($u) {
  try { return (Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200 } catch { return $false }
}

$asrPy = "E:\miniconda3\envs\speakloop-asr\python.exe"
$ttsPy = "E:\miniconda3\envs\speakloop-tts\python.exe"
$serverDir = Join-Path $root "ai-server"

if (-not (Test-Url "http://127.0.0.1:8100/health")) {
  $env:AI_ROLE = "asr"
  Start-Process -FilePath $asrPy `
    -ArgumentList "-m", "uvicorn", "server:app", "--host", "127.0.0.1", "--port", "8100" `
    -WorkingDirectory $serverDir -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir "asr.log") `
    -RedirectStandardError (Join-Path $logDir "asr.err")
}

if (-not (Test-Url "http://127.0.0.1:8101/health")) {
  $env:AI_ROLE = "tts"
  Start-Process -FilePath $ttsPy `
    -ArgumentList "-m", "uvicorn", "server:app", "--host", "127.0.0.1", "--port", "8101" `
    -WorkingDirectory $serverDir -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir "tts.log") `
    -RedirectStandardError (Join-Path $logDir "tts.err")
}

if (-not (Test-Url "http://localhost:3000/api/scenarios")) {
  if (-not (Test-Path (Join-Path $root ".next\BUILD_ID"))) {
    Push-Location $root
    npm run build 2>&1 | Out-File (Join-Path $logDir "build.log") -Encoding utf8
    Pop-Location
  }
  Start-Process -FilePath "npm.cmd" -ArgumentList "run", "start" `
    -WorkingDirectory $root -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir "next.log") `
    -RedirectStandardError (Join-Path $logDir "next.err")
}

$deadline = (Get-Date).AddSeconds(120)
$nextUp = $false
do {
  Start-Sleep -Seconds 3
  $nextUp = Test-Url "http://localhost:3000/api/scenarios"
} until ($nextUp -or (Get-Date) -gt $deadline)

try {
  Invoke-WebRequest -Uri "http://127.0.0.1:8100/warmup" -Method POST -UseBasicParsing -TimeoutSec 5 | Out-Null
} catch {}
try {
  Invoke-WebRequest -Uri "http://127.0.0.1:8101/warmup" -Method POST -UseBasicParsing -TimeoutSec 5 | Out-Null
} catch {}

if (-not $nextUp -and -not $Silent) {
  $shell = New-Object -ComObject Wscript.Shell
  $shell.Popup("SpeakLoop 启动超时，请查看 logs\ 目录日志。", 8, "SpeakLoop", 16) | Out-Null
}

if ($nextUp -and -not $NoBrowser) {
  Start-Process "http://localhost:3000"
}
