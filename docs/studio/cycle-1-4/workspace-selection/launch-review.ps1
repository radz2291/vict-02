param([string]$ListenHost='127.0.0.22',[int]$ListenPort=5616)
$ErrorActionPreference='Stop'
if($ListenHost -notin @('127.0.0.22') -or $ListenPort -notin @(5616)){throw 'Use only the isolated workspace-selection review origin.'}
$dockReviewRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
Set-Location -LiteralPath $dockReviewRoot
if(Get-NetTCPConnection -State Listen -LocalPort $ListenPort -ErrorAction SilentlyContinue){throw 'Review port occupied. Inspect ownership; preserve running previews.'}
node docs/studio/cycle-1-4/workspace-selection/seal-production.mjs --verify
if($LASTEXITCODE -ne 0){throw 'Build seal verification failed.'}
$env:HOST=$ListenHost
$env:PORT=[string]$ListenPort
$env:ORIGIN="http://${ListenHost}:$ListenPort"
$env:STUDIO_AGENT_MODEL='zai/glm-5.3-flash'
$env:STUDIO_AGENT_AUTH_FILE=Join-Path $env:USERPROFILE '.pi/agent/auth.json'
$env:STUDIO_AGENT_MODELS_FILE=Join-Path $env:USERPROFILE '.pi/agent/models.json'
node apps/studio/scripts/launch-agent.mjs
