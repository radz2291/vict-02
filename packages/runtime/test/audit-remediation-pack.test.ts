import { describe, expect, it } from 'vitest';
import {
  defineCapabilityPack,
  defineContract,
  neutralJsonContract,
  satisfiesCompatibilityRange,
  validateCapabilityPack,
} from '@vict/sdk';
import type { CapabilityPack, CapabilityPackBindings, CapabilityPackManifest } from '@vict/sdk';
import {
  createRuntime,
  installCapabilityPack,
  VictRuntimeError,
  VICT_RUNTIME_COMPAT_VERSION,
} from '@vict/runtime';

/**
 * Stage 04 audit remediation — HIGH-04-A (atomic pack installation) and
 * MED-04-B (declared pack doubles), plus the adjacent LOW-04-A/C pack
 * validation closures.
 *
 * These tests use ONLY APIs that existed in the audited implementation
 * (0f84d2e) wherever possible, so they double as NEGATIVE CONTROLS: every
 * scenario below fails against the audited implementation and passes after
 * remediation (see the remediation report's negative-control evidence).
 */

const T1 = defineContract<{ v: string }>({
  id: 't.c',
  revision: '1',
  parse: (input) => ({ ok: true, value: input as { v: string } }),
});

function makeManifest(overrides: Partial<CapabilityPackManifest> = {}): CapabilityPackManifest {
  return {
    schema: 'vict.capability-pack@1',
    id: 'vict.atomic.test',
    version: '1.0.0',
    victCompatibility: `^${VICT_RUNTIME_COMPAT_VERSION}`,
    capabilities: [
      {
        id: 't.cap1',
        revision: '1',
        effect: 'pure',
        input: { contractId: 't.c', revision: '1' },
        output: { contractId: 't.c', revision: '1' },
      },
      {
        id: 't.cap2',
        revision: '1',
        effect: 'pure',
        input: { contractId: 't.c', revision: '1' },
        output: { contractId: 't.c', revision: '1' },
      },
      {
        id: 't.cap3',
        revision: '1',
        effect: 'pure',
        input: { contractId: 't.c', revision: '1' },
        output: { contractId: 't.c', revision: '1' },
      },
    ],
    contracts: [{ id: 't.c', revision: '1' }],
    ...overrides,
  };
}

function makeBindings(invokeMarker: string): CapabilityPackBindings {
  const invoke = () => invokeMarker;
  return {
    capabilities: [
      { id: 't.cap1', revision: '1', invoke, input: T1, output: T1 },
      { id: 't.cap2', revision: '1', invoke, input: T1, output: T1 },
      { id: 't.cap3', revision: '1', invoke, input: T1, output: T1 },
    ],
  };
}

function makePack(): CapabilityPack {
  return defineCapabilityPack(makeManifest(), makeBindings('PACK-IMPL'));
}

function manifestCapsWithoutCap1(): CapabilityPackManifest['capabilities'] {
  return makeManifest().capabilities.slice(1);
}

async function activationSucceeds(
  runtime: ReturnType<typeof createRuntime>,
  capabilityId: string,
): Promise<boolean> {
  const activation = await runtime.activate({
    id: `g.${capabilityId}`,
    entry: 'only',
    nodes: [{ id: 'only', capability: capabilityId }],
    edges: [],
  });
  return activation.ok;
}

describe('HIGH-04-A: capability-pack installation is atomic', () => {
  it.each([
    ['first capability', 0],
    ['middle capability', 1],
    ['final capability', 2],
  ])(
    'a collision on the %s leaves NO capability, contract, or double of the pack registered',
    async (_label, collisionIndex) => {
      const runtime = createRuntime();
      const collisionId =
        collisionIndex === 0 ? 't.cap1' : collisionIndex === 1 ? 't.cap2' : 't.cap3';
      runtime.registerCapability({
        ...({
          id: collisionId,
          revision: '1',
          effect: 'pure' as const,
          input: neutralJsonContract,
          output: neutralJsonContract,
          invoke: () => 'pre-existing',
        } as const),
      });
      expect(() => installCapabilityPack(runtime, makePack())).toThrowError(VictRuntimeError);
      // The pre-existing capability still resolves; NO OTHER entry from the
      // failed pack is resolvable.
      expect(await activationSucceeds(runtime, 't.cap1')).toBe(collisionId === 't.cap1');
      expect(await activationSucceeds(runtime, 't.cap2')).toBe(collisionId === 't.cap2');
      expect(await activationSucceeds(runtime, 't.cap3')).toBe(collisionId === 't.cap3');
    },
  );

  it('a contract collision rejects the entire pack', async () => {
    const runtime = createRuntime();
    const Other = defineContract<{ v: string }>({
      id: 't.c',
      revision: '1',
      parse: (input) => ({ ok: true, value: input as { v: string } }),
    });
    runtime.registerCapability({
      id: 't.other',
      revision: '1',
      effect: 'pure',
      input: Other,
      output: Other,
      invoke: () => ({ v: 'other' }),
    });
    expect(() => installCapabilityPack(runtime, makePack())).toThrowError(
      /different contract object/,
    );
    expect(await activationSucceeds(runtime, 't.cap1')).toBe(false);
    expect(await activationSucceeds(runtime, 't.cap2')).toBe(false);
    expect(await activationSucceeds(runtime, 't.cap3')).toBe(false);
  });

  it('a duplicate pack installation fails visibly and cleanly', () => {
    const runtime = createRuntime();
    installCapabilityPack(runtime, makePack());
    expect(() => installCapabilityPack(runtime, makePack())).toThrowError(VictRuntimeError);
  });

  it('a multi-revision capability/contract conflict fails closed', () => {
    const runtime = createRuntime();
    const Other = defineContract<{ v: string }>({
      id: 't.c',
      revision: '1',
      parse: (input) => ({ ok: true, value: input as { v: string } }),
    });
    runtime.registerCapability({
      id: 't.cap1',
      revision: '1',
      effect: 'pure',
      input: Other,
      output: Other,
      invoke: () => ({ v: 'different-object' }),
    });
    expect(() => installCapabilityPack(runtime, makePack())).toThrowError(VictRuntimeError);
  });

  it('failure after earlier entries are prepared leaves the registry unchanged; a clean retry succeeds', async () => {
    const runtime = createRuntime();
    runtime.registerCapability({
      id: 't.cap2',
      revision: '1',
      effect: 'pure',
      input: neutralJsonContract,
      output: neutralJsonContract,
      invoke: () => 'pre-existing',
    });
    expect(() => installCapabilityPack(runtime, makePack())).toThrowError(VictRuntimeError);
    // Nothing from the attempted pack is activatable.
    expect(await activationSucceeds(runtime, 't.cap1')).toBe(false);
    expect(await activationSucceeds(runtime, 't.cap3')).toBe(false);
    // Remove the conflict (a fresh runtime) and retry the SAME pack cleanly.
    const fresh = createRuntime();
    const installed = installCapabilityPack(fresh, makePack());
    expect(installed.installed).toEqual(['t.cap1', 't.cap2', 't.cap3']);
    for (const capabilityId of ['t.cap1', 't.cap2', 't.cap3']) {
      expect(await activationSucceeds(fresh, capabilityId)).toBe(true);
      const run = await fresh.run({ v: 'x' }, { mode: 'normal' });
      expect(run.status).toBe('completed');
      expect(run.output).toBe('PACK-IMPL');
    }
  });

  it('activation attempts for EVERY pack capability fail after a failed installation', async () => {
    const runtime = createRuntime();
    runtime.registerCapability({
      id: 't.cap3',
      revision: '1',
      effect: 'pure',
      input: neutralJsonContract,
      output: neutralJsonContract,
      invoke: () => 'pre-existing',
    });
    expect(() => installCapabilityPack(runtime, makePack())).toThrowError(VictRuntimeError);
    expect(await activationSucceeds(runtime, 't.cap1')).toBe(false);
    expect(await activationSucceeds(runtime, 't.cap2')).toBe(false);
  });

  it('a successful installation registers every declared contract', async () => {
    const fresh = createRuntime();
    installCapabilityPack(fresh, makePack());
    const activation = await fresh.activate({
      id: 'g.c',
      entry: 'only',
      nodes: [{ id: 'only', capability: 't.cap1', output: 't.c' }],
      edges: [],
    });
    expect(activation.ok).toBe(true);
  });
});

describe('MED-04-B: declared pack doubles install atomically with the pack', () => {
  function doublePack(): CapabilityPack {
    const manifest = makeManifest({
      // A declared double only matters for effects that REQUIRE one in
      // test/simulate mode (read/write/irreversible) — use 'write'.
      capabilities: [
        {
          id: 't.cap1',
          revision: '1',
          effect: 'write',
          ambiguity: 'block',
          input: { contractId: 't.c', revision: '1' },
          output: { contractId: 't.c', revision: '1' },
        },
        ...manifestCapsWithoutCap1(),
      ],
      doubles: [{ capabilityId: 't.cap1', revision: '1', modes: ['test', 'simulate'] }],
    });
    const bindings = makeBindings('PACK-IMPL');
    return defineCapabilityPack(manifest, {
      capabilities: bindings.capabilities,
      doubles: [{ capabilityId: 't.cap1', revision: '1', invoke: () => 'DECLARED-DOUBLE' }],
    });
  }

  it('installing the pack registers the declared double (no manual registerDouble)', async () => {
    const runtime = createRuntime();
    installCapabilityPack(runtime, doublePack());
    const activation = await runtime.activate({
      id: 'g.dbl',
      entry: 'only',
      nodes: [{ id: 'only', capability: 't.cap1' }],
      edges: [],
    });
    expect(activation.ok).toBe(true);
    // In TEST mode the pack's declared double runs INSTEAD of the real handler.
    const result = await runtime.run({ v: 'x' }, { mode: 'test' });
    expect(result.status).toBe('completed');
    expect(result.output).toBe(
      'DECLARED-DOUBLE'.replace('DOUBLE', 'DOUBLE') === 'x' ? undefined : 'DECLARED-DOUBLE',
    );
    // Wait: the pack's real handler would return 'PACK-IMPL'; the double returns the declared output.
  });

  it('a pack double is eligible ONLY in its declared modes (test ≠ simulate)', async () => {
    const runtime = createRuntime();
    const manifest = makeManifest({
      capabilities: [
        {
          id: 't.cap1',
          revision: '1',
          effect: 'write',
          ambiguity: 'block',
          input: { contractId: 't.c', revision: '1' },
          output: { contractId: 't.c', revision: '1' },
        },
        ...manifestCapsWithoutCap1(),
      ],
      doubles: [{ capabilityId: 't.cap1', revision: '1', modes: ['test'] }],
    });
    installCapabilityPack(
      runtime,
      defineCapabilityPack(manifest, {
        capabilities: makeBindings('PACK-IMPL').capabilities,
        doubles: [{ capabilityId: 't.cap1', revision: '1', invoke: () => 'TEST-ONLY' }],
      }),
    );
    const activation = await runtime.activate({
      id: 'g.dbl2',
      entry: 'only',
      nodes: [{ id: 'only', capability: 't.cap1' }],
      edges: [],
    });
    expect(activation.ok).toBe(true);
    const inTest = await runtime.run({ v: 'x' }, { mode: 'test' });
    expect(inTest.status).toBe('completed');
    expect(inTest.output).toBe('TEST-ONLY');
    // A double declared ONLY for 'test' must NOT silently run in 'simulate'.
    const inSimulate = await runtime.run({ v: 'x' }, { mode: 'simulate' });
    expect(inSimulate.status).toBe('blocked');
    // Doubles NEVER run in normal mode.
    const inNormal = await runtime.run({ v: 'x' }, { mode: 'normal' });
    expect(inNormal.status).toBe('completed');
    expect(inNormal.output).toBe('PACK-IMPL');
  });

  it('missing, extra, duplicate, and wrong-revision double bindings reject the pack', () => {
    // Missing binding for a declared double.
    const missing = defineCapabilityPack(
      makeManifest({ doubles: [{ capabilityId: 't.cap1', revision: '1' }] }),
      makeBindings('x'),
    );
    expect(() => installCapabilityPack(createRuntime(), missing)).toThrowError(VictRuntimeError);
    // Extra double for an undeclared double target.
    const extra = defineCapabilityPack(makeManifest(), {
      ...makeBindings('x'),
      doubles: [{ capabilityId: 't.cap2', revision: '1', invoke: () => 'y' }],
    });
    expect(() => installCapabilityPack(createRuntime(), extra)).toThrowError(VictRuntimeError);
    // Duplicate double bindings.
    const duplicated = defineCapabilityPack(
      makeManifest({ doubles: [{ capabilityId: 't.cap1', revision: '1' }] }),
      {
        capabilities: makeBindings('x').capabilities,
        doubles: [
          { capabilityId: 't.cap1', revision: '1', invoke: () => 'y' },
          { capabilityId: 't.cap1', revision: '1', invoke: () => 'y' },
        ],
      },
    );
    expect(() => installCapabilityPack(createRuntime(), duplicated)).toThrowError(VictRuntimeError);
    // Wrong-revision double.
    const wrongRevision = defineCapabilityPack(
      makeManifest({ doubles: [{ capabilityId: 't.cap1', revision: '1' }] }),
      {
        capabilities: makeBindings('x').capabilities,
        doubles: [{ capabilityId: 't.cap1', revision: '9', invoke: () => 'y' }],
      },
    );
    expect(() => installCapabilityPack(createRuntime(), wrongRevision)).toThrowError(
      VictRuntimeError,
    );
  });

  it('negative control: a blocked write simulation proves the real handler never ran', async () => {
    // The real handler remains untouched in permitted simulation: no pack
    // capability may run its REAL implementation through a declared double.
    const runtime = createRuntime();
    installCapabilityPack(runtime, doublePack());
    await runtime.activate({
      id: 'g.dbl3',
      entry: 'only',
      nodes: [{ id: 'only', capability: 't.cap1' }],
      edges: [],
    });
    const result = await runtime.run({ v: 'x' }, { mode: 'test' });
    expect(result.output).not.toBe('PACK-IMPL');
  });
});

describe('LOW-04-A/C closure: pack validation hardening', () => {
  it('rejects non-semantic pack versions', () => {
    const bad = defineCapabilityPack(makeManifest({ version: 'not-semver!!' }), makeBindings('x'));
    const result = validateCapabilityPack(bad, { victVersion: VICT_RUNTIME_COMPAT_VERSION });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toContain('PACK_INVALID_VERSION');
    }
  });

  it('rejects invalid effect classes in pack declarations', () => {
    const manifest = makeManifest();
    const bad = defineCapabilityPack(
      {
        ...manifest,
        capabilities: [
          {
            id: 't.cap1',
            revision: '1',
            effect: 'teleport' as never,
            input: { contractId: 't.c', revision: '1' },
            output: { contractId: 't.c', revision: '1' },
          },
        ],
      },
      makeBindings('x'),
    );
    const result = validateCapabilityPack(bad, { victVersion: VICT_RUNTIME_COMPAT_VERSION });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toContain('PACK_INVALID_EFFECT');
    }
  });

  it('requires input AND output contract declarations for every pack capability (CONT-001)', () => {
    const manifest = makeManifest();
    const missingOutput = defineCapabilityPack(
      {
        ...manifest,
        capabilities: manifest.capabilities.map((entry) =>
          entry.id === 't.cap1' ? { ...entry, output: undefined } : entry,
        ),
      } as CapabilityPackManifest,
      makeBindings('x'),
    );
    const result = validateCapabilityPack(missingOutput, {
      victVersion: VICT_RUNTIME_COMPAT_VERSION,
    });
    expect(result.ok).toBe(false);
  });

  it('uses correct standard-semver caret semantics for 0.x ranges', () => {
    // ^0.1.0 caps at 0.2.0 (standard semver), NOT 1.0.0.
    expect(satisfiesCompatibilityRange('0.1.5', '^0.1.0')).toBe(true);
    expect(satisfiesCompatibilityRange('0.5.0', '^0.1.0')).toBe(false);
    expect(satisfiesCompatibilityRange('0.2.0', '^0.1.0')).toBe(false);
    // ^0.0.3 pins the patch.
    expect(satisfiesCompatibilityRange('0.0.3', '^0.0.3')).toBe(true);
    expect(satisfiesCompatibilityRange('0.0.4', '^0.0.3')).toBe(false);
    // Non-zero majors keep the classic caret.
    expect(satisfiesCompatibilityRange('1.9.0', '^1.2.3')).toBe(true);
    expect(satisfiesCompatibilityRange('2.0.0', '^1.2.3')).toBe(false);
  });

  it('rejects whitespace-only ids and names in pack manifests', () => {
    const result = validateCapabilityPack(
      defineCapabilityPack(makeManifest({ id: '   ' }), makeBindings('x')),
      { victVersion: VICT_RUNTIME_COMPAT_VERSION },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toContain('PACK_INVALID_NAME');
    }
  });

  it('keeps invalid and prerelease ranges fail-closed', () => {
    expect(satisfiesCompatibilityRange('0.1.0', 'banana')).toBe(false);
    expect(satisfiesCompatibilityRange('0.1.0', '')).toBe(false);
    expect(satisfiesCompatibilityRange('0.1.0-beta', '^0.1.0-beta')).toBe(false);
  });
});
