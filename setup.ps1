# PLaMo NPU WebUI setup
#   1. creates a Python virtual environment in .\venv
#   2. installs the packages in requirements.txt
#   3. downloads PLaMo 3 Translate 2B and builds the NPU models (tools\build_model.py)
#
#   .\setup.ps1                       ... everything (both INT4 variants)
#   .\setup.ps1 -Variants cw          ... build only the per-channel model
#   .\setup.ps1 -SkipModel            ... install packages only
param(
    [string]$Python = "",
    [ValidateSet("cw", "g128")][string[]]$Variants = @("cw", "g128"),
    [switch]$SkipModel
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$venv = Join-Path $root "venv"
$py = Join-Path $venv "Scripts\python.exe"
$env:HF_HOME = Join-Path $root ".cache\hf"
$env:PIP_CACHE_DIR = Join-Path $root ".cache\pip"
$env:PYTHONIOENCODING = "utf-8"

if (-not (Test-Path $py)) {
    if (-not $Python) {
        if (Get-Command py -ErrorAction SilentlyContinue) { $Python = "py -3.10" } else { $Python = "python" }
    }
    Write-Host "Creating virtual environment with: $Python"
    $exe, $rest = $Python -split " ", 2
    if ($rest) { & $exe $rest -m venv $venv } else { & $exe -m venv $venv }
    if ($LASTEXITCODE -ne 0) { throw "Failed to create the virtual environment. Install Python 3.10 and try again." }
}

Write-Host "Installing packages..."
& $py -m pip install --upgrade pip
& $py -m pip install -r (Join-Path $root "requirements.txt")
if ($LASTEXITCODE -ne 0) { throw "pip install failed." }

if ($SkipModel) { Write-Host "Skipped the model build (-SkipModel)."; exit 0 }

Write-Host ""
Write-Host "The model is licensed under the PLaMo Community License:"
Write-Host "  https://plamo.preferredai.jp/info/plamo-community-license-en"
Write-Host "Downloading and converting it means you agree to that license."
Write-Host ""
& $py -I (Join-Path $root "tools\build_model.py") --variants @Variants
if ($LASTEXITCODE -ne 0) { throw "Model build failed." }
