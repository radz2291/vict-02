import type { UiComponentTargetAttributes } from '@victframework/ui-svelte';

/** A canvas-local, disposable projection. Canonical declarations remain the source. */
export const FLOW_AUTHORING_CONTEXT = Symbol('vict.flow.authoring@1');
export interface FlowDeclaration {
  readonly kind: 'node' | 'edge';
  readonly id: string;
  readonly nodeId: string;
  readonly occurrenceKey: string;
  readonly target: UiComponentTargetAttributes;
  readonly label: string;
  readonly x?: number;
  readonly y?: number;
  readonly source?: string;
  readonly destination?: string;
}
export interface FlowAuthoringDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly nodeId: string;
  readonly occurrenceKey: string;
}
export interface FlowProjection {
  readonly nodes: readonly FlowDeclaration[];
  readonly edges: readonly FlowDeclaration[];
  readonly diagnostics: readonly FlowAuthoringDiagnostic[];
}
export interface FlowAuthoringContext {
  register(entry: FlowDeclaration): () => void;
}

/** Tokens belong to one mounted effect, not a graph id. An old cleanup cannot
 * delete a replacement and duplicates cannot silently overwrite one another.
 * One microtask batches sibling mount/cleanup before checking endpoints. */
export function createFlowAuthoringContext(
  publish: (value: FlowProjection) => void,
): FlowAuthoringContext {
  const entries = new Map<symbol, FlowDeclaration>();
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      publish(projectFlowDeclarations([...entries.values()]));
    });
  };
  return {
    register(entry) {
      const owner = Symbol(entry.occurrenceKey);
      entries.set(owner, entry);
      schedule();
      return () => {
        if (entries.delete(owner)) schedule();
      };
    },
  };
}

export function projectFlowDeclarations(entries: readonly FlowDeclaration[]): FlowProjection {
  const diagnostics: FlowAuthoringDiagnostic[] = [];
  const issue = (entry: FlowDeclaration, code: string, message: string) => {
    if (diagnostics.length < 20)
      diagnostics.push({ code, message, nodeId: entry.nodeId, occurrenceKey: entry.occurrenceKey });
  };
  const nodes = entries.filter((entry) => entry.kind === 'node');
  const edges = entries.filter((entry) => entry.kind === 'edge');
  for (const family of [nodes, edges]) {
    const counts = new Map<string, number>();
    for (const entry of family) counts.set(entry.id, (counts.get(entry.id) ?? 0) + 1);
    for (const entry of family) {
      if (!entry.id.trim())
        issue(entry, 'UI_FLOW_ID_REQUIRED', 'A nonempty evaluated graph id is required.');
      if (counts.get(entry.id)! > 1)
        issue(
          entry,
          'UI_FLOW_DUPLICATE_ID',
          `Evaluated ${entry.kind} id '${entry.id.slice(0, 80)}' is ambiguous in this canvas.`,
        );
      if (entry.kind === 'node' && (!Number.isFinite(entry.x) || !Number.isFinite(entry.y)))
        issue(entry, 'UI_FLOW_POSITION_INVALID', 'Node coordinates must be finite numbers.');
    }
  }
  const nodeCounts = new Map<string, number>();
  for (const entry of nodes) nodeCounts.set(entry.id, (nodeCounts.get(entry.id) ?? 0) + 1);
  for (const entry of edges) {
    if (nodeCounts.get(entry.source ?? '') !== 1 || nodeCounts.get(entry.destination ?? '') !== 1)
      issue(
        entry,
        'UI_FLOW_ENDPOINT_UNAVAILABLE',
        'Each evaluated edge endpoint must identify exactly one node in this canvas.',
      );
  }
  // Refuse the ambiguous presentation as a whole; never choose a first match.
  return diagnostics.length ? { nodes: [], edges: [], diagnostics } : { nodes, edges, diagnostics };
}
