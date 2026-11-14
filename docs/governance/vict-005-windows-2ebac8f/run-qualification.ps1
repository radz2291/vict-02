param(
  [Parameter(Mandatory)][string]$Worktree,
  [Parameter(Mandatory)][string]$Evidence,
  [Parameter(Mandatory)][string]$Toolchain
)
$ErrorActionPreference = 'Stop'
$node = Join-Path $Toolchain 'node.exe'
$npm = Join-Path $Toolchain 'node_modules/npm/bin/npm-cli.js'
$env:Path = "$Toolchain;$env:Path"
$packed = Join-Path $Evidence 'packed'
$consumer = Join-Path $packed 'consumer'
$proofPath = Join-Path $Worktree 'scripts/pack-agent-exchange-proof.mjs'
Push-Location $Worktree
try {
  & $node $proofPath $packed 2>&1 | Tee-Object -FilePath (Join-Path $Evidence 'packed-public-proof.log')
  $proofExit = $LASTEXITCODE
  $manifest = Get-Content -Raw -LiteralPath (Join-Path $packed 'manifest.json') | ConvertFrom-Json
  if ($manifest.candidate -ne '2ebac8f0e20c19c5731766d0021b0f33ff1ec249' -or $manifest.node -ne 'v22.13.1') {
    throw 'Unexpected candidate or Node in the archive manifest'
  }
  $archives = @(
    Get-ChildItem (Join-Path $packed 'archives') -Filter '*.tgz' | Sort-Object Name | ForEach-Object {
      $sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
      $sha512 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA512).Hash.ToLowerInvariant()
      $expected = @($manifest.files | Where-Object name -EQ $_.Name)
      if ($expected.Count -ne 1 -or $expected[0].sha512 -ne $sha512) {
        throw "Unexpected SHA-512 for $($_.Name)"
      }
      [ordered]@{ file = $_.Name; sha256 = $sha256; sha512 = $sha512; bytes = $_.Length }
    }
  )
  if ($archives.Count -ne 8) { throw 'Expected exactly eight archives' }
  $archives | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Evidence 'archives.json') -Encoding utf8NoBOM

  $probes = @('verify-installed-exports.mjs', 'historical-independent-probe.mjs', 'independent-probe.mjs')
  foreach ($probe in $probes) {
    Copy-Item -LiteralPath (Join-Path $Evidence $probe) -Destination $consumer
  }
  Push-Location $consumer
  try {
    & $node 'verify-installed-exports.mjs' 2>&1 | Tee-Object -FilePath (Join-Path $Evidence 'installed-exports.log')
    $exportsExit = $LASTEXITCODE
    & $node 'historical-independent-probe.mjs' 'settled-before-delivery-owner-loss' 2>&1 | Tee-Object -FilePath (Join-Path $Evidence 'historical-settled-loss.log')
    $historicalExit = $LASTEXITCODE
    & $node 'independent-probe.mjs' 2>&1 | Tee-Object -FilePath (Join-Path $Evidence 'independent-public-probe.log')
    $independentExit = $LASTEXITCODE
  } finally {
    Pop-Location
  }
  $npx = Join-Path $Toolchain 'node_modules/npm/bin/npx-cli.js'
  & $node $npx --offline vitest run packages/mastra/test packages/runtime/test packages/store-sqlite/test packages/control/test --maxWorkers=2 2>&1 |
    Tee-Object -FilePath (Join-Path $Evidence 'regressions.log')
  $regressionsExit = $LASTEXITCODE
  $finalStatus = git status --porcelain
  @(
    "Public packed proof $proofExit"
    "Installed exports $exportsExit"
    "Historical settled-loss probe $historicalExit"
    "Independent public probe $independentExit"
    "Regression suite $regressionsExit"
    "Final git status $($finalStatus -join ', ')"
  ) | Tee-Object -FilePath (Join-Path $Evidence 'exit-status.log')
  if ($proofExit -or $exportsExit -or $historicalExit -or $independentExit -or $regressionsExit -or $finalStatus) { exit 1 }
} finally {
  Pop-Location
}

