$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$candidate = (git -C $repo rev-parse HEAD).Trim()
if ($candidate -ne '59212b031d49163f7e1ebc40088f6a8ab2ae1b1e') { throw 'Unexpected candidate' }
if (git -C $repo diff --name-only HEAD -- apps/studio/scripts) { throw 'Launcher source changed after candidate' }
$launcher = Join-Path $repo 'apps/studio/scripts/start-local-existing-config.ps1'
$tokens = $null; $parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($launcher, [ref]$tokens, [ref]$parseErrors)
if (@($parseErrors).Count) { throw 'Launcher parse failed' }
$endpointIf = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.IfStatementAst] -and $node.Extent.Text.StartsWith('if ($endpoint.Scheme') }, $true)
$endpointPredicate = [ScriptBlock]::Create('param($endpoint) ' + $endpointIf.Clauses[0].Item1.Extent.Text)
$endpointCases = @(
  @{ Uri='https://api.z.ai/api/coding/paas/v4'; Reject=$false },
  @{ Uri='https://api.z.ai:443/api/coding/paas/v4'; Reject=$false },
  @{ Uri='https://api.z.ai:8443/api/coding/paas/v4'; Reject=$true },
  @{ Uri='http://api.z.ai/api/coding/paas/v4'; Reject=$true },
  @{ Uri='https://other.example/api/coding/paas/v4'; Reject=$true },
  @{ Uri='https://api.z.ai/api/paas/v4'; Reject=$true },
  @{ Uri='https://user@api.z.ai/api/coding/paas/v4'; Reject=$true },
  @{ Uri='https://api.z.ai/api/coding/paas/v4?x=1'; Reject=$true },
  @{ Uri='https://api.z.ai/api/coding/paas/v4#part'; Reject=$true }
)
foreach ($case in $endpointCases) {
  if ([bool](& $endpointPredicate ([Uri]$case.Uri)) -ne $case.Reject) { throw 'Endpoint predicate mismatch' }
}
$where = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.CommandAst] -and $node.GetCommandName() -eq 'Where-Object' }, $true)
$whereBlock = @($where.CommandElements | Where-Object { $_ -is [System.Management.Automation.Language.ScriptBlockExpressionAst] })[0].ScriptBlock.GetScriptBlock()
$occupiedCases = @(
  @{ Address='127.0.0.25'; Port=5626; Occupied=$true },
  @{ Address='0.0.0.0'; Port=5626; Occupied=$true },
  @{ Address='::'; Port=5626; Occupied=$true },
  @{ Address='::ffff:127.0.0.25'; Port=5626; Occupied=$true },
  @{ Address='127.0.0.1'; Port=5626; Occupied=$false },
  @{ Address='127.0.0.25'; Port=5627; Occupied=$false }
)
foreach ($case in $occupiedCases) {
  $fixture = [pscustomobject]@{ LocalAddress=$case.Address; LocalPort=$case.Port }
  if ((@($fixture | Where-Object $whereBlock).Count -gt 0) -ne $case.Occupied) { throw 'Occupied predicate mismatch' }
}
$argument = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.AssignmentStatementAst] -and $node.Left.Extent.Text -eq '$launcherArgument' }, $true)
$argumentExpression = [ScriptBlock]::Create('param($repo) ' + $argument.Right.Extent.Text)
$spaceRoot = 'C:\Example Workspace\VICT'
$quoted = & $argumentExpression $spaceRoot
if ($quoted -ne ('"' + (Join-Path $spaceRoot 'apps/studio/scripts/launch-agent.mjs') + '"')) { throw 'Quoted path mismatch' }
Push-Location (Split-Path $repo)
try { $validated = & $launcher -ValidateOnly } finally { Pop-Location }
if ($validated.ServerStarted -ne $false -or $validated.CodingPlanEndpoint -ne $true -or $validated.Address -ne 'http://127.0.0.25:5626') { throw 'Validation-only result mismatch' }
$hashes = @{}
foreach ($path in @('apps/studio/scripts/start-local-existing-config.ps1','apps/studio/scripts/LOCAL-STUDIO-LAUNCH.md')) { $hashes[$path] = (Get-FileHash -LiteralPath (Join-Path $repo $path) -Algorithm SHA256).Hash.ToLowerInvariant() }
$report = [ordered]@{
  candidateSHA=$candidate; Verdict='PASS - bounded launcher repair recheck'; ParseErrors=0;
  EndpointPredicateCases=$endpointCases.Count; OccupiedPredicateCases=$occupiedCases.Count;
  QuotedAbsolutePathWithSpaces=$true; ValidateOnlyFromDifferentWorkingDirectory=$validated;
  ClosedFindings=@('LAUNCH-01','LAUNCH-02','LAUNCH-03'); SourceHashes=$hashes;
  Limits=@('No actual launcher start or stop','No actual listener inventory; occupied cases use inert fixtures and the source predicate','No browser, provider or network request','No product source edits','Previous failed review retained')
}
$report | ConvertTo-Json -Depth 6 | Set-Content -Encoding utf8 (Join-Path $PSScriptRoot 'launcher-independent-recheck.json')
$report | ConvertTo-Json -Depth 6
