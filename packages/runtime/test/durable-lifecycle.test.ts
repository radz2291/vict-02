import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineCapability, defineGraph } from '@vict/sdk';
import { defineZodContract } from '@vict/sdk/zod';
import { createInMemoryStores, createRuntime } from '@vict/runtime';
import type { VictRuntime } from '@vict/runtime';

const Count = defineZodContract('dl.count', '1', z.object({ count: z.number() }));

function incrementCapability() {
  return defineCapability({
    id: 'dl.increment',
    revision: '1',
    effect: 'pure',
    input: Count,
    output: Count,
    invoke: (input) => ({ count: input.count + 1 }),
  });
}

function twoNodeGraph() {
  return defineGraph({
    id: 'dl-graph',
    entry: 'a',
    nodes: [
      { id: 'a', capability: 'dl.increment' },
      { id: 'b', capability: 'dl.increment' },
    ],
    edges: [{ from: 'a', to: 'b' }],
  });
}

describe('durable run lifecycle (in-memory store)', () => {
  let runtime: VictRuntime;
  beforeEach(() => {
    runtime = createRuntime();
    runtime.registerCapability(incrementCapability());
  });

  it('persists the activation manifest and selection so exact restoration succeeds', async () => {
    const activation = await runtime.activate(twoNodeGraph());
    expect(activation.ok).toBe(true);
    if (!activation.ok) {
      return;
    }
    expect(runtime.activeGraph()?.activationVersion).toBe(activation.activationVersion);
    // The durable catalog holds the manifest: current code reproduces it exactly.
    const restore = await runtime.restoreActivation(twoNodeGraph());
    expect(restore.ok).toBe(true);
    if (restore.ok) {
      expect(restore.activationVersion).toBe(activation.activationVersion);
      expect(restore.capabilitySetVersion).toBe(activation.capabilitySetVersion);
    }
  });

  it('commits the run and its events atomically with dense sequence and exact order', async () => {
    await runtime.activate(twoNodeGraph());
    const result = await runtime.run({ count: 1 });
    expect(result.status).toBe('completed');

    const record = await runtime.getRun(result.runId);
    expect(record).toBeDefined();
    expect(record?.status).toBe('completed');
    // The in-memory trace and durable event sequence agree exactly.
    expect(record?.trace.map((event) => event.seq)).toEqual(result.trace.map((event) => event.seq));
    expect(record?.trace.map((event) => event.type)).toEqual(
      result.trace.map((event) => event.type),
    );
    expect(record?.steps).toBe(2);
    expect(record?.outputSummary).toBeDefined();
    expect('output' in (record ?? {})).toBe(false);
  });

  it('commits exactly five durable operations for the two-node graph shape', async () => {
    // Documented Stage 02 fact replacing "one repository write per run":
    // 1 createRun (run.started) + 1 commitTransition per node.started (2)
    // + 1 per node-result batch (completed + signal.routed ride together,
    // 1) + 1 terminal (node.completed + run.completed) = 5 durable
    // transactions. The in-memory trace is unchanged at 7 events.
    const stores = createInMemoryStores();
    const transitions: string[] = [];
    const originalCommit = stores.execution.commitTransition.bind(stores.execution);
    const countingExecution = {
      ...stores.execution,
      async commitTransition(command: Parameters<typeof originalCommit>[0]) {
        transitions.push(command.events.map((event) => event.type).join('+'));
        return originalCommit(command);
      },
    };
    const countingRuntime = createRuntime({ stores: { ...stores, execution: countingExecution } });
    countingRuntime.registerCapability(incrementCapability());
    await countingRuntime.activate(
      defineGraph({
        id: 'dl-bench-shape',
        entry: 'a',
        nodes: [
          { id: 'a', capability: 'dl.increment' },
          { id: 'b', capability: 'dl.increment' },
        ],
        edges: [{ from: 'a', to: 'b' }],
      }),
    );
    const result = await countingRuntime.run({ count: 0 });
    expect(result.status).toBe('completed');
    expect(result.trace.length).toBe(7);
    expect(transitions).toEqual([
      'node.started',
      'node.completed+signal.routed',
      'node.started',
      'node.completed+run.completed',
    ]);
  });

  it('persists the full output only under explicit full retention and never the input', async () => {
    const fullRuntime = createRuntime({ payloadRetention: 'full' });
    fullRuntime.registerCapability(incrementCapability());
    await fullRuntime.activate(twoNodeGraph());
    const canaryInput = { count: 1, canary: 'dl-canary-FULL-77a' };
    const result = await fullRuntime.run(canaryInput);
    const record = await fullRuntime.getRun(result.runId);
    expect(record?.output).toBeDefined();
    expect(JSON.stringify(record).includes('dl-canary-FULL-77a')).toBe(false);
  });

  it('fails a run loudly when the durable store cannot commit transitions', async () => {
    const stores = createInMemoryStores();
    let failCommits = false;
    const breakingExecution = {
      ...stores.execution,
      async commitTransition(...args: Parameters<typeof stores.execution.commitTransition>) {
        if (failCommits) {
          throw Object.assign(new Error('storage exploded'), { code: 'VICT_STORE_UNAVAILABLE' });
        }
        return stores.execution.commitTransition(...args);
      },
    };
    const breakingRuntime = createRuntime({ stores: { ...stores, execution: breakingExecution } });
    breakingRuntime.registerCapability(incrementCapability());
    await breakingRuntime.activate(twoNodeGraph());
    failCommits = true;
    await expect(breakingRuntime.run({ count: 1 })).rejects.toMatchObject({
      code: 'VICT_STORE_UNAVAILABLE',
    });
  });
});
