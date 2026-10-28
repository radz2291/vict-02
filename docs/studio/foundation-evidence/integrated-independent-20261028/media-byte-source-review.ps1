$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$evidence=Join-Path $repo 'docs/studio/foundation-evidence/fresh-integration-20261028'
function Read-Json($name){Get-Content (Join-Path $evidence $name) -Raw|ConvertFrom-Json -AsHashtable}
function Changed-Keys($before,$after){@($before.Keys|Where-Object {($before[$_]|ConvertTo-Json -Depth 100 -Compress) -cne ($after[$_]|ConvertTo-Json -Depth 100 -Compress)})}
$bundle=Read-Json 'actual-media-exported-bundle.json'
$rows=@(foreach($asset in $bundle.mediaArchive.assets){
  $bytes=[Convert]::FromBase64String($asset.base64)
  $digest=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant()
  $fixture=Join-Path $repo ('packages/ui-media-svelte/test/fixtures/foundation-media/'+$asset.name)
  $fixtureBytes=[IO.File]::ReadAllBytes($fixture)
  $equal=[System.Linq.Enumerable]::SequenceEqual[byte]($bytes,$fixtureBytes)
  if($digest -cne $asset.digest -or $asset.reference -cne ('asset:sha256:'+$digest) -or $bytes.Length -ne $asset.size -or !$equal){throw 'Export member verification failed'}
  [ordered]@{name=$asset.name;size=$bytes.Length;sha256=$digest;declaredDigestMatches=$true;referenceMatches=$true;fixtureExactByteEquality=$equal}
})
if($rows.Count -ne 5){throw 'Expected five export members'}
$agent=Read-Json 'actual-media-agent-saved-r1r1.json'
$final=Read-Json 'actual-media-final-saved-r1r2.json'
$imported=Read-Json 'actual-media-imported-saved-source.json'
$accent=Read-Json 'actual-media-imported-accent-saved-r1r2.json'
$negative=Read-Json 'actual-media-negative-missing-video-bundle.json'
$removed=@($bundle.mediaArchive.assets.reference|Where-Object {$_ -notin $negative.mediaArchive.assets.reference})
$negativeComparable=Read-Json 'actual-media-negative-missing-video-bundle.json'
$negativeComparable.mediaArchive.assets=$bundle.mediaArchive.assets
$repairedVectors=Read-Json 'media-vectors-native-repaired.json'
$allIds=@($repairedVectors|ForEach-Object {$_.ids})
$report=[ordered]@{
  candidateSHA=(git -C $repo rev-parse HEAD).Trim()
  byteMembers=$rows
  agentNodeCount=$agent.nodes.Count
  agentToFinalChangedTopKeys=@(Changed-Keys $agent $final)
  agentToFinalChangedNodes=@(Changed-Keys $agent.nodes $final.nodes)
  finalToExportDocumentChangedKeys=@(Changed-Keys $final $bundle.uiDocuments[0].document)
  finalToImportedChangedKeys=@(Changed-Keys $final $imported)
  importedId=$imported.id
  importedToAccentChangedKeys=@(Changed-Keys $imported $accent)
  importedToAccentChangedNodes=@(Changed-Keys $imported.nodes $accent.nodes)
  negativeMissingReferences=$removed
  negativeOtherTopLevelDifferences=@(Changed-Keys $bundle $negativeComparable)
  nativeRepairedVectorIdCount=$allIds.Count
  nativeRepairedVectorUniqueIdCount=@($allIds|Select-Object -Unique).Count
  limits=@('Read existing files only; no browser/provider/server/build/source operations','Native metadata/PNG observations were retained by root, not independently replayed')
}
$report|ConvertTo-Json -Depth 12|Set-Content -Encoding utf8 (Join-Path $PSScriptRoot 'media-byte-source-review.json')
$report|ConvertTo-Json -Depth 12
