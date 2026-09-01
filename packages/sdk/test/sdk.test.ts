import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createRuntime, defineCapability, defineContract, defineGraph } from '@vict/sdk';
import { defineZodContract } from '@vict/sdk/zod';

/**
 * Smoke test for the public authoring surface: everything here goes through
 * the public SDK imports, as an application would. Both authoring routes are
 * exercised: the neutral `defineContract` and the optional Zod adapter.
 */
describe('@vict/sdk public surface', () => {
  it('authors, activates, and runs a two-node pure graph (zod adapter route)', async () => {
    const TextMessage = defineZodContract('smoke.text', '1', z.object({ text: z.string().min(1) }));
    const LoudMessage = defineZodContract(
      'smoke.loud',
      '1',
      z.object({ text: z.string().min(1), shout: z.boolean() }),
    );

    const uppercase = defineCapability({
      id: 'smoke.uppercase',
      revision: '1',
      effect: 'pure',
      input: TextMessage,
      output: TextMessage,
      invoke: async (input) => ({ text: input.text.toUpperCase() }),
    });
    const exclaim = defineCapability({
      id: 'smoke.exclaim',
      revision: '1',
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

    const activation = await runtime.activate(graph);
    expect(activation.ok).toBe(true);
    if (!activation.ok) {
      return;
    }
    expect(activation.nodeCount).toBe(2);
    expect(activation.capabilitySetVersion).toMatch(/^v1_[0-9a-f]{64}$/);
    expect(activation.activationVersion).toMatch(/^v1_[0-9a-f]{64}$/);

    const result = await runtime.run({ text: 'vict kernel' });
    expect(result.status).toBe('completed');
    expect(result.output).toEqual({ text: 'VICT KERNEL!', shout: true });
    expect(result.capabilitySetVersion).toBe(activation.capabilitySetVersion);
    expect(result.activationVersion).toBe(activation.activationVersion);
    expect(result.trace[0]?.type).toBe('run.started');
    expect(result.trace.at(-1)?.type).toBe('run.completed');
  });

  it('authors a contract through the neutral API without any schema library', async () => {
    // Neutral authoring: a plain parse function, no schema library involved.
    const Echo = defineContract<{ text: string }>({
      id: 'smoke.echo',
      revision: '3',
      parse: (input) => {
        const text = (input as { text?: unknown } | null)?.text;
        return typeof text === 'string'
          ? { ok: true, value: { text } }
          : {
              ok: false,
              issues: [
                {
                  code: 'invalid_type',
                  path: 'text',
                  message: "Expected a string at 'text', received unknown.",
                  expected: 'string',
                  received: 'undefined',
                },
              ],
            };
      },
    });

    const echo = defineCapability({
      id: 'smoke.echo-cap',
      revision: '1',
      effect: 'pure',
      input: Echo,
      output: Echo,
      invoke: async (input) => ({ text: input.text }),
    });
    const runtime = createRuntime();
    runtime.registerCapability(echo);
    const activation = await runtime.activate(
      defineGraph({
        id: 'smoke-neutral-graph',
        entry: 'e',
        nodes: [{ id: 'e', capability: 'smoke.echo-cap' }],
        edges: [],
      }),
    );
    expect(activation.ok).toBe(true);
    const rejected = await runtime.run({ wrong: true });
    expect(rejected.status).toBe('failed');
    const ok = await runtime.run({ text: 'neutral works' });
    expect(ok.status).toBe('completed');
    expect(ok.output).toEqual({ text: 'neutral works' });
  });

  it('exposes the effect policy vocabulary publicly', () => {
    const runtime = createRuntime();
    expect(typeof runtime.activate).toBe('function');
    expect(typeof runtime.registerDouble).toBe('function');
    expect(typeof runtime.replaceDouble).toBe('function');
    expect(typeof runtime.runNode).toBe('function');
  });
});
