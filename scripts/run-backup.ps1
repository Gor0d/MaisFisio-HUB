# Wrapper chamado pela Tarefa Agendada do Windows: carrega .env.local e roda
# o backup lógico do banco (scripts/backup-database.mjs). Gera log em
# backups/agendador.log para conferência posterior.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Get-Content ".env.local" | ForEach-Object {
  if ($_ -match "^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$") {
    [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
  }
}

$logDir = "backups"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir "agendador.log"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

try {
  $output = node scripts/backup-database.mjs 2>&1 | Out-String
  Add-Content -Path $logFile -Value "[$timestamp] OK`n$output`n"
} catch {
  Add-Content -Path $logFile -Value "[$timestamp] ERRO: $_`n"
}
