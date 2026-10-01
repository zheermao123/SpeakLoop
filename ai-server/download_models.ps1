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
