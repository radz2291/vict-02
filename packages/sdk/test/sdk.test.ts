import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createRuntime, defineCapability, defineContract, defineGraph } from '@vict/sdk';

/**
 * Smoke test for the public authoring surface: everything here goes through
 * the public SDK imports, as an application author would.
 */
describe('@vict/sdk public surface', () => {
  it('authors, activates, and runs a two-node pure graph', async () => {
    const TextMessage = defineContract('smoke.TextMessage', z.object({ text: z.string().min(1) }));
    const LoudMessage = defineContract(
      'smoke.LoudMessage',
      z.object({ text: z.string().min(1), shout: z.boolean() }),
    );

    const uppercase = defineCapability({
      id: 'smoke.uppercase',
      effect: 'pure',
      input: TextMessage,
      output: TextMessage,
      invoke: async (input) => ({ text: input.text.toUpperCase() }),
    });
    const exclaim = defineCapability({
      id: 'smoke.exclaim',
      effect: 'pure',
      input: TextMessage,
      output: LoudMessage,
      invoke: (input) => ({ text: `${input.text}!`, shout: true }),
    });

    const graph = defineGraph({
      id: 'smoke-graph',
      entry: 'upper',
      nodes: [
        { id: 'upper', capability: 'smoke.uppercase' },
        { id: 'exclaim', capability: 'smoke.exclaim' },
      ],
      edges: [{ from: 'upper', to: 'exclaim' }],
    });

    const runtime = createRuntime();
    runtime.registerCapability(uppercase).registerCapability(exclaim);

    const activation = runtime.activate(graph);
    expect(activation.ok).toBe(true);
    if (!activation.ok) {
      return;
    }
    expect(activation.nodeCount).toBe(2);

    const result = await runtime.run({ text: 'vict kernel' });
    expect(result.status).toBe('completed');
    expect(result.output).toEqual({ text: 'VICT KERNEL!', shout: true });
    expect(result.trace[0]?.type).toBe('run.started');
    expect(result.trace.at(-1)?.type).toBe('run.completed');
  });

  it('exposes the effect policy vocabulary publicly', () => {
    const runtime = createRuntime();
    expect(typeof runtime.activate).toBe('function');
    expect(typeof runtime.registerDouble).toBe('function');
    expect(typeof runtime.runNode).toBe('function');
  });
});
