import { describe, expect, it } from 'vitest';
import {
  compileGraph,
  computeGraphVersion,
  canonicalSemanticFormV2,
  canonicalJson,
  backoffDelayMs,
  isRetryable,
  resolveDecisionRoute,
  canonicalJoinOutput,
  deriveRunStatus,
  RETRY_MAX_ATTEMPTS_LIMIT,
} from '@vict/kernel';
import type { ApplicationGraphDefinition, CapabilityIndex, ContractEnvironment } from '@vict/kernel';

/** Stable capability/contract knowledge for compiler tests. */
const capabilities: CapabilityIndex = {
  getCapabilityDescriptor: (capabilityId: string) => {
    const table: Record<string, { effect: string; idempotency?: 'keyed' }> = {
      'pure': { effect: 'pure' },
      'reader': { effect: 'read' },
      'writer': { effect: 'write' },
      'keyed-writer': { effect: 'write', idempotency: 'keyed' },
      'irreversible': { effect: 'irreversible' },
    };
    const entry = table[capabilityId];
    if (!entry) {
      return undefined;
    }
    return {
      id: capabilityId,
      revision: '1',
      effect: entry.effect as never,
      ...(entry.idempotency !== undefined ? { idempotency: entry.idempotency } : {}),
    };
  },
};

const contracts = {
  has: (id: string) => id === 's1' || id === 's2',
  isCompatible: (from: string | undefined, to: string | undefined) =>
    from === undefined || to === undefined || from === to,
  get: (id: string) =>
    id === 's1' || id === 's2'
      ? {
          id,
          revision: '1',
          expected: 'a string',
          parse: (input: unknown) =>
            typeof input === 'string'
              ? { ok: true as const, value: input, issues: [] }
              : { ok: false as const, issues: [] },
        }
      : undefined,
};

function compile(definition: ApplicationGraphDefinition) {
  return compileGraph({ definition, capabilities, contracts });
}

/** A two-branch fork/join control graph used across identity tests. */
function fanoutDefinition(): ApplicationGraphDefinition {
  return {
    id: 'identity-fanout',
    entry: 'd',
    nodes: [
      { id: 'd', kind: 'decision', capability: 'pure' },
      { id: 'f', kind: 'fork', join: 'j' },
      { id: 'a', capability: 'pure' },
      { id: 'b', capability: 'pure' },
      { id: 'j', kind: 'join', fork: 'f' },
      { id: 'w', kind: 'wait', wait: { kind: 'signal', name: 'go', timeoutMs: 100 } },
      { id: 'apply', capability: 'keyed-writer', retry: { maxAttempts: 2, retryOn: ['X'], backoff: { kind: 'fixed', delayMs: 5 } } },
      { id: 'timeout', capability: 'pure' },
    ],
    edges: [
      { from: 'd', to: 'f', kind: 'route', key: 'go' },
      { from: 'f', to: 'a', kind: 'branch', key: 'a' },
      { from: 'f', to: 'b', kind: 'branch', key: 'b' },
      { from: 'a', to: 'j' },
      { from: 'b', to: 'j' },
      { from: 'j', to: 'w' },
      { from: 'w', to: 'apply' },
      { from: 'w', to: 'timeout', kind: 'timeout' },
    ],
  };
}

describe('stage 03 compiler validation', () => {
  it('compiles a control graph and rejects structural violations in stable order', () => {
    const ok = compile(fanoutDefinition());
    expect(ok.ok).toBe(true);

    // Fork with fewer than two branches.
    const tooFew = compile({
      ...fanoutDefinition(),
      edges: [
        { from: 'd', to: 'f', kind: 'route', key: 'go' },
        { from: 'f', to: 'a', kind: 'branch', key: 'a' },
        { from: 'a', to: 'j' },
        { from: 'j', to: 'w' },
        { from: 'w', to: 'apply' },
        { from: 'w', to: 'timeout', kind: 'timeout' },
      ],
    });
    expect(tooFew.ok).toBe(false);
    if (!tooFew.ok) {
      expect(tooFew.issues.some((issue) => issue.code === 'FORK_TOO_FEW_BRANCHES')).toBe(true);
    }

    // Decision bound to a non-pure capability.
    const impure = compile({
      ...fanoutDefinition(),
      nodes: fanoutDefinition().nodes.map((node) =>
        node.id === 'd' ? { ...node, capability: 'reader' } : node,
      ),
    });
    expect(impure.ok).toBe(false);
    if (!impure.ok) {
      expect(impure.issues.some((issue) => issue.code === 'DECISION_NOT_PURE')).toBe(true);
    }

    // Write retry without a keyed-idempotency declaration.
    const unsafeWrite = compile({
      ...fanoutDefinition(),
      nodes: fanoutDefinition().nodes.map((node) =>
        node.id === 'apply' ? { ...node, capability: 'writer' } : node,
      ),
    });
    expect(unsafeWrite.ok).toBe(false);
    if (!unsafeWrite.ok) {
      expect(unsafeWrite.issues.some((issue) => issue.code === 'WRITE_RETRY_NOT_IDEMPOTENT')).toBe(true);
    }

    // Irreversible retry denied at compilation.
    const irreversible = compile({
      ...fanoutDefinition(),
      nodes: fanoutDefinition().nodes.map((node) =>
        node.id === 'apply' ? { ...node, capability: 'irreversible' } : node,
      ),
    });
    expect(irreversible.ok).toBe(false);
    if (!irreversible.ok) {
      expect(irreversible.issues.some((issue) => issue.code === 'IRREVERSIBLE_RETRY_DENIED')).toBe(true);
    }

    // Timeout edge without a declared signal timeout.
    const orphanTimeout = compile({
      ...fanoutDefinition(),
      nodes: fanoutDefinition().nodes.map((node) =>
        node.id === 'w'
          ? { ...node, wait: { kind: 'signal', name: 'go' } }
          : node,
      ),
    });
    expect(orphanTimeout.ok).toBe(false);
    if (!orphanTimeout.ok) {
      expect(orphanTimeout.issues.some((issue) => issue.code === 'TIMEOUT_EDGE_WITHOUT_SIGNAL_TIMEOUT')).toBe(true);
    }

    // Signal timeout without a timeout edge.
    const missingTimeoutEdge = compile({
      ...fanoutDefinition(),
      edges: fanoutDefinition().edges.filter((edge) => (edge as { kind?: string }).kind !== 'timeout'),
    });
    expect(missingTimeoutEdge.ok).toBe(false);
    if (!missingTimeoutEdge.ok) {
      expect(
        missingTimeoutEdge.issues.some((issue) => issue.code === 'SIGNAL_TIMEOUT_WITHOUT_TIMEOUT_EDGE'),
      ).toBe(true);
    }
    expect(RETRY_MAX_ATTEMPTS_LIMIT).toBeGreaterThan(1);
  });
});

describe('stage 03 canonical identity for control graphs', () => {
  it('reordered route/branch declarations retain identity; semantic changes do not', () => {
    const a = compile(fanoutDefinition());
    // Reorder nodes and edges: identical canonical form.
    const reordered: ApplicationGraphDefinition = {
      id: 'identity-fanout',
      entry: 'd',
      nodes: [
        { id: 'apply', capability: 'keyed-writer', retry: { maxAttempts: 2, retryOn: ['X'], backoff: { kind: 'fixed', delayMs: 5 } } },
        { id: 'w', kind: 'wait', wait: { kind: 'signal', name: 'go', timeoutMs: 100 } },
        { id: 'j', kind: 'join', fork: 'f' },
        { id: 'b', capability: 'pure' },
        { id: 'a', capability: 'pure' },
        { id: 'f', kind: 'fork', join: 'j' },
        { id: 'd', kind: 'decision', capability: 'pure' },
        { id: 'timeout', capability: 'pure' },
      ],
      edges: [
        { from: 'w', to: 'apply' },
        { from: 'w', to: 'timeout', kind: 'timeout' },
        { from: 'j', to: 'w' },
        { from: 'b', to: 'j' },
        { from: 'a', to: 'j' },
        { from: 'f', to: 'b', kind: 'branch', key: 'b' },
        { from: 'f', to: 'a', kind: 'branch', key: 'a' },
        { from: 'd', to: 'f', kind: 'route', key: 'go' },
      ],
    };
    const b = compile(reordered);
    expect(b.ok).toBe(true);
    expect(a.ok && b.ok && a.graph.graphVersion === b.graph.graphVersion).toBe(true);
    expect(a.ok && b.ok && a.graph.activationVersion === b.graph.activationVersion).toBe(true);

    // A changed route target changes the graph identity.
    const changedRoute = compile({
      ...fanoutDefinition(),
      edges: fanoutDefinition().edges.map((edge) =>
        edge.from === 'd' ? { ...edge, to: 'b' } : edge,
      ),
    });
    expect(changedRoute.ok).toBe(true);
    expect(a.ok && changedRoute.ok && changedRoute.graph.graphVersion !== a.graph.graphVersion).toBe(true);

    // A changed branch key changes the graph identity.
    const changedBranch = compile({
      ...fanoutDefinition(),
      edges: fanoutDefinition().edges.map((edge) =>
        edge.from === 'f' && (edge as { key?: string }).key === 'a'
          ? { ...edge, key: 'alpha' }
          : edge,
      ),
    });
    expect(changedBranch.ok).toBe(true);
    expect(a.ok && changedBranch.ok && changedBranch.graph.graphVersion !== a.graph.graphVersion).toBe(true);

    // A changed retry bound changes the graph identity (not the capability set).
    const changedRetry = compile({
      ...fanoutDefinition(),
      nodes: fanoutDefinition().nodes.map((node) =>
        node.id === 'apply'
          ? { ...node, retry: { maxAttempts: 3, retryOn: ['X'], backoff: { kind: 'fixed', delayMs: 5 } } }
          : node,
      ),
    });
    expect(changedRetry.ok).toBe(true);
    expect(a.ok && changedRetry.ok && changedRetry.graph.graphVersion !== a.graph.graphVersion).toBe(true);

    // The v2 canonical form is idempotent and independent of declaration order.
    const c1 = canonicalSemanticFormV2(fanoutDefinition());
    const c2 = canonicalSemanticFormV2(reordered);
    expect(canonicalJson(c1) === canonicalJson(c2)).toBe(true);
    expect(canonicalJson(canonicalSemanticFormV2(c1 as unknown as ApplicationGraphDefinition)) === canonicalJson(c1)).toBe(true);
  });
});

describe('stage 03 pure helpers', () => {
  it('backoff is deterministic and bounded; retry classification uses stable codes only', () => {
    const fixed = { maxAttempts: 3, retryOn: ['X'], backoff: { kind: 'fixed' as const, delayMs: 100 } };
    expect(backoffDelayMs(fixed, 1)).toBe(100);
    expect(backoffDelayMs(fixed, 2)).toBe(100);
    const exp = {
      maxAttempts: 5,
      retryOn: ['X'],
      backoff: { kind: 'exponential' as const, initialMs: 100, multiplier: 2, maxMs: 800 },
    };
    expect(backoffDelayMs(exp, 1)).toBe(100);
    expect(backoffDelayMs(exp, 2)).toBe(200);
    expect(backoffDelayMs(exp, 3)).toBe(400);
    expect(backoffDelayMs(exp, 9)).toBe(800); // capped at maxMs
    expect(isRetryable(fixed, 'X')).toBe(true);
    expect(isRetryable(fixed, 'raw message text')).toBe(false);
    expect(isRetryable(fixed, 'timeout')).toBe(false);
    const timeoutClass = { ...fixed, retryOn: ['timeout'] };
    expect(isRetryable(timeoutClass, 'timeout')).toBe(true);
    void resolveDecisionRoute;
    void canonicalJoinOutput;
  });

  it('decision routing resolves only declared keys; join output is canonical by key', () => {
    const routes = { b: 'node-b', a: 'node-a' };
    expect(resolveDecisionRoute(routes, { route: 'a', value: 1 })).toEqual({ ok: true, target: 'node-a' });
    expect(resolveDecisionRoute(routes, { route: 'zzz', value: 1 })).toEqual({
      ok: false,
      code: 'UNKNOWN_ROUTE',
      route: 'zzz',
    });
    expect(resolveDecisionRoute(routes, { route: '', value: 1 })).toEqual({
      ok: false,
      code: 'EMPTY_ROUTE',
      route: '',
    });
    // Insertion order never leaks into join output ordering.
    const joined = canonicalJoinOutput({ zeta: 1, alpha: 2, mid: 3 });
    expect(Object.keys(joined)).toEqual(['alpha', 'mid', 'zeta']);
  });
});