param(
    [string]$LemonadeUrl = "http://localhost:13305"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env"
$example = Join-Path $root ".env.lemonade.example"

if (-not (Get-Command lemonade -ErrorAction SilentlyContinue)) {
    Write-Host "The 'lemonade' CLI was not found. Install Lemonade from https://lemonade-server.ai and reopen this terminal." -ForegroundColor Red
    exit 1
}

if (Test-Path $envFile) {
    Write-Host ".env already exists; leaving it unchanged. Compare it with .env.lemonade.example if you want the Lemonade settings."
} else {
    Copy-Item $example $envFile
    Write-Host "Created .env from .env.lemonade.example."
}

function Get-EnvValue([string]$name, [string]$fallback) {
    $line = Get-Content $envFile | Where-Object { $_ -match "^\s*$name\s*=" } | Select-Object -First 1
    if ($line) { return ($line -split "=", 2)[1].Trim() }
    return $fallback
}

$chatModel = Get-EnvValue "LLM_MODEL" "Qwen2.5-7B-Instruct-Hybrid"
$embedModel = Get-EnvValue "EMBED_MODEL" "nomic-embed-text-v1-GGUF"

foreach ($model in @($chatModel, $embedModel)) {
    Write-Host "Pulling $model ..."
    lemonade pull $model
    if ($LASTEXITCODE -ne 0) { Write-Host "Failed to pull $model" -ForegroundColor Red; exit 1 }
}

try {
    $models = Invoke-RestMethod -Uri "$LemonadeUrl/api/v1/models" -TimeoutSec 5
    Write-Host "Lemonade is running at $LemonadeUrl with models:" -ForegroundColor Green
    $models.data | ForEach-Object { Write-Host "  $($_.id)" }
} catch {
    Write-Host "Lemonade is not responding at $LemonadeUrl. Start the Lemonade server, then re-run this script or check the URL." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Next:"
Write-Host "  docker compose up -d --build"
Write-Host "  docker compose exec backend python ingest.py --reset"
