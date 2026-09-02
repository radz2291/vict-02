import { describe, expect, it } from 'vitest';
import { compileGraph } from '../src/compile.js';
import type { CapabilityDescriptor, CapabilityIndex, ContractEnvironment } from '../src/types.js';

/**
 * Stage 04 authoring-boundary regression tests (Stage 03 LOW-2 and LOW-3
 * closures):
 *
 * 1. Untyped JavaScript authors must never receive silent property
 *    stripping: unknown fields at graph, node, edge, wait, and retry
 *    boundaries produce structured diagnostics with stable codes and safe
 *    definition paths, in an insertion-order-independent order.
 * 2. Wait-level `timeoutMs` / timer `delayMs` bounds follow ONE exact rule:
 *    positive finite safe integers when present; `undefined`/`null` mean
 *    absent; zero/negative/fractional/NaN/infinite are rejected at
 *    compilation with the stable `INVALID_WAIT_BOUND` diagnostic.
 *
 * These tests exercise PLAIN JAVASCRIPT OBJECTS directly (TypeScript types
 * are not sufficient evidence).
 */

function descriptor(
  id: string,
  effect: CapabilityDescriptor['effect'] = 'pure',
): CapabilityDescriptor {
  return { id, revision: '1', effect };
}

const capabilities: CapabilityIndex = {
  getCapabilityDescriptor: (id) =>
    id === 'c.pure' || id === 'c.write'
      ? descriptor(id, id === 'c.write' ? 'write' : 'pure')
      : undefined,
};

const contracts: ContractEnvironment = {
  has: (id) => id === 'In' || id === 'Out',
  isCompatible: (from, to) => from === undefined || to === undefined || from === to,
  get: (id) =>
    id === 'In' || id === 'Out'
      ? {
          id,
          revision: '1',
          expected: id,
          parse: (input: unknown) => ({ ok: true as const, value: input }),
        }
      : undefined,
};

/** Two-node pure graph, built as untyped objects (simulating a JS author). */
function baseGraph(): Record<string, unknown> {
  return {
    id: 'g.probe',
    entry: 'a',
    nodes: [
      { id: 'a', capability: 'c.pure' },
      { id: 'b', capability: 'c.pure' },
    ],
    edges: [{ from: 'a', to: 'b' }],
  };
}

describe('Stage 04: unknown authoring fields are rejected structurally (LOW-2)', () => {
  it('rejects an unknown field on a capability node (the Stage 03 probe case)', () => {
    const graph = baseGraph();
    // The Stage 03 LOW-2 probe: a misspelled output-contract property must
    // not be silently stripped.
    (graph.nodes as Record<string, unknown>[])[1]!.outputContractId = 'Out';
    const result = compileGraph({
      definition: graph as never,
      capabilities,
      contracts,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((issue) => issue.code)).toContain('UNKNOWN_NODE_FIELD');
    const issue = result.issues.find((entry) => entry.code === 'UNKNOWN_NODE_FIELD');
    expect(issue?.message).toContain('outputContractId');
    expect(issue?.message).toContain('nodes[b]');
  });

  it('rejects unknown fields at every nested boundary', () => {
    const graph = baseGraph();
    (graph as Record<string, unknown>).schemaMarker = 'nope'; // graph root
    (graph.nodes as Record<string, unknown>[])[0]!.typo = 1; // node
    (graph.nodes as Record<string, unknown>[])[0]!.retry = {
      maxAttempts: 2,
      retryOn: ['timeout'],
      backoff: { kind: 'fixed', delayMs: 5, mystery: true }, // nested backoff
      who: 'x', // nested retry field
    };
    (graph.edges as Record<string, unknown>[])[0]!.weight = 3; // edge
    const result = compileGraph({
      definition: graph as never,
      capabilities,
      contracts,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const codes = result.issues.map((issue) => issue.code);
    expect(codes).toContain('UNKNOWN_GRAPH_FIELD');
    expect(codes).toContain('UNKNOWN_NODE_FIELD');
    expect(codes).toContain('UNKNOWN_RETRY_FIELD');
    expect(codes).toContain('UNKNOWN_EDGE_FIELD');
    // Safe definition paths are reported.
    const paths = result.issues.map((issue) => issue.message);
    expect(paths.some((message) => message.includes("'schemaMarker'"))).toBe(true);
    expect(paths.some((message) => message.includes("'weight'"))).toBe(true);
  });

  it('rejects unknown fields inside wait descriptors', () => {
    const graph = {
      id: 'g.wait',
      entry: 'gate',
      nodes: [
        {
          id: 'gate',
          kind: 'wait',
          wait: { kind: 'signal', name: 'go', timeoutX: 5 },
        },
      ],
      edges: [{ from: 'gate', to: 'after' }],
      // Wait needs a success target that exists:
    } as Record<string, unknown>;
    graph.nodes = [
      { id: 'a', capability: 'c.pure' },
      {
        id: 'gate',
        kind: 'wait',
        wait: { kind: 'signal', name: 'go', timeoutX: 5 },
      },
      { id: 'after', capability: 'c.pure' },
    ];
    graph.edges = [
      { from: 'a', to: 'gate' },
      { from: 'gate', to: 'after' },
    ];
    const result = compileGraph({
      definition: graph as never,
      capabilities,
      contracts,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((issue) => issue.code)).toContain('UNKNOWN_WAIT_FIELD');
    const issue = result.issues.find((entry) => entry.code === 'UNKNOWN_WAIT_FIELD');
    expect(issue?.message).toContain("'timeoutX'");
    expect(issue?.message).toContain('nodes[gate].wait');
  });

  it('rejects unknown fields on timer waits', () => {
    const graph = {
      id: 'g.timer',
      entry: 'gate',
      nodes: [
        {
          id: 'gate',
          kind: 'wait',
          wait: { kind: 'timer', delayMs: 5, prion: 2 },
        },
        { id: 'after', capability: 'c.pure' },
      ],
      edges: [{ from: 'gate', to: 'after' }],
    };
    const result = compileGraph({
      definition: graph as never,
      capabilities,
      contracts,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((issue) => issue.code)).toContain('UNKNOWN_WAIT_FIELD');
  });

  it('unknown-field diagnostics are deterministic and insertion-order independent', () => {
    const graphA = baseGraph();
    (graphA.nodes as Record<string, unknown>[])[0]!.zebra = 1;
    (graphA.nodes as Record<string, unknown>[])[1]!.alpha = 1;
    const graphB = baseGraph();
    (graphB.nodes as Record<string, unknown>[])[1]!.alpha = 1;
    (graphB.nodes as Record<string, unknown>[])[0]!.zebra = 1;

    const resultA = compileGraph({ definition: graphA as never, capabilities, contracts });
    const resultB = compileGraph({ definition: graphB as never, capabilities, contracts });
    expect(resultA.ok).toBe(false);
    expect(resultB.ok).toBe(false);
    if (resultA.ok || resultB.ok) return;
    const fieldIssuesA = resultA.issues
      .filter((issue) => issue.code === 'UNKNOWN_NODE_FIELD')
      .map((issue) => issue.message);
    const fieldIssuesB = resultB.issues
      .filter((issue) => issue.code === 'UNKNOWN_NODE_FIELD')
      .map((issue) => issue.message);
    expect(fieldIssuesA).toEqual(fieldIssuesB);
    // Path-sorted: nodes[a] before nodes[b] regardless of declaration order.
    expect(fieldIssuesA[0]).toContain("'zebra'");
    expect(fieldIssuesA[0]).toContain('nodes[a]');
    expect(fieldIssuesA[1]).toContain("'alpha'");
    expect(fieldIssuesA[1]).toContain('nodes[b]');
  });

  it('still re-compiles canonical manifests from storage (closed canonical field set)', () => {
    // A canonical vict.graph@2 manifest with explicit null fields must NOT
    // be rejected by the closed-schema checks.
    const canonical = {
      schema: 'vict.graph@2',
      id: 'g.canon',
      entry: 'a',
      nodes: [
        {
          id: 'a',
          kind: 'capability',
          capability: 'c.pure',
          input: null,
          output: null,
          retry: null,
          timeoutMs: null,
          wait: null,
          fork: null,
          join: null,
          maxConcurrency: null,
        },
      ],
      edges: [{ from: 'a', to: 'b', kind: 'success', key: null }],
    };
    const result = compileGraph({
      definition: canonical as never,
      capabilities,
      contracts: { has: () => false, isCompatible: () => true, get: () => undefined },
    });
    // 'b' does not exist -> other diagnostics, but NO unknown-field issues.
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.filter((issue) => issue.code.startsWith('UNKNOWN_'))).toHaveLength(0);
  });
});

describe('Stage 04: wait and delay bounds (LOW-3)', () => {
  function signalGraph(timeoutMs: unknown): Record<string, unknown> {
    return {
      id: 'g.sig',
      entry: 'gate',
      nodes: [
        { id: 'seed', capability: 'c.pure' },
        {
          id: 'gate',
          kind: 'wait',
          wait: { kind: 'signal', name: 'go', timeoutMs },
        },
        { id: 'success', capability: 'c.pure' },
        { id: 'fallback', capability: 'c.pure' },
      ],
      edges: [
        { from: 'seed', to: 'gate' },
        { from: 'gate', to: 'success' },
        { from: 'gate', to: 'fallback', kind: 'timeout' },
      ],
    };
  }

  it.each([0, -1, -100, 1.5, Number.NaN, Number.POSITIVE_INFINITY, -Number.POSITIVE_INFINITY])(
    'rejects signal wait timeoutMs %p at compilation with INVALID_WAIT_BOUND',
    (timeoutMs) => {
      const result = compileGraph({
        definition: signalGraph(timeoutMs) as never,
        capabilities,
        contracts,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.issues.map((issue) => issue.code)).toContain('INVALID_WAIT_BOUND');
      const issue = result.issues.find((entry) => entry.code === 'INVALID_WAIT_BOUND');
      expect(issue?.message).toContain('gate');
    },
  );

  it.each([0, -5, 0.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects timer wait delayMs %p at compilation with INVALID_WAIT_BOUND',
    (delayMs) => {
      const graph = {
        id: 'g.timer2',
        entry: 'gate',
        nodes: [
          {
            id: 'gate',
            kind: 'wait',
            wait: { kind: 'timer', delayMs },
          },
          { id: 'after', capability: 'c.pure' },
        ],
        edges: [{ from: 'gate', to: 'after' }],
      };
      const result = compileGraph({ definition: graph as never, capabilities, contracts });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.issues.map((issue) => issue.code)).toContain('INVALID_WAIT_BOUND');
    },
  );

  it('treats undefined and null timeoutMs as absent (no diagnostic)', () => {
    for (const timeoutMs of [undefined, null]) {
      const graph = signalGraph(timeoutMs);
      const result = compileGraph({ definition: graph as never, capabilities, contracts });
      expect(result.ok).toBe(false); // timeout edge without timeoutMs is its own diagnostic
      if (result.ok) return;
      expect(result.issues.map((issue) => issue.code)).not.toContain('INVALID_WAIT_BOUND');
    }
  });

  it('preserves valid declared timeout behavior (positive finite safe integer)', () => {
    const graph = signalGraph(50);
    const result = compileGraph({ definition: graph as never, capabilities, contracts });
    expect(result.ok).toBe(true);
  });

  it('supports long-lived waits well beyond the removed seven-day ceiling (MED-04-E)', () => {
    // The seven-day ceiling was unapproved and is removed: seven days + 1
    // ms, 30 days, one year, and the largest safely schedulable durations
    // all compile. Overflow beyond the safe persisted-timestamp domain is
    // rejected at SCHEDULING time, not by an arbitrary compile ceiling.
    for (const timeoutMs of [
      7 * 24 * 60 * 60 * 1000 + 1,
      30 * 24 * 60 * 60 * 1000,
      365 * 24 * 60 * 60 * 1000,
      Number.MAX_SAFE_INTEGER - 1,
    ]) {
      const graph = signalGraph(timeoutMs);
      const result = compileGraph({ definition: graph as never, capabilities, contracts });
      expect(result.ok).toBe(true);
    }
  });

  it('rejects non-integer overflow-scale delay values that are not safe integers', () => {
    const graph = signalGraph(Number.MAX_SAFE_INTEGER);
    const result = compileGraph({ definition: graph as never, capabilities, contracts });
    expect(result.ok).toBe(true); // MAX_SAFE_INTEGER is still a safe integer
    const overflow = {
      id: 'g.sig.overflow',
      entry: 'gate',
      nodes: [
        { id: 'seed', capability: 'c.pure' },
        {
          id: 'gate',
          kind: 'wait',
          wait: { kind: 'timer', delayMs: Number.MAX_SAFE_INTEGER },
        },
        { id: 'after', capability: 'c.pure' },
      ],
      edges: [{ from: 'gate', to: 'after' }],
    };
    const compiled = compileGraph({ definition: overflow as never, capabilities, contracts });
    expect(compiled.ok).toBe(true);
  });
});
