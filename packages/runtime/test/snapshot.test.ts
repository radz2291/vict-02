import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { defineCapability, defineGraph } from '@vict/sdk';
import { defineZodContract } from '@vict/sdk/zod';
import { createRuntime } from '@vict/runtime';
import type { KernelEvent } from '@vict/sdk';

const Count = defineZodContract('s.count', '1', z.object({ count: z.number() }));

function oneNodeGraph(capabilityId: string) {
  return defineGraph({
    id: 's-graph',
    entry: 'n',
    nodes: [{ id: 'n', capability: capabilityId }],
    edges: [],
  });
}

function twoNodeGraph(first: string, second: string) {
  return defineGraph({
    id: 's-graph-2',
    entry: 'n1',
    nodes: [
      { id: 'n1', capability: first },
      { id: 'n2', capability: second },
    ],
    edges: [{ from: 'n1', to: 'n2' }],
  });
}

describe('activation snapshot semantics', () => {
  it('post-activation mutation of the capability-definition object does not affect execution', async () => {
    const real = vi.fn((input: { count: number }) => ({ count: input.count + 1000 }));
    // Keep a mutable reference the test controls after registration.
    const definition = {
      id: 's.mutant',
      revision: '1',
      effect: 'pure' as const,
      input: Count,
      output: Count,
      invoke: real,
    };
    const runtime = createRuntime();
    runtime.registerCapability(definition);
    await runtime.activate(oneNodeGraph('s.mutant'));

    const before = await runtime.run({ count: 1 }, { mode: 'simulate' });
    expect(before.status).toBe('completed'); // pure runs real in simulate

    // Mutate the ORIGINAL definition object after activation.
    (definition as { effect: string }).effect = 'write';
    (definition as { invoke: (input: { count: number }) => unknown }).invoke = () => ({
      count: 666,
    });

    const after = await runtime.run({ count: 2 }, { mode: 'simulate' });
    // The activation snapshot still has effect 'pure' and the original invoke.
    expect(after.status).toBe('completed');
    expect(after.output).toEqual({ count: 1002 });
    expect(real).toHaveBeenCalledTimes(2);
    expect(after.activationVersion).toBe(before.activationVersion);
  });

  it('post-activation registration does not affect the active graph', async () => {
    const runtime = createRuntime();
    runtime.registerCapability(
      defineCapability({
        id: 's.pure',
        revision: '1',
        effect: 'pure',
        input: Count,
        output: Count,
        invoke: (input) => input,
      }),
    );
    const activation = await runtime.activate(oneNodeGraph('s.pure'));
    const before = await runtime.run({ count: 1 });
    expect(before.status).toBe('completed');

    runtime.registerCapability(
      defineCapability({
        id: 's.latecomer',
        revision: '1',
        effect: 'irreversible',
        input: Count,
        output: Count,
        invoke: () => ({ count: -1 }),
      }),
    );
    expect(runtime.activeGraph()?.activationVersion).toBe(
      activation.ok ? activation.activationVersion : '',
    );
    const after = await runtime.run({ count: 2 });
    expect(after.status).toBe('completed');
    expect(after.output).toEqual({ count: 2 });
    expect(after.activationVersion).toBe(before.activationVersion);
  });

  it('explicit reactivation captures the updated registry under a new activation identity', async () => {
    const definition = {
      id: 's.revisable',
      revision: '1',
      effect: 'pure' as const,
      input: Count,
      output: Count,
      invoke: (input: { count: number }) => ({ count: input.count }),
    };
    const runtime = createRuntime();
    runtime.registerCapability(definition);
    const first = await runtime.activate(oneNodeGraph('s.revisable'));
    expect(first.ok).toBe(true);

    // Change the effect class and revision, then reactivate explicitly.
    (definition as { effect: string }).effect = 'write';
    definition.revision = '2';
    const second = await runtime.activate(oneNodeGraph('s.revisable'));
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.graphVersion).toBe(second.graphVersion); // topology unchanged
      expect(first.capabilitySetVersion).not.toBe(second.capabilitySetVersion);
      expect(first.activationVersion).not.toBe(second.activationVersion);
    }

    // New semantics are live: simulate now requires a double for 'write'.
    const simulated = await runtime.run({ count: 1 }, { mode: 'simulate' });
    expect(simulated.status).toBe('blocked');
  });

  it('mid-run double registration does not affect an in-flight run; later runs see it', async () => {
    const real = vi.fn((input: { count: number }) => ({ count: input.count + 1000 }));
    const double = vi.fn((input: unknown) => ({ count: (input as { count: number }).count + 1 }));
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const seen = new Set<string>();

    const runtime = createRuntime();
    runtime
      .registerCapability(
        defineCapability({
          id: 's.gate',
          revision: '1',
          effect: 'pure',
          input: Count,
          output: Count,
          invoke: async (input) => {
            await gate;
            return input;
          },
        }),
      )
      .registerCapability(
        defineCapability({
          id: 's.reader',
          revision: '1',
          effect: 'read',
          input: Count,
          output: Count,
          invoke: real,
        }),
      );
    await runtime.activate(twoNodeGraph('s.gate', 's.reader'));

    const inFlight = runtime.run(
      { count: 5 },
      {
        mode: 'simulate',
        onEvent: (event: KernelEvent) => {
          if (event.type === 'node.started' && event.nodeId === 'n1' && !seen.has('n1')) {
            seen.add('n1');
            // Mutate test configuration while the run is in flight, then proceed.
            queueMicrotask(() => {
              runtime.registerDouble('s.reader', double);
              release();
            });
          }
        },
      },
    );

    const result = await inFlight;
    // The run pinned its doubles at start: the reader is blocked, real never runs.
    expect(result.status).toBe('blocked');
    expect(real).not.toHaveBeenCalled();
    expect(double).not.toHaveBeenCalled();
    expect(result.trace.some((event) => event.type === 'effect.blocked')).toBe(true);

    // Later runs observe the registered double.
    const later = await runtime.run({ count: 5 }, { mode: 'simulate' });
    expect(later.status).toBe('completed');
    expect(double).toHaveBeenCalledTimes(1);
    expect(real).not.toHaveBeenCalled();
  });

  it('mid-run double replacement does not affect an in-flight run; later runs use the replacement', async () => {
    const doubleA = vi.fn((input: unknown) => ({
      count: (input as { count: number }).count + 100,
    }));
    const doubleB = vi.fn((input: unknown) => ({
      count: (input as { count: number }).count + 200,
    }));
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const seen = new Set<string>();

    const runtime = createRuntime();
    runtime
      .registerCapability(
        defineCapability({
          id: 's.gate',
          revision: '1',
          effect: 'pure',
          input: Count,
          output: Count,
          invoke: async (input) => {
            await gate;
            return input;
          },
        }),
      )
      .registerCapability(
        defineCapability({
          id: 's.pure',
          revision: '1',
          effect: 'read',
          input: Count,
          output: Count,
          invoke: (input) => input,
        }),
      );
    runtime.registerDouble('s.pure', doubleA);
    await runtime.activate(twoNodeGraph('s.gate', 's.pure'));

    const inFlight = runtime.run(
      { count: 1 },
      {
        mode: 'simulate',
        onEvent: (event: KernelEvent) => {
          if (event.type === 'node.started' && event.nodeId === 'n1' && !seen.has('n1')) {
            seen.add('n1');
            queueMicrotask(() => {
              runtime.replaceDouble('s.pure', doubleB);
              release();
            });
          }
        },
      },
    );

    const result = await inFlight;
    // In-flight run keeps its run-start snapshot: the original double answered.
    expect(result.status).toBe('completed');
    expect(doubleA).toHaveBeenCalledTimes(1);
    expect(doubleB).not.toHaveBeenCalled();
    expect(result.output).toEqual({ count: 101 });

    // Later runs use the replacement.
    const later = await runtime.run({ count: 1 }, { mode: 'simulate' });
    expect(later.status).toBe('completed');
    expect(doubleA).toHaveBeenCalledTimes(1);
    expect(doubleB).toHaveBeenCalledTimes(1);
    expect(later.output).toEqual({ count: 201 });
  });
});
