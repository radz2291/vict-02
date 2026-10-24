param(
  [string]$PreviewRoot = (Join-Path $env:USERPROFILE '.codex/worktrees/studio-structure-preview/260831-VCT-02')
)
$ErrorActionPreference = 'Stop'
$structurePreviewRoot = [IO.Path]::GetFullPath($PreviewRoot)
if (Get-NetTCPConnection -State Listen -LocalPort 5599 -ErrorAction SilentlyContinue) {
  throw 'Port 5599 is already serving. Inspect ownership; do not stop another preview.'
}
if ((git -C $structurePreviewRoot rev-parse HEAD) -ne 'dabbe9027e335bab1a405f4a808711d93623b3c5') {
  throw 'Preview checkout differs from the independently reviewed Structure product.'
}
if (-not (Test-Path -LiteralPath (Join-Path $structurePreviewRoot 'apps/studio/build/index.js'))) {
  throw 'The sealed Structure production build is missing; do not rebuild an owner checkout.'
}
$env:HOST = '127.0.0.5'
$env:PORT = '5599'
$env:ORIGIN = 'http://127.0.0.5:5599'
$env:STUDIO_AGENT_MODEL = 'zai/glm-5.3-flash'
$env:STUDIO_AGENT_AUTH_FILE = Join-Path $env:USERPROFILE '.pi/agent/auth.json'
$env:STUDIO_AGENT_MODELS_FILE = Join-Path $env:USERPROFILE '.pi/agent/models.json'
# Existing launcher reads credentials only server-side; never print their contents.
node (Join-Path $structurePreviewRoot 'apps/studio/scripts/launch-agent.mjs')
