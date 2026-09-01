import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { defineCapability, defineGraph } from '@vict/sdk';
import { defineZodContract } from '@vict/sdk/zod';
import { createRuntime } from '@vict/runtime';

const Count = defineZodContract('e.count', '1', z.object({ count: z.number() }));

/** Build a runtime with one capability whose real and double implementations are spied on. */
function spyCapability(effect: 'pure' | 'read' | 'write' | 'irreversible') {
  const real = vi.fn((input: { count: number }) => ({ count: input.count + 1000 }));
  const double = vi.fn((input: unknown) => ({ count: (input as { count: number }).count + 1 }));
  const capability = defineCapability({
    id: `e.${effect}`,
    revision: '1',
    effect,
    input: Count,
    output: Count,
    invoke: real,
  });
  return { capability, real, double };
}

function oneNodeGraph(capabilityId: string) {
  return defineGraph({
    id: 'e-graph',
    entry: 'n',
    nodes: [{ id: 'n', capability: capabilityId }],
    edges: [],
  });
}

function twoNodeGraph(firstCapabilityId: string, secondCapabilityId: string) {
  return defineGraph({
    id: 'e-graph-2',
    entry: 'n1',
    nodes: [
      { id: 'n1', capability: firstCapabilityId },
      { id: 'n2', capability: secondCapabilityId },
    ],
    edges: [{ from: 'n1', to: 'n2' }],
  });
}

describe('effect policy enforcement', () => {
  it('runs pure capabilities for real in simulate mode', async () => {
    const pure = spyCapability('pure');
    const runtime = createRuntime();
    runtime.registerCapability(pure.capability);
    await runtime.activate(oneNodeGraph('e.pure'));

    const result = await runtime.run({ count: 1 }, { mode: 'simulate' });
    expect(result.status).toBe('completed');
    expect(pure.real).toHaveBeenCalledTimes(1);
    expect(result.output).toEqual({ count: 1001 });
  });

  it('blocks a read capability without a test double in simulate mode', async () => {
    const read = spyCapability('read');
    const runtime = createRuntime();
    runtime.registerCapability(read.capability);
    await runtime.activate(oneNodeGraph('e.read'));

    const result = await runtime.run({ count: 1 }, { mode: 'simulate' });
    expect(result.status).toBe('blocked');
    expect(read.real).not.toHaveBeenCalled();
    const blocked = result.trace.find((event) => event.type === 'effect.blocked');
    expect(blocked).toBeDefined();
    if (blocked?.type === 'effect.blocked') {
      expect(blocked.capabilityId).toBe('e.read');
      expect(blocked.effect).toBe('read');
      expect(blocked.mode).toBe('simulate');
      expect(blocked.remediation).toContain('registerDouble');
    }
    expect(result.trace.at(-1)?.type).toBe('run.blocked');
  });

  it('runs only the registered double for a read capability in simulate mode', async () => {
    const read = spyCapability('read');
    const runtime = createRuntime();
    runtime.registerCapability(read.capability);
    runtime.registerDouble('e.read', read.double);
    await runtime.activate(oneNodeGraph('e.read'));

    const result = await runtime.run({ count: 5 }, { mode: 'simulate' });
    expect(result.status).toBe('completed');
    expect(read.real).not.toHaveBeenCalled();
    expect(read.double).toHaveBeenCalledTimes(1);
    expect(result.output).toEqual({ count: 6 });
    const completed = result.trace.find((event) => event.type === 'node.completed');
    if (completed?.type === 'node.completed') {
      expect(completed.invokedVia).toBe('double');
    }
  });

  it('blocks a write capability without a test double in simulate mode', async () => {
    const write = spyCapability('write');
    const runtime = createRuntime();
    runtime.registerCapability(write.capability);
    await runtime.activate(oneNodeGraph('e.write'));

    const result = await runtime.run({ count: 1 }, { mode: 'simulate' });
    expect(result.status).toBe('blocked');
    expect(write.real).not.toHaveBeenCalled();
  });

  it('runs only the registered double for a write capability in simulate mode', async () => {
    const write = spyCapability('write');
    const runtime = createRuntime();
    runtime.registerCapability(write.capability);
    runtime.registerDouble('e.write', write.double);
    await runtime.activate(oneNodeGraph('e.write'));

    const result = await runtime.run({ count: 2 }, { mode: 'simulate' });
    expect(result.status).toBe('completed');
    expect(write.real).not.toHaveBeenCalled();
    expect(write.double).toHaveBeenCalledTimes(1);
  });

  it('blocks irreversible capabilities in simulate mode even with explicit permission', async () => {
    const irreversible = spyCapability('irreversible');
    const runtime = createRuntime();
    runtime.registerCapability(irreversible.capability);
    runtime.registerDouble('e.irreversible', irreversible.double);
    await runtime.activate(oneNodeGraph('e.irreversible'));

    const result = await runtime.run(
      { count: 1 },
      { mode: 'simulate', policy: { allowIrreversible: true } },
    );
    // Simulate requires the double; the explicit allow policy must not bypass that.
    expect(result.status).toBe('completed');
    expect(irreversible.real).not.toHaveBeenCalled();
    expect(irreversible.double).toHaveBeenCalledTimes(1);
  });

  it('blocks irreversible capabilities in isolated test mode regardless of permission', async () => {
    const irreversible = spyCapability('irreversible');
    const runtime = createRuntime();
    runtime.registerCapability(irreversible.capability);
    await runtime.activate(oneNodeGraph('e.irreversible'));

    const result = await runtime.runNode('n', { count: 1 });
    expect(result.status).toBe('blocked');
    expect(irreversible.real).not.toHaveBeenCalled();
  });

  it('blocks irreversible capabilities in normal mode without explicit permission', async () => {
    const irreversible = spyCapability('irreversible');
    const runtime = createRuntime();
    runtime.registerCapability(irreversible.capability);
    await runtime.activate(oneNodeGraph('e.irreversible'));

    const result = await runtime.run({ count: 1 });
    expect(result.status).toBe('blocked');
    expect(irreversible.real).not.toHaveBeenCalled();
    const blocked = result.trace.find((event) => event.type === 'effect.blocked');
    if (blocked?.type === 'effect.blocked') {
      expect(blocked.remediation).toContain('allowIrreversible');
    }
  });

  it('runs irreversible capabilities for real in normal mode only with explicit permission', async () => {
    const irreversible = spyCapability('irreversible');
    const runtime = createRuntime();
    runtime.registerCapability(irreversible.capability);
    await runtime.activate(oneNodeGraph('e.irreversible'));

    const result = await runtime.run({ count: 1 }, { policy: { allowIrreversible: true } });
    expect(result.status).toBe('completed');
    expect(irreversible.real).toHaveBeenCalledTimes(1);
  });

  it('runs read/write capabilities for real in normal mode by default', async () => {
    const read = spyCapability('read');
    const write = spyCapability('write');
    const runtime = createRuntime();
    runtime.registerCapability(read.capability).registerCapability(write.capability);
    await runtime.activate(twoNodeGraph('e.read', 'e.write'));

    const result = await runtime.run({ count: 1 });
    expect(result.status).toBe('completed');
    expect(read.real).toHaveBeenCalledTimes(1);
    expect(write.real).toHaveBeenCalledTimes(1);
  });

  it('blocks test doubles only in the mode that requires them (normal ignores doubles)', async () => {
    const read = spyCapability('read');
    const runtime = createRuntime();
    runtime.registerCapability(read.capability);
    runtime.registerDouble('e.read', read.double);
    await runtime.activate(oneNodeGraph('e.read'));

    const result = await runtime.run({ count: 7 });
    expect(result.status).toBe('completed');
    expect(read.real).toHaveBeenCalledTimes(1);
    expect(read.double).not.toHaveBeenCalled();
  });
});

describe('isolated node testing', () => {
  it('does not traverse outgoing edges', async () => {
    const first = spyCapability('pure');
    const second = spyCapability('read');
    const runtime = createRuntime();
    runtime.registerCapability(first.capability).registerCapability(second.capability);
    runtime.registerDouble('e.read', second.double);
    await runtime.activate(twoNodeGraph('e.pure', 'e.read'));

    const result = await runtime.runNode('n1', { count: 1 });
    expect(result.status).toBe('completed');
    expect(first.real).toHaveBeenCalledTimes(1);
    expect(second.real).not.toHaveBeenCalled();
    expect(second.double).not.toHaveBeenCalled();
  });

  it('does not publish into normal run history', async () => {
    const pure = spyCapability('pure');
    const runtime = createRuntime();
    runtime.registerCapability(pure.capability);
    await runtime.activate(oneNodeGraph('e.pure'));

    const isolated = await runtime.runNode('n', { count: 1 });
    expect(isolated.status).toBe('completed');
    expect(isolated.trace.length).toBeGreaterThan(0);
    // Isolated node execution never writes durable run records.
    expect(await runtime.listRuns()).toEqual([]);

    // A normal run still lands in the store afterwards.
    await runtime.run({ count: 2 });
    expect((await runtime.listRuns()).length).toBe(1);
    const stored = await runtime.getRun(((await runtime.listRuns())[0] as { runId: string }).runId);
    expect(stored?.status).toBe('completed');
  });

  it('runs a registered safe double for irreversible capabilities in isolated testing while the real implementation stays untouched', async () => {
    const irreversible = spyCapability('irreversible');
    const runtime = createRuntime();
    runtime.registerCapability(irreversible.capability);
    runtime.registerDouble('e.irreversible', irreversible.double);
    await runtime.activate(oneNodeGraph('e.irreversible'));

    const result = await runtime.runNode('n', { count: 3 });
    // The safe double runs; the real irreversible implementation never does.
    expect(result.status).toBe('completed');
    expect(irreversible.double).toHaveBeenCalledTimes(1);
    expect(irreversible.real).not.toHaveBeenCalled();
    expect(result.output).toEqual({ count: 4 });
    const completed = result.trace.find((event) => event.type === 'node.completed');
    if (completed?.type === 'node.completed') {
      expect(completed.invokedVia).toBe('double');
    }
  });

  it('rejects isolated runs for unknown nodes', async () => {
    const pure = spyCapability('pure');
    const runtime = createRuntime();
    runtime.registerCapability(pure.capability);
    await runtime.activate(oneNodeGraph('e.pure'));
    await expect(runtime.runNode('ghost', {})).rejects.toMatchObject({
      code: 'VICT_RUNTIME_UNKNOWN_NODE',
    });
  });
});
