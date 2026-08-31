import { describe, expect, it } from 'vitest';
import { compileGraph } from '../src/compile.js';
import { computeGraphVersion } from '../src/canonical.js';
import type {
  ApplicationGraphDefinition,
  CapabilityDescriptor,
  CapabilityIndex,
  ContractEnvironment,
  GraphIssue,
  GraphIssueCode,
} from '../src/types.js';

function descriptor(
  id: string,
  effect: CapabilityDescriptor['effect'] = 'pure',
  inputContractId?: string,
  outputContractId?: string,
  revision = '1',
  inputRevision?: string,
  outputRevision?: string,
): CapabilityDescriptor {
  return {
    id,
    revision,
    effect,
    inputContractId,
    inputRevision: inputRevision ?? (inputContractId ? '1' : undefined),
    outputContractId,
    outputRevision: outputRevision ?? (outputContractId ? '1' : undefined),
  };
}

function capabilityIndex(entries: CapabilityDescriptor[]): CapabilityIndex {
  const map = new Map(entries.map((entry) => [entry.id, entry]));
  return { getCapabilityDescriptor: (id) => map.get(id) };
}

/** Identity-based static compatibility: unknown sides are assumed compatible. */
const registeredContractIds = new Set(['In', 'Out', 'InB', 'OutA', 'vict.error-signal']);
const contractObjects = new Map(
  [...registeredContractIds].map((id) => [
    id,
    {
      id,
      revision: '1',
      expected: id,
      parse: (input: unknown) => ({ ok: true as const, value: input }),
    },
  ]),
);
const contracts: ContractEnvironment = {
  has: (id) => registeredContractIds.has(id),
  isCompatible: (from, to) => from === undefined || to === undefined || from === to,
  get: (id) => contractObjects.get(id),
};

/** Permissive knowledge: used by tests that exercise other rules (e.g. cycles). */
const permissiveContracts: ContractEnvironment = {
  has: () => true,
  isCompatible: () => true,
  get: () => undefined,
};

function expectSingleIssue(issues: readonly GraphIssue[], code: GraphIssueCode): GraphIssue {
  const matching = issues.filter((issue) => issue.code === code);
  expect(matching.length, `expected issue ${code}, got: ${JSON.stringify(issues)}`).toBe(1);
  return matching[0] as GraphIssue;
}

const VALID_DEF: ApplicationGraphDefinition = {
  id: 'g1',
  entry: 'a',
  nodes: [
    { id: 'a', capability: 'cap-a' },
    { id: 'b', capability: 'cap-b' },
    { id: 'c', capability: 'cap-c' },
  ],
  edges: [
    { from: 'a', to: 'b' },
    { from: 'b', to: 'c' },
  ],
};

const VALID_CAPS = capabilityIndex([
  descriptor('cap-a', 'pure', 'In', 'Out'),
  descriptor('cap-b', 'pure', 'Out', 'Out'),
  descriptor('cap-c', 'pure', 'Out'),
]);

describe('compileGraph', () => {
  it('compiles a valid graph into an immutable compiled graph', () => {
    const result = compileGraph({ definition: VALID_DEF, capabilities: VALID_CAPS, contracts });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const graph = result.graph;
    expect(graph.id).toBe('g1');
    expect(graph.entryNodeId).toBe('a');
    expect(graph.nodeCount).toBe(3);
    expect(graph.nodeIds).toEqual(['a', 'b', 'c']);
    expect(graph.graphVersion).toMatch(/^v1_[0-9a-f]{64}$/);
    expect(graph.capabilitySetVersion).toMatch(/^v1_[0-9a-f]{64}$/);
    expect(graph.activationVersion).toMatch(/^v1_[0-9a-f]{64}$/);
    expect(graph.successTargetOf('a')).toBe('b');
    expect(graph.successTargetOf('c')).toBeUndefined();
    expect(graph.errorTargetOf('a')).toBeUndefined();
    // Immutability is enforced structurally.
    expect(Object.isFrozen(graph)).toBe(true);
    expect(Object.isFrozen(graph.nodeIds)).toBe(true);
    expect(Object.isFrozen(graph.getNode('a'))).toBe(true);
  });

  it('produces a deterministic version across semantically identical definitions', () => {
    const defA: ApplicationGraphDefinition = {
      id: 'g',
      entry: 'x',
      nodes: [
        { id: 'x', capability: 'cap-a' },
        { id: 'y', capability: 'cap-b', output: 'Out' },
      ],
      edges: [{ from: 'x', to: 'y' }],
    };
    // Same semantics: node order reversed, edge listed differently, key order shuffled via JSON round-trip.
    const shuffled = JSON.parse(
      JSON.stringify({
        edges: [{ to: 'y', from: 'x' }],
        nodes: [
          { output: 'Out', capability: 'cap-b', id: 'y' },
          { id: 'x', capability: 'cap-a' },
        ],
        entry: 'x',
        id: 'g',
      }),
    ) as ApplicationGraphDefinition;
    expect(computeGraphVersion(defA)).toBe(computeGraphVersion(shuffled));
    expect(computeGraphVersion(defA)).toMatch(/^v1_[0-9a-f]{64}$/);

    const resultA = compileGraph({ definition: defA, capabilities: VALID_CAPS, contracts });
    const resultB = compileGraph({ definition: shuffled, capabilities: VALID_CAPS, contracts });
    if (resultA.ok && resultB.ok) {
      expect(resultA.graph.graphVersion).toBe(resultB.graph.graphVersion);
      expect(resultA.graph.capabilitySetVersion).toBe(resultB.graph.capabilitySetVersion);
      expect(resultA.graph.activationVersion).toBe(resultB.graph.activationVersion);
    } else {
      expect.unreachable('valid graphs should compile');
    }
  });

  it('changes the version when semantics change', () => {
    const defA: ApplicationGraphDefinition = VALID_DEF;
    const defB: ApplicationGraphDefinition = { ...VALID_DEF, id: 'g2' };
    expect(computeGraphVersion(defA)).not.toBe(computeGraphVersion(defB));
  });

  it('accepts node contract overrides that resolve to registered contracts', () => {
    const def: ApplicationGraphDefinition = {
      id: 'g',
      entry: 'a',
      nodes: [{ id: 'a', capability: 'cap-a', input: 'In' }],
      edges: [],
    };
    const result = compileGraph({ definition: def, capabilities: VALID_CAPS, contracts });
    expect(result.ok).toBe(true);
  });

  it('rejects duplicate node ids', () => {
    const def: ApplicationGraphDefinition = {
      id: 'g',
      entry: 'a',
      nodes: [
        { id: 'a', capability: 'cap-a' },
        { id: 'a', capability: 'cap-b' },
      ],
      edges: [],
    };
    const result = compileGraph({ definition: def, capabilities: VALID_CAPS, contracts });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expectSingleIssue(result.issues, 'DUPLICATE_NODE');
    }
  });

  it('rejects a missing entry node', () => {
    const def: ApplicationGraphDefinition = {
      id: 'g',
      entry: 'nope',
      nodes: [{ id: 'a', capability: 'cap-a' }],
      edges: [],
    };
    const result = compileGraph({ definition: def, capabilities: VALID_CAPS, contracts });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expectSingleIssue(result.issues, 'MISSING_ENTRY_NODE');
    }
  });

  it('rejects an empty graph id', () => {
    const def: ApplicationGraphDefinition = { ...VALID_DEF, id: '' };
    const result = compileGraph({ definition: def, capabilities: VALID_CAPS, contracts });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expectSingleIssue(result.issues, 'EMPTY_GRAPH_ID');
    }
  });

  it('rejects unknown capabilities at compile time', () => {
    const def: ApplicationGraphDefinition = {
      id: 'g',
      entry: 'a',
      nodes: [{ id: 'a', capability: 'ghost' }],
      edges: [],
    };
    const result = compileGraph({ definition: def, capabilities: VALID_CAPS, contracts });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const issue = expectSingleIssue(result.issues, 'UNKNOWN_CAPABILITY');
      expect(issue.nodeIds).toEqual(['a']);
    }
  });

  it('rejects edges referencing unknown nodes', () => {
    const def: ApplicationGraphDefinition = {
      id: 'g',
      entry: 'a',
      nodes: [{ id: 'a', capability: 'cap-a' }],
      edges: [{ from: 'a', to: 'ghost' }],
    };
    const result = compileGraph({ definition: def, capabilities: VALID_CAPS, contracts });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expectSingleIssue(result.issues, 'EDGE_REFERENCES_UNKNOWN_NODE');
    }
  });

  it('rejects duplicate edges', () => {
    const def: ApplicationGraphDefinition = {
      id: 'g',
      entry: 'a',
      nodes: [
        { id: 'a', capability: 'cap-a' },
        { id: 'b', capability: 'cap-b' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'a', to: 'b', kind: 'success' },
      ],
    };
    const result = compileGraph({ definition: def, capabilities: VALID_CAPS, contracts });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expectSingleIssue(result.issues, 'DUPLICATE_EDGE');
    }
  });

  it('rejects multiple outgoing success edges from one node', () => {
    const def: ApplicationGraphDefinition = {
      id: 'g',
      entry: 'a',
      nodes: [
        { id: 'a', capability: 'cap-a' },
        { id: 'b', capability: 'cap-b' },
        { id: 'c', capability: 'cap-c' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'a', to: 'c' },
      ],
    };
    const result = compileGraph({ definition: def, capabilities: VALID_CAPS, contracts });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expectSingleIssue(result.issues, 'MULTIPLE_SUCCESS_EDGES');
    }
  });

  it('rejects multiple outgoing error edges from one node', () => {
    const def: ApplicationGraphDefinition = {
      id: 'g',
      entry: 'a',
      nodes: [
        { id: 'a', capability: 'cap-a' },
        { id: 'b', capability: 'cap-b' },
        { id: 'c', capability: 'cap-c' },
      ],
      edges: [
        { from: 'a', to: 'b', kind: 'error' },
        { from: 'a', to: 'c', kind: 'error' },
      ],
    };
    const result = compileGraph({ definition: def, capabilities: VALID_CAPS, contracts });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expectSingleIssue(result.issues, 'MULTIPLE_ERROR_EDGES');
    }
  });

  it('rejects unsupported cycles', () => {
    const def: ApplicationGraphDefinition = {
      id: 'g',
      entry: 'a',
      nodes: [
        { id: 'a', capability: 'cap-a' },
        { id: 'b', capability: 'cap-b' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' },
      ],
    };
    const result = compileGraph({
      definition: def,
      capabilities: VALID_CAPS,
      contracts: permissiveContracts,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const issue = expectSingleIssue(result.issues, 'UNSUPPORTED_CYCLE');
      expect(issue.nodeIds).toBeDefined();
    }
  });

  it('rejects cycles that include error edges', () => {
    const def: ApplicationGraphDefinition = {
      id: 'g',
      entry: 'a',
      nodes: [
        { id: 'a', capability: 'cap-a' },
        { id: 'b', capability: 'cap-b' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a', kind: 'error' },
      ],
    };
    const result = compileGraph({
      definition: def,
      capabilities: VALID_CAPS,
      contracts: permissiveContracts,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expectSingleIssue(result.issues, 'UNSUPPORTED_CYCLE');
    }
  });

  it('rejects statically knowable adjacent contract incompatibility', () => {
    const def: ApplicationGraphDefinition = {
      id: 'g',
      entry: 'a',
      nodes: [
        { id: 'a', capability: 'cap-a' }, // output contract 'Out'
        { id: 'b', capability: 'cap-b-inb' }, // input contract 'InB'
      ],
      edges: [{ from: 'a', to: 'b' }],
    };
    const caps = capabilityIndex([
      descriptor('cap-a', 'pure', 'In', 'Out'),
      descriptor('cap-b-inb', 'pure', 'InB'),
    ]);
    const result = compileGraph({ definition: def, capabilities: caps, contracts });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const issue = expectSingleIssue(result.issues, 'CONTRACT_INCOMPATIBLE');
      expect(issue.contractIds).toEqual(['Out', 'InB']);
      expect(issue.edge).toEqual({ from: 'a', to: 'b', kind: 'success' });
    }
  });

  it('accepts compatible adjacent contracts', () => {
    const result = compileGraph({ definition: VALID_DEF, capabilities: VALID_CAPS, contracts });
    expect(result.ok).toBe(true);
  });

  it('rejects node contract overrides referencing unknown contracts', () => {
    const def: ApplicationGraphDefinition = {
      id: 'g',
      entry: 'a',
      nodes: [{ id: 'a', capability: 'cap-a', input: 'ghost-contract' }],
      edges: [],
    };
    const result = compileGraph({ definition: def, capabilities: VALID_CAPS, contracts });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const issue = expectSingleIssue(result.issues, 'MISSING_CONTRACT');
      expect(issue.contractIds).toEqual(['ghost-contract']);
    }
  });
});
