#Requires -Version 7.0
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$StageRoot,
  [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..\..')).Path
if (-not [IO.Path]::IsPathFullyQualified($StageRoot)) { throw 'StageRoot must be an absolute path.' }
$stagePath = [IO.Path]::GetFullPath($StageRoot).TrimEnd('\', '/')
if ($stagePath -eq $repoRoot -or $stagePath.StartsWith($repoRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Use a fresh staging directory outside the checkout.'
}
if (Test-Path -LiteralPath $stagePath) { throw 'Refusing to overwrite an existing staging directory.' }

# These source imports live outside apps/studio and are required build inputs.
# Check them before copying anything or invoking the compiler.
$requiredInputs = @('docs/studio/CYCLE-1-4-CATALOG-MIGRATION.json')
foreach ($relativePath in $requiredInputs) {
  $inputPath = Join-Path $repoRoot $relativePath
  if (-not (Test-Path -LiteralPath $inputPath -PathType Leaf)) { throw "Missing required Studio build input: $relativePath" }
  $null = Get-Content -LiteralPath $inputPath -Raw | ConvertFrom-Json
}
$dependencyPaths = @('node_modules', 'apps/studio/node_modules')
foreach ($relativePath in $dependencyPaths) {
  if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $relativePath) -PathType Container)) {
    throw "Missing installed dependencies: $relativePath. This helper does not install dependencies."
  }
}
$studioFiles = @(& git -C $repoRoot ls-files -- apps/studio)
if ($LASTEXITCODE -ne 0 -or -not $studioFiles.Count) { throw 'Cannot enumerate tracked Studio inputs.' }
$sourceCommit = (& git -C $repoRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Cannot identify the source checkout.' }
$inputStatus = @(& git -C $repoRoot status --porcelain -- apps/studio @requiredInputs)
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect the source input working tree.' }
$inputsClean = $inputStatus.Count -eq 0
$workspaceStatus = @(& git -C $repoRoot status --porcelain -- apps/studio packages package.json package-lock.json @requiredInputs)
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect linked workspace sources.' }
$workspaceClean = $workspaceStatus.Count -eq 0
$copyPaths = @($studioFiles) + $requiredInputs
foreach ($relativePath in $copyPaths) {
  if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $relativePath) -PathType Leaf)) { throw "Missing tracked Studio input: $relativePath" }
  $destination = [IO.Path]::GetFullPath((Join-Path $stagePath $relativePath))
  if (-not $destination.StartsWith($stagePath + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Input path escaped the staging directory.' }
}
if ($ValidateOnly) {
  [pscustomobject]@{ Valid = $true; SourceCommit = $sourceCommit; InputWorkingTreeClean = $inputsClean; WorkspaceWorkingTreeClean = $workspaceClean; StudioFiles = $studioFiles.Count; RequiredInputs = $requiredInputs; StageRoot = $stagePath }
  return
}

New-Item -ItemType Directory -Path $stagePath | Out-Null
$copiedInputs = foreach ($relativePath in $copyPaths) {
  $source = Join-Path $repoRoot $relativePath
  $destination = Join-Path $stagePath $relativePath
  New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $destination
  $sourceHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
  if ((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash -ne $sourceHash) { throw "Staged input hash mismatch: $relativePath" }
  [pscustomobject]@{ Path = $relativePath; SHA256 = $sourceHash.ToLowerInvariant() }
}
Set-Content -LiteralPath (Join-Path $stagePath 'package.json') -Value '{"private":true,"type":"module"}'
$dependencyLinks = foreach ($relativePath in $dependencyPaths) {
  New-Item -ItemType Junction -Path (Join-Path $stagePath $relativePath) -Target (Join-Path $repoRoot $relativePath) | Out-Null
  [pscustomobject]@{ Path = $relativePath; Target = (Join-Path $repoRoot $relativePath) }
}
[pscustomobject]@{ SourceCommit = $sourceCommit; InputWorkingTreeClean = $inputsClean; WorkspaceWorkingTreeClean = $workspaceClean; Repository = $repoRoot; Inputs = @($copiedInputs); RequiredInputs = $requiredInputs; DependencyLinks = @($dependencyLinks) } |
  ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $stagePath 'studio-build-inputs.json')
[pscustomobject]@{ SourceCommit = $sourceCommit; StageRoot = $stagePath; AppPath = (Join-Path $stagePath 'apps/studio'); CopiedInputs = @($copiedInputs).Count }
