param([ValidateSet('127.0.0.9','127.0.0.10')][string]$ListenHost='127.0.0.9',[ValidateSet(5603,5604)][int]$ListenPort=5603)
$ErrorActionPreference='Stop'
$coreReviewRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
Set-Location -LiteralPath $coreReviewRoot
if(Get-NetTCPConnection -State Listen -LocalPort $ListenPort -ErrorAction SilentlyContinue){throw "Port $ListenPort is already serving. Inspect ownership; preserve existing previews."}
node docs/studio/cycle-1-3/core/seal-production.mjs --verify
if($LASTEXITCODE -ne 0){throw 'Build seal verification failed.'}
$env:HOST=$ListenHost
$env:PORT=[string]$ListenPort
$env:ORIGIN="http://${ListenHost}:$ListenPort"
$env:STUDIO_AGENT_MODEL='zai/glm-5.3-flash'
$env:STUDIO_AGENT_AUTH_FILE=Join-Path $env:USERPROFILE '.pi/agent/auth.json'
$env:STUDIO_AGENT_MODELS_FILE=Join-Path $env:USERPROFILE '.pi/agent/models.json'
node apps/studio/scripts/launch-agent.mjs
