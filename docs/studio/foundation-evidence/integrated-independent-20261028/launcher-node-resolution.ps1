$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$launcher = Join-Path $repo 'apps/studio/scripts/start-local-existing-config.ps1'
$tokens = $null; $parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($launcher, [ref]$tokens, [ref]$parseErrors)
if (@($parseErrors).Count) { throw 'Launcher parse failed' }
$assignment = $ast.Find({param($item) $item -is [System.Management.Automation.Language.AssignmentStatementAst] -and $item.Left.Extent.Text -eq '$node'}, $true)
if (!$assignment) { throw 'Missing node assignment' }
$expression = [ScriptBlock]::Create($assignment.Right.Extent.Text)
$actualCommands = @(Microsoft.PowerShell.Core\Get-Command node -CommandType Application -ErrorAction Stop)
$actual = & $expression
if ($actual -isnot [string] -or !$actual -or $actual -ne $actualCommands[0].Source) { throw 'Actual resolution was not the first scalar Application path' }
if (!(Test-Path -LiteralPath $actual -PathType Leaf)) { throw 'Actual selected executable is unavailable' }

$mockResult = & {
  param($expression)
  function Get-Command {
    [CmdletBinding()]
    param([string]$Name, [string]$CommandType)
    if ($Name -ne 'node' -or $CommandType -ne 'Application' -or $ErrorActionPreference -ne 'Stop') { throw 'Lookup contract changed' }
    [pscustomobject]@{Source='C:\First Node\node.exe';CommandType='Application'}
    [pscustomobject]@{Source='C:\Second Node\node.exe';CommandType='Application'}
  }
  & $expression
} $expression
if ($mockResult -isnot [string] -or $mockResult -ne 'C:\First Node\node.exe') { throw 'Multiple-result resolution is not a scalar first path' }

$baselineText = git -C $repo show HEAD:apps/studio/scripts/start-local-existing-config.ps1 | Out-String
$baselineAst = [System.Management.Automation.Language.Parser]::ParseInput($baselineText, [ref]$tokens, [ref]$parseErrors)
$baselineAssignment = $baselineAst.Find({param($item) $item -is [System.Management.Automation.Language.AssignmentStatementAst] -and $item.Left.Extent.Text -eq '$node'}, $true)
$baselineExpression = [ScriptBlock]::Create($baselineAssignment.Right.Extent.Text)
$baselineResult = & {
  param($expression)
  function Get-Command {
    [CmdletBinding()]
    param([string]$Name, [string]$CommandType)
    [pscustomobject]@{Source='C:\First Node\node.exe'}
    [pscustomobject]@{Source='C:\Second Node\node.exe'}
  }
  & $expression
} $baselineExpression
if ($baselineResult -isnot [object[]] -or $baselineResult.Count -ne 2) { throw 'Pre-fix multiple-result regression was not reproduced' }

$report = [ordered]@{
  candidateSHA=(git -C $repo rev-parse HEAD).Trim()
  verdict='PASS - bounded one-line launcher node resolution fix'
  sourceSHA256=(Get-FileHash -LiteralPath $launcher -Algorithm SHA256).Hash.ToLowerInvariant()
  extractedExpression=$assignment.Right.Extent.Text
  actualApplicationResultCount=$actualCommands.Count
  actualSelectedType=$actual.GetType().FullName
  actualFirstPathSelected=$true
  mockedMultipleResultsFirstScalarSelected=$true
  preFixMockedMultipleResultType=$baselineResult.GetType().FullName
  preFixMockedMultipleResultCount=$baselineResult.Count
  limitations=@('Expression-only execution; launcher not invoked','No process start/stop, listener inventory, browser, provider or network calls','Prior candidate review excludes this uncommitted helper amendment','Actual approved relaunch outcome belongs to root evidence')
}
$report | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 (Join-Path $PSScriptRoot 'launcher-node-resolution.json')
$report | ConvertTo-Json -Depth 5
