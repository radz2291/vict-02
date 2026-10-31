param([Parameter(Mandatory=$true)][ValidatePattern('^[0-9a-f]{40}$')][string]$ArtifactReviewCommit)
$ErrorActionPreference='Stop'
$repo='C:\Users\RZ1\.codex\worktrees\vict-architecture-realignment-20261030'
$stage='C:\Users\RZ1\AppData\Local\Temp\vict-limits-4fcaadcd-20261031-stage'
$build=Join-Path $repo 'apps/studio/build'
$newBuild=Join-Path $stage 'apps/studio/build'
$backup='C:\Users\RZ1\AppData\Local\Temp\vict-pre-limits-8d8-20261031-build'
$evidence=Join-Path $repo 'docs/studio/foundation-evidence/node-suite-stress-20261031'
if([IO.Path]::GetFullPath($build) -ne ($repo+'\apps\studio\build') -or [IO.Path]::GetFullPath($newBuild) -ne ($stage+'\apps\studio\build') -or [IO.Path]::GetFullPath($backup) -ne $backup -or (Test-Path -LiteralPath $backup)){throw 'Unexpected build or existing backup target'}
$review=(& git -C $repo rev-parse --verify ($ArtifactReviewCommit+'^{commit}')).Trim()
if($LASTEXITCODE -ne 0 -or $review -ne $ArtifactReviewCommit){throw 'Missing exact independent artifact review'}
$sealPath=Join-Path $evidence 'limits-production-seal.json'
$seal=Get-Content -LiteralPath $sealPath -Raw|ConvertFrom-Json
if($seal.sourceCandidate -ne '4fcaadcd91434448e12f2e8294da70f74103bb07' -or $seal.totalFiles -ne 392 -or $seal.activationPerformed -ne $false){throw 'Unexpected production seal'}
$reviewPath='docs/studio/foundation-evidence/node-suite-stress-20261031/independent-artifact-association.json'
$reviewText=@(& git -C $repo show ($ArtifactReviewCommit+':'+$reviewPath))
if($LASTEXITCODE -ne 0){throw 'Independent review commit does not contain its artifact attestation'}
$artifactReview=($reviewText -join "`n")|ConvertFrom-Json
if($artifactReview.status -ne 'PASS' -or $artifactReview.technicalActivationSupported -ne $true -or $artifactReview.actualUiVerified -ne $false -or $artifactReview.sourceCandidate -ne $seal.sourceCandidate -or $artifactReview.sealSha256 -ne (Get-FileHash -LiteralPath $sealPath -Algorithm SHA256).Hash.ToLowerInvariant() -or @($artifactReview.errors).Count -ne 0 -or $artifactReview.productionSourceDrift){throw 'Independent artifact attestation does not authorize this exact technical switch'}
$inputsPath=Join-Path $stage 'studio-build-inputs.json'
if((Get-FileHash -LiteralPath $inputsPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $seal.sourceInputsSha256){throw 'Staging input manifest changed'}
if($artifactReview.sourceInputsSha256 -ne $seal.sourceInputsSha256 -or $artifactReview.packageLockSha256 -ne $seal.packageLockSha256 -or (Get-FileHash -LiteralPath (Join-Path $repo 'package-lock.json') -Algorithm SHA256).Hash.ToLowerInvariant() -ne $seal.packageLockSha256){throw 'Independent dependency/input identity changed'}
if($artifactReview.schema -ne 'vict.node-suite-independent-artifact-review@1' -or !@($artifactReview.compiledWorkspaceFiles).Count){throw 'Missing independently compared compiled dependency inventory'}
foreach($entry in $artifactReview.compiledWorkspaceFiles){
 $compiled=[IO.Path]::GetFullPath((Join-Path $repo $entry.path))
 if(!$compiled.StartsWith($repo+'\packages\',[StringComparison]::OrdinalIgnoreCase) -or (Get-FileHash -LiteralPath $compiled -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256){throw 'Compiled workspace dependency bytes changed'}
}
$inputs=Get-Content -LiteralPath $inputsPath -Raw|ConvertFrom-Json
if(!$inputs.InputWorkingTreeClean -or !$inputs.WorkspaceWorkingTreeClean -or $inputs.SourceCommit -ne $seal.sourceCandidate){throw 'Dirty or mismatched staging inputs'}
foreach($entry in $inputs.Inputs){if((Get-FileHash -LiteralPath (Join-Path $stage $entry.Path) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.SHA256){throw 'Staged source input changed'}}
$changes=@(& git -C $repo diff --name-only $seal.sourceCandidate -- apps/studio/src apps/studio/scripts apps/studio/package.json apps/studio/svelte.config.js apps/studio/vite.config.ts packages package.json package-lock.json tsconfig.base.json)
if($LASTEXITCODE -ne 0 -or $changes.Count){throw 'Production source changed since independent review'}
$newEntries=@($seal.coreFiles)+@($seal.historicalProofFiles)+@($seal.addedPublicProofFiles)
if(@(Get-ChildItem -LiteralPath $newBuild -Recurse -File).Count -ne $newEntries.Count){throw 'Staged file count changed'}
foreach($entry in $newEntries){if((Get-FileHash -LiteralPath (Join-Path $newBuild $entry.path) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256){throw 'Staged output changed'}}
$oldEntries=@($seal.previousCoreFiles)+@($seal.historicalProofFiles)
if($oldEntries.Count -ne 389 -or @(Get-ChildItem -LiteralPath $build -File -Recurse).Count -ne 389){throw 'Serving file count changed'}
foreach($entry in $oldEntries){if((Get-FileHash -LiteralPath (Join-Path $build $entry.path) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256){throw 'Serving byte mismatch'}}
$listener=@(Get-NetTCPConnection -LocalPort 5626 -State Listen)
if($listener.Count -ne 1 -or $listener[0].LocalAddress -ne '127.0.0.25'){throw 'Unexpected Studio listener'}
$child=Get-CimInstance Win32_Process -Filter ('ProcessId='+$listener[0].OwningProcess)
$launcher=Get-CimInstance Win32_Process -Filter ('ProcessId='+$child.ParentProcessId)
$expectedLauncher=Join-Path $repo 'apps\studio\scripts\launch-agent.mjs'
if($child.CommandLine -ne '"C:\Program Files\nodejs\node.exe" build' -or !$launcher -or !$launcher.CommandLine.Contains('"'+$expectedLauncher+'"')){throw 'Studio process ownership not verified'}
Stop-Process -Id $child.ProcessId -ErrorAction Stop
if(Get-Process -Id $launcher.ProcessId -ErrorAction SilentlyContinue){Stop-Process -Id $launcher.ProcessId -ErrorAction Stop}
# Both absolute move targets were checked above; the complete prior build remains intact.
Move-Item -LiteralPath $build -Destination $backup
Copy-Item -LiteralPath $newBuild -Destination $build -Recurse
foreach($entry in $newEntries){if((Get-FileHash -LiteralPath (Join-Path $build $entry.path) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256){throw 'Activated output mismatch; old build is preserved'}}
$launch=& (Join-Path $repo 'apps/studio/scripts/start-local-existing-config.ps1')
[pscustomobject]@{schema='vict.node-suite-activation@1';sourceCandidate=$seal.sourceCandidate;observedUtc=[DateTime]::UtcNow.ToString('o');independentSourceReview=$seal.independentSourceReview;independentArtifactReview=$ArtifactReviewCommit;sealSha256=(Get-FileHash -LiteralPath $sealPath -Algorithm SHA256).Hash.ToLowerInvariant();backup=$backup;previousServingSource=$seal.previousServingSource;previousListenerPid=$child.ProcessId;previousLauncherPid=$launcher.ProcessId;coreFiles=$seal.coreFiles;historicalProofFiles=$seal.historicalProofFiles;addedPublicProofFiles=$seal.addedPublicProofFiles;totalFiles=$newEntries.Count;hashMismatches=@();launch=$launch;browserVerification='pending';campaignCheckpoint='r1.r2';lanListenerStarted=$false}|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $evidence 'limits-activation.json') -Encoding utf8
$launch
