/**
 * Occurrence → source-node resolution for editor surfaces.
 *
 * Renderer occurrence keys carry `documentId|sourceNodeId|instance…|keys…`;
 * selection in the canvas maps back to the exact source node — including
 * which component definition owns it (the first `@` path segment).
 */

import type { UiDocument, UiNode } from '@victframework/ui';

export interface OccurrenceReport {
  readonly sourceNodeId: string;
  readonly owningDefinitionId: string | undefined;
  readonly repeatKeys: readonly string[];
  readonly node: UiNode | undefined;
}

/** Parse an occurrence key (renderer annotation) back to its source parts. */
export function resolveOccurrence(
  occurrenceKey: string,
  document: UiDocument,
): OccurrenceReport {
  const parts = occurrenceKey.split('|');
  const documentId = parts[0] ?? '';
  const sourceNodeId = parts[1] ?? '';
  const rest = parts.slice(2);
  const instanceSegments = rest.filter((segment) => segment.includes('@'));
  const repeatKeys = rest.filter((segment) => !segment.includes('@'));
  const firstInstance = instanceSegments[0] ?? '';
  const owningDefinitionId = firstInstance === '' ? undefined : (firstInstance.split('@')[1] ?? undefined);
  const nodes = (document.nodes ?? {}) as Record<string, UiNode>;
  return {
    sourceNodeId,
    owningDefinitionId,
    repeatKeys,
    node: documentId === String(document.id) ? nodes[sourceNodeId] : undefined,
  };
}

/** True when the canvas element for this occurrence is currently selected. */
export function isSelected(occurrenceKey: string, selected: string | undefined): boolean {
  return selected !== undefined && occurrenceKey === selected;
}
