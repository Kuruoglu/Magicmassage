$ErrorActionPreference = "Stop"

$port = if ($env:PORT) { $env:PORT } else { "3001" }
$installDir = Join-Path $env:LOCALAPPDATA "MagicMassageNatali"
$cloudflared = Join-Path $installDir "cloudflared.exe"
$downloadUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"

if (-not (Test-Path -LiteralPath $cloudflared)) {
  New-Item -ItemType Directory -Force -Path $installDir | Out-Null
  Write-Host "Downloading cloudflared..."
  Invoke-WebRequest -Uri $downloadUrl -OutFile $cloudflared -UseBasicParsing
}

Write-Host "Starting Cloudflare Quick Tunnel for http://localhost:$port"
Write-Host "Keep this terminal open while sharing the site."
& $cloudflared tunnel --url "http://localhost:$port"
