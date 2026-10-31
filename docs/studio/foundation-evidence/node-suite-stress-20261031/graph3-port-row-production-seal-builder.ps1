param([Parameter(Mandatory=$true)][ValidatePattern('^[0-9a-f]{40}$')][string]$SourceReviewCommit)
$ErrorActionPreference='Stop'
$repo='C:\Users\RZ1\.codex\worktrees\vict-architecture-realignment-20261030'
$stage='C:\Users\RZ1\AppData\Local\Temp\vict-graph3-ports-fae2e9e0-stage'
$source='fae2e9e053fe34d3c7d4bf618488538e800318ac'
$oldBuild=Join-Path $repo 'apps/studio/build'
$newBuild=Join-Path $stage 'apps/studio/build'
$evidence=Join-Path $repo 'docs/studio/foundation-evidence/node-suite-stress-20261031'
$inputsPath=Join-Path $stage 'studio-build-inputs.json'
$inputs=Get-Content -LiteralPath $inputsPath -Raw|ConvertFrom-Json
if($inputs.SourceCommit -ne $source -or !$inputs.InputWorkingTreeClean -or !$inputs.WorkspaceWorkingTreeClean){throw 'Wrong or dirty staged source'}
foreach($entry in $inputs.Inputs){if((Get-FileHash -LiteralPath (Join-Path $stage $entry.Path) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.SHA256){throw 'Staged source input mismatch'}}
$changes=@(& git -C $repo diff --name-only $source -- apps/studio/src apps/studio/scripts apps/studio/package.json apps/studio/svelte.config.js apps/studio/vite.config.ts packages package.json package-lock.json tsconfig.base.json)
if($LASTEXITCODE -ne 0 -or $changes.Count){throw 'Production source moved after staging'}
function Inventory($root){@(Get-ChildItem -LiteralPath $root -File -Recurse|ForEach-Object{[pscustomobject]@{path=$_.FullName.Substring($root.Length+1).Replace('\','/');sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}})}
$old=Get-Content -LiteralPath (Join-Path $repo 'docs/studio/foundation-evidence/node-suite-stress-20261031/limits-activation.json') -Raw|ConvertFrom-Json
$oldProof=@($old.historicalProofFiles)+@($old.addedPublicProofFiles)
$oldEntries=@($old.coreFiles)+$oldProof
if($old.sourceCandidate -ne '4fcaadcd91434448e12f2e8294da70f74103bb07' -or $oldEntries.Count -ne 392 -or $oldProof.Count -ne 87 -or @(Inventory $oldBuild).Count -ne 392){throw 'Serving inventory changed'}
foreach($entry in $oldEntries){if((Get-FileHash -LiteralPath (Join-Path $oldBuild $entry.path) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256){throw 'Serving byte mismatch'}}
foreach($required in @('index.js','handler.js','client/_app/version.json')){if(!(Test-Path -LiteralPath (Join-Path $newBuild $required) -PathType Leaf)){throw 'Incomplete staged production build'}}
$core=Inventory $newBuild
function CopyProof($fromRoot,$relative,$targetRelative,$expectedHash){
 $from=[IO.Path]::GetFullPath((Join-Path $fromRoot $relative))
 $target=[IO.Path]::GetFullPath((Join-Path $newBuild $targetRelative))
 if(!$from.StartsWith([IO.Path]::GetFullPath($fromRoot)+'\',[StringComparison]::OrdinalIgnoreCase) -or !$target.StartsWith([IO.Path]::GetFullPath($newBuild)+'\',[StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $target)){throw 'Proof path conflict or escape'}
 if((Get-FileHash -LiteralPath $from -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedHash){throw 'Proof input hash mismatch'}
 New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force|Out-Null
 Copy-Item -LiteralPath $from -Destination $target
 if((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedHash){throw 'Copied proof mismatch'}
 [pscustomobject]@{path=$targetRelative;sha256=$expectedHash}
}
foreach($entry in $oldProof){$null=CopyProof $oldBuild $entry.path $entry.path $entry.sha256}
$consumerPath=Join-Path $repo 'docs/studio/foundation-evidence/architecture-realignment-20261030/vict-realignment-consumer-qSyhak.json'
$consumer=Get-Content -LiteralPath $consumerPath -Raw|ConvertFrom-Json
if(!$consumer.status.StartsWith('PASS:') -or !$consumer.domTest.passed -or $consumer.sourceCandidate -ne $source){throw 'Wrong installed consumer proof'}
$consumerDist=Join-Path $consumer.consumer 'dist'
foreach($entry in $consumer.outputFiles){if((Get-FileHash -LiteralPath (Join-Path (Join-Path $consumerDist 'assets') $entry.name) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256){throw 'Consumer asset mismatch'}}
$newProof=@(foreach($entry in (Inventory $consumerDist)){CopyProof $consumerDist $entry.path ('client/foundation-graph3-port-row-qSyhak/'+$entry.path) $entry.sha256})
$full=Inventory $newBuild
if($full.Count -ne ($core.Count+$oldProof.Count+$newProof.Count)){throw 'Unexpected staged file count'}
$seal=[pscustomobject]@{schema='vict.node-suite-production-seal@1';sourceCandidate=$source;stageRoot=$stage;buildRoot=$newBuild;observedUtc=[DateTime]::UtcNow.ToString('o');sourceInputsSha256=(Get-FileHash -LiteralPath $inputsPath -Algorithm SHA256).Hash.ToLowerInvariant();packageLockSha256=(Get-FileHash -LiteralPath (Join-Path $repo 'package-lock.json') -Algorithm SHA256).Hash.ToLowerInvariant();independentSourceReview=$SourceReviewCommit;consumerReportSha256=(Get-FileHash -LiteralPath $consumerPath -Algorithm SHA256).Hash.ToLowerInvariant();previousServingSource=$old.sourceCandidate;previousCoreFiles=@($old.coreFiles);coreFiles=$core;historicalProofFiles=$oldProof;addedPublicProofFiles=$newProof;totalFiles=$full.Count;hashMismatches=@();activationPerformed=$false;actualUiVerification='pending'}
$seal|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $evidence 'graph3-port-row-production-seal.json') -Encoding utf8
[pscustomobject]@{sourceCandidate=$source;coreFiles=$core.Count;historicalProofFiles=$oldProof.Count;addedPublicProofFiles=$newProof.Count;totalFiles=$full.Count;activationPerformed=$false}

