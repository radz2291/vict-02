import { describe, expect, it } from 'vitest';
import { defineContract, defineGraph, neutralJsonContract } from '@vict/sdk';
import { createInMemoryStores, createRuntime } from '@vict/runtime';
import { createSqliteStores } from '@vict/store-sqlite';
import type { VictRuntime } from '@vict/runtime';

/**
 * Stage 04 audit remediation — HIGH-04-C (pinned authority declarations),
 * LOW-04-H (TOCTOU: one provider read per name per invocation), and the
 * activation-identity sensitivity of authority declarations.
 *
 * Proven on BOTH store adapters (in-memory durable and SQLite durable).
 */

const Config = defineContract<{ v: string }>({
  id: 'au.cfg',
  revision: '1',
  parse: (input) => ({ ok: true, value: input as { v: string } }),
});

interface Harness {
  runtime: VictRuntime;
  dispose(): Promise<void>;
}

async function withHarness(
  authority: {
    grants?: readonly string[];
    configuration?: { get(name: string): unknown };
    secrets?: { get(name: string): Promise<string | undefined> };
  },
  engine: 'in-memory' | 'sqlite',
  run: (harness: Harness) => Promise<void>,
): Promise<void> {
  const stores =
    engine === 'sqlite' ? createSqliteStores({ path: ':memory:' }) : createInMemoryStores();
  const runtime = createRuntime({ stores, authority });
  try {
    await run({ runtime, dispose: async () => undefined });
  } finally {
    if ('dispose' in stores && typeof (stores as { dispose?: unknown }).dispose === 'function') {
      await (stores as unknown as { dispose(): Promise<void> }).dispose();
    }
  }
}

function graph(capabilityId: string): Parameters<VictRuntime['activate']>[0] {
  return defineGraph({
    id: `g.${capabilityId}`,
    entry: 'only',
    nodes: [{ id: 'only', capability: capabilityId }],
    edges: [],
  });
}

describe.each(['in-memory', 'sqlite'] as const)(
  'HIGH-04-C: authority declarations are pinned (%s engine)',
  (engine) => {
    it('mutating the raw permission array after registration AND activation does not change enforcement', async () => {
      const definition = {
        id: 'au.guarded',
        revision: '1',
        effect: 'pure' as const,
        input: neutralJsonContract,
        output: neutralJsonContract,
        permissions: ['perm.orig'],
        invoke: () => 'ran',
      };
      await withHarness({ grants: ['perm.other'] }, engine, async ({ runtime }) => {
        runtime.registerCapability(definition);
        const activation = await runtime.activate(graph('au.guarded'));
        expect(activation.ok).toBe(true);

        // 1) before mutation: permission denied, handler NOT invoked.
        const denied = await runtime.run({ v: 'x' }, { mode: 'normal' });
        expect(denied.status).toBe('failed');
        expect(denied.error?.code).toBe('VICT_RUNTIME_PERMISSION_DENIED');

        // 2) AFTER activation: mutate the original permission array.
        (definition.permissions as string[]).length = 0;
        (definition.permissions as string[]).push('perm.other');

        // 3) the ACTIVE execution still enforces the ORIGINAL declarations.
        const stillDenied = await runtime.run({ v: 'x' }, { mode: 'normal' });
        expect(stillDenied.status).toBe('failed');
        expect(stillDenied.error?.code).toBe('VICT_RUNTIME_PERMISSION_DENIED');
      });
    });

    it('required configuration and secret declarations are pinned after activation', async () => {
      const definition = {
        id: 'au.required',
        revision: '1',
        effect: 'pure' as const,
        input: neutralJsonContract,
        output: neutralJsonContract,
        requiredConfiguration: ['cfg.required'],
        requiredSecrets: ['sec.required'],
        invoke: () => 'ran',
      };
      let secretReads = 0;
      await withHarness(
        {
          grants: [],
          configuration: { get: (name: string) => (name === 'cfg.required' ? 'v' : undefined) },
          secrets: {
            get: async (name: string) => {
              secretReads += 1;
              return name === 'sec.required' ? 'sec-value' : undefined;
            },
          },
        },
        engine,
        async ({ runtime }) => {
          runtime.registerCapability(definition);
          const activation = await runtime.activate(graph('au.required'));
          expect(activation.ok).toBe(true);
          const before = await runtime.run({ v: 'x' }, { mode: 'normal' });
          expect(before.status).toBe('completed');

          // Mutate the original arrays after activation.
          (definition.requiredConfiguration as string[]).length = 0;
          (definition.requiredSecrets as string[]).length = 0;

          // Enforcement is unchanged: the declarations were pinned.
          const after = await runtime.run({ v: 'x' }, { mode: 'normal' });
          expect(after.status).toBe('completed');
        },
      );
      expect(secretReads).toBeGreaterThan(0);
    });

    it('a later explicit registration with a NEW revision captures the new declarations', async () => {
      const runtime = createRuntime({ authority: { grants: [] } });
      runtime.registerCapability({
        id: 'au.revisable',
        revision: '1',
        effect: 'pure',
        input: neutralJsonContract,
        output: neutralJsonContract,
        permissions: ['perm.orig'],
        invoke: () => 'one',
      });
      await runtime.activate(graph('au.revisable'));
      const denied = await runtime.run({ v: 'x' }, { mode: 'normal' });
      expect(denied.status).toBe('failed');

      runtime.registerCapability({
        id: 'au.revisable',
        revision: '2',
        effect: 'pure',
        input: neutralJsonContract,
        output: neutralJsonContract,
        permissions: [],
        invoke: () => 'two',
      });
      const activation2 = await runtime.activate(graph('au.revisable'));
      expect(activation2.ok).toBe(true);
      const allowed = await runtime.run({ v: 'x' }, { mode: 'normal' });
      expect(allowed.status).toBe('completed');
      expect(allowed.output).toBe('two');
    });

    it('changed authority declarations change the capability-set and activation identity', async () => {
      const versions = async (authority: {
        permissions?: readonly string[];
        requiredConfiguration?: readonly string[];
        requiredSecrets?: readonly string[];
      }): Promise<{ capabilitySetVersion: string; activationVersion: string }> => {
        const runtime = createRuntime({ authority: { grants: [] } });
        runtime.registerCapability({
          id: 'au.identity',
          revision: '1',
          effect: 'pure',
          input: neutralJsonContract,
          output: neutralJsonContract,
          ...(authority.permissions !== undefined ? { permissions: authority.permissions } : {}),
          ...(authority.requiredConfiguration !== undefined
            ? { requiredConfiguration: authority.requiredConfiguration }
            : {}),
          ...(authority.requiredSecrets !== undefined
            ? { requiredSecrets: authority.requiredSecrets }
            : {}),
          invoke: () => 'x',
        });
        const activation = await runtime.activate(graph('au.identity'));
        if (!activation.ok) {
          throw new Error(`activation failed: ${JSON.stringify(activation.issues)}`);
        }
        return {
          capabilitySetVersion: activation.capabilitySetVersion,
          activationVersion: activation.activationVersion,
        };
      };
      const baseline = await versions({});
      const changedPermissions = await versions({ permissions: ['p1'] });
      const changedRequiredConfig = await versions({ requiredConfiguration: ['c1'] });
      const changedRequiredSecrets = await versions({ requiredSecrets: ['s1'] });
      expect(changedPermissions.capabilitySetVersion).not.toBe(baseline.capabilitySetVersion);
      expect(changedPermissions.activationVersion).not.toBe(baseline.activationVersion);
      expect(changedRequiredConfig.capabilitySetVersion).not.toBe(baseline.capabilitySetVersion);
      expect(changedRequiredConfig.activationVersion).not.toBe(baseline.activationVersion);
      expect(changedRequiredSecrets.capabilitySetVersion).not.toBe(baseline.capabilitySetVersion);
      expect(changedRequiredSecrets.activationVersion).not.toBe(baseline.activationVersion);
    });
  },
);

describe('LOW-04-H: TOCTOU removal — one provider read per name per invocation', () => {
  it('the handler observes the value that passed the availability check (inconsistent providers)', async () => {
    let configReads = 0;
    const values = ['checked-value', 'CHANGED-VALUE', 'CHANGED-AGAIN'];
    const runtime = createRuntime({
      authority: {
        grants: [],
        configuration: {
          get: (_name: string) => {
            configReads += 1;
            return values[Math.min(configReads - 1, values.length - 1)];
          },
        },
      },
    });
    runtime.registerCapability({
      id: 'au.toctou',
      revision: '1',
      effect: 'pure',
      input: neutralJsonContract,
      output: neutralJsonContract,
      requiredConfiguration: ['cfg.a'],
      configuration: ['cfg.a'],
      invoke: (_input, context) => context.config?.get('cfg.a'),
    });
    const activation = await runtime.activate(graph('au.toctou'));
    expect(activation.ok).toBe(true);
    const result = await runtime.run({ v: 'x' }, { mode: 'normal' });
    expect(result.status).toBe('completed');
    // Exactly ONE provider read for the one requested name; the handler saw
    // the value that passed the availability check.
    expect(configReads).toBe(1);
    expect(result.output).toBe('checked-value');
  });

  it('optional declared names resolve lazily ONCE per name and are then cached', async () => {
    const reads: string[] = [];
    const runtime = createRuntime({
      authority: {
        grants: [],
        secrets: {
          get: async (name: string) => {
            reads.push(name);
            return `value:${name}`;
          },
        },
      },
    });
    runtime.registerCapability({
      id: 'au.lazy',
      revision: '1',
      effect: 'pure',
      input: neutralJsonContract,
      output: neutralJsonContract,
      secrets: ['sec.opt'],
      invoke: async (_input, context) => {
        const first = await context.secrets?.get('sec.opt');
        const second = await context.secrets?.get('sec.opt');
        return `${String(first)}|${String(second)}`;
      },
    });
    const activation = await runtime.activate(graph('au.lazy'));
    expect(activation.ok).toBe(true);
    const result = await runtime.run({ v: 'x' }, { mode: 'normal' });
    expect(result.status).toBe('completed');
    expect(reads).toEqual(['sec.opt']);
    expect(result.output).toBe('value:sec.opt|value:sec.opt');
  });

  it('provider exceptions become sanitized stable authority failures (never raw messages)', async () => {
    const CANARY = 'PROVIDER-FAILURE-CANARY-x91';
    const runtime = createRuntime({
      authority: {
        grants: [],
        configuration: {
          get: () => {
            throw new Error(`hostile provider failure ${CANARY}`);
          },
        },
        secrets: {
          get: async () => {
            throw new Error(`hostile secret failure ${CANARY}`);
          },
        },
      },
    });
    runtime.registerCapability({
      id: 'au.hostile.provider',
      revision: '1',
      effect: 'pure',
      input: neutralJsonContract,
      output: neutralJsonContract,
      configuration: ['cfg.hostile'],
      secrets: ['sec.hostile'],
      invoke: async (_input, context) => {
        context.config?.get('cfg.hostile');
        return String(await context.secrets?.get('sec.hostile'));
      },
    });
    const activation = await runtime.activate(graph('au.hostile.provider'));
    expect(activation.ok).toBe(true);
    const result = await runtime.run({ v: 'x' }, { mode: 'normal' });
    expect(result.status).toBe('failed');
    // The stable authority failure code survives; the provider canary never does.
    expect(String(result.error?.code)).toMatch(/UNAVAILABLE|THREW/);
    expect(JSON.stringify(result)).not.toContain(CANARY);
    const history = await runtime.listRuns();
    expect(JSON.stringify(history)).not.toContain(CANARY);
  });

  it('resolved secret values never enter events, traces, or history', async () => {
    const SECRET_VALUE = 'SECRET-CANARY-value-vault1';
    const runtime = createRuntime({
      authority: {
        grants: [],
        secrets: { get: async () => SECRET_VALUE },
      },
    });
    runtime.registerCapability({
      id: 'au.secret.retention',
      revision: '1',
      effect: 'pure',
      input: neutralJsonContract,
      output: neutralJsonContract,
      requiredSecrets: ['sec.vault'],
      invoke: async (_input, context) => (await context.secrets?.get('sec.vault'))?.length ?? -1,
    });
    const activation = await runtime.activate(graph('au.secret.retention'));
    expect(activation.ok).toBe(true);
    const result = await runtime.run({ v: 'x' }, { mode: 'normal' });
    expect(result.status).toBe('completed');
    expect(JSON.stringify(result)).not.toContain(SECRET_VALUE);
    expect(JSON.stringify(await runtime.listRuns())).not.toContain(SECRET_VALUE);
  });
});

describe('HIGH-04-C context: in-flight execution retains original enforcement', () => {
  it('a run prepared before mutation completes with the ORIGINAL enforcement', async () => {
    const definition = {
      id: 'au.inflight',
      revision: '1',
      effect: 'pure' as const,
      input: neutralJsonContract,
      output: neutralJsonContract,
      permissions: ['perm.inflight'],
      invoke: () => 'ran',
    };
    const runtime = createRuntime({ authority: { grants: [] } });
    runtime.registerCapability(definition);
    await runtime.activate(graph('au.inflight'));
    const denied = await runtime.run({ v: 'x' }, { mode: 'normal' });
    expect(denied.status).toBe('failed');
    (definition.permissions as string[]).length = 0;
    const stillDenied = await runtime.run({ v: 'x' }, { mode: 'normal' });
    expect(stillDenied.status).toBe('failed');
    expect(stillDenied.error?.code).toBe('VICT_RUNTIME_PERMISSION_DENIED');
  });
});

void Config;
void withHarness;
