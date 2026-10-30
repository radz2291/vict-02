$ErrorActionPreference='Stop'
$repo='C:\Users\RZ1\.codex\worktrees\vict-architecture-realignment-20261030'
$stage='C:\Users\RZ1\AppData\Local\Temp\vict-routing-8d8be402-20261030-stage'
$build=Join-Path $repo 'apps/studio/build'
$newBuild=Join-Path $stage 'apps/studio/build'
$backup='C:\Users\RZ1\AppData\Local\Temp\vict-pre-routing-ab329-20261030-build'
$evidence=Join-Path $repo 'docs/studio/foundation-evidence/architecture-realignment-20261030'
if([IO.Path]::GetFullPath($build) -ne ($repo+'\apps\studio\build') -or [IO.Path]::GetFullPath($backup) -ne $backup -or (Test-Path -LiteralPath $backup)){throw 'Unexpected build/backup target'}
$inputs=Get-Content -LiteralPath (Join-Path $stage 'studio-build-inputs.json') -Raw|ConvertFrom-Json
if($inputs.SourceCommit -ne '8d8be402893a8942b985ad920b32b31807e2ad47' -or !$inputs.InputWorkingTreeClean -or !$inputs.WorkspaceWorkingTreeClean){throw 'Wrong staged source'}
foreach($entry in $inputs.Inputs){if((Get-FileHash -LiteralPath (Join-Path $stage $entry.Path) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.SHA256){throw 'Staged input mismatch'}}
$changes=@(& git -C $repo diff --name-only $inputs.SourceCommit HEAD -- apps/studio/src 'packages/*/src' package.json package-lock.json tsconfig.base.json)
if($LASTEXITCODE -ne 0 -or $changes.Count){throw 'Production source changed since reviewed build'}
function Inventory($root){@(Get-ChildItem -LiteralPath $root -File -Recurse|ForEach-Object{[pscustomobject]@{path=$_.FullName.Substring($root.Length+1).Replace('\','/');sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}})}
$old=Get-Content -LiteralPath (Join-Path $evidence 'HISTORY-REDO-ACTIVATION.json') -Raw|ConvertFrom-Json
$oldProof=@($old.historicalProofFiles)+@($old.addedPublicProofFiles)
$expectedOld=@($old.coreFiles)+@($oldProof)
if($old.sourceCandidate -ne 'ab3296e6503a63b2587ed36a1e1a121179082396' -or @(Inventory $build).Count -ne $expectedOld.Count -or $oldProof.Count -ne 81){throw 'Serving inventory changed'}
foreach($entry in $expectedOld){if((Get-FileHash -LiteralPath (Join-Path $build $entry.path) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256){throw 'Serving output hash mismatch'}}
$newCore=Inventory $newBuild
if($newCore.Count -lt 300){throw 'Incomplete new build'}
function AddProof($root,$prefix,$entries){
 foreach($entry in $entries){
  $source=[IO.Path]::GetFullPath((Join-Path $root $entry.path))
  $relative='client/'+$prefix+'/'+$entry.path
  $target=[IO.Path]::GetFullPath((Join-Path $newBuild $relative))
  if(!$source.StartsWith([IO.Path]::GetFullPath($root)+'\',[StringComparison]::OrdinalIgnoreCase) -or !$target.StartsWith([IO.Path]::GetFullPath($newBuild)+'\',[StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $target)){throw 'Unexpected proof target'}
  if((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256){throw 'Proof output mismatch'}
  New-Item -ItemType Directory -Path (Split-Path $target) -Force|Out-Null
  Copy-Item -LiteralPath $source -Destination $target
  [pscustomobject]@{path=$relative;sha256=$entry.sha256}
 }
}
foreach($entry in $oldProof){
 $target=Join-Path $newBuild $entry.path
 if(Test-Path -LiteralPath $target){throw 'Historical proof conflicts with core'}
 New-Item -ItemType Directory -Path (Split-Path $target) -Force|Out-Null
 Copy-Item -LiteralPath (Join-Path $build $entry.path) -Destination $target
}
$consumerRoot='C:\Users\RZ1\AppData\Local\Temp\vict-realignment-consumer-bYGiad\consumer\dist'
$consumer=Get-Content -LiteralPath (Join-Path $evidence 'vict-realignment-consumer-bYGiad.json') -Raw|ConvertFrom-Json
if(!$consumer.status.StartsWith('PASS:') -or $consumer.sourceCandidate -ne $inputs.SourceCommit){throw 'Wrong public consumer'}
foreach($entry in $consumer.outputFiles){if((Get-FileHash -LiteralPath (Join-Path (Join-Path $consumerRoot 'assets') $entry.name) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256){throw 'Consumer output differs from reviewed report'}}
$newProof=@(AddProof $consumerRoot 'foundation-routing-bYGiad' (Inventory $consumerRoot))
$listener=@(Get-NetTCPConnection -LocalPort 5626 -State Listen)
if($listener.Count -ne 1 -or $listener[0].LocalAddress -ne '127.0.0.25'){throw 'Unexpected listener'}
$child=Get-CimInstance Win32_Process -Filter ('ProcessId='+$listener[0].OwningProcess)
$launcher=Get-CimInstance Win32_Process -Filter ('ProcessId='+$child.ParentProcessId)
$expectedLauncher=Join-Path $repo 'apps\studio\scripts\launch-agent.mjs'
if($child.CommandLine -ne '"C:\Program Files\nodejs\node.exe" build' -or !$launcher.CommandLine.Contains('"'+$expectedLauncher+'"')){throw 'Unverified process ownership'}
Stop-Process -Id $child.ProcessId -ErrorAction Stop
if(Get-Process -Id $launcher.ProcessId -ErrorAction SilentlyContinue){Stop-Process -Id $launcher.ProcessId -ErrorAction Stop}
Move-Item -LiteralPath $build -Destination $backup
Copy-Item -LiteralPath $newBuild -Destination $build -Recurse
foreach($entry in @($newCore)+@($oldProof)+@($newProof)){if((Get-FileHash -LiteralPath (Join-Path $build $entry.path) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256){throw 'Activated hash mismatch; old build preserved'}}
$launch=& (Join-Path $repo 'apps/studio/scripts/start-local-existing-config.ps1')
[pscustomobject]@{sourceCandidate=$inputs.SourceCommit;independentReview='b81e8cda6ff28b90ca17ff8817670aa1f59d668e';independentArtifactReview='nested-route-guidance-bYGiad-independent-audit.json';observedUtc=[DateTime]::UtcNow.ToString('o');backup=$backup;coreFiles=$newCore;historicalProofFiles=$oldProof;addedPublicProofFiles=$newProof;launch=$launch;hashMismatches=@();browserVerification='pending';lanListenerStarted=$false}|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $evidence 'NESTED-ROUTE-GUIDANCE-ACTIVATION.json') -Encoding utf8
$launch


