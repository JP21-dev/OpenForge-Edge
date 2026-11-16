# Checks that OpenForge Edge has everything it needs locally and is not talking to the internet.
# Run from the repo root:  powershell -ExecutionPolicy Bypass -File scripts\offline-check.ps1
# For the real test, turn off Wi-Fi / unplug Ethernet first, then run this and ask the copilot a question.

$ErrorActionPreference = "Continue"
$failed = 0

function Pass($msg) { Write-Host "  [ok]   $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red; $script:failed++ }
function Info($msg) { Write-Host "  [info] $msg" -ForegroundColor Yellow }

function EnvValue($name, $default) {
    if (Test-Path .env) {
        $line = Select-String -Path .env -Pattern "^\s*$name\s*=" | Select-Object -Last 1
        if ($line) { return ($line.Line -split "=", 2)[1].Trim() }
    }
    return $default
}

$provider = EnvValue "LLM_PROVIDER" "ollama"
$models = @(
    (EnvValue "LLM_MODEL" "qwen2.5:7b"),
    (EnvValue "EMBED_MODEL" "nomic-embed-text"),
    (EnvValue "VISION_MODEL" "qwen3-vl:4b-instruct")
)

Write-Host "`nModels"
if ($provider -eq "ollama") {
    $ollama = Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"
    if (-not (Test-Path $ollama)) { $ollama = "ollama" }
    $installed = & $ollama list 2>$null | Select-Object -Skip 1 | ForEach-Object { ($_ -split "\s+")[0] }
    foreach ($m in $models) {
        $tag = if ($m -match ":") { $m } else { "$m`:latest" }
        if ($installed -contains $tag) { Pass "$m is downloaded" } else { Fail "$m is missing: run  ollama pull $m  while online" }
    }
} else {
    Info "LLM_PROVIDER=${provider}: check the models with  lemonade list"
}

Write-Host "`nDocker images"
$images = @(docker compose images --format json 2>$null | ConvertFrom-Json | ForEach-Object { $_ } | Where-Object { $_.ContainerName })
if ($images) {
    foreach ($img in $images) { Pass "$($img.ContainerName): $($img.Repository):$($img.Tag)" }
} else {
    Fail "No local images found: run  docker compose up -d --build  while online"
}

Write-Host "`nServices"
try {
    $h = Invoke-RestMethod http://localhost:8000/api/health -TimeoutSec 10
    Pass "backend: $($h.provider) $($h.model), mode $($h.mode), $($h.knowledge_chunks) knowledge chunks"
    foreach ($svc in $h.services.PSObject.Properties) {
        if ($svc.Value -eq "ok") { Pass $svc.Name } else { Fail "$($svc.Name): $($svc.Value)" }
    }
} catch {
    Fail "backend not reachable on http://localhost:8000"
}
try {
    $null = Invoke-WebRequest -UseBasicParsing http://localhost:3000 -TimeoutSec 10
    Pass "Bench UI on http://localhost:3000"
} catch {
    Fail "Bench UI not reachable on http://localhost:3000"
}

Write-Host "`nOutbound connections"
$private = '^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$|fe80:|0\.0\.0\.0)'
$procs = Get-Process ollama*, lemond*, lemonade* -ErrorAction SilentlyContinue
$external = @()
foreach ($p in $procs) {
    $external += Get-NetTCPConnection -OwningProcess $p.Id -State Established -ErrorAction SilentlyContinue |
        Where-Object { $_.RemoteAddress -notmatch $private } |
        Select-Object @{n = "Process"; e = { $p.ProcessName } }, RemoteAddress, RemotePort
}
if ($external) {
    Fail "The model server has connections outside this machine (an update check or a model download):"
    $external | Format-Table -AutoSize | Out-String | Write-Host
} else {
    Pass "No internet connections from the model server"
}

$online = Test-Connection -ComputerName 1.1.1.1 -Count 1 -Quiet -ErrorAction SilentlyContinue
if ($online) {
    Info "This PC is online. For the real test: turn off Wi-Fi, run this again, and ask the copilot a question."
} else {
    Pass "This PC is offline"
}

Write-Host ""
if ($failed) { Write-Host "$failed check(s) failed." -ForegroundColor Red; exit 1 }
Write-Host "Everything OpenForge Edge needs is on this machine." -ForegroundColor Green
