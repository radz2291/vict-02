import { describe, expect, it } from 'vitest';
import { defineContract, defineGraph } from '@vict/sdk';
import { createRuntime } from '@vict/runtime';
import { installCapabilityPack } from '@vict/runtime';
import type { CapabilityPack, CapabilityPackManifest } from '@vict/sdk';

/**
 * Stage 04 audit remediation — MED-04-A (CONT-001 enforcement) and
 * MED-04-H (closed capability-definition schemas, effect vocabulary).
 * Plain JavaScript objects are tested, not only TypeScript.
 */

const C = defineContract<{ v?: string }>({
  id: 'cb.c',
  revision: '1',
  parse: (input) => ({ ok: true, value: input as { v?: string } }),
});

describe('MED-04-A/H: strict capability definitions at the public registration boundary', () => {
  it('rejects contract-less capabilities with a stable structured diagnostic (plain JS object)', () => {
    const runtime = createRuntime();
    // Plain JavaScript object with NO input/output contracts.
    const bare = {
      id: 'js.bare',
      revision: '1',
      effect: 'pure',
      invoke: (input: unknown) => input,
    } as never;
    expect(() => runtime.registerCapability(bare)).toThrowError(/CONT-001|MISSING_CONTRACT/);
  });

  it('rejects a capability with only an input or only an output contract', () => {
    const runtime = createRuntime();
    expect(() =>
      runtime.registerCapability({
        id: 'js.half.in',
        revision: '1',
        effect: 'pure',
        input: C,
        invoke: (input: unknown) => input,
      } as never),
    ).toThrowError(/CONT-001|MISSING_CONTRACT/);
    expect(() =>
      runtime.registerCapability({
        id: 'js.half.out',
        revision: '1',
        effect: 'pure',
        output: C,
        invoke: (input: unknown) => input,
      } as never),
    ).toThrowError(/CONT-001|MISSING_CONTRACT/);
  });

  it('rejects invalid effect values such as teleport or wriite (plain JS object)', () => {
    const runtime = createRuntime();
    for (const effect of ['teleport', 'wriite', 'PURE', '']) {
      expect(() =>
        runtime.registerCapability({
          id: `js.effect.${String(effect)}`,
          revision: '1',
          effect,
          input: C,
          output: C,
          invoke: (input: unknown) => input,
        } as never),
      ).toThrowError(/effect vocabulary|INVALID_EFFECT/);
    }
  });

  it('a misspelled effect can never downgrade write safety', async () => {
    const runtime = createRuntime();
    expect(() =>
      runtime.registerCapability({
        id: 'js.write.typosquat',
        revision: '1',
        effect: 'wriite',
        input: C,
        output: C,
        invoke: (input: unknown) => input,
      } as never),
    ).toThrowError();
    // 'write' capabilities REQUIRE a double in test mode; the misspelling
    // must not have bypassed the policy.
    runtime.registerCapability({
      id: 'js.write.real',
      revision: '1',
      effect: 'write',
      input: C,
      output: C,
      invoke: (input: unknown) => input,
    });
    const activation = await runtime.activate(
      defineGraph({
        id: 'g.wriite',
        entry: 'only',
        nodes: [{ id: 'only', capability: 'js.write.real' }],
        edges: [],
      }),
    );
    expect(activation.ok).toBe(true);
    const simulated = await runtime.run({ v: 'x' }, { mode: 'test' });
    expect(simulated.status).toBe('blocked');
  });

  it('rejects unknown definition fields (misspelled authority fields fail loudly)', () => {
    const runtime = createRuntime();
    expect(() =>
      runtime.registerCapability({
        id: 'js.typo',
        revision: '1',
        effect: 'pure',
        input: C,
        output: C,
        permissionsTypo: ['secret.admin'],
        requriedSecrets: ['vault'],
        invoke: (input: unknown) => input,
      } as never),
    ).toThrowError(/UNKNOWN_DEFINITION_FIELD|unknown field/i);
  });

  it('rejects malformed authority arrays and unsupported idempotency values', () => {
    const runtime = createRuntime();
    expect(() =>
      runtime.registerCapability({
        id: 'js.bad.authority',
        revision: '1',
        effect: 'pure',
        input: C,
        output: C,
        permissions: ['ok', '   '],
        invoke: (input: unknown) => input,
      } as never),
    ).toThrowError(/INVALID_AUTHORITY|authority/);
    expect(() =>
      runtime.registerCapability({
        id: 'js.dup.authority',
        revision: '1',
        effect: 'pure',
        input: C,
        output: C,
        permissions: ['p1', 'p1'],
        invoke: (input: unknown) => input,
      } as never),
    ).toThrowError();
    expect(() =>
      runtime.registerCapability({
        id: 'js.bad.idem',
        revision: '1',
        effect: 'write',
        idempotency: 'eventually',
        input: C,
        output: C,
        invoke: (input: unknown) => input,
      } as never),
    ).toThrowError(/idempotency/);
  });

  it('rejects whitespace-only ids and revisions', () => {
    const runtime = createRuntime();
    expect(() =>
      runtime.registerCapability({
        id: '   ',
        revision: '1',
        effect: 'pure',
        input: C,
        output: C,
        invoke: (input: unknown) => input,
      } as never),
    ).toThrowError();
    expect(() =>
      runtime.registerCapability({
        id: 'js.ws.rev',
        revision: '  ',
        effect: 'pure',
        input: C,
        output: C,
        invoke: (input: unknown) => input,
      } as never),
    ).toThrowError();
  });

  it('a contract-declared capability registers, activates, and validates output (plain JS object)', async () => {
    const runtime = createRuntime();
    runtime.registerCapability({
      id: 'js.valid',
      revision: '1',
      effect: 'pure',
      input: C,
      output: C,
      invoke: (input: { v?: string }) => ({ v: `ok:${String(input.v ?? '')}` }),
    } as never);
    const activation = await runtime.activate(
      defineGraph({
        id: 'g.js.valid',
        entry: 'only',
        nodes: [{ id: 'only', capability: 'js.valid' }],
        edges: [],
      }),
    );
    expect(activation.ok).toBe(true);
    const run = await runtime.run({ v: 'x' }, { mode: 'normal' });
    expect(run.status).toBe('completed');
  });

  it('pack installation enforces the same boundary for pack capabilities', () => {
    const runtime = createRuntime();
    const manifest: CapabilityPackManifest = {
      schema: 'vict.capability-pack@1',
      id: 'vict.strict',
      version: '1.0.0',
      victCompatibility: '^0.1.0',
      capabilities: [
        {
          id: 'strict.cap',
          revision: '1',
          effect: 'pure',
          input: { contractId: 'sc.c', revision: '1' },
          output: { contractId: 'sc.c', revision: '1' },
        },
      ],
      contracts: [{ id: 'sc.c', revision: '1' }],
    };
    // A pack binding WITHOUT contracts cannot be installed: validation
    // requires the declared contract references and the runtime enforces
    // CONT-001 at registration.
    const missingContracts = {
      manifest,
      bindings: {
        capabilities: [{ id: 'sc.c', revision: '1', invoke: (input: unknown) => input }],
      },
    } as unknown as CapabilityPack;
    expect(() => installCapabilityPack(runtime, missingContracts)).toThrowError();
  });
});
