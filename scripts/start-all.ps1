# scripts/start-all.ps1 —— 一键启动 SpeakLoop 全栈（无窗口）
# 用法：双击根目录 启动SpeakLoop.vbs；或 powershell -File scripts/start-all.ps1 [-Silent] [-NoBrowser]
param(
  [switch]$Silent,
  [switch]$NoBrowser,
  [switch]$NoNext
)
$ErrorActionPreference = "Continue"
$root = if ($env:SPEAKLOOP_REPO_ROOT) { $env:SPEAKLOOP_REPO_ROOT } else { Split-Path $PSScriptRoot -Parent }
$logDir = Join-Path $root "logs"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$actionLog = Join-Path $logDir "start-all.log"
function Log($m) {
  Add-Content -Path $actionLog -Value ("[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $m)
}
Log ("start-all invoked (Silent=$Silent NoBrowser=$NoBrowser)")

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

$nextWasDown = -not (Test-Url "http://localhost:3000/api/scenarios")
if ($nextWasDown -and -not $NoNext) {
  Log "starting next-server"
  if (-not (Test-Path (Join-Path $root ".next\BUILD_ID"))) {
    Log "no build artifacts, running npm run build"
    Push-Location $root
    npm run build 2>&1 | Out-File (Join-Path $logDir "build.log") -Encoding utf8
    Pop-Location
  }
  Start-Process -FilePath "npm.cmd" -ArgumentList "run", "start" `
    -WorkingDirectory $root -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir "next.log") `
    -RedirectStandardError (Join-Path $logDir "next.err")
}

if ($NoNext) {
  $nextUp = $true
} else {
  $deadline = (Get-Date).AddSeconds(120)
  $nextUp = $false
  do {
    Start-Sleep -Seconds 3
    $nextUp = Test-Url "http://localhost:3000/api/scenarios"
  } until ($nextUp -or (Get-Date) -gt $deadline)
}

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

$openBrowser = ($nextWasDown -and -not $NoNext)
$reason = if ($nextWasDown) { "next freshly started" } else { "probe" }
if ($nextUp -and -not $openBrowser) {
  try {
    $hs = (Invoke-WebRequest -Uri "http://localhost:3000/api/heartbeat" -UseBasicParsing -TimeoutSec 3).Content | ConvertFrom-Json
    if ($hs.armed -and $null -ne $hs.ageSec -and [int]$hs.ageSec -lt 60) {
      $openBrowser = $false
      $reason = "skip: fresh browser heartbeat ($($hs.ageSec)s)"
    } else {
      $openBrowser = $true
      $reason = "open: heartbeat stale/absent (armed=$($hs.armed) ageSec=$($hs.ageSec))"
    }
  } catch {
    $openBrowser = $true
    $reason = "open: heartbeat probe failed"
  }
}
Log ("browser decision: $reason (openBrowser=$openBrowser, nextUp=$nextUp)")

if ($nextUp -and -not $NoBrowser -and $openBrowser) {
  Start-Process "http://localhost:3000"
}
