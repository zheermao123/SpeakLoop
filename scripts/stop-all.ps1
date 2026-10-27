# scripts/stop-all.ps1 —— 停止语音双服务（8100/8101；供手动停止使用，Electron 退出时由主进程直接清理端口）
param([switch]$Quiet)
foreach ($port in 8100, 8101) {
  try {
    $pids = (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue).OwningProcess |
      Select-Object -Unique
    foreach ($p in $pids) {
      Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
    }
  } catch {}
}
if (-not $Quiet) {
  $shell = New-Object -ComObject Wscript.Shell
  $shell.Popup("SpeakLoop 已停止。", 3, "SpeakLoop", 64) | Out-Null
}
