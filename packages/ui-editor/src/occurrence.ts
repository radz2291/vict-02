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
  /** Ordered component-instance path: innermost ownership last. */
  readonly instancePath: readonly {
    readonly sourceNodeId: string;
    readonly definitionId: string;
  }[];
  /** Logical portal ownership chain (sourceNodeId + overlay target). */
  readonly portalPath: readonly { readonly sourceNodeId: string; readonly overlayId: string }[];
  /** The nearest owning component definition, if any. */
  readonly owningDefinitionId: string | undefined;
  readonly repeatKeys: readonly string[];
  readonly node: UiNode | undefined;
}

/** Parse an occurrence key (renderer annotation) back to its source parts. */
export function resolveOccurrence(occurrenceKey: string, document: UiDocument): OccurrenceReport {
  const parts = occurrenceKey.split('|');
  const documentId = parts[0] ?? '';
  const sourceNodeId = parts[1] ?? '';
  const rest = parts.slice(2);
  const instanceSegments = rest.filter(
    (segment) => segment.includes('@') && !segment.startsWith('portal:'),
  );
  const portalSegments = rest.filter((segment) => segment.startsWith('portal:'));
  const instancePath = instanceSegments.map((segment) => {
    const at = segment.indexOf('@');
    return { sourceNodeId: segment.slice(0, at), definitionId: segment.slice(at + 1) };
  });
  const portalPath = portalSegments.map((segment) => {
    // portal:<sourceNodeId>:<overlayId>
    const [, portalNode, overlayId] = segment.split(':');
    return { sourceNodeId: portalNode ?? '', overlayId: overlayId ?? '' };
  });
  const repeatKeys = rest.filter(
    (segment) => !segment.includes('@') && !segment.startsWith('portal:'),
  );
  const firstInstance = instanceSegments[0] ?? '';
  const owningDefinitionId =
    firstInstance === '' ? undefined : (firstInstance.split('@')[1] ?? undefined);
  const nodes = (document.nodes ?? {}) as Record<string, UiNode>;
  return {
    sourceNodeId,
    instancePath,
    portalPath,
    owningDefinitionId,
    repeatKeys,
    node: documentId === String(document.id) ? nodes[sourceNodeId] : undefined,
  };
}

/** True when the canvas element for this occurrence is currently selected. */
export function isSelected(occurrenceKey: string, selected: string | undefined): boolean {
  return selected !== undefined && occurrenceKey === selected;
}
