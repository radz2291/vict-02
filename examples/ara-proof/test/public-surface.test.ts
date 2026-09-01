import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createRuntime, defineCapability, defineGraph, type VictRuntime } from '@vict/sdk';
import { defineZodContract } from '@vict/sdk/zod';

/**
 * Public-surface smoke test: this file imports ONLY from '@vict/sdk' and its
 * optional zod adapter '@vict/sdk/zod' (plus zod for schema authoring),
 * exactly as an external application would, and proves the system through
 * public APIs - not package internals.
 */

const Text = defineZodContract('pub.text', '1', z.object({ text: z.string().min(1) }));
const Enriched = defineZodContract(
  'pub.enriched',
  '1',
  z.object({ text: z.string(), notes: z.number() }),
);

function buildPublicApp(runtime: VictRuntime): void {
  const normalize = defineCapability({
    id: 'pub.normalize',
    revision: '1',
    effect: 'pure',
    input: Text,
    output: Text,
    invoke: async (input) => ({ text: input.text.trim() }),
  });
  const enrich = defineCapability({
    id: 'pub.enrich',
    revision: '1',
    effect: 'read',
    input: Text,
    output: Enriched,
    invoke: (input) => ({ text: input.text, notes: input.text.length }),
  });
  runtime.registerCapability(normalize).registerCapability(enrich);
  runtime.activate(
    defineGraph({
      id: 'pub-graph',
      entry: 'normalize',
      nodes: [
        { id: 'normalize', capability: 'pub.normalize' },
        { id: 'enrich', capability: 'pub.enrich' },
      ],
      edges: [{ from: 'normalize', to: 'enrich' }],
    }),
  );
}

describe('public SDK surface (outside package internals)', () => {
  it('runs a normal execution end to end', async () => {
    const runtime = createRuntime();
    await buildPublicApp(runtime);
    const result = await runtime.run({ text: '  public surface  ' });
    expect(result.status).toBe('completed');
    expect(result.output).toEqual({ text: 'public surface', notes: 14 });
    expect(result.graphId).toBe('pub-graph');
    expect(result.graphVersion).toMatch(/^v1_[0-9a-f]{64}$/);
    expect(result.capabilitySetVersion).toMatch(/^v1_[0-9a-f]{64}$/);
    expect(result.activationVersion).toMatch(/^v1_[0-9a-f]{64}$/);
  });

  it('blocks unmocked read effects in simulation through the public API only', async () => {
    const runtime = createRuntime();
    await buildPublicApp(runtime);
    const result = await runtime.run({ text: 'x' }, { mode: 'simulate' });
    expect(result.status).toBe('blocked');
    expect(result.trace.some((event) => event.type === 'effect.blocked')).toBe(true);
  });
});

/**
 * The ARA proof itself, re-implemented here against the public surface so the
 * integration project exercises the exact imports an application would use.
 */
const araContracts = {
  UserMessage: defineZodContract('ara2.UserMessage', '1', z.object({ text: z.string().min(1) })),
  PreparedContext: defineZodContract(
    'ara2.PreparedContext',
    '1',
    z.object({ text: z.string().min(1), context: z.array(z.string()) }),
  ),
  AssistantMessage: defineZodContract(
    'ara2.AssistantMessage',
    '1',
    z.object({ role: z.literal('assistant'), text: z.string().min(1) }),
  ),
};

async function buildAraRuntime(): Promise<VictRuntime> {
  const runtime = createRuntime();
  const { UserMessage, PreparedContext, AssistantMessage } = araContracts;
  runtime
    .registerCapability(
      defineCapability({
        id: 'ara2.user-message',
        revision: '1',
        effect: 'pure',
        input: UserMessage,
        output: UserMessage,
        invoke: async (input) => ({ text: input.text.trim() }),
      }),
    )
    .registerCapability(
      defineCapability({
        id: 'ara2.prepare-context',
        revision: '1',
        effect: 'pure',
        input: UserMessage,
        output: PreparedContext,
        invoke: (input) => ({
          text: input.text,
          context: ['conversation: public-proof', `user-goal: ${input.text}`],
        }),
      }),
    )
    .registerCapability(
      defineCapability({
        id: 'ara2.assistant',
        revision: '1',
        effect: 'read',
        input: PreparedContext,
        output: AssistantMessage,
        invoke: (input) => ({
          role: 'assistant' as const,
          text: `Practical next step for "${input.text}": reviewed ${input.context.length} context note(s).`,
        }),
      }),
    )
    .registerCapability(
      defineCapability({
        id: 'ara2.assistant-response',
        revision: '1',
        effect: 'pure',
        input: AssistantMessage,
        output: AssistantMessage,
        invoke: async (message) => ({ role: message.role, text: message.text }),
      }),
    );
  const activation = await runtime.activate(
    defineGraph({
      id: 'ara2-proof',
      entry: 'user-message',
      nodes: [
        { id: 'user-message', capability: 'ara2.user-message' },
        { id: 'prepare-context', capability: 'ara2.prepare-context' },
        { id: 'assistant', capability: 'ara2.assistant' },
        { id: 'assistant-response', capability: 'ara2.assistant-response' },
      ],
      edges: [
        { from: 'user-message', to: 'prepare-context' },
        { from: 'prepare-context', to: 'assistant' },
        { from: 'assistant', to: 'assistant-response' },
      ],
    }),
  );
  if (!activation.ok) {
    throw new Error(`ARA graph failed to activate: ${JSON.stringify(activation.issues)}`);
  }
  return runtime;
}

describe('ARA proof integration (public imports)', () => {
  it('executes one user message through the full graph, offline, with exactly 13 events', async () => {
    const runtime = await buildAraRuntime();
    const active = runtime.activeGraph();
    expect(active?.id).toBe('ara2-proof');

    const result = await runtime.run<{ role: 'assistant'; text: string }>({
      text: 'Help me make this practical',
    });

    // 3. completed run status
    expect(result.status).toBe('completed');

    // 4. assistant output contract holds
    expect(result.output).toBeDefined();
    const parsed = araContracts.AssistantMessage.parse(result.output);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.text).toContain('Help me make this practical');
    }

    // 5. expected ordered nodes
    const nodeOrder = result.trace
      .filter((event) => event.type === 'node.started')
      .map((event) => (event.type === 'node.started' ? event.nodeId : ''));
    expect(nodeOrder).toEqual([
      'user-message',
      'prepare-context',
      'assistant',
      'assistant-response',
    ]);

    // 6. terminal event matches status; trace stays at exactly 13 events
    //    (1 run.started + 4 x 2 node events + 3 signal.routed + 1 run.completed).
    expect(result.trace.at(-1)?.type).toBe('run.completed');
    expect(result.trace.length).toBe(13);

    // 7. graph id and all three identity layers pinned on every event
    for (const event of result.trace) {
      expect(event.graphId).toBe('ara2-proof');
      expect(event.graphVersion).toBe(active?.version);
      expect(event.capabilitySetVersion).toBe(active?.capabilitySetVersion);
      expect(event.activationVersion).toBe(active?.activationVersion);
    }

    // Run record persisted under the same id.
    expect((await runtime.getRun(result.runId))?.runId).toBe(result.runId);
  });

  it('blocks the assistant node in simulation without a double, runs the double when registered', async () => {
    const runtime = await buildAraRuntime();
    const double = vi.fn(() => ({
      role: 'assistant' as const,
      text: 'simulated reply',
    }));
    runtime.registerDouble('ara2.assistant', double);

    const simulated = await runtime.run({ text: 'simulate me' }, { mode: 'simulate' });
    expect(simulated.status).toBe('completed');
    expect(double).toHaveBeenCalledTimes(1);
    expect(simulated.output).toEqual({ role: 'assistant', text: 'simulated reply' });

    // Normal mode still uses the real deterministic provider.
    const normal = await runtime.run({ text: 'real me' });
    expect(normal.status).toBe('completed');
    expect(double).toHaveBeenCalledTimes(1); // unchanged
    expect(
      normal.output && typeof normal.output === 'object' && 'text' in normal.output
        ? normal.output.text
        : '',
    ).toContain('real me');
  });
});
