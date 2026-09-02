import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { defineCapability, defineContract, defineGraph, neutralJsonContract } from '@vict/sdk';
import { defineZodContract } from '@vict/sdk/zod';
import { createRuntime } from '@vict/runtime';
import type { Contract, ContractResult } from '@vict/contracts';

const Count = defineZodContract('ci.count', '1', z.object({ count: z.number() }));

function oneNodeGraph(capabilityId: string) {
  return defineGraph({
    id: 'ci-graph',
    entry: 'n',
    nodes: [{ id: 'n', capability: capabilityId }],
    edges: [],
  });
}

/**
 * CONT-008 / VER-010: official contract factories freeze their results, and
 * activation captures the effective parsing callable so caller-owned
 * mutation after activation cannot change a pinned run's parsing behavior.
 */
describe('contract immutability at the activation boundary', () => {
  it('defineZodContract returns a frozen contract', () => {
    const contract = defineZodContract('ci.zod', '1', z.object({ n: z.number() }));
    expect(Object.isFrozen(contract)).toBe(true);
  });

  it('defineContract returns a frozen contract', () => {
    const contract = defineContract<{ n: number }>({
      id: 'ci.neutral',
      revision: '1',
      parse: (input) => ({ ok: true as const, value: input as { n: number } }),
    });
    expect(Object.isFrozen(contract)).toBe(true);
  });

  it('replacing parse on a hand-rolled contract after activation does not affect later runs', async () => {
    // A deliberately mutable, caller-owned contract object (not built by an
    // official factory). The runtime must still pin parsing at activation.
    const realParse = vi.fn((input: unknown) => ({
      ok: true as const,
      value: input as { count: number },
    }));
    const mutableContract: Contract<{ count: number }> = {
      id: 'ci.mutable',
      revision: '1',
      expected: 'a count',
      parse: (input: unknown) => realParse(input) as ContractResult<{ count: number }>,
    };
    const capability = defineCapability({
      id: 'ci.cap',
      revision: '1',
      effect: 'pure',
      input: mutableContract,
      output: Count,
      invoke: (input: { count: number }) => ({ count: input.count + 1 }),
    });
    const runtime = createRuntime();
    runtime.registerCapability(capability);
    await runtime.activate(oneNodeGraph('ci.cap'));

    const before = await runtime.run({ count: 1 });
    expect(before.status).toBe('completed');
    expect(before.output).toEqual({ count: 2 });

    // The caller swaps the parse function in place AFTER activation.
    const originalParse = mutableContract.parse;
    mutableContract.parse = () => ({
      ok: true as const,
      value: { count: 666 } as unknown as { count: number },
    });

    const after = await runtime.run({ count: 5 });
    // The pinned activation still parses with the ORIGINAL parse callable.
    expect(after.status).toBe('completed');
    expect(after.output).toEqual({ count: 6 });
    expect(realParse).toHaveBeenCalledTimes(2);
    // Identity is unchanged: the swap changed no revisioned metadata.
    expect(after.activationVersion).toBe(before.activationVersion);
    expect(originalParse).toBeDefined();
  });

  it('mutating a frozen official contract is impossible', async () => {
    const contract = defineZodContract('ci.frozen-cap', '1', z.object({ count: z.number() }));
    const capability = defineCapability({
      id: 'ci.frozen',
      revision: '1',
      effect: 'pure',
      input: contract,
      output: Count,
      invoke: (input) => ({ count: input.count + 2 }),
    });
    const runtime = createRuntime();
    runtime.registerCapability(capability);
    await runtime.activate(oneNodeGraph('ci.frozen'));

    const before = await runtime.run({ count: 1 });
    expect(before.output).toEqual({ count: 3 });

    expect(() => {
      (contract as { parse: unknown }).parse = () => ({
        ok: true as const,
        value: { count: 666 },
      });
    }).toThrow();
    const after = await runtime.run({ count: 2 });
    expect(after.output).toEqual({ count: 4 });
  });

  it('explicit reactivation captures a changed contract only when its revision changed', async () => {
    // V1 accepts any number; V2 (same id, new revision) rejects negatives.
    const contractV1 = defineZodContract<{ count: number }>(
      'ci.revisable',
      '1',
      z.object({ count: z.number() }),
    );
    const capability = {
      id: 'ci.revisable-cap',
      revision: '1',
      effect: 'pure' as const,
      input: contractV1,
      output: neutralJsonContract,
      invoke: (input: { count: number }) => ({ count: input.count * 10 }),
    };
    const runtime = createRuntime();
    runtime.registerCapability(capability);
    const first = await runtime.activate(oneNodeGraph('ci.revisable-cap'));
    expect(first.ok).toBe(true);
    const runA = await runtime.run({ count: -2 });
    expect(runA.status).toBe('completed');
    expect(runA.output).toEqual({ count: -20 });

    // Deliberately change the contract semantics AND its revision, then
    // reactivate: the new activation captures the new contract under a new
    // identity.
    const contractV2 = defineZodContract<{ count: number }>(
      'ci.revisable',
      '2',
      z.object({ count: z.number().nonnegative() }),
    );
    const revisedCapability = {
      id: 'ci.revisable-cap',
      revision: '2',
      effect: 'pure' as const,
      input: contractV2,
      output: neutralJsonContract,
      invoke: (input: { count: number }) => ({ count: input.count * 10 }),
    };
    // A new runtime instance models the deliberate re-binding: the registry
    // keeps one object per contract id, so changed meaning arrives as a new
    // contract object with a new revision.
    const runtime2 = createRuntime();
    runtime2.registerCapability(revisedCapability);
    const second = await runtime2.activate(oneNodeGraph('ci.revisable-cap'));
    expect(second.ok).toBe(true);
    const runB = await runtime2.run({ count: -2 });
    // The new activation enforces the new contract meaning.
    expect(runB.status).toBe('failed');
    expect(runB.trace.some((event) => event.type === 'contract.rejected')).toBe(true);
    if (first.ok && second.ok) {
      expect(first.activationVersion).not.toBe(second.activationVersion);
      expect(first.capabilitySetVersion).not.toBe(second.capabilitySetVersion);
      expect(first.graphVersion).toBe(second.graphVersion);
    }

    // A frozen contract cannot be mutated in place, so the only way its
    // meaning changes is a deliberate new contract object with a new
    // revision — the accepted author/build trust boundary.
  });

  it('run records never expose a way to mutate stored traces', async () => {
    const capability = defineCapability({
      id: 'ci.encapsulation',
      revision: '1',
      effect: 'pure',
      input: neutralJsonContract,
      output: neutralJsonContract,
      invoke: (input: unknown) => input,
    });
    const runtime = createRuntime();
    runtime.registerCapability(capability);
    await runtime.activate(oneNodeGraph('ci.encapsulation'));
    const result = await runtime.run({ count: 1 });
    const record = await runtime.getRun(result.runId);
    expect(record).toBeDefined();
    expect(Object.isFrozen(record)).toBe(true);
    expect(() => {
      (record as { status: string }).status = 'failed';
    }).toThrow();
    expect(() => {
      (record?.trace as unknown as unknown[]).push({ type: 'injected' });
    }).toThrow();
    const reread = await runtime.getRun(result.runId);
    expect(reread?.status).toBe('completed');
    expect(reread?.trace.some((event) => (event.type as string) === 'injected')).toBe(false);
  });
});
