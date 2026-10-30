import type { UiDocument } from '@victframework/ui';
import type {
  GraphAuthoringDisposition,
  GraphOccurrenceIdentity,
  GraphHistoryController,
} from '@victframework/ui-flow-svelte';
import {
  authoredGraphVersion,
  authoredGraphBinding,
  graphSourceOwnership,
  graphLexicalOwners,
  inspectAuthoredGraphSource,
  type GraphOccurrenceRoute,
} from './graph-authoring.js';
import { graphAuthoringContract } from '@victframework/ui-flow-svelte';

function sourceRoot(
  document: UiDocument,
  nodeId: string,
  seen: readonly string[] = [],
): 'document' | 'runtime' | 'unresolved' {
  if (seen.includes(nodeId) || seen.length >= 32) return 'unresolved';
  const node = document.nodes[nodeId];
  if (!authoredGraphVersion(node)) return 'unresolved';
  const owner = graphSourceOwnership(document, nodeId);
  if (owner?.kind === 'document') return 'document';
  if (
    owner?.kind === 'literal' ||
    (owner?.kind === 'slot' && !owner.controlled) ||
    (!owner && !authoredGraphBinding(node))
  )
    return 'runtime';
  if (owner?.kind !== 'slot') return 'unresolved';
  const parent = document.nodes[owner.ownerNodeId],
    contract =
      parent?.kind === 'component'
        ? graphAuthoringContract(parent.definitionId, parent.revision)
        : undefined;
  if (contract?.body?.slot !== owner.slotName) return 'unresolved';
  return sourceRoot(document, owner.ownerNodeId, [...seen, nodeId]);
}

/** Source authority follows the actual containing node's string parameter and
 * revisions. A declaration's controlled flag alone never grants source Undo. */
export function graphUsesSourceHistory(
  document: UiDocument,
  nodeId: string,
  route: GraphOccurrenceRoute = [],
): boolean {
  if (!graphLexicalOwners(document).complete) return false;
  const checked = inspectAuthoredGraphSource(document, nodeId, route);
  if (!checked.ok) return false;
  const owner = graphSourceOwnership(document, nodeId);
  if (owner?.kind === 'document') return true;
  if (owner?.kind !== 'slot' || !owner.controlled || !route.length) return false;
  const entry = route.at(-1)!;
  return (
    entry.workspaceNodeId === owner.ownerNodeId &&
    graphUsesSourceHistory(document, entry.workspaceNodeId, route.slice(0, -1))
  );
}
export function graphAuthoringFor(
  document: UiDocument | undefined,
  identity: GraphOccurrenceIdentity,
  history: GraphHistoryController,
): GraphAuthoringDisposition {
  if (!document)
    return { kind: 'refused', message: 'The graph document is unavailable; authoring is refused.' };
  if (!graphLexicalOwners(document).complete)
    return {
      kind: 'refused',
      message: 'Graph source ownership could not be fully inspected; authoring is refused.',
    };
  // A wholly runtime-owned chain can have live revisions different from its
  // authored initial values. It never receives canonical history authority.
  if (sourceRoot(document, identity.nodeId) === 'runtime') return { kind: 'runtime' };
  const checked = inspectAuthoredGraphSource(document, identity.nodeId, identity.occurrenceRoute);
  if (!checked.ok) return { kind: 'refused', message: checked.message };
  return graphUsesSourceHistory(document, identity.nodeId, identity.occurrenceRoute)
    ? { kind: 'source', history }
    : { kind: 'runtime' };
}
/** @1 callers without structured provenance cannot claim nested source history. */
export function graphHistoryFor(
  document: UiDocument | undefined,
  nodeId: string,
  history: GraphHistoryController,
  route: GraphOccurrenceRoute = [],
): GraphHistoryController | undefined {
  return document && graphUsesSourceHistory(document, nodeId, route) ? history : undefined;
}
