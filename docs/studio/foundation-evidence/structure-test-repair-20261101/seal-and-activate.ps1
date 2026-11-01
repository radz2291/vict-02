param([Parameter(Mandatory=$true)][string]$StageRoot,[switch]$Activate)
$ErrorActionPreference='Stop'
$repo='C:\Users\RZ1\.codex\worktrees\vict-architecture-realignment-20261030'
$source='a629b40818ba367daf79850c80d9abb7fe02df1c'
$evidence=Join-Path $repo 'docs/studio/foundation-evidence/structure-test-repair-20261101'
$stage=[IO.Path]::GetFullPath($StageRoot).TrimEnd('\')
$expectedStage='C:\Users\RZ1\AppData\Local\Temp\vict-structure-tests-a629b408-stage'
if($stage -ne $expectedStage){throw 'Unexpected stage target'}
$build=Join-Path $repo 'apps/studio/build'
$newBuild=Join-Path $stage 'apps/studio/build'
$backup='C:\Users\RZ1\AppData\Local\Temp\vict-pre-structure-tests-20e26253-20261101-build'
if([IO.Path]::GetFullPath($build) -ne ($repo+'\apps\studio\build') -or [IO.Path]::GetFullPath($newBuild) -ne ($stage+'\apps\studio\build') -or (Test-Path -LiteralPath $backup)){throw 'Unexpected build or existing backup target'}
$paths=@('apps/studio/src','apps/studio/scripts','apps/studio/package.json','apps/studio/vite.config.ts','apps/studio/svelte.config.js','packages','package.json','package-lock.json','tsconfig.base.json')
if(@(& git -C $repo diff --name-only $source -- @paths).Count -or @(& git -C $repo ls-files --others --exclude-standard -- @paths).Count){throw 'Product source drift after freeze'}
$inputs=Get-Content -LiteralPath (Join-Path $stage 'studio-build-inputs.json') -Raw|ConvertFrom-Json
if($inputs.SourceCommit -ne $source -or !$inputs.InputWorkingTreeClean -or !$inputs.WorkspaceWorkingTreeClean){throw 'Wrong or dirty staged source'}
foreach($entry in $inputs.Inputs){if((Get-FileHash -LiteralPath (Join-Path $stage $entry.Path) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.SHA256){throw 'Staged source mismatch'}}
function Inventory($root){@(Get-ChildItem -LiteralPath $root -File -Recurse|ForEach-Object{[pscustomobject]@{path=$_.FullName.Substring($root.Length+1).Replace('\','/');sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}})}
$previous=Get-Content -LiteralPath (Join-Path $evidence 'production-seal-before-test-repair.json') -Raw|ConvertFrom-Json
$oldEntries=@($previous.files)
if($previous.sourceCandidate -ne '20e26253f0ec6aab20f480c1b3e537e2282938d8' -or (Inventory $build).Count -ne $oldEntries.Count){throw 'Previous build identity changed'}
foreach($entry in $oldEntries){if((Get-FileHash -LiteralPath (Join-Path $build $entry.path) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256){throw 'Previous build hash mismatch'}}
$sealPath=Join-Path $evidence 'production-seal.json'
if(!$Activate){
 $consumerPath=Join-Path $evidence 'vict-structure-consumer-PTVWq5.json'
 $consumer=Get-Content -LiteralPath $consumerPath -Raw|ConvertFrom-Json
 if($consumer.status -ne 'PASS' -or $consumer.sourceCandidate -ne $source -or !$consumer.domTest.passed){throw 'Missing final installed public-consumer proof'}
 $compiled=@(foreach($pack in $consumer.packs){foreach($file in $pack.files){if($file.path.StartsWith('dist/')){
  $relative='packages/'+$pack.name.Replace('@victframework/','')+'/'+$file.path
  if((Get-FileHash -LiteralPath (Join-Path $repo $relative) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $file.sha256){throw 'Compiled package differs from installed artifact proof'}
  [pscustomobject]@{path=$relative;sha256=$file.sha256}
 }}})
 if(!$compiled.Count){throw 'Missing compiled workspace inventory'}
 foreach($required in @('index.js','handler.js','client/_app/version.json')){if(!(Test-Path -LiteralPath (Join-Path $newBuild $required) -PathType Leaf)){throw 'Incomplete production build'}}
 $core=Inventory $newBuild
 $proof=@($previous.historicalProofFiles)
 foreach($entry in $proof){
  $target=[IO.Path]::GetFullPath((Join-Path $newBuild $entry.path))
  if(!$target.StartsWith($newBuild+'\',[StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $target)){throw 'Proof conflict or path escape'}
  New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force|Out-Null
  Copy-Item -LiteralPath (Join-Path $build $entry.path) -Destination $target
 }
 $entries=Inventory $newBuild
 [ordered]@{schema='vict.structure-shared-production-seal@1';sourceCandidate=$source;stageRoot=$stage;previousServingSource=$previous.sourceCandidate;coreFiles=$core;historicalProofFiles=$proof;files=$entries;totalFiles=$entries.Count;compiledWorkspaceFiles=$compiled;consumerReportPath=$consumerPath;consumerReportSha256=(Get-FileHash -LiteralPath $consumerPath -Algorithm SHA256).Hash.ToLowerInvariant();sourceInputsSha256=(Get-FileHash -LiteralPath (Join-Path $stage 'studio-build-inputs.json') -Algorithm SHA256).Hash.ToLowerInvariant();packageLockSha256=(Get-FileHash -LiteralPath (Join-Path $repo 'package-lock.json') -Algorithm SHA256).Hash.ToLowerInvariant();activationPerformed=$false}|ConvertTo-Json -Depth 8|Set-Content -LiteralPath $sealPath -Encoding utf8
 [pscustomobject]@{sealed=$true;core=$core.Count;retainedProof=$proof.Count;total=$entries.Count;activated=$false}
 return
}
$seal=Get-Content -LiteralPath $sealPath -Raw|ConvertFrom-Json
$review=Get-Content -LiteralPath (Join-Path $evidence 'technical-review.json') -Raw|ConvertFrom-Json
if($review.status -ne 'PASS' -or $review.sourceCandidate -ne $source -or $review.sealSha256 -ne (Get-FileHash -LiteralPath $sealPath -Algorithm SHA256).Hash.ToLowerInvariant()){throw 'Missing exact integrator technical activation review'}
if((Get-FileHash -LiteralPath $seal.consumerReportPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $seal.consumerReportSha256 -or (Get-FileHash -LiteralPath (Join-Path $repo 'package-lock.json') -Algorithm SHA256).Hash.ToLowerInvariant() -ne $seal.packageLockSha256 -or (Get-FileHash -LiteralPath (Join-Path $stage 'studio-build-inputs.json') -Algorithm SHA256).Hash.ToLowerInvariant() -ne $seal.sourceInputsSha256){throw 'Sealed dependency or input manifest changed'}
foreach($entry in $seal.compiledWorkspaceFiles){if((Get-FileHash -LiteralPath (Join-Path $repo $entry.path) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256){throw 'Compiled workspace dependency changed'}}
if((Inventory $newBuild).Count -ne $seal.totalFiles){throw 'Staged output count changed'}
foreach($entry in $seal.files){if((Get-FileHash -LiteralPath (Join-Path $newBuild $entry.path) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256){throw 'Staged output hash changed'}}
$listeners=@(Get-NetTCPConnection -LocalPort 5626 -State Listen)
if($listeners.Count -ne 1 -or $listeners[0].LocalAddress -ne '127.0.0.25'){throw 'Unexpected listener'}
$child=Get-CimInstance Win32_Process -Filter ('ProcessId='+$listeners[0].OwningProcess)
$launcher=Get-CimInstance Win32_Process -Filter ('ProcessId='+$child.ParentProcessId)
if($child.CommandLine -ne '"C:\Program Files\nodejs\node.exe" build' -or !$launcher.CommandLine.Contains('"'+(Join-Path $repo 'apps/studio/scripts/launch-agent.mjs')+'"')){throw 'Unverified process ownership'}
Stop-Process -Id $child.ProcessId -ErrorAction Stop
if(Get-Process -Id $launcher.ProcessId -ErrorAction SilentlyContinue){Stop-Process -Id $launcher.ProcessId -ErrorAction Stop}
# Both absolute move targets are checked above; preserve the complete old build.
Move-Item -LiteralPath $build -Destination $backup
Copy-Item -LiteralPath $newBuild -Destination $build -Recurse
foreach($entry in $seal.files){if((Get-FileHash -LiteralPath (Join-Path $build $entry.path) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256){throw 'Installed output mismatch; previous build remains preserved'}}
$launch=& (Join-Path $repo 'apps/studio/scripts/start-local-existing-config.ps1')
[ordered]@{schema='vict.structure-shared-activation@1';sourceCandidate=$source;previousServingSource=$previous.sourceCandidate;backup=$backup;sealSha256=(Get-FileHash -LiteralPath $sealPath -Algorithm SHA256).Hash.ToLowerInvariant();installedFiles=$seal.totalFiles;historicalProofFiles=@($seal.historicalProofFiles).Count;hashMismatches=@();launch=$launch;nativeVerification='pending'}|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $evidence 'activation.json') -Encoding utf8
$launch


