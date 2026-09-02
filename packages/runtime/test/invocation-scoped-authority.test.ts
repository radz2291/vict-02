import { describe, expect, it } from 'vitest';
import { defineGraph, neutralJsonContract } from '@vict/sdk';
import { createInMemoryStores, createRuntime } from '@vict/runtime';
import type { VictRuntime } from '@vict/runtime';
import { createSqliteStores } from '@vict/store-sqlite';

/**
 * HIGH-04-D (RE-AUDIT) permanent remediation suite — the authority
 * configuration/secret caches must be genuinely INVOCATION-SCOPED.
 *
 * The corrected caches (and their resolver functions) live INSIDE the
 * per-invocation execution boundary of the gate returned by
 * `gateCapabilityInvoke`:
 *
 * 1. every invocation creates its own private configuration/secret caches;
 * 2. required eager resolution and handler reads share those caches;
 * 3. repeated reads of one name within one invocation call the provider at
 *    most once;
 * 4. a subsequent invocation calls the provider again (rotation observed);
 * 5. concurrent invocations never share cached values or promises;
 * 6. a provider failure affects only the current invocation;
 * 7. a later invocation recovers after the provider recovers;
 * 8. `undefined` values stay distinguishable from 'not yet read';
 * 9. provider errors remain sanitized (raw messages/values never leak);
 * 10. declarations, activation identity, and least-authority enforcement
 *     are unchanged.
 *
 * Proven on the sequential runtime, the durable in-memory orchestration,
 * and the SQLite orchestration.
 */

type Engine = 'sequential' | 'in-memory' | 'sqlite';

const ENGINES: readonly Engine[] = ['sequential', 'in-memory', 'sqlite'];

interface AuthorityPorts {
  grants?: readonly string[];
  configuration?: { get(name: string): unknown };
  secrets?: { get(name: string): Promise<string | undefined> };
}

async function withRuntime(
  engine: Engine,
  authority: AuthorityPorts,
  run: (runtime: VictRuntime) => Promise<void>,
): Promise<void> {
  const stores =
    engine === 'sqlite'
      ? createSqliteStores({ path: ':memory:' })
      : engine === 'in-memory'
        ? createInMemoryStores()
        : undefined;
  const runtime =
    stores !== undefined ? createRuntime({ stores, authority }) : createRuntime({ authority });
  try {
    await run(runtime);
  } finally {
    if (
      stores !== undefined &&
      'dispose' in stores &&
      typeof (stores as { dispose?: unknown }).dispose === 'function'
    ) {
      await (stores as unknown as { dispose(): Promise<void> }).dispose();
    }
  }
}

let capabilityCounter = 0;

/** A unique graph binding one capability id (fresh identity per case). */
function graphFor(capabilityId: string): Parameters<VictRuntime['activate']>[0] {
  capabilityCounter += 1;
  const id = `g.inv-scoped.${capabilityCounter}`;
  return defineGraph({
    id,
    entry: 'only',
    nodes: [{ id: 'only', capability: capabilityId }],
    edges: [],
  });
}

async function activateOnce(runtime: VictRuntime, capabilityId: string): Promise<void> {
  const activation = await runtime.activate(graphFor(capabilityId));
  if (!activation.ok) {
    throw new Error(`activation failed: ${JSON.stringify(activation.issues)}`);
  }
}

describe.each(ENGINES)('HIGH-04-D: invocation-scoped authority caches (%s)', (engine) => {
  it('rotating required configuration: each invocation re-reads the provider', async () => {
    const values = ['cfg-v1', 'cfg-v2'];
    let reads = 0;
    await withRuntime(
      engine,
      { grants: [], configuration: { get: () => values[Math.min(reads++, values.length - 1)] } },
      async (runtime) => {
        runtime.registerCapability({
          id: 'inv.rot.cfg',
          revision: '1',
          effect: 'pure',
          input: neutralJsonContract,
          output: neutralJsonContract,
          requiredConfiguration: ['cfg.rot'],
          invoke: (_input, context) => context.config?.get('cfg.rot'),
        });
        await activateOnce(runtime, 'inv.rot.cfg');
        const run1 = await runtime.run({ v: 'x' }, { mode: 'normal' });
        expect(run1.status).toBe('completed');
        expect(run1.output).toBe('cfg-v1');
        const run2 = await runtime.run({ v: 'x' }, { mode: 'normal' });
        expect(run2.status).toBe('completed');
        // A shared (capability-lifetime) cache would return 'cfg-v1' again.
        expect(run2.output).toBe('cfg-v2');
        expect(reads).toBe(2);
      },
    );
  });

  it('rotating required secrets: each invocation re-reads the provider', async () => {
    const values = ['sec-v1', 'sec-v2'];
    let reads = 0;
    await withRuntime(
      engine,
      {
        grants: [],
        secrets: {
          get: async () => values[Math.min(reads++, values.length - 1)],
        },
      },
      async (runtime) => {
        runtime.registerCapability({
          id: 'inv.rot.sec',
          revision: '1',
          effect: 'pure',
          input: neutralJsonContract,
          output: neutralJsonContract,
          requiredSecrets: ['sec.rot'],
          invoke: async (_input, context) => await context.secrets?.get('sec.rot'),
        });
        await activateOnce(runtime, 'inv.rot.sec');
        const run1 = await runtime.run({ v: 'x' }, { mode: 'normal' });
        expect(run1.status).toBe('completed');
        expect(run1.output).toBe('sec-v1');
        const run2 = await runtime.run({ v: 'x' }, { mode: 'normal' });
        expect(run2.status).toBe('completed');
        expect(run2.output).toBe('sec-v2');
        expect(reads).toBe(2);
      },
    );
  });

  it('required eager resolution + repeated handler reads: ONE provider read per invocation', async () => {
    let reads = 0;
    await withRuntime(
      engine,
      {
        grants: [],
        configuration: {
          get: () => {
            reads += 1;
            return 'stable-cfg';
          },
        },
      },
      async (runtime) => {
        runtime.registerCapability({
          id: 'inv.once.cfg',
          revision: '1',
          effect: 'pure',
          input: neutralJsonContract,
          output: neutralJsonContract,
          requiredConfiguration: ['cfg.once'],
          invoke: (_input, context) => {
            const a = context.config?.get('cfg.once');
            const b = context.config?.get('cfg.once');
            const c = context.config?.get('cfg.once');
            return `${String(a)}|${String(b)}|${String(c)}`;
          },
        });
        await activateOnce(runtime, 'inv.once.cfg');
        const result = await runtime.run({ v: 'x' }, { mode: 'normal' });
        expect(result.status).toBe('completed');
        expect(result.output).toBe('stable-cfg|stable-cfg|stable-cfg');
        // One eager read (required) + ZERO re-reads for the handler reads.
        expect(reads).toBe(1);
      },
    );
  });

  it('optional configuration and secret read repeatedly: one read per name per invocation', async () => {
    const configReads: string[] = [];
    const secretReads: string[] = [];
    await withRuntime(
      engine,
      {
        grants: [],
        configuration: {
          get: (name: string) => {
            configReads.push(name);
            return `cfg:${name}`;
          },
        },
        secrets: {
          get: async (name: string) => {
            secretReads.push(name);
            return `sec:${name}`;
          },
        },
      },
      async (runtime) => {
        runtime.registerCapability({
          id: 'inv.lazy',
          revision: '1',
          effect: 'pure',
          input: neutralJsonContract,
          output: neutralJsonContract,
          configuration: ['cfg.opt'],
          secrets: ['sec.opt'],
          invoke: async (_input, context) => {
            const c1 = context.config?.get('cfg.opt');
            const c2 = context.config?.get('cfg.opt');
            const s1 = await context.secrets?.get('sec.opt');
            const s2 = await context.secrets?.get('sec.opt');
            return `${String(c1)}|${String(c2)}|${String(s1)}|${String(s2)}`;
          },
        });
        await activateOnce(runtime, 'inv.lazy');
        const result = await runtime.run({ v: 'x' }, { mode: 'normal' });
        expect(result.status).toBe('completed');
        expect(result.output).toBe('cfg:cfg.opt|cfg:cfg.opt|sec:sec.opt|sec:sec.opt');
        expect(configReads).toEqual(['cfg.opt']);
        expect(secretReads).toEqual(['sec.opt']);
      },
    );
  });

  it('a failed configuration-provider call affects only that invocation; the next run recovers', async () => {
    const CANARY = 'CONFIG-PROVIDER-FAILURE-CANARY-hd1';
    let calls = 0;
    await withRuntime(
      engine,
      {
        grants: [],
        configuration: {
          get: () => {
            calls += 1;
            if (calls === 1) {
              throw new Error(`provider outage ${CANARY}`);
            }
            return 'cfg-recovered';
          },
        },
      },
      async (runtime) => {
        runtime.registerCapability({
          id: 'inv.cfg.recover',
          revision: '1',
          effect: 'pure',
          input: neutralJsonContract,
          output: neutralJsonContract,
          requiredConfiguration: ['cfg.recover'],
          invoke: (_input, context) => context.config?.get('cfg.recover'),
        });
        await activateOnce(runtime, 'inv.cfg.recover');
        const run1 = await runtime.run({ v: 'x' }, { mode: 'normal' });
        expect(run1.status).toBe('failed');
        expect(run1.error?.code).toBe('VICT_RUNTIME_CONFIGURATION_UNAVAILABLE');
        // The provider was re-read on the second invocation and recovered.
        const run2 = await runtime.run({ v: 'x' }, { mode: 'normal' });
        expect(run2.status).toBe('completed');
        expect(run2.output).toBe('cfg-recovered');
        expect(calls).toBe(2);
        // The raw provider message never enters the failure surface.
        expect(JSON.stringify(run1)).not.toContain(CANARY);
        expect(JSON.stringify(await runtime.listRuns())).not.toContain(CANARY);
      },
    );
  });

  it('a rejected secret-provider promise poisons only that invocation; the next run recovers', async () => {
    const CANARY = 'SECRET-PROVIDER-FAILURE-CANARY-hd2';
    let calls = 0;
    await withRuntime(
      engine,
      {
        grants: [],
        secrets: {
          get: async () => {
            calls += 1;
            if (calls === 1) {
              throw new Error(`secret outage ${CANARY}`);
            }
            return 'sec-recovered';
          },
        },
      },
      async (runtime) => {
        runtime.registerCapability({
          id: 'inv.sec.recover',
          revision: '1',
          effect: 'pure',
          input: neutralJsonContract,
          output: neutralJsonContract,
          requiredSecrets: ['sec.recover'],
          invoke: async (_input, context) => await context.secrets?.get('sec.recover'),
        });
        await activateOnce(runtime, 'inv.sec.recover');
        const run1 = await runtime.run({ v: 'x' }, { mode: 'normal' });
        expect(run1.status).toBe('failed');
        expect(run1.error?.code).toBe('VICT_RUNTIME_SECRET_UNAVAILABLE');
        const run2 = await runtime.run({ v: 'x' }, { mode: 'normal' });
        expect(run2.status).toBe('completed');
        expect(run2.output).toBe('sec-recovered');
        expect(calls).toBe(2);
        expect(JSON.stringify(run1)).not.toContain(CANARY);
        expect(JSON.stringify(await runtime.listRuns())).not.toContain(CANARY);
      },
    );
  });

  it('an OPTIONAL secret-provider rejection does not poison the next invocation either', async () => {
    let calls = 0;
    await withRuntime(
      engine,
      {
        grants: [],
        secrets: {
          get: async () => {
            calls += 1;
            if (calls === 1) {
              throw new Error('optional secret outage');
            }
            return 'optional-ok';
          },
        },
      },
      async (runtime) => {
        runtime.registerCapability({
          id: 'inv.sec.optional',
          revision: '1',
          effect: 'pure',
          input: neutralJsonContract,
          output: neutralJsonContract,
          secrets: ['sec.optional'],
          invoke: async (_input, context) => await context.secrets?.get('sec.optional'),
        });
        await activateOnce(runtime, 'inv.sec.optional');
        const run1 = await runtime.run({ v: 'x' }, { mode: 'normal' });
        expect(run1.status).toBe('failed');
        expect(run1.error?.code).toBe('VICT_RUNTIME_SECRET_UNAVAILABLE');
        const run2 = await runtime.run({ v: 'x' }, { mode: 'normal' });
        expect(run2.status).toBe('completed');
        expect(run2.output).toBe('optional-ok');
        expect(calls).toBe(2);
      },
    );
  });

  it('two barrier-controlled concurrent invocations receive their own values and provider reads', async () => {
    let entered = 0;
    let releaseBarrier: (() => void) | undefined;
    const values = ['concurrent-A', 'concurrent-B'];
    await withRuntime(
      engine,
      {
        grants: [],
        secrets: {
          get: async () => {
            const index = entered;
            entered += 1;
            if (index === 0) {
              // Park until the SECOND invocation's provider read arrives:
              // if the caches were shared, the second read would never
              // happen and this barrier would deadlock (or the runs would
              // observe identical cached values).
              await new Promise<void>((resolve) => {
                releaseBarrier = resolve;
              });
            } else {
              releaseBarrier?.();
            }
            return values[index];
          },
        },
      },
      async (runtime) => {
        runtime.registerCapability({
          id: 'inv.concurrent',
          revision: '1',
          effect: 'pure',
          input: neutralJsonContract,
          output: neutralJsonContract,
          secrets: ['sec.concurrent'],
          invoke: async (_input, context) => await context.secrets?.get('sec.concurrent'),
        });
        await activateOnce(runtime, 'inv.concurrent');
        const [run1, run2] = await Promise.all([
          runtime.run({ v: 'x' }, { mode: 'normal' }),
          runtime.run({ v: 'x' }, { mode: 'normal' }),
        ]);
        expect(run1.status).toBe('completed');
        expect(run2.status).toBe('completed');
        // Each invocation got its OWN value: a shared cache or shared
        // promise would make both outputs identical.
        expect([run1.output, run2.output].sort()).toEqual(['concurrent-A', 'concurrent-B']);
        // Both invocations actually reached the provider.
        expect(entered).toBe(2);
      },
    );
  });

  it('resolved values and provider errors never enter events, traces, or retained history', async () => {
    const SECRET_VALUE = 'INVOCATION-SECRET-CANARY-hd3';
    const FAILURE_CANARY = 'INVOCATION-FAILURE-CANARY-hd4';
    let calls = 0;
    await withRuntime(
      engine,
      {
        grants: [],
        configuration: {
          get: () => {
            calls += 1;
            if (calls === 1) {
              throw new Error(`raw provider message ${FAILURE_CANARY}`);
            }
            return undefined;
          },
        },
        secrets: {
          get: async (name: string) => (name === 'sec.vault' ? SECRET_VALUE : undefined),
        },
      },
      async (runtime) => {
        runtime.registerCapability({
          id: 'inv.canary',
          revision: '1',
          effect: 'pure',
          input: neutralJsonContract,
          output: neutralJsonContract,
          requiredSecrets: ['sec.vault'],
          configuration: ['cfg.canary'],
          invoke: async (_input, context) => {
            // The optional configuration read exercises the (failing on the
            // first invocation) configuration provider; the secret read
            // produces the resolved-value canary.
            context.config?.get('cfg.canary');
            return ((await context.secrets?.get('sec.vault')) as string).length;
          },
        });
        await activateOnce(runtime, 'inv.canary');
        const failed = await runtime.run({ v: 'x' }, { mode: 'normal' });
        expect(failed.status).toBe('failed');
        const succeeded = await runtime.run({ v: 'x' }, { mode: 'normal' });
        expect(succeeded.status).toBe('completed');
        const history = JSON.stringify(await runtime.listRuns());
        expect(history).not.toContain(SECRET_VALUE);
        expect(history).not.toContain(FAILURE_CANARY);
        expect(JSON.stringify(failed)).not.toContain(SECRET_VALUE);
        expect(JSON.stringify(succeeded)).not.toContain(SECRET_VALUE);
        for (const run of await runtime.listRuns()) {
          expect(JSON.stringify(run.trace ?? [])).not.toContain(SECRET_VALUE);
          expect(JSON.stringify(run.trace ?? [])).not.toContain(FAILURE_CANARY);
        }
      },
    );
  });
});

describe('HIGH-04-D: declarations and enforcement unchanged by the cache relocation', () => {
  it('undeclared configuration names remain unavailable (scoped-reader semantics unchanged)', async () => {
    const runtime = createRuntime({
      authority: {
        grants: [],
        configuration: { get: (name: string) => (name === 'cfg.declared' ? 'v' : undefined) },
      },
    });
    runtime.registerCapability({
      id: 'inv.undeclared',
      revision: '1',
      effect: 'pure',
      input: neutralJsonContract,
      output: neutralJsonContract,
      configuration: ['cfg.declared'],
      invoke: (_input, context) => context.config?.get('cfg.other'),
    });
    const activation = await runtime.activate(graphFor('inv.undeclared'));
    expect(activation.ok).toBe(true);
    const result = await runtime.run({ v: 'x' }, { mode: 'normal' });
    expect(result.status).toBe('failed');
    // The undeclared name is unavailable (stable sanitization, never a raw
    // throw) — the closed-scoped-reader semantics are unchanged.
    expect(String(result.error?.code)).toMatch(/UNAVAILABLE|THREW/);
  });
});
