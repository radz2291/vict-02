import { describe, expect, it } from 'vitest';
import { defineCapabilityPack, defineContract, neutralJsonContract } from '@vict/sdk';
import type { CapabilityPackBindings, CapabilityPackManifest } from '@vict/sdk';
import {
  createInMemoryStores,
  createRuntime,
  installCapabilityPack,
  VICT_RUNTIME_COMPAT_VERSION,
} from '@vict/runtime';
import { createSqliteStores } from '@vict/store-sqlite';

/**
 * RE-AUDIT LOW-RE-3 permanent remediation suite — the direct public
 * `registerCapability` path is ATOMIC.
 *
 * The capability AND its embedded contracts are staged together through the
 * same registry staging mechanism the pack installer uses; the complete
 * registration commits only when every validation and collision check
 * succeeds. A capability-identity collision or an input/output contract
 * collision leaves the registry semantically unchanged, and the same
 * corrected registration is retryable. Pack installation keeps its own
 * outer batch (no nested staging), and activation never observes a partial
 * definition.
 *
 * All probes use ONLY public runtime boundaries: `registerCapability`,
 * `registerContract` (conflict probes), and `activate` (registration
 * observability).
 */

const contractA = defineContract<{ v: string }>({
  id: 'atomic.contract.a',
  revision: '1',
  parse: (input) => ({ ok: true, value: input as { v: string } }),
});
const contractAImpostor = defineContract<{ v: string }>({
  id: 'atomic.contract.a',
  revision: '1',
  parse: (input) => ({ ok: true, value: input as { v: string } }),
});
const contractB = defineContract<{ n: number }>({
  id: 'atomic.contract.b',
  revision: '1',
  parse: (input) => ({ ok: true, value: input as { n: number } }),
});
const contractBImpostor = defineContract<{ n: number }>({
  id: 'atomic.contract.b',
  revision: '1',
  parse: (input) => ({ ok: true, value: input as { n: number } }),
});

function capability(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'atomic.cap',
    revision: '1',
    effect: 'pure',
    input: contractA,
    output: contractB,
    invoke: (input: unknown) => input,
    ...overrides,
  };
}

/** Probe: the contract id/revision is NOT registered (a differing object binds). */
function expectContractAbsent(
  runtime: ReturnType<typeof createRuntime>,
  impostor: { id: string; revision: string },
): void {
  expect(() => runtime.registerContract(impostor as never)).not.toThrowError();
}

/** Probe: the ORIGINAL contract object is still live (a differing object conflicts). */
function expectContractIsOriginal(
  runtime: ReturnType<typeof createRuntime>,
  impostor: { id: string; revision: string },
): void {
  expect(() => runtime.registerContract(impostor as never)).toThrowError(
    /different contract object/,
  );
}

/** A capability is registered (and activatable) only if activation succeeds. */
async function activationSucceeds(
  runtime: ReturnType<typeof createRuntime>,
  capabilityId: string,
): Promise<boolean> {
  const activation = await runtime.activate({
    id: `g.probe.${capabilityId}`,
    entry: 'only',
    nodes: [{ id: 'only', capability: capabilityId }],
    edges: [],
  });
  return activation.ok;
}

describe('RE-AUDIT LOW-RE-3: direct capability registration is atomic', () => {
  it('a capability-identity collision leaves the registry semantically unchanged', async () => {
    const runtime = createRuntime();
    runtime.registerCapability({
      id: 'atomic.cap',
      revision: '1',
      effect: 'pure',
      input: neutralJsonContract,
      output: neutralJsonContract,
      invoke: () => 'pre-existing',
    });
    expect(() => runtime.registerCapability(capability({}) as never)).toThrowError(
      /already registered in this runtime/,
    );
    // Nothing from the failed registration is observable: neither embedded
    // contract was registered.
    expectContractAbsent(runtime, contractAImpostor);
    expectContractAbsent(runtime, contractBImpostor);
    // The pre-existing capability still resolves to ITS handler.
    expect(await activationSucceeds(runtime, 'atomic.cap')).toBe(true);
  });

  it('an INPUT contract collision leaves the registry semantically unchanged', async () => {
    const runtime = createRuntime();
    runtime.registerContract(contractA);
    expect(() =>
      runtime.registerCapability(
        capability({ id: 'atomic.input-conflict', input: contractAImpostor }) as never,
      ),
    ).toThrowError(/different contract object/);
    // No partial registration: the capability is absent and the live
    // contract is still the ORIGINAL object.
    expect(await activationSucceeds(runtime, 'atomic.input-conflict')).toBe(false);
    expectContractIsOriginal(runtime, contractAImpostor);
    expectContractAbsent(runtime, contractBImpostor);
  });

  it('an OUTPUT contract collision leaves the registry semantically unchanged', async () => {
    const runtime = createRuntime();
    runtime.registerContract(contractB);
    expect(() =>
      runtime.registerCapability(
        capability({ id: 'atomic.output-conflict', output: contractBImpostor }) as never,
      ),
    ).toThrowError(/different contract object/);
    expect(await activationSucceeds(runtime, 'atomic.output-conflict')).toBe(false);
    expectContractIsOriginal(runtime, contractBImpostor);
    expectContractAbsent(runtime, contractAImpostor);
  });

  it('a conflict in BOTH embedded contracts leaves the registry semantically unchanged', async () => {
    const runtime = createRuntime();
    runtime.registerContract(contractA);
    runtime.registerContract(contractB);
    expect(() =>
      runtime.registerCapability(
        capability({
          id: 'atomic.both-conflict',
          input: contractAImpostor,
          output: contractBImpostor,
        }) as never,
      ),
    ).toThrowError(/different contract object/);
    expect(await activationSucceeds(runtime, 'atomic.both-conflict')).toBe(false);
    expectContractIsOriginal(runtime, contractAImpostor);
    expectContractIsOriginal(runtime, contractBImpostor);
  });

  it('the same corrected registration is retryable after a failure', async () => {
    const runtime = createRuntime();
    runtime.registerContract(contractA);
    expect(() =>
      runtime.registerCapability(
        capability({ id: 'atomic.retry', input: contractAImpostor }) as never,
      ),
    ).toThrowError(/different contract object/);
    expect(await activationSucceeds(runtime, 'atomic.retry')).toBe(false);
    // Retry with the SAME (matching) contract objects: fully succeeds.
    runtime.registerCapability(capability({ id: 'atomic.retry' }) as never);
    expect(await activationSucceeds(runtime, 'atomic.retry')).toBe(true);
    expectContractIsOriginal(runtime, contractAImpostor);
    expectContractIsOriginal(runtime, contractBImpostor);
  });

  it('activation never observes a partial definition (durable engines)', async () => {
    for (const engine of ['in-memory', 'sqlite'] as const) {
      const stores =
        engine === 'sqlite' ? createSqliteStores({ path: ':memory:' }) : createInMemoryStores();
      const runtime = createRuntime({ stores });
      try {
        runtime.registerContract(contractA);
        expect(() =>
          runtime.registerCapability(
            capability({ id: 'atomic.durable', input: contractAImpostor }) as never,
          ),
        ).toThrowError(/different contract object/);
        // The capability is NOT activatable: nothing partial was committed.
        const activation = await runtime.activate({
          id: 'g.probe.atomic.durable',
          entry: 'only',
          nodes: [{ id: 'only', capability: 'atomic.durable' }],
          edges: [],
        });
        expect(activation.ok).toBe(false);
      } finally {
        if (
          'dispose' in stores &&
          typeof (stores as { dispose?: unknown }).dispose === 'function'
        ) {
          await (stores as unknown as { dispose(): Promise<void> }).dispose();
        }
      }
    }
  });

  it('pack installation keeps its atomic outer batch (no nested-staging regression)', async () => {
    const runtime = createRuntime();
    runtime.registerContract(contractA);
    const manifest: CapabilityPackManifest = {
      schema: 'vict.capability-pack@1',
      id: 'atomic.pack',
      version: '1.0.0',
      victCompatibility: `^${VICT_RUNTIME_COMPAT_VERSION}`,
      capabilities: [
        {
          id: 'atomic.pack.cap',
          revision: '1',
          effect: 'pure',
          input: { contractId: 'atomic.contract.a', revision: '1' },
          output: { contractId: 'atomic.contract.b', revision: '1' },
        },
      ],
      contracts: [
        { id: 'atomic.contract.a', revision: '1' },
        { id: 'atomic.contract.b', revision: '1' },
      ],
    };
    const bindings: CapabilityPackBindings = {
      capabilities: [
        {
          id: 'atomic.pack.cap',
          revision: '1',
          invoke: (input: unknown) => input,
          input: contractAImpostor,
          output: contractB,
        },
      ],
    };
    // The conflicting pack fails ATOMICALLY (existing HIGH-04-A semantics,
    // preserved by the same staging mechanism — no nested-staging error).
    expect(() =>
      installCapabilityPack(runtime, defineCapabilityPack(manifest, bindings)),
    ).toThrowError(/different contract object/);
    expect(await activationSucceeds(runtime, 'atomic.pack.cap')).toBe(false);
    expectContractAbsent(runtime, contractBImpostor);
  });
});
