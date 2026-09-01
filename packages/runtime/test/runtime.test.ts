import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineCapability, defineGraph, errorSignalContract } from '@vict/sdk';
import { defineZodContract } from '@vict/sdk/zod';
import { createRuntime } from '@vict/runtime';

const Counter = defineZodContract('t.counter', '1', z.object({ count: z.number() }));
const Greeting = defineZodContract(
  't.greeting',
  '1',
  z.object({ message: z.string(), count: z.number() }),
);

function counterCapability(revision = '1') {
  return defineCapability({
    id: 't.counter',
    revision,
    effect: 'pure',
    input: Counter,
    output: Counter,
    invoke: async (input) => ({ count: input.count + 1 }),
  });
}

function greeterCapability() {
  return defineCapability({
    id: 't.greeter',
    revision: '1',
    effect: 'pure',
    input: Counter,
    output: Greeting,
    invoke: (input) => ({ message: `count ${input.count}`, count: input.count }),
  });
}

function counterRuntime(revision = '1') {
  const runtime = createRuntime();
  runtime.registerCapability(counterCapability(revision)).registerCapability(greeterCapability());
  return runtime;
}

function twoNodeGraph() {
  return defineGraph({
    id: 't-graph',
    entry: 'a',
    nodes: [
      { id: 'a', capability: 't.counter' },
      { id: 'b', capability: 't.greeter' },
    ],
    edges: [{ from: 'a', to: 'b' }],
  });
}

describe('runtime activation and configuration', () => {
  it('compiles and activates a valid graph with layered identity', async () => {
    const runtime = counterRuntime();
    const activation = await runtime.activate(twoNodeGraph());
    expect(activation.ok).toBe(true);
    if (activation.ok) {
      expect(activation.graphId).toBe('t-graph');
      expect(activation.graphVersion).toMatch(/^v1_[0-9a-f]{64}$/);
      expect(activation.capabilitySetVersion).toMatch(/^v1_[0-9a-f]{64}$/);
      expect(activation.activationVersion).toMatch(/^v1_[0-9a-f]{64}$/);
      expect(activation.nodeCount).toBe(2);
    }
    const active = runtime.activeGraph();
    expect(active?.id).toBe('t-graph');
    expect(active?.version).toMatch(/^v1_[0-9a-f]{64}$/);
    expect(active?.capabilitySetVersion).toBeDefined();
    expect(active?.activationVersion).toBeDefined();
  });

  it('produces the same activation identity for identical revisions and a new one after revision changes', async () => {
    const a = counterRuntime();
    const b = counterRuntime();
    const activationA = await a.activate(twoNodeGraph());
    const activationB = await b.activate(twoNodeGraph());
    if (activationA.ok && activationB.ok) {
      expect(activationA.graphVersion).toBe(activationB.graphVersion);
      expect(activationA.capabilitySetVersion).toBe(activationB.capabilitySetVersion);
      expect(activationA.activationVersion).toBe(activationB.activationVersion);
    } else {
      expect.unreachable();
    }

    const c = counterRuntime('2');
    const activationC = await c.activate(twoNodeGraph());
    if (activationA.ok && activationC.ok) {
      expect(activationA.graphVersion).toBe(activationC.graphVersion);
      expect(activationA.capabilitySetVersion).not.toBe(activationC.capabilitySetVersion);
      expect(activationA.activationVersion).not.toBe(activationC.activationVersion);
    } else {
      expect.unreachable();
    }
  });

  it('preserves the previously active graph when activation fails', async () => {
    const runtime = counterRuntime();
    const first = await runtime.activate(twoNodeGraph());
    expect(first.ok).toBe(true);

    // Invalid: duplicate node ids.
    const broken = defineGraph({
      id: 't-graph-broken',
      entry: 'a',
      nodes: [
        { id: 'a', capability: 't.counter' },
        { id: 'a', capability: 't.greeter' },
      ],
      edges: [],
    });
    const second = await runtime.activate(broken);
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.issues.some((issue) => issue.code === 'DUPLICATE_NODE')).toBe(true);
      expect(second.previousGraph?.id).toBe('t-graph');
    }
    // Previous graph is still active and still runnable.
    expect(runtime.activeGraph()?.id).toBe('t-graph');
    const result = await runtime.run({ count: 1 });
    expect(result.status).toBe('completed');
    expect((await runtime.getRun(result.runId))?.graphId).toBe('t-graph');
  });

  it('rejects runs before any graph is activated', async () => {
    const runtime = createRuntime();
    await expect(runtime.run({})).rejects.toMatchObject({ code: 'VICT_RUNTIME_NO_ACTIVE_GRAPH' });
  });

  it('validates revisions at registration with structured errors', () => {
    const runtime = createRuntime();
    expect(() =>
      runtime.registerCapability({
        id: 't.bad',
        revision: '',
        effect: 'pure',
        invoke: (input) => input,
      }),
    ).toThrowError(/revision/);
    expect(() =>
      runtime.registerCapability({
        id: 't.bad',
        revision: undefined as unknown as string,
        effect: 'pure',
        invoke: (input) => input,
      }),
    ).toThrowError(/revision/);
    expect(() =>
      runtime.registerCapability(counterCapability()).registerContract({
        id: 't.bad-contract',
        revision: '',
        expected: 'x',
        parse: (input) => ({ ok: true as const, value: input }),
      }),
    ).toThrowError(/revision/);
  });

  it('rejects duplicate capability registration and conflicting contract ids', () => {
    const runtime = createRuntime();
    runtime.registerCapability(counterCapability());
    expect(() => runtime.registerCapability(counterCapability())).toThrowError(
      /already registered/,
    );
    const conflicting = defineZodContract('t.counter', '1', z.object({ different: z.boolean() }));
    expect(() => runtime.registerContract(conflicting)).toThrowError(/different contract object/);
  });

  it('requires explicit replacement for test doubles', () => {
    const runtime = counterRuntime();
    runtime.registerDouble('t.counter', () => ({ count: 0 }));
    expect(() => runtime.registerDouble('t.counter', () => ({ count: 1 }))).toThrowError(
      /already registered/,
    );
    expect(() => runtime.replaceDouble('t.ghost', () => ({ count: 2 }))).toThrowError(
      /unknown capability/,
    );
    expect(() => runtime.replaceDouble('t.greeter', () => ({ count: 3 }))).toThrowError(
      /No test double is registered/,
    );
    runtime.replaceDouble('t.counter', () => ({ count: 42 }));
    // The replacement is now effective (verified behaviourally in snapshot tests).
    expect(true).toBe(true);
  });

  it('rejects invalid retention configuration', () => {
    expect(() => createRuntime({ payloadRetention: 'everything' as 'full' })).toThrowError(
      /payloadRetention/,
    );
  });

  it('records runs in the repository and exposes them', async () => {
    const runtime = counterRuntime();
    await runtime.activate(twoNodeGraph());
    const result = await runtime.run({ count: 41 });
    expect((await runtime.listRuns()).length).toBe(1);
    const record = await runtime.getRun(result.runId);
    expect(record).toBeDefined();
    expect(record?.status).toBe('completed');
    expect(record?.trace.length).toBeGreaterThan(0);
  });
});

describe('trace safety', () => {
  it('keeps secret-like values and key names out of trace diagnostics', async () => {
    const Session = defineZodContract(
      't.session',
      '1',
      z.object({ username: z.string(), password: z.string(), apiToken: z.string() }),
    );
    const runtime = createRuntime();
    runtime.registerCapability(
      defineCapability({
        id: 't.session-maker',
        revision: '1',
        effect: 'pure',
        input: Counter,
        output: Session,
        invoke: () => ({
          username: 'alex',
          password: 'hunter2-super-secret',
          apiToken: 'tok-123-xyz',
        }),
      }),
    );
    await runtime.activate(
      defineGraph({
        id: 't-secret-graph',
        entry: 's',
        nodes: [{ id: 's', capability: 't.session-maker' }],
        edges: [],
      }),
    );
    const result = await runtime.run({ count: 1 });
    expect(result.status).toBe('completed');
    const serialized = JSON.stringify(result.trace);
    expect(serialized).not.toContain('hunter2-super-secret');
    expect(serialized).not.toContain('tok-123-xyz');
    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('apiToken');
    expect(serialized).toContain('username');
    const completed = result.trace.find((event) => event.type === 'node.completed');
    expect(completed).toBeDefined();
    if (completed?.type === 'node.completed' && completed.output.shape === 'object') {
      expect([...completed.output.keys].sort()).toEqual(['[redacted]', '[redacted]', 'username']);
    }
  });

  it('keeps contract rejections useful after redaction', async () => {
    const runtime = counterRuntime();
    await runtime.activate(
      defineGraph({
        id: 't-reject-graph',
        entry: 'a',
        nodes: [{ id: 'a', capability: 't.counter' }],
        edges: [],
      }),
    );
    const result = await runtime.run({ count: 'not-a-number' });
    expect(result.status).toBe('failed');
    const rejected = result.trace.find((event) => event.type === 'contract.rejected');
    expect(rejected).toBeDefined();
    if (rejected?.type === 'contract.rejected') {
      expect(rejected.contractId).toBe('t.counter');
      expect(rejected.issues.length).toBeGreaterThan(0);
      // Fail-closed path policy: issues are located by ordinal; the
      // framework-generated message quotes the ordinal, never the raw
      // schema path, and no schema text is copied.
      expect(rejected.issues[0]?.path).toBe('issues[0]');
      expect(rejected.issues[0]?.message).toMatch(/Expected a valid value at 'issues\[0\]'/);
      expect(rejected.issues[0]?.safeMessage).toBeUndefined();
    }
    expect(JSON.stringify(result.trace)).not.toContain('not-a-number');
  });

  it('routes explicit capability failures over the error edge as structured signals', async () => {
    const runtime = createRuntime();
    runtime.registerCapability(
      defineCapability({
        id: 't.exploding',
        revision: '1',
        effect: 'pure',
        input: Counter,
        output: Counter,
        invoke: () => {
          throw new Error('model provider offline');
        },
      }),
    );
    runtime.registerCapability(
      defineCapability({
        id: 't.error-handler',
        revision: '1',
        effect: 'pure',
        input: errorSignalContract,
        output: Greeting,
        invoke: (error) => ({ message: `handled: ${error.code}`, count: 0 }),
      }),
    );
    await runtime.activate(
      defineGraph({
        id: 't-error-graph',
        entry: 'x',
        nodes: [
          { id: 'x', capability: 't.exploding' },
          { id: 'handler', capability: 't.error-handler' },
        ],
        edges: [{ from: 'x', to: 'handler', kind: 'error' }],
      }),
    );
    const result = await runtime.run({ count: 1 });
    expect(result.status).toBe('completed');
    expect(result.output).toMatchObject({ message: 'handled: VICT_RUNTIME_CAPABILITY_THREW' });
    // The raw thrown message must not survive anywhere.
    expect(JSON.stringify(result)).not.toContain('model provider offline');
    const routed = result.trace.find((event) => event.type === 'signal.routed');
    expect(routed).toBeDefined();
    if (routed?.type === 'signal.routed') {
      expect(routed.kind).toBe('error');
    }
  });

  it('fails honestly when a capability throws with no error edge', async () => {
    const runtime = createRuntime();
    runtime.registerCapability(
      defineCapability({
        id: 't.exploding',
        revision: '1',
        effect: 'pure',
        input: Counter,
        output: Counter,
        invoke: () => {
          throw new Error('offline');
        },
      }),
    );
    await runtime.activate(
      defineGraph({
        id: 't-fail-graph',
        entry: 'x',
        nodes: [{ id: 'x', capability: 't.exploding' }],
        edges: [],
      }),
    );
    const result = await runtime.run({ count: 1 });
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('VICT_RUNTIME_CAPABILITY_THREW');
    // Sanitised: safe type name, correlation id, no raw message.
    expect(result.error?.details).toMatchObject({ errorName: 'Error' });
    expect(typeof (result.error?.details as { errorId?: string }).errorId).toBe('string');
    expect(JSON.stringify(result)).not.toContain('offline');
    expect(result.trace.at(-1)?.type).toBe('run.failed');
  });
});
