$ErrorActionPreference = "Stop"

$backendDir = $PSScriptRoot
$repoRoot = Split-Path -Parent $backendDir
$python = Join-Path $backendDir "venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $python)) {
    throw "Backend virtual environment not found: $python. Create it with the standard Windows Python installation first."
}

Set-Location $repoRoot
& $python -m uvicorn backend.app:app --host 127.0.0.1 --port 8124 @args
