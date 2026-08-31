import { canonicalSemanticForm, computeGraphVersion } from './canonical.js';
import type {
  ApplicationGraphDefinition,
  CompiledGraph,
  CompiledNode,
  GraphEdgeDefinition,
  GraphNodeDefinition,
} from './types.js';

export interface UnsafeGraphSpec {
  readonly id: string;
  readonly entry: string;
  readonly nodes: readonly GraphNodeDefinition[];
  readonly edges: readonly GraphEdgeDefinition[];
}

/**
 * Build a compiled graph without validation. FOR SAFETY TESTS AND INTERNAL
 * TOOLING ONLY — this exists so mandatory tests can prove that the executor's
 * runaway protection terminates even on a cyclic graph that the compiler would
 * reject. Never use it to bypass compilation in product code.
 */
export function unsafeCompiledGraphForTesting(spec: UnsafeGraphSpec): CompiledGraph {
  const success: Record<string, string> = {};
  const error: Record<string, string> = {};
  for (const edge of spec.edges) {
    if ((edge.kind ?? 'success') === 'success') {
      success[edge.from] = edge.to;
    } else {
      error[edge.from] = edge.to;
    }
  }
  const frozenNodes: Record<string, CompiledNode> = {};
  for (const node of spec.nodes) {
    frozenNodes[node.id] = Object.freeze({
      id: node.id,
      capability: node.capability,
      inputContractId: node.input,
      outputContractId: node.output,
    });
  }
  const nodeIds = Object.freeze(spec.nodes.map((node) => node.id).sort());
  const definition: ApplicationGraphDefinition = Object.freeze({
    id: spec.id,
    entry: spec.entry,
    nodes: Object.freeze(spec.nodes.map((node) => Object.freeze({ ...node }))),
    edges: Object.freeze(spec.edges.map((edge) => Object.freeze({ ...edge }))),
  });
  const version = computeGraphVersion(definition);

  return Object.freeze({
    id: spec.id,
    version,
    entryNodeId: spec.entry,
    nodeCount: nodeIds.length,
    nodeIds,
    getNode: (nodeId: string) => frozenNodes[nodeId],
    successTargetOf: (nodeId: string) => success[nodeId],
    errorTargetOf: (nodeId: string) => error[nodeId],
    toDefinition: () => canonicalSemanticForm(definition) as unknown as ApplicationGraphDefinition,
  });
}
