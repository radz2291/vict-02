param(
  [Parameter(Mandatory)][string]$ReferenceCheckout,
  [Parameter(Mandatory)][string]$FreshWorktree,
  [Parameter(Mandatory)][string]$Evidence,
  [Parameter(Mandatory)][string]$Toolchain
)
$ErrorActionPreference = 'Stop'
$commit = '2ebac8f0e20c19c5731766d0021b0f33ff1ec249'
$node = Join-Path $Toolchain 'node.exe'
$npm = Join-Path $Toolchain 'node_modules/npm/bin/npm-cli.js'
New-Item -ItemType Directory -Force -Path $Evidence | Out-Null
& git -C $ReferenceCheckout worktree add --detach $FreshWorktree $commit 2>&1 |
  Tee-Object -FilePath (Join-Path $Evidence 'checkout.log')
if ($LASTEXITCODE) { throw 'Detached checkout failed' }

Push-Location $FreshWorktree
try {
  $actual = & git rev-parse HEAD 'HEAD^{tree}' HEAD:package-lock.json
  $expected = @(
    $commit
    '28394bf0a32ca81e37dc15103e767b75859c61ae'
    '66c10fa33529f34eff4008f3c3be2193a067f020'
  )
  if (Compare-Object $actual $expected -SyncWindow 0) { throw 'Candidate pins differ' }
  if ((git status --porcelain) -or (Test-Path node_modules)) { throw 'Worktree is not fresh' }
  $origin = git remote get-url origin
  $remote = git ls-remote origin refs/heads/codex/vict-governed-agent-exchange
  $nodeVersion = & $node --version
  $npmVersion = & $node $npm --version
  if ($nodeVersion -ne 'v22.13.1' -or $npmVersion -ne '11.19.1') { throw 'Unexpected runtime pins' }
  @(
    "Head $($actual[0])"
    "Tree $($actual[1])"
    "Lock $($actual[2])"
    "Origin $origin"
    "Remote $remote"
    "Node $nodeVersion"
    "npm $npmVersion"
    "Windows $([Environment]::OSVersion.VersionString)"
    "Architecture $([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture)"
    "PowerShell $($PSVersionTable.PSVersion)"
    "Git $(git --version)"
    'Initial git status clean with no node_modules'
  ) | Tee-Object -FilePath (Join-Path $Evidence 'pins.log')
  $env:Path = "$Toolchain;$env:Path"
  & $node $npm ci --prefer-offline 2>&1 | Tee-Object -FilePath (Join-Path $Evidence 'npm-ci.log')
  if ($LASTEXITCODE) { throw 'Frozen install failed' }
  & $node $npm ls @mastra/core -w @victframework/mastra 2>&1 |
    Tee-Object -FilePath (Join-Path $Evidence 'mastra-version.log')
  if ($LASTEXITCODE) { throw 'Mastra dependency check failed' }
  foreach ($pkg in @('contracts','ui','sdk','kernel','runtime','store-sqlite','control','mastra')) {
    & $node $npm run build -w "@victframework/$pkg" 2>&1 |
      Tee-Object -FilePath (Join-Path $Evidence "build-$pkg.log")
    if ($LASTEXITCODE) { throw "Build failed for $pkg" }
  }
} finally {
  Pop-Location
}
