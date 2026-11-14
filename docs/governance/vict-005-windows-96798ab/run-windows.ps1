$ErrorActionPreference='Stop'
$record=$env:VICT_VERIFICATION_EVIDENCE
if (!$record) { throw 'Set VICT_VERIFICATION_EVIDENCE to a new evidence directory' }
function Invoke-Logged {
  param([string]$Log,[scriptblock]$Command)
  & $Command *> (Join-Path $record $Log)
  $exitCode=$LASTEXITCODE
  "$Log exit=$exitCode" | Add-Content (Join-Path $record 'results.log')
  Write-Output "$Log exit=$exitCode"
  return $exitCode
}
git rev-parse HEAD 'HEAD^{tree}' HEAD:package-lock.json 6b420a3e9eada6f694cc2550debda7753316b5b3:package-lock.json > "$record/pins.log"
node -p "JSON.stringify({platform:process.platform,arch:process.arch,release:require('node:os').release(),node:process.version})" >> "$record/pins.log"
npm.cmd --version >> "$record/pins.log"
Get-FileHash package-lock.json -Algorithm SHA256 | Format-List | Out-String | Add-Content "$record/pins.log"
$ErrorActionPreference='Continue'
$install=@(Invoke-Logged 'npm-ci.log' { npm.cmd ci })
if($install[-1]){exit $install[-1]}
foreach ($package in @('contracts','ui','sdk','kernel','runtime','store-sqlite','control','mastra')) {
  $build=@(Invoke-Logged "build-$package.log" { npm.cmd run build -w "@victframework/$package" })
  if($build[-1]){exit $build[-1]}
}
$packed=@(Invoke-Logged 'public-consumer.log' { node scripts/pack-agent-exchange-proof.mjs "$record/pack" })
if(Test-Path -LiteralPath "$record/pack/manifest.json") {
  Get-ChildItem -LiteralPath "$record/pack/archives" -Filter '*.tgz' -File |
    ForEach-Object {
      [pscustomobject]@{file=$_.Name;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant();sha512=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA512).Hash.ToLowerInvariant();bytes=$_.Length}
    } | ConvertTo-Json | Set-Content "$record/archives.json"
  Copy-Item -LiteralPath "$record/independent-probe.mjs" -Destination "$record/pack/consumer/independent-probe.mjs"
  Push-Location "$record/pack/consumer"
  try {
    $extra=@(Invoke-Logged 'independent-consumer.log' { node independent-probe.mjs })
  } finally {
    Pop-Location
  }
}
$regression=@(Invoke-Logged 'regressions.log' { npx.cmd --offline vitest run packages/mastra/test packages/runtime/test packages/store-sqlite/test packages/control/test })
git diff --exit-code
Get-Content "$record/results.log"
if($packed[-1] -or $extra[-1] -or $regression[-1]){exit 1}
