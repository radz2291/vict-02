import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineCapability, defineGraph } from '@vict/sdk';
import { defineZodContract } from '@vict/sdk/zod';
import { createRuntime } from '@vict/runtime';

const SECRET = 'capability-SECRET-c31e9b';

const Count = defineZodContract('x.count', '1', z.object({ count: z.number() }));

/** Input contract whose custom schema message embeds a unique secret. */
const GuardedInput = defineZodContract(
  'x.guarded',
  '1',
  z.object({
    token: z.string().refine((value) => value.length > 100, {
      message: `Auth rejected for token value: ${SECRET}`,
    }),
  }),
);

function graphWith(capabilityId: string) {
  return defineGraph({
    id: 'x-graph',
    entry: 'n',
    nodes: [{ id: 'n', capability: capabilityId }],
    edges: [],
  });
}

describe('error propagation safety', () => {
  it('capability-thrown messages containing secrets never reach traces or history', async () => {
    const runtime = createRuntime();
    runtime.registerCapability(
      defineCapability({
        id: 'x.thrower',
        revision: '1',
        effect: 'pure',
        input: Count,
        output: Count,
        invoke: (input) => {
          throw new Error(`provider rejected count=${input.count} secret=${SECRET}`);
        },
      }),
    );
    runtime.activate(graphWith('x.thrower'));

    const result = await runtime.run({ count: 1 });
    expect(result.status).toBe('failed');
    const serialized = JSON.stringify({
      trace: result.trace,
      error: result.error,
      record: runtime.getRun(result.runId),
    });
    expect(serialized).not.toContain(SECRET);
    expect(serialized).not.toContain('provider rejected');
    // Diagnostics remain useful: stable code, safe type name, correlation id.
    expect(result.error?.code).toBe('VICT_RUNTIME_CAPABILITY_THREW');
    expect(result.error?.details).toMatchObject({ capabilityId: 'x.thrower', errorName: 'Error' });
    expect(typeof (result.error?.details as { errorId?: string }).errorId).toBe('string');
  });

  it('error causes carrying secrets are sanitised too', async () => {
    const runtime = createRuntime();
    runtime.registerCapability(
      defineCapability({
        id: 'x.nested-thrower',
        revision: '1',
        effect: 'pure',
        input: Count,
        output: Count,
        invoke: () => {
          const cause = new Error(`deep cause secret=${SECRET}`);
          const wrapped = new Error('wrapped', { cause });
          throw wrapped;
        },
      }),
    );
    runtime.activate(graphWith('x.nested-thrower'));
    const result = await runtime.run({ count: 1 });
    expect(
      JSON.stringify({
        trace: result.trace,
        error: result.error,
        record: runtime.getRun(result.runId),
      }),
    ).not.toContain(SECRET);
  });

  it('custom schema messages containing secrets never reach traces or history', async () => {
    const runtime = createRuntime();
    runtime.registerCapability(
      defineCapability({
        id: 'x.guarded',
        revision: '1',
        effect: 'pure',
        input: GuardedInput,
        output: Count,
        invoke: (input) => ({ count: input.token.length }),
      }),
    );
    runtime.activate(graphWith('x.guarded'));

    const result = await runtime.run({ token: 'short-token' });
    expect(result.status).toBe('failed');
    const serialized = JSON.stringify({
      trace: result.trace,
      error: result.error,
      record: runtime.getRun(result.runId),
    });
    expect(serialized).not.toContain(SECRET);
    // The framework-generated message still diagnoses the failure precisely.
    const rejected = result.trace.find((event) => event.type === 'contract.rejected');
    expect(rejected).toBeDefined();
    if (rejected?.type === 'contract.rejected') {
      expect(rejected.issues[0]?.path).toBe('token');
      expect(rejected.issues[0]?.message).toMatch(/^Validation failed \(custom\) at 'token'/);
    }
  });

  it('nested secret values inside payloads never reach traces or default history', async () => {
    const runtime = createRuntime();
    runtime.registerCapability(
      defineCapability({
        id: 'x.passthrough',
        revision: '1',
        effect: 'pure',
        input: Count,
        output: Count,
        invoke: () =>
          ({ count: 1, nested: { password: SECRET, items: [SECRET] } }) as unknown as {
            count: number;
          },
      }),
    );
    runtime.activate(graphWith('x.passthrough'));
    const result = await runtime.run({ count: 1 });
    expect(result.status).toBe('completed');
    expect(result.output).toMatchObject({ count: 1 }); // caller keeps the real output
    const serialized = JSON.stringify({
      trace: result.trace,
      record: runtime.getRun(result.runId),
    });
    expect(serialized).not.toContain(SECRET);
    expect(serialized).not.toContain('password');
  });

  it('secret values inside failing inputs never reach traces or history', async () => {
    const runtime = createRuntime();
    runtime.registerCapability(
      defineCapability({
        id: 'x.guarded-input-secret',
        revision: '1',
        effect: 'pure',
        input: GuardedInput,
        output: Count,
        invoke: (input) => ({ count: input.token.length }),
      }),
    );
    runtime.activate(graphWith('x.guarded-input-secret'));

    // The failing input itself contains the secret.
    const result = await runtime.run({ token: SECRET });
    expect(result.status).toBe('failed');
    const serialized = JSON.stringify({
      trace: result.trace,
      error: result.error,
      record: runtime.getRun(result.runId),
    });
    expect(serialized).not.toContain(SECRET);
    // Received stays a length description; the invocation never happened.
    const rejected = result.trace.find((event) => event.type === 'contract.rejected');
    if (rejected?.type === 'contract.rejected') {
      expect(rejected.issues[0]?.received).toBe(`string(${SECRET.length})`);
    }
  });
});
