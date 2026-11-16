# Usage: powershell -ExecutionPolicy Bypass -File scripts\restore.ps1 -Backup <folder> [-Force] [-SkipManuals]

param(
    [Parameter(Mandatory = $true)][string]$Backup,
    [switch]$Force,
    [switch]$SkipManuals
)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
$Backup = (Resolve-Path $Backup).Path

foreach ($f in "mongo.archive.gz", "uploads.tgz") {
    if (-not (Test-Path (Join-Path $Backup $f))) { throw "$f not found in $Backup" }
}
if (-not $Force) {
    $answer = Read-Host "This replaces the current MongoDB data and uploads with $Backup. Type 'restore' to continue"
    if ($answer -ne "restore") { Write-Host "Cancelled."; exit 1 }
}

function Step($msg) { Write-Host "  $msg" -ForegroundColor Cyan }

Step "MongoDB"
docker cp (Join-Path $Backup "mongo.archive.gz") mongodb:/tmp/openforge-mongo.gz | Out-Null
docker exec mongodb sh -c 'mongorestore --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --drop --archive=/tmp/openforge-mongo.gz --gzip && rm -f /tmp/openforge-mongo.gz'
if ($LASTEXITCODE) { throw "mongorestore failed" }

Step "Uploads"
docker cp (Join-Path $Backup "uploads.tgz") openforge-backend:/tmp/openforge-uploads.tgz | Out-Null
docker exec -u 0 openforge-backend sh -c 'rm -rf /app/uploads/* && tar xzf /tmp/openforge-uploads.tgz -C /app && chown -R openforge /app/uploads && rm -f /tmp/openforge-uploads.tgz'
if ($LASTEXITCODE) { throw "Restoring uploads failed" }

$manuals = Join-Path $Backup "manuals.zip"
if ((Test-Path $manuals) -and -not $SkipManuals) {
    Step "data/manuals (existing files with the same name are overwritten)"
    Expand-Archive -Path $manuals -DestinationPath data -Force
}

Step "Restarting the backend and rebuilding the search index"
docker compose restart backend | Out-Null
for ($i = 0; $i -lt 30; $i++) {
    try { $null = Invoke-RestMethod http://localhost:8000/api/health -TimeoutSec 3; break } catch { Start-Sleep 2 }
}
docker compose exec -T backend python ingest.py --reset
Write-Host "Restore complete." -ForegroundColor Green
