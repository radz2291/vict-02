<#
Starts the existing local Studio configuration. Run from a normal terminal or
through supported per-command approved outside execution. This script does not
escape or change isolation: a sandboxed listener can bind yet remain unreachable.
-ValidateOnly checks nonsecret configuration and build prerequisites, then exits.
#>
param([switch]$ValidateOnly)
$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$authFile = Join-Path $env:USERPROFILE '.pi/agent/auth.json'
$modelsFile = Join-Path $env:USERPROFILE '.pi/agent/models.json'
foreach ($path in @($authFile, $modelsFile, (Join-Path $repo 'apps/studio/build/index.js'))) {
  if (!(Test-Path -LiteralPath $path -PathType Leaf)) {
    throw 'Existing auth/model configuration or Studio build is missing. No server started.'
  }
}
# Read only the existing endpoint selection here. Credential resolution stays
# entirely in launch-agent.mjs; no key is copied, printed or written by this helper.
$models = Get-Content -LiteralPath $modelsFile -Raw | ConvertFrom-Json
$endpoint = [Uri]$models.providers.'zai-key1'.baseUrl
if ($endpoint.Scheme -ne 'https' -or $endpoint.Host -ne 'api.z.ai' -or $endpoint.Port -ne 443 -or
    $endpoint.AbsolutePath.TrimEnd('/') -ne '/api/coding/paas/v4' -or
    $endpoint.UserInfo -or $endpoint.Query -or $endpoint.Fragment) {
  throw 'The existing selected model entry must use the approved Coding Plan endpoint. No server started.'
}
if ($ValidateOnly) {
  [pscustomobject]@{ Configuration='existing normal loader'; Model='zai/glm-5.3-flash';
    Address='http://127.0.0.25:5626'; CodingPlanEndpoint=$true; ServerStarted=$false }
  return
}
$occupied = @(Get-NetTCPConnection -State Listen -ErrorAction Stop |
  Where-Object { $_.LocalPort -eq 5626 -and $_.LocalAddress -in @('127.0.0.25', '0.0.0.0', '::', '::ffff:127.0.0.25') })
if ($occupied.Count) { throw 'Studio address is already listening. Preserve it and verify ownership before any stop.' }
$node = (Get-Command node -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
$env:HOST = '127.0.0.25'
$env:PORT = '5626'
$env:ORIGIN = 'http://127.0.0.25:5626'
$env:STUDIO_AGENT_MODEL = 'zai/glm-5.3-flash'
$env:STUDIO_AGENT_AUTH_FILE = $authFile
$env:STUDIO_AGENT_MODELS_FILE = $modelsFile
$env:STUDIO_AGENT_PROVIDER_ENTRY = 'zai-key1'
$logRoot = Join-Path $env:LOCALAPPDATA 'Temp'
$outLog = Join-Path $logRoot 'vict-studio-out.log'
$errLog = Join-Path $logRoot 'vict-studio-err.log'
$stamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ')
foreach ($log in @($outLog, $errLog)) {
  if (Test-Path -LiteralPath $log) {
    Copy-Item -LiteralPath $log -Destination ($log + '.' + $stamp)
  }
}
$launcherArgument = '"' + (Join-Path $repo 'apps/studio/scripts/launch-agent.mjs') + '"'
$process = Start-Process -FilePath $node -ArgumentList @($launcherArgument) `
  -WorkingDirectory $repo -WindowStyle Hidden -RedirectStandardOutput $outLog `
  -RedirectStandardError $errLog -PassThru
[pscustomobject]@{ LauncherPid=$process.Id; Address='http://127.0.0.25:5626';
  Model='zai/glm-5.3-flash'; Configuration='existing launch-agent.mjs loader';
  Verification='Check the listener and supported internal browser; a PID alone is not reachability proof.' }
