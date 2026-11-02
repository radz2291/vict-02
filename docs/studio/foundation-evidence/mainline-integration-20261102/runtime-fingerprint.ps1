param([Parameter(Mandatory=$true)][string]$OutputPath)
$ErrorActionPreference='Stop'
$live='C:\Users\RZ1\.codex\worktrees\vict-architecture-realignment-20261030'
$build=Join-Path $live 'apps/studio/build'
$files=@(Get-ChildItem -LiteralPath $build -Recurse -File | ForEach-Object {
  [ordered]@{path=[IO.Path]::GetRelativePath($build,$_.FullName).Replace('\','/');sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}
} | Sort-Object { $_.path })
$listeners=@(Get-NetTCPConnection -LocalPort 5626 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
  $process=Get-Process -Id $_.OwningProcess
  [ordered]@{address=$_.LocalAddress;port=$_.LocalPort;pid=$_.OwningProcess;started=$process.StartTime.ToUniversalTime().ToString('o')}
})
$config=@('package-lock.json','apps/studio/scripts/launch-agent.mjs','apps/studio/svelte.config.js','apps/studio/vite.config.ts') | ForEach-Object {
  [ordered]@{path=$_;sha256=(Get-FileHash -LiteralPath (Join-Path $live $_) -Algorithm SHA256).Hash.ToLowerInvariant()}
}
[ordered]@{schema='vict.mainline-runtime-readonly-fingerprint@1';liveRoot=$live;buildFiles=$files;listeners=$listeners;configurationFiles=@($config);limits='Read-only filesystem/listener proof. No browser/storage API accessed; saved apps/assets/conversations/drafts are protected by no runtime or browser mutation, not claimed as a new saved-data export comparison.'} | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath $OutputPath -Encoding utf8
