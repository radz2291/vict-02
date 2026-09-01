import {
  canonicalSemanticForm,
  canonicalSemanticFormV2,
  computeActivationVersion,
  computeCapabilitySetVersion,
  computeGraphVersion,
  declaresControlSemantics,
} from './canonical.js';
import type {
  ApplicationGraphDefinition,
  CompiledGraph,
  CompiledNode,
  EffectClass,
  GraphEdgeDefinition,
  GraphNodeDefinition,
} from './types.js';

export interface UnsafeGraphSpec {
  readonly id: string;
  readonly entry: string;
  readonly nodes: readonly GraphNodeDefinition[];
  readonly edges: readonly GraphEdgeDefinition[];
  /**
   * Capability bindings used for capability-set/activation identity of the
   * unsafe graph. Defaults to a stable placeholder revision for each declared
   * capability — fine for safety tests that exercise execution bounds, but do
   * not treat versions from this factory as meaningful identity.
   */
  readonly capabilities?: readonly {
    readonly id: string;
    readonly revision: string;
    readonly effect: EffectClass;
  }[];
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
  for (const rawNode of spec.nodes) {
    const node = rawNode as GraphNodeDefinition & { kind?: CompiledNode['kind'] };
    frozenNodes[node.id] = Object.freeze({
      id: node.id,
      kind: node.kind ?? 'capability',
      capability: (node as { capability?: string }).capability ?? '',
      inputContractId: (node as { input?: string }).input,
      outputContractId: (node as { output?: string }).output,
    });
  }
  const nodeIds = Object.freeze(spec.nodes.map((node) => node.id).sort());
  const definition: ApplicationGraphDefinition = Object.freeze({
    id: spec.id,
    entry: spec.entry,
    nodes: Object.freeze(spec.nodes.map((node) => Object.freeze({ ...node }))),
    edges: Object.freeze(spec.edges.map((edge) => Object.freeze({ ...edge }))),
  });
  const graphVersion = computeGraphVersion(definition);
  const declaredCapabilities =
    spec.capabilities ??
    [
      ...new Set(
        spec.nodes
          .map((node) => (node as { capability?: string }).capability)
          .filter((capability): capability is string => capability !== undefined),
      ),
    ].map((capabilityId) => ({
      id: capabilityId,
      revision: 'test-unversioned',
      effect: 'pure' as EffectClass,
    }));
  const capabilitySetVersion = computeCapabilitySetVersion(
    declaredCapabilities.map((capability) => ({
      capability: capability.id,
      revision: capability.revision,
      effect: capability.effect,
      input: null,
      output: null,
    })),
  );
  const activationVersion = computeActivationVersion(
    graphVersion,
    capabilitySetVersion,
    declaresControlSemantics(definition) ? 'vict.activation@2' : 'vict.activation@1',
  );

  return Object.freeze({
    id: spec.id,
    graphVersion,
    capabilitySetVersion,
    activationVersion,
    entryNodeId: spec.entry,
    nodeCount: nodeIds.length,
    nodeIds,
    hasControlNodes: declaresControlSemantics(definition),
    getNode: (nodeId: string) => frozenNodes[nodeId],
    successTargetOf: (nodeId: string) => success[nodeId],
    errorTargetOf: (nodeId: string) => error[nodeId],
    routeTargetsOf: () => Object.freeze({}),
    branchTargetsOf: () => Object.freeze({}),
    branchKeysOf: () => Object.freeze([]),
    timeoutTargetOf: () => undefined,
    joinOfFork: () => undefined,
    forkOfJoin: () => undefined,
    toDefinition: () =>
      declaresControlSemantics(definition)
        ? (canonicalSemanticFormV2(definition) as unknown as ApplicationGraphDefinition)
        : (canonicalSemanticForm(definition) as unknown as ApplicationGraphDefinition),
  });
}