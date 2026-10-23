$ErrorActionPreference = 'Stop'
$completionRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
Set-Location -LiteralPath $completionRoot
if (Get-NetTCPConnection -State Listen -LocalPort 5596 -ErrorAction SilentlyContinue) {
  throw 'Port 5596 is already serving. Inspect ownership; do not stop another preview.'
}
if (-not (Test-Path -LiteralPath 'apps/studio/build/index.js')) {
  throw 'Build this checkout first: npm run build; npm run build -w vict-studio.'
}
$env:HOST = '127.0.0.3'
$env:PORT = '5596'
$env:ORIGIN = 'http://127.0.0.3:5596'
$env:STUDIO_AGENT_MODEL = 'zai/glm-5.3-flash'
$env:STUDIO_AGENT_AUTH_FILE = Join-Path $env:USERPROFILE '.pi/agent/auth.json'
$env:STUDIO_AGENT_MODELS_FILE = Join-Path $env:USERPROFILE '.pi/agent/models.json'
node apps/studio/scripts/launch-agent.mjs
