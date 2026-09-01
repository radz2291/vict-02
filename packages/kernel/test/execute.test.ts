import { describe, expect, it } from 'vitest';
import { compileGraph } from '../src/compile.js';
import { executeGraph } from '../src/execute.js';
import { unsafeCompiledGraphForTesting } from '../src/testing.js';
import type { VictError } from '@vict/contracts';
import type { Contract } from '@vict/contracts';
import type {
  CapabilityDescriptor,
  CapabilityIndex,
  CompiledGraph,
  ContractEnvironment,
  KernelEvent,
  KernelPorts,
  KernelRunOutput,
} from '../src/types.js';

/** A contract that accepts everything (kernel-level tests don't need real schemas). */
function acceptAll(id: string): Contract<unknown> {
  return {
    id,
    revision: '1',
    expected: 'anything',
    parse: (input) => ({ ok: true, value: input }),
  };
}

/** A contract that rejects everything with one structured issue. */
function rejectAll(id: string): Contract<unknown> {
  return {
    id,
    revision: '1',
    expected: 'nothing',
    parse: () => ({
      ok: false as const,
      issues: [{ code: 'reject_all', path: '(root)', message: 'rejected by test contract' }],
    }),
  };
}

interface Harness {
  ports: KernelPorts;
  invocations: { capabilityId: string; input: unknown; useDouble: boolean }[];
  capabilityIndex: CapabilityIndex;
  contractEnvironment: ContractEnvironment;
}

function makeHarness(options?: {
  contractsById?: Record<string, Contract<unknown>>;
  handlers?: Record<string, (input: unknown) => unknown | Promise<unknown>>;
  allow?: boolean;
  effects?: Record<string, CapabilityDescriptor['effect']>;
  beforeInvoke?: (boundary: {
    nodeId: string;
    capabilityId: string;
    step: number;
  }) => Promise<void>;
}): Harness {
  const invocations: Harness['invocations'] = [];
  const contractMap = new Map<string, Contract<unknown>>(
    Object.entries(options?.contractsById ?? {}),
  );
  const handlerMap = new Map(Object.entries(options?.handlers ?? {}));
  const effects = options?.effects ?? {};
  const capabilityIndex: CapabilityIndex = {
    getCapabilityDescriptor: (id) => ({
      id,
      revision: '1',
      effect: effects[id] ?? 'pure',
      inputContractId: contractMap.has(`in:${id}`) ? `in:${id}` : undefined,
      inputRevision: contractMap.has(`in:${id}`) ? '1' : undefined,
      outputContractId: contractMap.has(`out:${id}`) ? `out:${id}` : undefined,
      outputRevision: contractMap.has(`out:${id}`) ? '1' : undefined,
    }),
  };
  const contractEnvironment: ContractEnvironment = {
    has: (id) => contractMap.has(id),
    isCompatible: (from, to) => from === undefined || to === undefined || from === to,
    get: (id) => contractMap.get(id),
  };
  const ports: KernelPorts = {
    descriptors: capabilityIndex,
    contracts: contractEnvironment,
    policy: {
      authorize: () => ({ allowed: options?.allow ?? true, useDouble: false }),
    },
    capabilities: {
      invoke: async (capabilityId, input, context) => {
        invocations.push({ capabilityId, input, useDouble: context.useDouble });
        const handler = handlerMap.get(capabilityId);
        if (!handler) {
          return { ok: true as const, value: input };
        }
        return { ok: true as const, value: await handler(input) };
      },
    },
    clock: { now: () => 1_000 },
    ids: { runId: () => 'run_test_1' },
    ...(options?.beforeInvoke !== undefined ? { beforeInvoke: options.beforeInvoke } : {}),
  };
  return { ports, invocations, capabilityIndex, contractEnvironment };
}

/** Compile the standard three-node graph against the harness's own capability knowledge. */
function threeNodeGraph(harness: Harness): CompiledGraph {
  const result = compileGraph({
    definition: {
      id: 'g3',
      entry: 'n1',
      nodes: [
        { id: 'n1', capability: 'c1' },
        { id: 'n2', capability: 'c2' },
        { id: 'n3', capability: 'c3' },
      ],
      edges: [
        { from: 'n1', to: 'n2' },
        { from: 'n2', to: 'n3' },
      ],
    },
    capabilities: harness.capabilityIndex,
    contracts: harness.contractEnvironment,
  });
  if (!result.ok) {
    throw new Error(`fixture graph failed to compile: ${JSON.stringify(result.issues)}`);
  }
  return result.graph;
}

async function runThreeNode(harness: Harness, input: unknown): Promise<KernelRunOutput> {
  return executeGraph({
    graph: threeNodeGraph(harness),
    input,
    mode: 'normal',
    ports: harness.ports,
  });
}

const ALWAYS_ALLOW = { allow: true };

describe('executeGraph', () => {
  it('executes a three-node pure graph in stable order', async () => {
    const harness = makeHarness(ALWAYS_ALLOW);
    const result = await runThreeNode(harness, { seed: 1 });

    expect(result.status).toBe('completed');
    expect(result.steps).toBe(3);
    expect(harness.invocations.map((call) => call.capabilityId)).toEqual(['c1', 'c2', 'c3']);
    // Output flows along the success chain unchanged (identity handlers).
    expect(result.output).toEqual({ seed: 1 });

    const types = result.events.map((event) => event.type);
    expect(types).toEqual([
      'run.started',
      'node.started',
      'node.completed',
      'signal.routed',
      'node.started',
      'node.completed',
      'signal.routed',
      'node.started',
      'node.completed',
      'run.completed',
    ]);
  });

  it('keeps sequence numbers strictly increasing and identity fields constant', async () => {
    const harness = makeHarness(ALWAYS_ALLOW);
    const result = await runThreeNode(harness, 1);
    let previous = -1;
    for (const event of result.events) {
      expect(event.seq).toBe(previous + 1);
      previous = event.seq;
      expect(event.runId).toBe(result.runId);
      expect(event.graphId).toBe('g3');
      expect(event.graphVersion).toBe(result.graphVersion);
    }
  });

  it('blocks invocation when the entry input contract rejects', async () => {
    const harness = makeHarness({
      allow: true,
      contractsById: { 'in:c1': rejectAll('in:c1') },
    });
    const result = await runThreeNode(harness, { seed: 1 });

    expect(result.status).toBe('failed');
    expect(harness.invocations).toEqual([]);
    const rejected = result.events.find((event) => event.type === 'contract.rejected');
    expect(rejected).toBeDefined();
    if (rejected?.type === 'contract.rejected') {
      expect(rejected.stage).toBe('input');
      expect(rejected.contractId).toBe('in:c1');
    }
    expect(result.events.at(-1)?.type).toBe('run.failed');
    expect(result.error?.code).toBe('VICT_KERNEL_CONTRACT_REJECTED');
  });

  it('validates inputs against accepting contracts and passes them through', async () => {
    const harness = makeHarness({
      allow: true,
      contractsById: { 'in:c1': acceptAll('in:c1') },
    });
    const result = await runThreeNode(harness, { seed: 7 });
    expect(result.status).toBe('completed');
    expect(result.output).toEqual({ seed: 7 });
    expect(harness.invocations.map((call) => call.capabilityId)).toEqual(['c1', 'c2', 'c3']);
  });

  it('prevents downstream routing when an output contract rejects', async () => {
    const harness = makeHarness({
      allow: true,
      contractsById: { 'out:c1': rejectAll('out:c1') },
    });
    const result = await runThreeNode(harness, 1);

    expect(result.status).toBe('failed');
    expect(harness.invocations.map((call) => call.capabilityId)).toEqual(['c1']);
    const rejected = result.events.find((event) => event.type === 'contract.rejected');
    expect(rejected).toBeDefined();
    if (rejected?.type === 'contract.rejected') {
      expect(rejected.stage).toBe('output');
    }
    expect(result.events.at(-1)?.type).toBe('run.failed');
  });

  it('routes explicit failures along the error edge as structured signals', async () => {
    const failingHarness = makeHarness({
      allow: true,
      contractsById: { 'out:c-boom': rejectAll('out:c-boom') },
    });
    const graphResult = compileGraph({
      definition: {
        id: 'g-err',
        entry: 'boom',
        nodes: [
          { id: 'boom', capability: 'c-boom' },
          { id: 'handler', capability: 'c-handler' },
        ],
        edges: [{ from: 'boom', to: 'handler', kind: 'error' }],
      },
      capabilities: failingHarness.capabilityIndex,
      contracts: failingHarness.contractEnvironment,
    });
    if (!graphResult.ok) {
      throw new Error('fixture should compile');
    }

    const result = await executeGraph({
      graph: graphResult.graph,
      input: 1,
      mode: 'normal',
      ports: failingHarness.ports,
    });

    expect(result.status).toBe('completed'); // the error handler completed the run
    expect(failingHarness.invocations.map((call) => call.capabilityId)).toEqual([
      'c-boom',
      'c-handler',
    ]);
    const routed = result.events.find((event) => event.type === 'signal.routed');
    expect(routed).toBeDefined();
    if (routed?.type === 'signal.routed') {
      expect(routed.kind).toBe('error');
      expect(routed.fromNodeId).toBe('boom');
      expect(routed.toNodeId).toBe('handler');
    }
    // The handler received the structured error signal as its input.
    const handlerInvocation = failingHarness.invocations[1];
    expect((handlerInvocation?.input as VictError).code).toBe('VICT_KERNEL_CONTRACT_REJECTED');
    expect(result.events.at(-1)?.type).toBe('run.completed');
  });

  it('fails the run honestly when an error has no error edge', async () => {
    const harness = makeHarness({
      allow: true,
      contractsById: { 'out:c-a': rejectAll('out:c-a') },
    });
    const graphResult = compileGraph({
      definition: {
        id: 'g-fail',
        entry: 'a',
        nodes: [{ id: 'a', capability: 'c-a' }],
        edges: [],
      },
      capabilities: harness.capabilityIndex,
      contracts: harness.contractEnvironment,
    });
    if (!graphResult.ok) {
      throw new Error('fixture should compile');
    }
    const result = await executeGraph({
      graph: graphResult.graph,
      input: 1,
      mode: 'normal',
      ports: harness.ports,
    });
    expect(result.status).toBe('failed');
    expect(result.error).toBeDefined();
    expect(result.events.at(-1)?.type).toBe('run.failed');
  });

  it('terminates runaway execution at the maximum step count', async () => {
    // The compiler rejects cycles; this unsafe factory exists to prove the executor bound holds anyway.
    const cyclic = unsafeCompiledGraphForTesting({
      id: 'g-cycle',
      entry: 'a',
      nodes: [
        { id: 'a', capability: 'c-a' },
        { id: 'b', capability: 'c-b' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' },
      ],
    });
    const harness = makeHarness(ALWAYS_ALLOW);
    const result = await executeGraph({
      graph: cyclic,
      input: 1,
      mode: 'normal',
      ports: harness.ports,
      maxSteps: 10,
    });
    expect(result.status).toBe('failed');
    expect(result.steps).toBe(11);
    expect(result.error?.code).toBe('VICT_KERNEL_MAX_STEPS_EXCEEDED');
    expect(result.events.at(-1)?.type).toBe('run.failed');
  });

  it('emits effect.blocked and run.blocked when the policy denies an effect', async () => {
    const harness = makeHarness({ allow: false });
    const result = await runThreeNode(harness, 1);
    expect(result.status).toBe('blocked');
    expect(harness.invocations).toEqual([]);
    expect(result.events.map((event) => event.type)).toEqual([
      'run.started',
      'effect.blocked',
      'run.blocked',
    ]);
    if (result.events[1]?.type === 'effect.blocked') {
      expect(result.events[1].nodeId).toBe('n1');
    }
  });

  it('matches the final event to the final status', async () => {
    const completed = await runThreeNode(makeHarness(ALWAYS_ALLOW), 1);
    expect(completed.status).toBe('completed');
    expect(completed.events.at(-1)?.type).toBe('run.completed');

    const blocked = await runThreeNode(makeHarness({ allow: false }), 1);
    expect(blocked.status).toBe('blocked');
    expect(blocked.events.at(-1)?.type).toBe('run.blocked');

    const failed = await runThreeNode(
      makeHarness({ allow: true, contractsById: { 'in:c1': rejectAll('in:c1') } }),
      1,
    );
    expect(failed.status).toBe('failed');
    expect(failed.events.at(-1)?.type).toBe('run.failed');
  });

  it('redacts secret-like key names and never records values in trace metadata', async () => {
    const harness = makeHarness({
      allow: true,
      handlers: {
        'c-secret': () => ({ username: 'alex', password: 'super-secret-value', apiKey: 'k-123' }),
      },
    });
    const graphResult = compileGraph({
      definition: {
        id: 'g-secret',
        entry: 'a',
        nodes: [{ id: 'a', capability: 'c-secret' }],
        edges: [],
      },
      capabilities: harness.capabilityIndex,
      contracts: harness.contractEnvironment,
    });
    if (!graphResult.ok) {
      throw new Error('fixture should compile');
    }
    const result = await executeGraph({
      graph: graphResult.graph,
      input: 1,
      mode: 'normal',
      ports: harness.ports,
    });
    expect(result.status).toBe('completed');
    const serialized = JSON.stringify(result.events);
    expect(serialized).not.toContain('super-secret-value');
    expect(serialized).not.toContain('k-123');
    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('apiKey');
    expect(serialized).toContain('username');
    const completed = result.events.find((event) => event.type === 'node.completed');
    expect(completed).toBeDefined();
    if (completed?.type === 'node.completed' && completed.output.shape === 'object') {
      expect([...completed.output.keys].sort()).toEqual(['[redacted]', '[redacted]', 'username']);
    }
  });

  it('invokes capabilities bound to one pinned graph identity', async () => {
    const harness = makeHarness(ALWAYS_ALLOW);
    const result = await runThreeNode(harness, 1);
    expect(harness.invocations.length).toBe(3);
    const versions = new Set(result.events.map((event) => event.graphVersion));
    expect(versions.size).toBe(1);
  });
});

describe('event envelope', () => {
  it('assigns dense, ordered sequence numbers', async () => {
    const harness = makeHarness(ALWAYS_ALLOW);
    const result = await runThreeNode(harness, 1);
    const seqs: number[] = [];
    for (const event of result.events as readonly KernelEvent[]) {
      seqs.push(event.seq);
    }
    expect(seqs).toEqual(seqs.map((_, index) => index));
  });
});

describe('executeGraph durable invocation boundary (beforeInvoke)', () => {
  it('awaits the guard before every capability invocation, in node order', async () => {
    const events: string[] = [];
    const harness = makeHarness({
      beforeInvoke: async (boundary) => {
        // Record the boundary crossing; the guard resolves immediately but
        // asynchronously, so a synchronous invoke would beat it.
        events.push(`boundary:${boundary.nodeId}:${boundary.step}`);
      },
    });
    // Wrap invoke to record its start relative to the guard.
    const innerInvoke = harness.ports.capabilities.invoke;
    harness.ports.capabilities.invoke = async (id, input, context) => {
      events.push(`invoke:${id}`);
      return innerInvoke(id, input, context);
    };
    const output = await runThreeNode(harness, { n: 1 });
    expect(output.status).toBe('completed');
    expect(events).toEqual([
      'boundary:n1:1',
      'invoke:c1',
      'boundary:n2:2',
      'invoke:c2',
      'boundary:n3:3',
      'invoke:c3',
    ]);
  });

  it('a guard rejection prevents the capability invocation and propagates unchanged', async () => {
    const harness = makeHarness({
      beforeInvoke: async (boundary) => {
        if (boundary.nodeId === 'n1') {
          throw Object.assign(new Error('durable intent not committed'), {
            code: 'VICT_TEST_NOT_DURABLE',
          });
        }
      },
    });
    let caught: unknown;
    try {
      await runThreeNode(harness, { n: 1 });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();
    expect((caught as { code?: string }).code).toBe('VICT_TEST_NOT_DURABLE');
    expect((caught as { message?: string }).message).toBe('durable intent not committed');
    // The capability was never invoked; the error was not converted into a
    // domain event or routed along an error edge.
    expect(harness.invocations).toEqual([]);
  });

  it('a guard that resolves only after a deferred write orders invocation causally', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const harness = makeHarness({
      beforeInvoke: () => gate,
    });
    const invocationPromise = runThreeNode(harness, { n: 1 });
    // Give the kernel a chance to run to the boundary; the capability must
    // not have been invoked while the gate is closed.
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(harness.invocations).toEqual([]);
    release();
    const output = await invocationPromise;
    expect(output.status).toBe('completed');
    expect(harness.invocations).toHaveLength(3);
  });
});
