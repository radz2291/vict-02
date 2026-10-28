import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const output = dirname(fileURLToPath(import.meta.url));
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const artifact = 'docs/studio/foundation-evidence/actual-agent-responsive-recovery-public.json';
const summaryPath = 'docs/studio/foundation-evidence/actual-agent-responsive.json';
const historical = JSON.parse(readFileSync(join(root, artifact), 'utf8'));
const summary = JSON.parse(readFileSync(join(root, summaryPath), 'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
const nodes = [];
const states = [];
const conditions = [];
const edits = [];
const tools = [];
for (const [partIndex, part] of historical.parts.entries()) {
  if (part.type !== 'tool-invocation') continue;
  const call = part.toolInvocation;
  tools.push({ partIndex, name: call.toolName, section: call.args?.section, expectedRevision: call.result?.expectedRevision });
  if (call.toolName === 'studio_screen_edit') {
    edits.push({ partIndex, args: call.args, result: {
      ok: call.result.ok, expectedRevision: call.result.expectedRevision,
      revision: call.result.revision, digest: call.result.digest, applied: call.result.applied,
    } });
  }
  if (call.toolName !== 'studio_screen_read') continue;
  const result = call.result;
  if (result.section === 'source' && result.sourceJson && result.offset === 0 && result.nextOffset === null) {
    nodes.push({ partIndex, revision: result.expectedRevision, nodeId: result.nodeId, node: JSON.parse(result.sourceJson) });
  }
  if (result.section === 'sources') {
    for (const item of result.items ?? []) {
      if (item.sourceJson && item.offset === 0 && item.nextOffset === null && item.sourceJson.length === item.totalCharacters) {
        nodes.push({ partIndex, revision: result.expectedRevision, nodeId: item.nodeId, node: JSON.parse(item.sourceJson) });
      }
    }
  }
  if (result.section === 'state') states.push(...result.items.map(item => ({ partIndex, ...item })));
  if (result.section === 'registry' && result.registry === 'conditions') conditions.push(...result.items);
}
const initialNodes = nodes.filter(node => node.revision === 'r1#8');
const nodeIds = new Set(initialNodes.map(node => node.nodeId));
const unresolvedReferences = new Set();
for (const { node } of initialNodes) {
  for (const id of [...(node.children ?? []), ...Object.values(node.slots ?? {}).flat()]) {
    if (!nodeIds.has(id)) unresolvedReferences.add(id);
  }
}
const lastEdit = edits.at(-1);
const observation = historical.parts.find(part => part.type === 'tool-invocation' && part.toolInvocation.toolName === 'studio_screen_observe')?.toolInvocation.result;
const finalDigest = lastEdit?.result.digest;
const inventory = {
  kind: 'Bounded retained-public-artifact recovery inventory; not a recovered UiDocument',
  inspectedHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  artifact, artifactSha256: hash(readFileSync(join(root, artifact))),
  sourceIdentity: historical.initialScreenSummary,
  completeInitialNodeBodies: initialNodes.map(({ nodeId, partIndex, node }) => ({ nodeId, partIndex, sourceJsonSha256: hash(JSON.stringify(node)) })),
  initialNodeBodiesPresent: nodeIds.size,
  initialNodeBodiesRequired: historical.initialScreenSummary.nodeCount,
  initialNodeBodiesAbsentAtLeast: historical.initialScreenSummary.nodeCount - nodeIds.size,
  knownUnresolvedInitialChildReferences: [...unresolvedReferences].sort(),
  statePreviewCount: states.length,
  parseableInitialJsonPreviews: states.filter(item => { try { JSON.parse(item.initialJson); return true; } catch { return false; } }).length,
  stateKeys: states.map(item => item.key),
  conditionPreviewKeys: conditions.map(item => item.key),
  confirmedContinuationBatches: edits.map(({ partIndex, args, result }) => ({ partIndex, expectedRevision: args.expectedRevision, operationCount: args.operations.length, ...result })),
  finalCursor: summary.recovery.finalCursor,
  receiptConsistency: { summaryDigestMatchesLastReceipt: finalDigest === summary.recovery.finalCursor.digest,
    observationDigestMatchesLastReceipt: finalDigest === observation?.metadata.cursor.digest },
  observedCrop: observation?.metadata.image,
  originalFirstSixConfirmedBatchInputsPresent: false,
  exactPublicDatastorePathCited: false,
  missingCanonicalFields: ['16 or more initial node bodies', 'complete initial theme', 'complete styleSources/tokens/assets/componentDefinitions registries', 'initial six confirmed batch inputs if reconstruction is attempted'],
  verdict: 'UNRECOVERED: insufficient original canonical input to compute or verify the final digest',
  noBrowserProviderServerOrPrivateReasoningAccess: true,
  toolInventory: tools,
};
writeFileSync(join(output, 'retained-coverage.json'), JSON.stringify(inventory, null, 2) + '\n');
writeFileSync(join(output, 'incomplete-public-fragments.json'), JSON.stringify({
  kind: 'INCOMPLETE public original fragments; not importable or a replacement app',
  artifact, nodes, confirmedContinuationEdits: edits,
}, null, 2) + '\n');
console.log(JSON.stringify({ verdict: inventory.verdict, initialNodeBodiesPresent: nodeIds.size,
  initialNodeBodiesRequired: historical.initialScreenSummary.nodeCount, states: states.length,
  continuationBatches: edits.length, receiptConsistency: inventory.receiptConsistency }, null, 2));
