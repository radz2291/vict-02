param(
  [Parameter(Mandatory)][string]$PgBin,
  [Parameter(Mandatory)][string]$Node,
  [Parameter(Mandatory)][string]$Consumer,
  [Parameter(Mandatory)][string]$Source,
  [Parameter(Mandatory)][string]$Output,
  [ValidateRange(4,1000)][int]$Samples = 24,
  [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
$PgBin = (Resolve-Path -LiteralPath $PgBin).Path
$Node = (Resolve-Path -LiteralPath $Node).Path
$Consumer = (Resolve-Path -LiteralPath $Consumer).Path
$Source = (Resolve-Path -LiteralPath $Source).Path
$Output = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Output)
if (Test-Path -LiteralPath $Output) { throw 'Choose a new output directory.' }
$work = Join-Path ([IO.Path]::GetTempPath()) ('vhost003-pg-' + [guid]::NewGuid().ToString('N'))
if (($work + $Output + $PgBin + $Consumer + $Source) -match '[\r\n"]') { throw 'Unsupported path.' }
New-Item -ItemType Directory -Path $Output,$work | Out-Null
Push-Location -LiteralPath $Consumer
try {
  & $Node scripts/verify-baseline.mjs --installed *> (Join-Path $Output 'closure.log')
  if ($LASTEXITCODE -ne 0) { throw 'The pinned Quellight package closure failed verification.' }
} finally {
  Pop-Location
}
$data = Join-Path $work 'data'
$log = Join-Path $Output 'postgres.log'
$pgCtl = Join-Path $PgBin 'pg_ctl.exe'
$provenance = [ordered]@{}
foreach ($binary in @('postgres.exe','initdb.exe','pg_ctl.exe')) {
  $provenance[$binary] = (Get-FileHash -LiteralPath (Join-Path $PgBin $binary)).Hash.ToLowerInvariant()
}
$provenance | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Output 'binaries.json') -Encoding utf8
& (Join-Path $PgBin 'initdb.exe') -D $data -U vhostbench --auth-host=trust --auth-local=trust --encoding=UTF8 --locale=C *> (Join-Path $Output 'initdb.log')
if ($LASTEXITCODE -ne 0) { throw 'Owned initdb failed.' }
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0)
$listener.Start()
try { $port = $listener.LocalEndpoint.Port } finally { $listener.Stop() }
$process = Start-Process -FilePath $pgCtl -ArgumentList @('start','-D',('"' + $data + '"'),'-l',('"' + $log + '"'),'-t','30','-w','-o',('"-h 127.0.0.1 -p '+$port+' -c ssl=off -c max_connections=20 -c log_lock_waits=on -c deadlock_timeout=20ms"')) -WindowStyle Hidden -PassThru
try {
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) { throw "Owned PostgreSQL failed to start. See $log" }
  $phase = if ($CheckOnly) { 'check' } else { 'all' }
  & $Node (Join-Path $PSScriptRoot 'run.mjs') $Consumer $Source $data "$port" "$Samples" $Output $phase *> (Join-Path $Output 'runner.log')
  if ($LASTEXITCODE -ne 0) { throw "VHOST-003 failed. Review retained evidence in $Output" }
} finally {
  if (Test-Path -LiteralPath (Join-Path $data 'postmaster.pid')) {
    & $pgCtl stop -D $data -m fast -w -t 30 | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "Failed to stop benchmark-owned PostgreSQL at $data" }
  }
  Write-Output "Stopped owned PostgreSQL. Disposable data retained at $work"
}
