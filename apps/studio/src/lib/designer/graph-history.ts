import type { UiDocument } from '@victframework/ui';
import { graphAuthoringContract, type GraphHistoryController } from '@victframework/ui-flow-svelte';
import { graphSourceOwnership } from './graph-authoring.js';

/** Source history is shared only by graphs whose writes actually reach source.
 * A literal or private scoped graph keeps its occurrence-local GraphSession.
 * Controlled node parameters delegate through the same public ownership chain
 * used by the renderer; a matching state name alone grants nothing. */
export function graphUsesSourceHistory(document: UiDocument, nodeId: string, seen: readonly string[] = []): boolean {
  if (seen.includes(nodeId) || seen.length >= 32) return false;
  const owner = graphSourceOwnership(document, nodeId);
  if (owner?.kind === 'document') return document.localState[owner.key]?.type === 'string';
  if (owner?.kind !== 'slot' || !owner.controlled) return false;
  const parent = document.nodes[owner.ownerNodeId];
  const contract = parent?.kind === 'component' ? graphAuthoringContract(parent.definitionId, parent.revision) : undefined;
  return !!contract?.body && contract.body.slot === owner.slotName &&
    graphUsesSourceHistory(document, owner.ownerNodeId, [...seen, nodeId]);
}

export function graphHistoryFor(document: UiDocument | undefined, nodeId: string, history: GraphHistoryController): GraphHistoryController | undefined {
  return document && graphUsesSourceHistory(document, nodeId) ? history : undefined;
}
