import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineCapability, defineGraph } from '@vict/sdk';
import { defineZodContract } from '@vict/sdk/zod';
import { createRuntime } from '@vict/runtime';
import type { PayloadRetention } from '@vict/runtime';

const SECRET_OUTPUT = { text: 'public part', secretNote: 'retained-SECRET-8a2f1' };
const SECRET = 'retained-SECRET-8a2f1';

const Text = defineZodContract(
  'r.text',
  '1',
  z.object({ text: z.string(), secretNote: z.string() }),
);
const Count = defineZodContract('r.count', '1', z.object({ count: z.number() }));

async function retentionRuntime(retention: PayloadRetention) {
  const runtime = createRuntime({ payloadRetention: retention });
  runtime.registerCapability(
    defineCapability({
      id: 'r.producer',
      revision: '1',
      effect: 'pure',
      input: Count,
      output: Text,
      invoke: () => SECRET_OUTPUT,
    }),
  );
  await runtime.activate(
    defineGraph({
      id: 'r-graph',
      entry: 'p',
      nodes: [{ id: 'p', capability: 'r.producer' }],
      edges: [],
    }),
  );
  return { runtime };
}

describe('run-record payload policy', () => {
  it('default retention stores metadata and safe summary only', async () => {
    const { runtime } = await retentionRuntime('summary');
    const result = await runtime.run({ count: 1 });
    expect(result.status).toBe('completed');
    // The caller still receives the actual output.
    expect(result.output).toEqual(SECRET_OUTPUT);

    const record = await runtime.getRun(result.runId);
    expect(record?.retention).toBe('summary');
    expect('output' in (record ?? {})).toBe(false);
    expect(record?.outputSummary).toEqual({
      shape: 'object',
      keys: ['text', '[redacted]'],
    });
    // Serialized default history contains no secret values.
    expect(JSON.stringify(record)).not.toContain(SECRET);
  });

  it("'none' retains no output payload or summary", async () => {
    const { runtime } = await retentionRuntime('none');
    const result = await runtime.run({ count: 1 });
    expect(result.output).toEqual(SECRET_OUTPUT); // caller-facing result unaffected

    const record = await runtime.getRun(result.runId);
    expect(record?.retention).toBe('none');
    expect('output' in (record ?? {})).toBe(false);
    expect('outputSummary' in (record ?? {})).toBe(false);
    expect(JSON.stringify(record)).not.toContain(SECRET);
  });

  it("explicit 'full' retention stores the complete output", async () => {
    const { runtime } = await retentionRuntime('full');
    const result = await runtime.run({ count: 1 });
    expect(result.output).toEqual(SECRET_OUTPUT);

    const record = await runtime.getRun(result.runId);
    expect(record?.retention).toBe('full');
    expect(record?.output).toEqual(SECRET_OUTPUT);
    expect(record?.outputSummary).toBeDefined();
  });

  it('failed runs retain sanitised errors under every retention policy', async () => {
    for (const retention of ['none', 'summary', 'full'] as const) {
      const runtime = createRuntime({ payloadRetention: retention });
      runtime.registerCapability(
        defineCapability({
          id: 'r.failing',
          revision: '1',
          effect: 'pure',
          input: Count,
          output: Count,
          invoke: () => {
            throw new Error(`exploded with ${SECRET}`);
          },
        }),
      );
      await runtime.activate(
        defineGraph({
          id: 'r-fail-graph',
          entry: 'f',
          nodes: [{ id: 'f', capability: 'r.failing' }],
          edges: [],
        }),
      );
      const result = await runtime.run({ count: 1 });
      expect(result.status).toBe('failed');
      const record = await runtime.getRun(result.runId);
      expect(record?.error?.code).toBe('VICT_RUNTIME_CAPABILITY_THREW');
      expect(JSON.stringify(record)).not.toContain(SECRET);
      expect(JSON.stringify(result)).not.toContain(SECRET);
    }
  });
});
