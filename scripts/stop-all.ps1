# scripts/stop-all.ps1 —— 停止 SpeakLoop 全栈（无窗口）
foreach ($port in 8100, 8101, 3000) {
  try {
    $pids = (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue).OwningProcess |
      Select-Object -Unique
    foreach ($p in $pids) {
      Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
    }
  } catch {}
}
$shell = New-Object -ComObject Wscript.Shell
$shell.Popup("SpeakLoop 已停止。", 3, "SpeakLoop", 64) | Out-Null
