import { describe, expect, it } from 'vitest';
import { compileGraph } from '../src/compile.js';
import type {
  ApplicationGraphDefinition,
  CapabilityDescriptor,
  CapabilityIndex,
  ContractEnvironment,
} from '../src/types.js';

/**
 * Activation identity: three distinct, layered versions.
 * - graphVersion: topology/declaration only
 * - capabilitySetVersion: effective capability/contract bindings
 * - activationVersion: hash over the two — the exact executable activation
 */

function descriptor(
  id: string,
  revision: string,
  effect: CapabilityDescriptor['effect'],
  inputContractId?: string,
  outputContractId?: string,
  inputRevision?: string,
  outputRevision?: string,
): CapabilityDescriptor {
  return {
    id,
    revision,
    effect,
    inputContractId,
    inputRevision: inputRevision ?? (inputContractId ? 'c1' : undefined),
    outputContractId,
    outputRevision: outputRevision ?? (outputContractId ? 'c1' : undefined),
  };
}

function index(entries: CapabilityDescriptor[]): CapabilityIndex {
  const map = new Map(entries.map((entry) => [entry.id, entry]));
  return { getCapabilityDescriptor: (id) => map.get(id) };
}

function contractsEnv(): ContractEnvironment {
  const contract = (id: string) => ({
    id,
    revision: 'c1',
    expected: id,
    parse: (input: unknown) => ({ ok: true as const, value: input }),
  });
  const map = new Map<string, ReturnType<typeof contract>>();
  return {
    has: (id) => map.has(id) || id.startsWith('c'),
    isCompatible: (from, to) => from === undefined || to === undefined || from === to,
    get: (id) => {
      if (!map.has(id)) {
        map.set(id, contract(id));
      }
      return map.get(id);
    },
  };
}

const GRAPH: ApplicationGraphDefinition = {
  id: 'g',
  entry: 'a',
  nodes: [
    { id: 'a', capability: 'cap-a' },
    { id: 'b', capability: 'cap-b' },
  ],
  edges: [{ from: 'a', to: 'b' }],
};

function compile(
  definition: ApplicationGraphDefinition,
  capabilities: CapabilityIndex,
): Extract<ReturnType<typeof compileGraph>, { ok: true }>['graph'] {
  const result = compileGraph({ definition, capabilities, contracts: contractsEnv() });
  if (!result.ok) {
    throw new Error(`fixture failed to compile: ${JSON.stringify(result.issues)}`);
  }
  return result.graph;
}

const BASE_CAPS = () => [
  descriptor('cap-a', '1', 'pure', 'In', 'Out'),
  descriptor('cap-b', '1', 'pure', 'Out'),
];

describe('activation identity', () => {
  it('same graph and same capability/contract revisions produce identical versions', () => {
    const a = compile(GRAPH, index(BASE_CAPS()));
    const b = compile(GRAPH, index(BASE_CAPS()));
    expect(a.graphVersion).toBe(b.graphVersion);
    expect(a.capabilitySetVersion).toBe(b.capabilitySetVersion);
    expect(a.activationVersion).toBe(b.activationVersion);
  });

  it('different topology changes graph and activation versions', () => {
    const a = compile(GRAPH, index(BASE_CAPS()));
    const differentTopology: ApplicationGraphDefinition = {
      ...GRAPH,
      nodes: [...GRAPH.nodes, { id: 'c', capability: 'cap-a' }],
      edges: [...GRAPH.edges, { from: 'b', to: 'c' }],
    };
    const b = compile(differentTopology, index(BASE_CAPS()));
    expect(a.graphVersion).not.toBe(b.graphVersion);
    // Same bindings are still required, so the capability set is unchanged.
    expect(a.capabilitySetVersion).toBe(b.capabilitySetVersion);
    expect(a.activationVersion).not.toBe(b.activationVersion);
  });

  it('different capability revision changes capability-set and activation versions', () => {
    const a = compile(GRAPH, index(BASE_CAPS()));
    const bumped = [
      descriptor('cap-a', '2', 'pure', 'In', 'Out'),
      descriptor('cap-b', '1', 'pure', 'Out'),
    ];
    const b = compile(GRAPH, index(bumped));
    expect(a.graphVersion).toBe(b.graphVersion); // topology unchanged
    expect(a.capabilitySetVersion).not.toBe(b.capabilitySetVersion);
    expect(a.activationVersion).not.toBe(b.activationVersion);
  });

  it('different contract revision changes capability-set and activation versions', () => {
    const a = compile(GRAPH, index(BASE_CAPS()));
    const bumpedContracts = [
      descriptor('cap-a', '1', 'pure', 'In', 'Out', 'c2', 'c1'),
      descriptor('cap-b', '1', 'pure', 'Out'),
    ];
    const b = compile(GRAPH, index(bumpedContracts));
    expect(a.graphVersion).toBe(b.graphVersion);
    expect(a.capabilitySetVersion).not.toBe(b.capabilitySetVersion);
    expect(a.activationVersion).not.toBe(b.activationVersion);
  });

  it('different effect class changes capability-set and activation versions', () => {
    const a = compile(GRAPH, index(BASE_CAPS()));
    const reclassified = [
      descriptor('cap-a', '1', 'read', 'In', 'Out'),
      descriptor('cap-b', '1', 'pure', 'Out'),
    ];
    const b = compile(GRAPH, index(reclassified));
    expect(a.graphVersion).toBe(b.graphVersion);
    expect(a.capabilitySetVersion).not.toBe(b.capabilitySetVersion);
    expect(a.activationVersion).not.toBe(b.activationVersion);
  });

  it('capability binding order does not affect versions', () => {
    const a = compile(GRAPH, index(BASE_CAPS()));
    const reordered = [
      descriptor('cap-b', '1', 'pure', 'Out'),
      descriptor('cap-a', '1', 'pure', 'In', 'Out'),
    ];
    const b = compile(GRAPH, index(reordered));
    expect(a.capabilitySetVersion).toBe(b.capabilitySetVersion);
    expect(a.activationVersion).toBe(b.activationVersion);
  });

  it('only capabilities required by the graph contribute to the capability set', () => {
    const required = compile(GRAPH, index(BASE_CAPS()));
    const withExtra = index([...BASE_CAPS(), descriptor('cap-unused', '9', 'irreversible')]);
    const b = compile(GRAPH, withExtra);
    expect(required.capabilitySetVersion).toBe(b.capabilitySetVersion);
    expect(required.activationVersion).toBe(b.activationVersion);
  });
});
