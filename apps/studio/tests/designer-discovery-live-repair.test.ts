import { expect, it } from 'vitest';
import { createDeterministicOfflineModel, OFFLINE_MODEL_IDENTITY } from '@victframework/mastra';
import { newScreen } from '../src/lib/designer/application.js';
import { agentContext, documentCursor } from '../src/lib/designer/agent-edits.js';
import {
  openAgentRun,
  validateAgentStart,
  type StudioAgentEvent,
} from '../src/lib/server/designer-agent.js';

const source = newScreen('Discovery protocol proof', 'discovery-protocol-proof');
const cursor = documentCursor(source, 'r1', crypto.randomUUID());

async function execute(
  owner: string,
  calls: { toolName: string; args: Record<string, unknown> }[],
) {
  const parsed = validateAgentStart({
    prompt: 'Exercise the declared discovery protocol without editing.',
    document: source,
    cursor,
    history: [],
  });
  if (!parsed.ok) throw Error(parsed.message);
  const input = JSON.stringify({
    request: parsed.value.prompt,
    untrusted_history: [],
    untrusted_screen: agentContext(source, cursor),
  });
  const model = createDeterministicOfflineModel({
    script: {
      [input]: {
        kind: 'tool-chain',
        calls,
        thenText: 'Protocol probe finished; no application completion claimed.',
      },
    },
  });
  const events: StudioAgentEvent[] = [],
    prompts: unknown[] = [];
  const opened = openAgentRun(owner, parsed.value, (event) => events.push(event), {
    model: OFFLINE_MODEL_IDENTITY,
    modelFactory: () => ({
      ...model,
      doStream: async (options: Parameters<typeof model.doStream>[0]) => {
        prompts.push(options.prompt);
        return model.doStream(options);
      },
    }),
  });
  if (!opened.ok) throw Error(opened.code);
  await opened.finished;
  return { events, prompts };
}

it('emits only value-free input types through the actual pinned executor before rejected reads invoke', async () => {
  const canary = 'PRIVATE_INPUT_VALUE_MUST_NOT_ENTER_RECEIPTS';
  const { events } = await execute('discovery-shape-proof', [
    {
      toolName: 'studio_screen_read',
      args: {
        section: 'contracts',
        components: canary,
        includeExamples: 'false',
        offset: '0',
        expectedBodyIdentities: canary,
      },
    },
  ]);
  const diagnostics = events.filter(
    (event): event is Extract<StudioAgentEvent, { type: 'schema-diagnostic' }> =>
      event.type === 'schema-diagnostic',
  );
  expect(diagnostics.length).toBeGreaterThan(0);
  const shape = diagnostics
    .map((event) => JSON.parse(event.details))
    .find((value) => value.observedInputShape)?.observedInputShape;
  expect(shape).toMatchObject({ schema: 'studio.tool-input-shape@1', rootType: 'object' });
  for (const field of ['components', 'includeExamples', 'offset', 'expectedBodyIdentities'])
    expect(shape.fields).toContainEqual({ path: [field], observedType: 'string' });
  expect(JSON.stringify(events)).not.toContain(canary);
  expect(events.filter((event) => event.type === 'proposal')).toEqual([]);
  expect(events.at(-1)).toMatchObject({ type: 'done', applied: 0 });
}, 120000);

it('retains completed scalar component pages through cursor-only calls in the actual pinned executor', async () => {
  const calls: { toolName: string; args: Record<string, unknown> }[] = [];
  let query: Record<string, unknown> = {
    section: 'knowledge',
    kind: 'component',
    key: 'vict.flow.workspace@2',
  };
  let pages = 0;
  for (;;) {
    calls.push({ toolName: 'studio_screen_read', args: query });
    const result = agentContext(source, cursor, undefined, query);
    expect(result.ok).not.toBe(false);
    pages++;
    if (result.nextCursor === null) break;
    expect(typeof result.nextCursor).toBe('string');
    query = { section: 'knowledge', cursor: result.nextCursor };
    if (pages > 30) throw Error('Unbounded knowledge continuation');
  }
  expect(pages).toBeGreaterThan(1);
  const { events, prompts } = await execute('discovery-cursor-proof', calls);
  expect(events.at(-1)).toMatchObject({
    type: 'done',
    applied: 0,
    metrics: { categories: { knowledge: pages, source: 0, edit: 0, observe: 0 } },
  });
  const completions: unknown[] = [];
  const results: Record<string, unknown>[] = [];
  function inspect(value: unknown, depth = 0): void {
    if (depth > 18) return;
    if (typeof value === 'string' && /^[{[]/.test(value)) {
      try {
        inspect(JSON.parse(value), depth + 1);
      } catch {
        /* Non-JSON model prompt text is not a tool result. */
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => inspect(item, depth + 1));
      return;
    }
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      if (record.turnProgress && record.section === 'knowledge') results.push(record);
      const retained = (
        record.turnProgress as { retainedKnowledge?: { complete?: unknown[] } } | undefined
      )?.retainedKnowledge;
      if (retained?.complete) completions.push(...retained.complete);
      Object.values(record).forEach((item) => inspect(item, depth + 1));
    }
  }
  inspect(prompts);
  expect(results.some((result) => result.nextCursor === null)).toBe(true);
  expect(completions).toEqual(
    expect.arrayContaining([expect.objectContaining({ key: 'vict.flow.workspace@2' })]),
  );
}, 120000);
