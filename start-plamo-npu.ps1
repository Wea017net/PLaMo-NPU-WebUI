# PLaMo 3 Translate (NPU) launcher
#   .\start-plamo-npu.ps1                 ... INT4 per-channel model (faster), opens the browser
#   .\start-plamo-npu.ps1 -Model g128     ... INT4 group-128 model (closer to the original model)
#   .\start-plamo-npu.ps1 -NoBrowser
# The Web UI and the OpenAI-compatible API are served together on one port (default 8100).
param(
    [ValidateSet("cw", "g128")][string]$Model = "cw",
    [string]$Device = "NPU",
    [int]$Port = 8100,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$env:HF_HOME = Join-Path $root ".cache\hf"
$env:PIP_CACHE_DIR = Join-Path $root ".cache\pip"
$env:PYTHONIOENCODING = "utf-8"
$python = Join-Path $root "venv\Scripts\python.exe"
$server = Join-Path $root "server\npu_server.py"
$url = "http://127.0.0.1:$Port/"

Write-Host "PLaMo 3 Translate (NPU)"
Write-Host "  Web UI / API : $url"
Write-Host "  Model        : $Model    Device: $Device"
Write-Host "The first start (or after changing settings) compiles the model for the NPU and takes about a minute."
Write-Host "Later starts use the cache and take only a few seconds."
Write-Host "Press Ctrl+C or close this window to stop the server."
Write-Host ""

if (-not $NoBrowser) {
    # Open the browser once the server responds (the UI shows a loading state while the model loads)
    Start-Job -ArgumentList $url -ScriptBlock {
        param($u)
        for ($i = 0; $i -lt 60; $i++) {
            try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "${u}props" | Out-Null; Start-Process $u; return } catch { Start-Sleep 1 }
        }
    } | Out-Null
}

& $python -I $server --model $Model --device $Device --port $Port
