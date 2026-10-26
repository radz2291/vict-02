import type { Edge } from '@victframework/ui-flow-svelte';

export const structureTraceContext = Symbol('Studio Structure connection trace');
export type StructureTrace = Pick<Edge, 'id' | 'source' | 'target' | 'sourceHandle' | 'targetHandle'>;
export type StructureTraceContext = { current: () => StructureTrace | undefined };

/** Trace presentation only; never change source selection, scope or graph geometry. */
export function structureTrace(edges: readonly Edge[], id?: string): StructureTrace | undefined {
  // Coincident declarations retain their records but only their painted,
  // counted representative is interactive. Do not conflate different origins.
  return edges.find(edge => edge.id === id && edge.label);
}
