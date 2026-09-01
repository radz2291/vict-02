import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createRuntime, defineCapability, defineGraph } from '@vict/sdk';
import { defineZodContract } from '@vict/sdk/zod';

/**
 * Pins the benchmark graph's event semantics: a three-node pure graph with
 * two edges emits exactly 10 events per run
 * (1 run.started + 3 x (node.started + node.completed) + 2 signal.routed
 * + 1 run.completed) and performs 6 contract validations
 * (entry input + 2 x (input + output) on middle/exit + final output).
 */
describe('benchmark graph event semantics', () => {
  it('three-node pure graph emits exactly 10 events in stable order', async () => {
    const In = defineZodContract('b.in', '1', z.object({ n: z.number() }));
    const Mid = defineZodContract('b.mid', '1', z.object({ n: z.number(), doubled: z.boolean() }));
    const Out = defineZodContract('b.out', '1', z.object({ n: z.number(), digest: z.string() }));

    const runtime = createRuntime();
    runtime
      .registerCapability(
        defineCapability({
          id: 'b.start',
          revision: '1',
          effect: 'pure',
          input: In,
          output: In,
          invoke: async (input) => ({ n: input.n }),
        }),
      )
      .registerCapability(
        defineCapability({
          id: 'b.prepare',
          revision: '1',
          effect: 'pure',
          input: In,
          output: Mid,
          invoke: (input) => ({ n: input.n, doubled: input.n % 2 === 0 }),
        }),
      )
      .registerCapability(
        defineCapability({
          id: 'b.finish',
          revision: '1',
          effect: 'pure',
          input: Mid,
          output: Out,
          invoke: (input) => ({ n: input.n, digest: `d-${input.n}-${input.doubled}` }),
        }),
      );
    await runtime.activate(
      defineGraph({
        id: 'b-three-node-pure',
        entry: 'start',
        nodes: [
          { id: 'start', capability: 'b.start' },
          { id: 'prepare', capability: 'b.prepare' },
          { id: 'finish', capability: 'b.finish' },
        ],
        edges: [
          { from: 'start', to: 'prepare' },
          { from: 'prepare', to: 'finish' },
        ],
      }),
    );

    const result = await runtime.run({ n: 2 });
    expect(result.status).toBe('completed');
    const types = result.trace.map((event) => event.type);
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
    expect(result.trace.length).toBe(10);
    expect(result.output).toEqual({ n: 2, digest: 'd-2-true' });
  });
});
