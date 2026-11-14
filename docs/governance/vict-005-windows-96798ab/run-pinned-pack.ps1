$ErrorActionPreference='Continue'
$record=$env:VICT_VERIFICATION_EVIDENCE
$node=$env:VICT_PINNED_NODE
& $node --version
& $node (Join-Path (Split-Path $node) 'node_modules/npm/bin/npm-cli.js') --version
& $node scripts/pack-agent-exchange-proof.mjs "$record/pack-pinned" *> "$record/public-consumer-pinned.log"
$public=$LASTEXITCODE
"public-consumer-pinned.log exit=$public" | Add-Content "$record/results.log"
if(!(Test-Path -LiteralPath "$record/pack-pinned/manifest.json")) {exit 1}
Get-ChildItem -LiteralPath "$record/pack-pinned/archives" -Filter '*.tgz' -File | ForEach-Object {
  [pscustomobject]@{file=$_.Name;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant();sha512=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA512).Hash.ToLowerInvariant();bytes=$_.Length}
} | ConvertTo-Json | Set-Content "$record/archives-pinned.json"
$consumer="$record/pack-pinned/consumer"
Copy-Item -LiteralPath "$record/independent-probe.mjs" -Destination "$consumer/independent-probe.mjs"
Push-Location $consumer
try{
  & $node ./independent-probe.mjs *> "$record/independent-consumer-pinned.log"
  $probe=$LASTEXITCODE
} finally {Pop-Location}
"independent-consumer-pinned.log exit=$probe" | Add-Content "$record/results.log"
git status --short
Get-Content "$record/results.log"
if($public -or $probe){exit 1}
