$ErrorActionPreference = 'Stop'
$drawerReviewRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
if (Get-NetTCPConnection -State Listen -LocalPort 5600 -ErrorAction SilentlyContinue) {
  throw 'Port 5600 is already serving. Inspect ownership; never stop an owner preview.'
}
git -C $drawerReviewRoot diff --quiet a36793df0f62c002332d66db181310554aaabb05 -- apps/studio packages
if ($LASTEXITCODE -ne 0) { throw 'Product source differs from the reviewed drawer candidate.' }
if (-not (Test-Path -LiteralPath (Join-Path $drawerReviewRoot 'apps/studio/build/index.js'))) {
  throw 'The production build is missing. Build the isolated drawer candidate first.'
}
$env:HOST = '127.0.0.6'
$env:PORT = '5600'
$env:ORIGIN = 'http://127.0.0.6:5600'
$env:STUDIO_AGENT_MODEL = 'zai/glm-5.3-flash'
$env:STUDIO_AGENT_AUTH_FILE = Join-Path $env:USERPROFILE '.pi/agent/auth.json'
$env:STUDIO_AGENT_MODELS_FILE = Join-Path $env:USERPROFILE '.pi/agent/models.json'
# Existing launcher reads the key only on the server; never print its contents.
node (Join-Path $drawerReviewRoot 'apps/studio/scripts/launch-agent.mjs')
