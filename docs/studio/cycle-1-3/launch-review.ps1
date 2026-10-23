$ErrorActionPreference = 'Stop'
# Run only this checkout's already-built candidate. Never rebuild an owner server.
$reviewRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
Set-Location -LiteralPath $reviewRoot
if (Get-NetTCPConnection -State Listen -LocalPort 5594 -ErrorAction SilentlyContinue) {
  throw 'Port 5594 is already serving. Inspect its ownership; do not stop another preview.'
}
if (-not (Test-Path -LiteralPath 'apps/studio/build/index.js')) {
  throw 'Build this candidate first: npm run build; npm run build -w vict-studio.'
}
$env:HOST = '127.0.0.2'
$env:PORT = '5594'
$env:ORIGIN = 'http://127.0.0.2:5594'
$env:STUDIO_AGENT_MODEL = 'zai/glm-5.3-flash'
$env:STUDIO_AGENT_AUTH_FILE = Join-Path $env:USERPROFILE '.pi/agent/auth.json'
$env:STUDIO_AGENT_MODELS_FILE = Join-Path $env:USERPROFILE '.pi/agent/models.json'
node apps/studio/scripts/launch-agent.mjs
