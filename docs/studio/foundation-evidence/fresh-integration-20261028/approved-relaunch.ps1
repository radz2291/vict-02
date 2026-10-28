$ErrorActionPreference = 'Stop'
$repo = 'C:\Users\RZ1\AppData\Local\Temp\vict-authoring-foundation'
$stage = 'C:\Users\RZ1\AppData\Local\Temp\vict-string-amendment-build-20fb566'
$evidence = Join-Path $repo 'docs\studio\foundation-evidence\fresh-integration-20261028'
$node = 'C:\Program Files\nodejs\node.exe'
Set-Location -LiteralPath $repo

# Only the known nonsecret flags are supplied. The existing supported launcher
# resolves the existing credential file; no credential is copied or printed.
$env:HOST = '127.0.0.25'
$env:PORT = '5626'
$env:ORIGIN = 'http://127.0.0.25:5626'
$env:STUDIO_AGENT_MODEL = 'zai/glm-5.3-flash'
$env:STUDIO_AGENT_AUTH_FILE = Join-Path $env:USERPROFILE '.pi/agent/auth.json'
$env:STUDIO_AGENT_MODELS_FILE = Join-Path $env:USERPROFILE '.pi/agent/models.json'
$env:STUDIO_AGENT_PROVIDER_ENTRY = 'zai-key1'
foreach ($path in @($env:STUDIO_AGENT_AUTH_FILE, $env:STUDIO_AGENT_MODELS_FILE,
    (Join-Path $stage 'mastra-dist\presentation.js'),
    (Join-Path $stage 'apps\studio\build\index.js'))) {
  if (!(Test-Path -LiteralPath $path -PathType Leaf)) { throw 'A required existing configuration or staged build artifact is missing.' }
}
git diff --quiet 20fb566221a13eb7c68653f299f45c6222666c69 HEAD -- apps/studio/src packages/mastra/src
if ($LASTEXITCODE -ne 0) { throw 'Product source moved from the tested candidate.' }
git diff --quiet -- apps/studio/src packages/mastra/src
if ($LASTEXITCODE -ne 0) { throw 'Uncommitted product source requires reconciliation.' }

$launcher = Get-CimInstance Win32_Process -Filter 'ProcessId=22564'
$child = Get-CimInstance Win32_Process -Filter 'ProcessId=20016'
$listener = Get-NetTCPConnection -LocalAddress 127.0.0.25 -LocalPort 5626 -State Listen
if (!$launcher -or !$child -or $child.ParentProcessId -ne $launcher.ProcessId -or
    $launcher.ExecutablePath -ne $node -or $child.ExecutablePath -ne $node -or
    $launcher.CommandLine -notlike '*launch-agent.mjs*' -or
    $child.CommandLine -notmatch '\sbuild(?:\s|$|")' -or
    $listener.OwningProcess -ne $child.ProcessId) {
  throw 'The exact approved Studio process pair/listener changed. Nothing stopped.'
}

$backup = Join-Path $stage 'pre-approved-relaunch-backup'
if (Test-Path -LiteralPath $backup) { throw 'Backup path already exists; inspect the earlier outcome before retrying.' }
New-Item -ItemType Directory -Path $backup | Out-Null
Copy-Item -LiteralPath (Join-Path $repo 'apps\studio\build') -Destination (Join-Path $backup 'studio-build') -Recurse
Copy-Item -LiteralPath (Join-Path $repo 'packages\mastra\dist') -Destination (Join-Path $backup 'mastra-dist') -Recurse

function StopVerifiedProcess([int]$processId) {
  try { Stop-Process -Id $processId -ErrorAction Stop }
  catch {
    if ($_.FullyQualifiedErrorId -notlike 'NoProcessFoundForGivenId*') { throw }
  }
}
StopVerifiedProcess $child.ProcessId
$remainingLauncher = Get-CimInstance Win32_Process -Filter 'ProcessId=22564'
if ($remainingLauncher) {
  if ($remainingLauncher.CreationDate -ne $launcher.CreationDate -or
      $remainingLauncher.CommandLine -notlike '*launch-agent.mjs*') {
    throw 'Launcher identity changed after child exit; do not stop another process.'
  }
  StopVerifiedProcess $remainingLauncher.ProcessId
}
if ((Get-CimInstance Win32_Process -Filter 'ProcessId=22564') -or
    (Get-CimInstance Win32_Process -Filter 'ProcessId=20016')) {
  throw 'A verified old process still exists; do not replace live output.'
}
Write-Output 'Stopped only the reverified approved Studio pair.'

npm run build -w @victframework/mastra *> (Join-Path $evidence 'approved-relaunch-mastra-live-build.log')
if ($LASTEXITCODE -ne 0) { throw 'Mastra build failed; inspect its retained log and backup before any retry.' }
npm run build -w vict-studio *> (Join-Path $evidence 'approved-relaunch-studio-live-build.log')
if ($LASTEXITCODE -ne 0) { throw 'Studio build failed; inspect its retained log and backup before any retry.' }

$outLog = Join-Path $env:LOCALAPPDATA 'Temp\vict-studio-out.log'
$errLog = Join-Path $env:LOCALAPPDATA 'Temp\vict-studio-err.log'
foreach ($log in @($outLog, $errLog)) {
  if (Test-Path -LiteralPath $log) {
    Copy-Item -LiteralPath $log -Destination (Join-Path $backup ([IO.Path]::GetFileName($log)))
  }
}
$started = Start-Process -FilePath $node -ArgumentList @('apps/studio/scripts/launch-agent.mjs') `
  -WorkingDirectory $repo -WindowStyle Hidden -RedirectStandardOutput $outLog `
  -RedirectStandardError $errLog -PassThru
Write-Output ('New launcher PID: ' + $started.Id)
$record = [ordered]@{ launcherPid=$started.Id; host='127.0.0.25'; port=5626;
  model='zai/glm-5.3-flash'; credentialLoading='existing launch-agent.mjs auth-file loader';
  backup=$backup; launchedAtUtc=[DateTime]::UtcNow.ToString('o') }
$record | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $evidence 'approved-relaunch-started.json')
Write-Output 'Launched with existing normal configuration. Verify listener and supported browser before any retry.'
