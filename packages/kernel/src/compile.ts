import {
  canonicalSemanticForm,
  computeActivationVersion,
  computeCapabilitySetVersion,
  computeGraphVersion,
} from './canonical.js';
import type { CapabilityBindingFingerprint } from './canonical.js';
import type {
  ApplicationGraphDefinition,
  CapabilityIndex,
  CompiledGraph,
  CompiledNode,
  CompileResult,
  ContractEnvironment,
  GraphEdgeDefinition,
  GraphIssue,
} from './types.js';

export interface CompileGraphInput {
  readonly definition: ApplicationGraphDefinition;
  /** Capability knowledge; unknown capability ids fail compilation. */
  readonly capabilities: CapabilityIndex;
  /** Contract knowledge; unknown referenced contract ids and statically incompatible adjacent contracts fail compilation. */
  readonly contracts: ContractEnvironment;
}

interface Adjacency {
  readonly success: Readonly<Record<string, string>>;
  readonly error: Readonly<Record<string, string>>;
}

/**
 * Compile an application graph definition into an immutable compiled graph,
 * or return a structured rejection. Compilation never throws for invalid
 * definitions and never has side effects.
 *
 * Validation rules (Night 01):
 * - non-empty graph id, node ids, capability references
 * - exactly one entry, and it must reference an existing node
 * - unique node ids
 * - edges reference existing nodes; no duplicate semantically identical edges
 * - at most one outgoing success edge and one outgoing error edge per node
 * - capability ids must be known at compile time
 * - node contract overrides must reference registered contracts
 * - adjacent contracts must be compatible where statically determinable
 *   (success edges only; error edges carry the universal error signal)
 * - no cycles in the combined success/error adjacency (sequential Night 01
 *   semantics cannot bound them)
 */
export function compileGraph(input: CompileGraphInput): CompileResult {
  const { definition, capabilities, contracts } = input;
  const issues: GraphIssue[] = [];

  if (definition.id.length === 0) {
    issues.push({
      code: 'EMPTY_GRAPH_ID',
      message: 'Graph id must be a non-empty string.',
    });
  }

  // Nodes: uniqueness, empty ids, empty capability references.
  const nodesById = new Map<string, CompiledNode>();
  for (const node of definition.nodes) {
    if (node.id.length === 0) {
      issues.push({ code: 'EMPTY_NODE_ID', message: 'Node ids must be non-empty strings.' });
      continue;
    }
    if (nodesById.has(node.id)) {
      issues.push({
        code: 'DUPLICATE_NODE',
        message: `Node id '${node.id}' is defined more than once.`,
        nodeIds: [node.id],
      });
      continue;
    }
    if (node.capability.length === 0) {
      issues.push({
        code: 'EMPTY_CAPABILITY_REFERENCE',
        message: `Node '${node.id}' must reference a capability.`,
        nodeIds: [node.id],
      });
      continue;
    }
    nodesById.set(node.id, {
      id: node.id,
      capability: node.capability,
      inputContractId: node.input,
      outputContractId: node.output,
    });
  }

  // Entry.
  if (!nodesById.has(definition.entry)) {
    issues.push({
      code: 'MISSING_ENTRY_NODE',
      message: `Entry '${definition.entry}' does not reference an existing node.`,
      nodeIds: [definition.entry],
    });
  }

  // Edges: unknown endpoints, duplicates, fan-out limits.
  const seenEdges = new Set<string>();
  const successTargets = new Map<string, string[]>();
  const errorTargets = new Map<string, string[]>();
  const validEdges: GraphEdgeDefinition[] = [];

  for (const edge of definition.edges) {
    const kind = edge.kind ?? 'success';
    const missing = [edge.from, edge.to].filter((id) => !nodesById.has(id));
    if (missing.length > 0) {
      issues.push({
        code: 'EDGE_REFERENCES_UNKNOWN_NODE',
        message: `Edge '${edge.from}' -> '${edge.to}' (${kind}) references unknown node(s): ${missing.join(', ')}.`,
        nodeIds: missing,
        edge: { from: edge.from, to: edge.to, kind },
      });
      continue;
    }
    const edgeKey = `${edge.from}|${edge.to}|${kind}`;
    if (seenEdges.has(edgeKey)) {
      issues.push({
        code: 'DUPLICATE_EDGE',
        message: `Duplicate ${kind} edge '${edge.from}' -> '${edge.to}'.`,
        edge: { from: edge.from, to: edge.to, kind },
      });
      continue;
    }
    seenEdges.add(edgeKey);
    validEdges.push(edge);
    const targets = kind === 'success' ? successTargets : errorTargets;
    const list = targets.get(edge.from) ?? [];
    list.push(edge.to);
    targets.set(edge.from, list);
  }

  for (const [from, targets] of successTargets) {
    if (targets.length > 1) {
      issues.push({
        code: 'MULTIPLE_SUCCESS_EDGES',
        message: `Node '${from}' has ${targets.length} outgoing success edges; at most one is allowed.`,
        nodeIds: [from, ...targets],
      });
    }
  }
  for (const [from, targets] of errorTargets) {
    if (targets.length > 1) {
      issues.push({
        code: 'MULTIPLE_ERROR_EDGES',
        message: `Node '${from}' has ${targets.length} outgoing error edges; at most one is allowed.`,
        nodeIds: [from, ...targets],
      });
    }
  }

  // Capabilities must be known at compile time; resolve effective contract ids.
  const effectiveNodes = new Map<string, CompiledNode>();
  for (const [id, node] of nodesById) {
    const descriptor = capabilities.getCapabilityDescriptor(node.capability);
    if (!descriptor) {
      issues.push({
        code: 'UNKNOWN_CAPABILITY',
        message: `Node '${id}' references unknown capability '${node.capability}'.`,
        nodeIds: [id],
      });
      continue;
    }
    const inputContractId = node.inputContractId ?? descriptor.inputContractId;
    const outputContractId = node.outputContractId ?? descriptor.outputContractId;
    effectiveNodes.set(id, { id, capability: node.capability, inputContractId, outputContractId });

    // Node-level contract overrides must resolve to registered contracts.
    for (const [role, contractId] of [
      ['input', node.inputContractId],
      ['output', node.outputContractId],
    ] as const) {
      if (contractId !== undefined && contracts.get(contractId) === undefined) {
        issues.push({
          code: 'MISSING_CONTRACT',
          message: `Node '${id}' overrides its ${role} contract with unknown contract '${contractId}'.`,
          nodeIds: [id],
          contractIds: [contractId],
        });
      }
    }
  }

  // Static adjacent-contract compatibility on success edges.
  for (const edge of validEdges) {
    if ((edge.kind ?? 'success') !== 'success') {
      continue; // Error edges carry the universal error signal; runtime validation applies.
    }
    const fromNode = effectiveNodes.get(edge.from);
    const toNode = effectiveNodes.get(edge.to);
    const fromContract = fromNode?.outputContractId;
    const toContract = toNode?.inputContractId;
    if (fromContract !== undefined && toContract !== undefined) {
      if (!contracts.isCompatible(fromContract, toContract)) {
        issues.push({
          code: 'CONTRACT_INCOMPATIBLE',
          message: `Success edge '${edge.from}' -> '${edge.to}' connects incompatible contracts: output '${fromContract}' is not compatible with input '${toContract}'.`,
          edge: { from: edge.from, to: edge.to, kind: 'success' },
          contractIds: [fromContract, toContract],
        });
      }
    }
  }

  // Cycles in the combined adjacency. Cycle detection is independent of the
  // capability/contract diagnostics above: it only needs structurally valid
  // edges, so it runs even when other issues were found. Findings are
  // appended in the same deterministic position (after compatibility
  // checks), so the diagnostics for a given definition are always in a
  // stable order.
  const cycle = findCycle(effectiveNodes, successTargets, errorTargets);
  if (cycle) {
    issues.push({
      code: 'UNSUPPORTED_CYCLE',
      message: `Graph contains an unsupported cycle: ${cycle.join(' -> ')}.`,
      nodeIds: cycle,
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const success: Record<string, string> = {};
  for (const [from, targets] of successTargets) {
    const target = targets[0];
    if (target !== undefined) {
      success[from] = target;
    }
  }
  const error: Record<string, string> = {};
  for (const [from, targets] of errorTargets) {
    const target = targets[0];
    if (target !== undefined) {
      error[from] = target;
    }
  }
  const adjacency: Adjacency = { success, error };
  const frozenNodes: Record<string, CompiledNode> = {};
  for (const [id, node] of effectiveNodes) {
    frozenNodes[id] = Object.freeze({ ...node });
  }
  const nodeIds = Object.freeze([...effectiveNodes.keys()].sort());
  const graphVersion = computeGraphVersion(definition);

  // Effective capability/contract bindings: capability id + revision + effect
  // class + effective input/output contract id + revision, per resolved node.
  // Contract override revisions are resolved from the contract environment.
  const bindings: CapabilityBindingFingerprint[] = [];
  for (const rawNode of definition.nodes) {
    const node = effectiveNodes.get(rawNode.id);
    if (!node) {
      continue; // already rejected above with a structured issue
    }
    const descriptor = capabilities.getCapabilityDescriptor(node.capability);
    if (!descriptor) {
      continue; // already rejected above with a structured issue
    }
    const inputId = node.inputContractId;
    const outputId = node.outputContractId;
    const inputRevision =
      inputId === undefined
        ? undefined
        : rawNode.input !== undefined
          ? contracts.get(inputId)?.revision
          : descriptor.inputRevision;
    const outputRevision =
      outputId === undefined
        ? undefined
        : rawNode.output !== undefined
          ? contracts.get(outputId)?.revision
          : descriptor.outputRevision;
    bindings.push({
      capability: node.capability,
      revision: descriptor.revision,
      effect: descriptor.effect,
      input: inputId === undefined ? null : { id: inputId, revision: inputRevision ?? 'unknown' },
      output:
        outputId === undefined ? null : { id: outputId, revision: outputRevision ?? 'unknown' },
    });
  }
  const capabilitySetVersion = computeCapabilitySetVersion(bindings);
  const activationVersion = computeActivationVersion(graphVersion, capabilitySetVersion);

  const graph: CompiledGraph = Object.freeze({
    id: definition.id,
    graphVersion,
    capabilitySetVersion,
    activationVersion,
    entryNodeId: definition.entry,
    nodeCount: nodeIds.length,
    nodeIds,
    getNode(nodeId: string): CompiledNode | undefined {
      return frozenNodes[nodeId];
    },
    successTargetOf(nodeId: string): string | undefined {
      return adjacency.success[nodeId];
    },
    errorTargetOf(nodeId: string): string | undefined {
      return adjacency.error[nodeId];
    },
    toDefinition(): ApplicationGraphDefinition {
      return deepFreeze(canonicalSemanticForm(definition)) as unknown as ApplicationGraphDefinition;
    },
  });

  return { ok: true, graph };
}

/** Depth-first cycle detection over the combined success/error adjacency. Returns the cycle path or undefined. */
function findCycle(
  nodes: Map<string, CompiledNode>,
  success: Map<string, string[]>,
  error: Map<string, string[]>,
): string[] | undefined {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const id of nodes.keys()) {
    color.set(id, WHITE);
  }
  const stack: string[] = [];

  const visit = (id: string): string[] | undefined => {
    color.set(id, GRAY);
    stack.push(id);
    const targets = [...(success.get(id) ?? []), ...(error.get(id) ?? [])];
    for (const target of targets) {
      const state = color.get(target) ?? WHITE;
      if (state === GRAY) {
        const start = stack.indexOf(target);
        return [...stack.slice(start), target];
      }
      if (state === WHITE) {
        const found = visit(target);
        if (found) {
          return found;
        }
      }
    }
    stack.pop();
    color.set(id, BLACK);
    return undefined;
  };

  for (const id of nodes.keys()) {
    if ((color.get(id) ?? WHITE) === WHITE) {
      const found = visit(id);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}
