# Usage: powershell -ExecutionPolicy Bypass -File scripts\backup.ps1 [-Destination <dir>] [-Keep 14]
# ChromaDB is not backed up; restore.ps1 rebuilds it.

param(
    [string]$Destination = (Join-Path $PSScriptRoot "..\backups"),
    [int]$Keep = 14
)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Destination = [IO.Path]::GetFullPath($Destination)
$target = Join-Path $Destination "openforge-$stamp"
New-Item -ItemType Directory -Force $target | Out-Null

function Step($msg) { Write-Host "  $msg" -ForegroundColor Cyan }

foreach ($c in "mongodb", "openforge-backend") {
    $state = docker inspect -f "{{.State.Running}}" $c 2>$null
    if ($state -ne "true") { throw "Container '$c' is not running. Start the stack with: docker compose up -d" }
}

Step "MongoDB"
docker exec mongodb sh -c 'mongodump --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db "${MONGO_INITDB_DATABASE:-openforge}" --archive=/tmp/openforge-mongo.gz --gzip'
if ($LASTEXITCODE) { throw "mongodump failed" }
docker cp mongodb:/tmp/openforge-mongo.gz (Join-Path $target "mongo.archive.gz") | Out-Null
docker exec mongodb rm -f /tmp/openforge-mongo.gz

Step "Uploads (schematic pages, step photos)"
docker exec openforge-backend tar czf /tmp/openforge-uploads.tgz -C /app uploads
if ($LASTEXITCODE) { throw "Archiving uploads failed" }
docker cp openforge-backend:/tmp/openforge-uploads.tgz (Join-Path $target "uploads.tgz") | Out-Null
docker exec openforge-backend rm -f /tmp/openforge-uploads.tgz

Step "data/manuals"
if (Test-Path data\manuals) {
    Compress-Archive -Path data\manuals -DestinationPath (Join-Path $target "manuals.zip") -Force
}

$health = $null
try { $health = Invoke-RestMethod http://localhost:8000/api/health -TimeoutSec 10 } catch {}
@{
    created = (Get-Date).ToString("o")
    git_commit = (git rev-parse --short HEAD 2>$null)
    model = $health.model
    embedding = $health.embedding
    files = (Get-ChildItem $target | ForEach-Object { @{ name = $_.Name; bytes = $_.Length } })
} | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $target "manifest.json") -Encoding utf8

$size = (Get-ChildItem $target | Measure-Object Length -Sum).Sum / 1MB
Write-Host ("Backup saved: {0} ({1:N1} MB)" -f $target, $size) -ForegroundColor Green

$old = Get-ChildItem $Destination -Directory -Filter "openforge-*" | Sort-Object Name -Descending | Select-Object -Skip $Keep
foreach ($dir in $old) {
    Remove-Item $dir.FullName -Recurse -Force
    Write-Host "  removed old backup $($dir.Name)"
}
