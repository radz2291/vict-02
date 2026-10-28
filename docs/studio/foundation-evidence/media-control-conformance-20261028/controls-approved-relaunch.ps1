$ErrorActionPreference='Stop'
$repo='C:\Users\RZ1\AppData\Local\Temp\vict-authoring-foundation'
$stage='C:\Users\RZ1\AppData\Local\Temp\vict-controls-build-1ffdd12'
$expected='11d035c2243c58df526853ac218e86cb7770db54'
Set-Location -LiteralPath $repo
if((git rev-parse HEAD) -ne $expected){throw 'Candidate changed; nothing stopped.'}
git diff --quiet -- apps/studio/src packages/ui-svelte/src packages/ui-media-svelte/src
if($LASTEXITCODE -ne 0){throw 'Source dirty; nothing stopped.'}
& "$repo\apps\studio\scripts\start-local-existing-config.ps1" -ValidateOnly
$liveBuild=[IO.Path]::GetFullPath("$repo\apps\studio\build")
$stagedBuild=[IO.Path]::GetFullPath("$stage\apps\studio\build")
$backup=[IO.Path]::GetFullPath("$stage\pre-controls-live-build")
if($liveBuild -ne "$repo\apps\studio\build" -or $stagedBuild -ne "$stage\apps\studio\build" -or $backup -ne "$stage\pre-controls-live-build"){throw 'Unexpected build path'}
if(!(Test-Path -LiteralPath "$stagedBuild\index.js") -or (Test-Path -LiteralPath $backup)){throw 'Staged artifact missing or previous outcome requires inspection'}
$launcher=Get-CimInstance Win32_Process -Filter 'ProcessId=14908'
$child=Get-CimInstance Win32_Process -Filter 'ProcessId=7444'
$listeners=@(Get-NetTCPConnection -State Listen | Where-Object {$_.LocalPort -eq 5626 -and $_.LocalAddress -eq '127.0.0.25'})
if(!$launcher -or !$child -or $child.ParentProcessId -ne $launcher.ProcessId -or $launcher.ExecutablePath -ne 'C:\Program Files\nodejs\node.exe' -or $child.ExecutablePath -ne 'C:\Program Files\nodejs\node.exe' -or $launcher.CommandLine -notlike '*launch-agent.mjs*' -or $child.CommandLine -notmatch '\sbuild(?:\s|$|")' -or $listeners.Count -ne 1 -or $listeners[0].OwningProcess -ne $child.ProcessId){throw 'Exact Studio pair/listener changed; nothing stopped'}
Stop-Process -Id $child.ProcessId -ErrorAction Stop
$remaining=Get-CimInstance Win32_Process -Filter 'ProcessId=14908'
if($remaining){if($remaining.CreationDate -ne $launcher.CreationDate -or $remaining.CommandLine -notlike '*launch-agent.mjs*'){throw 'Launcher identity changed'}; Stop-Process -Id $remaining.ProcessId -ErrorAction Stop}
if((Get-CimInstance Win32_Process -Filter 'ProcessId=14908 OR ProcessId=7444')){throw 'Old pair still exists'}
Move-Item -LiteralPath $liveBuild -Destination $backup
Copy-Item -LiteralPath $stagedBuild -Destination $liveBuild -Recurse
& "$repo\apps\studio\scripts\start-local-existing-config.ps1"

