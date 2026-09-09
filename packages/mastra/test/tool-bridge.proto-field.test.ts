import { afterAll, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CapabilityDefinition, Contract } from '@victframework/sdk';
import { createInMemoryAgentControlStores, type AgentControlStores } from '@victframework/runtime';
import { createSqliteAgentControlStores } from '@victframework/store-sqlite';
import { AgentTurnService } from '@victframework/control';
import {
  captureDeliverySafeSnapshot,
  bridgeCapabilityToolToMastra,
  normalizeCapabilityToolResultEvent,
  runWithBridgeTurnScope,
  type CapabilityBridgeDeps,
} from '../src/index.js';

/**
 * Stage 07A N-1 permanent regression tests — own `__proto__`
 * delivery-snapshot keys (the accepted H-1 audit Low, an early Stage 07
 * hardening acceptance item).
 *
 * Pre-correction behavior (reproduced as the negative control at
 * `e0e65b7dc3c11a985ad0524f23aec380b9119c8d`): an own `__proto__` DATA key
 * on an otherwise-accepted object was NOT rejected — a scalar value was
 * silently DROPPED from the delivered snapshot (the plain rebuild assigns
 * through the inherited `__proto__` setter, which ignores non-object
 * values), and an object value became the delivered container's
 * PROTOTYPE. Truthful delivery requires rejection.
 *
 * Corrected contract, pinned here FOREVER:
 * - scalar-valued and object-valued own `__proto__` keys are REJECTED at
 *   every depth with the dedicated closed reason `proto-field` (surfaced
 *   by the bridge as the existing durable code
 *   `VICT_CAPABILITY_UNSAFE_OUTPUT_STRUCTURE` / model code
 *   `VICT_CAPABILITY_OUTCOME_UNKNOWN`) — never dropped, never promoted;
 * - rejection follows the effectful-ambiguity rule: fenced
 *   `outcome_unknown` settlement, exactly one effect, no `tool.completed`,
 *   and a retry performs no second effect;
 * - no `Object.prototype` (or other shared object) pollution; no echoed
 *   key/value; no getter/iterator/proxy code invoked during capture;
 * - accepted behavior is unchanged: null-prototype containers WITHOUT a
 *   prohibited own `__proto__` key remain accepted; `constructor` /
 *   `prototype` own string keys remain plain own data fields; previously
 *   accepted delivery-domain values behave byte-for-byte identically.
 */

// ---- Source-boundary tests (captureDeliverySafeSnapshot) --------------------

/** An object carrying an OWN enumerable `__proto__` DATA property. */
function withOwnProto(value: unknown): Record<string, unknown> {
  const obj: Record<string, unknown> = { marker: 'payload' };
  Object.defineProperty(obj, '__proto__', {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
  return obj;
}

const PROTO_CANARY = `CANARY-N1-${Math.random().toString(36).slice(2, 8)}`;

describe('N-1: own __proto__ delivery-snapshot keys are rejected (proto-field)', () => {
  it('rejects a scalar-valued own __proto__ at depth 2 with proto-field', () => {
    const hostile = { a: { b: withOwnProto(12345) } };
    const result = captureDeliverySafeSnapshot(hostile);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('proto-field');
      expect(JSON.stringify(result)).not.toContain('12345');
      expect(JSON.stringify(result)).not.toContain('payload');
    }
  });

  it('rejects an object-valued own __proto__ at depth 2 with proto-field', () => {
    const hostile = { outer: { inner: withOwnProto({ leaked: PROTO_CANARY }) } };
    const result = captureDeliverySafeSnapshot(hostile);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('proto-field');
    }
    // The canary payload is never echoed through the rejection.
    expect(JSON.stringify(result)).not.toContain(PROTO_CANARY);
  });

  it('rejects own __proto__ at every tested depth (1, 2, 4, 8)', () => {
    const scalar = withOwnProto('top');
    expect(captureDeliverySafeSnapshot(scalar)).toEqual({ ok: false, reason: 'proto-field' });

    const deep = (level: number): unknown =>
      level === 0 ? withOwnProto({ v: PROTO_CANARY }) : { nested: deep(level - 1) };
    for (const depth of [1, 2, 4, 8]) {
      const result = captureDeliverySafeSnapshot(deep(depth));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('proto-field');
      }
    }
    expect(JSON.stringify(captureDeliverySafeSnapshot(deep(4)))).not.toContain(PROTO_CANARY);
  });

  it('rejects an own __proto__ key in hidden (non-enumerable) form too', () => {
    const obj: Record<string, unknown> = { plain: 1 };
    Object.defineProperty(obj, '__proto__', {
      value: { hostile: true },
      enumerable: false,
      writable: true,
      configurable: true,
    });
    const result = captureDeliverySafeSnapshot(obj);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('proto-field');
    }
  });

  it('rejects an own __proto__ key BEFORE reading any other field value', () => {
    // A getter on a SIBLING field must never be invoked: the own
    // `__proto__` rejection happens during the pre-validation pass.
    let getterReads = 0;
    const obj: Record<string, unknown> = { marker: 'payload' };
    Object.defineProperty(obj, 'sibling', {
      enumerable: true,
      get() {
        getterReads += 1;
        return PROTO_CANARY;
      },
    });
    Object.defineProperty(obj, '__proto__', {
      value: { v: 1 },
      enumerable: true,
      writable: true,
      configurable: true,
    });
    const result = captureDeliverySafeSnapshot(obj);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('proto-field');
    }
    expect(getterReads).toBe(0);
  });

  it('causes no Object.prototype or global pollution in any rejection case', () => {
    const before = Object.getOwnPropertyNames(Object.prototype);
    captureDeliverySafeSnapshot(withOwnProto(12345));
    captureDeliverySafeSnapshot(withOwnProto({ leaked: true }));
    captureDeliverySafeSnapshot({ a: { b: { c: withOwnProto({ deeper: 1 }) } } });
    captureDeliverySafeSnapshot(withOwnProto(Object.create(null)));
    expect(Object.getOwnPropertyNames(Object.prototype)).toEqual(before);
    expect(Object.getOwnPropertyDescriptor(Object.prototype, 'leaked')).toBeUndefined();
    expect(({} as Record<string, unknown>).leaked).toBeUndefined();
    expect(({} as Record<string, unknown>).marker).toBeUndefined();
  });

  it('delivers an array-side own __proto__ property as extra-array-property (rejected)', () => {
    const arr: unknown[] = [1, 2, 3];
    Object.defineProperty(arr, '__proto__', {
      value: { hostile: true },
      enumerable: true,
      configurable: true,
      writable: true,
    });
    const result = captureDeliverySafeSnapshot({ list: arr });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('extra-array-property');
    }
  });

  it('PRESERVES the accepted null-prototype container positive case', () => {
    const nullProto = Object.create(null) as Record<string, unknown>;
    nullProto.honest = 'value';
    nullProto.nested = { deep: [1, 2] };
    const result = captureDeliverySafeSnapshot({ container: nullProto });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const delivered = result.value as { container: Record<string, unknown> };
      expect(Object.getPrototypeOf(delivered.container)).toBe(Object.prototype);
      expect(delivered.container.honest).toBe('value');
      expect(delivered.container.nested).toEqual({ deep: [1, 2] });
    }
  });

  it('preserves safe constructor/prototype string keys as plain own data', () => {
    const safe = { constructor: 'c', prototype: 'p', nested: { constructor: 1 } };
    const result = captureDeliverySafeSnapshot(safe);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const delivered = result.value as Record<string, unknown>;
      expect(Object.getOwnPropertyDescriptor(delivered, 'constructor')?.value).toBe('c');
      expect(Object.getOwnPropertyDescriptor(delivered, 'prototype')?.value).toBe('p');
      expect(Object.getPrototypeOf(delivered)).toBe(Object.prototype);
      expect(JSON.stringify(delivered)).toBe(JSON.stringify(safe));
    }
  });

  it('keeps previously accepted delivery-domain behavior unchanged (regression sample)', () => {
    const accepted = {
      s: 'x',
      n: 1.5,
      b: false,
      nil: null,
      list: [{ ok: true }],
      deep: { a: { b: { c: 1 } } },
    };
    const result = captureDeliverySafeSnapshot(accepted);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(accepted);
      expect(result.value).not.toBe(accepted);
      expect(JSON.stringify(result.value)).toBe(JSON.stringify(accepted));
    }
  });
});

// ---- Bridge-level tests (fenced settlement, one effect, no replay) ----------

const SCOPE = {
  turnId: 'turn-n1-proto',
  streamId: 'stream-n1-proto',
  actorId: 'actor-n1',
  agentProfileVersion: 'v1_profile',
} as const;

const tempDirs: string[] = [];
const tempDir = (prefix: string): string => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};
afterAll(() => {
  // Windows file-lock races on teardown must not fail the suite; the temp
  // directories are disposable, so removal retries in the background.
  for (const dir of tempDirs) {
    const attempt = (remaining: number): void => {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        if (remaining > 0) {
          setTimeout(() => attempt(remaining - 1), 500);
        }
      }
    };
    attempt(10);
  }
});

function permissiveContract(id: string): Contract<unknown> {
  return {
    id,
    revision: '1',
    expected: 'bounded test contract',
    parse: (input: unknown): ReturnType<Contract<unknown>['parse']> => ({
      ok: true,
      value: input,
    }),
  };
}

interface N1Fixture {
  stores: AgentControlStores;
  effectCount: () => number;
  execute: () => Promise<unknown>;
  executeRetry: () => Promise<unknown>;
  turnId: string;
  close: () => void;
}

async function makeN1Fixture(
  stores: AgentControlStores,
  outputProvider: () => unknown,
): Promise<N1Fixture> {
  const clockValue = { v: 9000 };
  const clock = (): number => (clockValue.v += 1);
  const counters = { effects: 0, ids: 0 };
  const capabilityId = 'cap.n1.proto';
  const capability = {
    id: capabilityId,
    revision: '1',
    effect: 'read',
    input: permissiveContract(`${capabilityId}.input`),
    output: permissiveContract(`${capabilityId}.output`),
    invoke: async () => {
      counters.effects += 1;
      return outputProvider();
    },
  } as unknown as CapabilityDefinition;
  await stores.actors.upsert({
    actorId: 'actor-n1',
    status: 'active',
    roles: ['developer', 'approver'],
    createdAt: 0,
  });
  const turnService = new AgentTurnService({
    stores,
    clock,
    ids: {
      turnId: (): string => `${SCOPE.turnId}-${(counters.ids += 1)}`,
      streamId: (): string => `stream-n1-${counters.ids}`,
      invocationId: (): string => `inv-n1-${counters.ids}`,
      approvalId: (): string => `approval-n1-${counters.ids}`,
      idempotencyKey: (): string => `key-n1-${counters.ids}`,
      cancelId: (): string => `cancel-n1-${counters.ids}`,
    },
  });
  const deps: CapabilityBridgeDeps = {
    resolveCapability: (id, revision): CapabilityDefinition | undefined =>
      id === capability.id && revision === capability.revision ? capability : undefined,
    invoke: async (resolved, input) => resolved.invoke(input, {} as never),
    recordInvocationIntent: (input) => turnService.recordToolInvocationIntent(input),
    claimInvocationRun: (command) => stores.invocations.claimInvocationRun(command),
    settleInvocationRun: (command) => stores.invocations.settleInvocationRun(command),
    settleInvocationPending: (command) => stores.invocations.settleInvocationPending(command),
    reconcileAbandonedRun: (command) => stores.invocations.reconcileAbandonedRun(command),
    requestApproval: () => {
      throw new Error('read capability never requests approval');
    },
    consumeApproval: () => {
      throw new Error('read capability never consumes approval');
    },
    updateInvocationStatus: (command) => stores.invocations.updateInvocationStatus(command),
    findExistingApproval: async () => undefined,
    pollApprovalDecision: async () => undefined,
    clock,
    pollIntervalMs: 5,
    approvalExpiryMs: 30_000,
  };
  const activation = {
    activationVersion: 'v1_act',
    agentProfileVersion: 'v1_profile',
    capabilities: [{ id: capabilityId, revision: '1' }],
  } as unknown as Parameters<typeof bridgeCapabilityToolToMastra>[0];
  const tool = bridgeCapabilityToolToMastra(activation, capability, deps) as {
    execute: (i: unknown, c: unknown) => Promise<unknown>;
  };
  const turnId = `${SCOPE.turnId}-${(counters.ids += 1)}`;
  await stores.turns.createTurnIntent({
    turnId,
    streamId: `stream-${turnId}`,
    threadId: 'thread-n1',
    actorId: 'actor-n1',
    agentProfileVersion: 'v1_profile',
    activationVersion: undefined,
    applicationReleaseVersion: undefined,
    inputSummary: 'user-input:length=4',
    status: 'intent',
    createdAt: 1,
    updatedAt: 1,
    terminalAt: undefined,
    errorCode: undefined,
    traceId: undefined,
    victRunId: undefined,
    mastraRunId: undefined,
  });
  await stores.turns.startTurn(turnId, 2);
  const exec = (): Promise<unknown> =>
    runWithBridgeTurnScope(
      { ...SCOPE, turnId, streamId: `stream-${turnId}`, threadId: 'thread-n1' },
      () => tool.execute({ k: 'v' }, { toolCallId: `call-${turnId}` }),
    );
  return {
    stores,
    effectCount: () => counters.effects,
    execute: exec,
    executeRetry: exec,
    turnId,
    close: () => {
      const maybeClose = (stores as { close?: () => void }).close;
      if (typeof maybeClose === 'function') {
        maybeClose.call(stores);
      }
    },
  };
}

/** Scan every raw control-store byte (DB + WAL + SHM) for the canary. */
function assertCanaryAbsentFromRawStoreBytes(dir: string): void {
  for (const suffix of ['', '-wal', '-shm']) {
    const path = join(dir, `n1-control.db${suffix}`);
    if (existsSync(path)) {
      const bytes = readFileSync(path);
      expect(bytes.includes(PROTO_CANARY)).toBe(false);
    }
  }
}

async function assertN1HostileOutputContained(storeKind: 'memory' | 'sqlite'): Promise<void> {
  const dir = storeKind === 'sqlite' ? tempDir('vict-n1-bridge-') : undefined;
  const stores =
    storeKind === 'sqlite'
      ? createSqliteAgentControlStores({ path: join(dir as string, 'n1-control.db') })
      : createInMemoryAgentControlStores();
  const fixture = await makeN1Fixture(stores, () => ({
    saved: true,
    detail: withOwnProto({ leaked: PROTO_CANARY }),
  }));
  try {
    let threw: unknown = null;
    let result: unknown;
    try {
      result = await fixture.execute();
    } catch (error) {
      threw = error;
    }
    expect(threw).toBeNull();
    // The returned result is the stable non-echoing failure envelope.
    expect(result).toEqual({ victCapabilityFailure: 'VICT_CAPABILITY_OUTCOME_UNKNOWN' });
    expect(JSON.stringify(result)).not.toContain(PROTO_CANARY);
    // EXACTLY one effect.
    expect(fixture.effectCount()).toBe(1);
    // The durable status is outcome_unknown — NEVER completed, never running.
    const invocations = await fixture.stores.invocations.listInvocationsForTurn(fixture.turnId);
    expect(invocations).toHaveLength(1);
    expect(invocations[0]?.status).toBe('outcome_unknown');
    expect(invocations[0]?.errorCode).toBe('VICT_CAPABILITY_UNSAFE_OUTPUT_STRUCTURE');
    // The single milestone mapping yields a SAFE failure — never completion.
    expect(normalizeCapabilityToolResultEvent(result)).toEqual({
      kind: 'failed',
      code: 'VICT_CAPABILITY_OUTCOME_UNKNOWN',
    });
    expect(JSON.stringify(invocations)).not.toContain(PROTO_CANARY);
    if (storeKind === 'sqlite') {
      assertCanaryAbsentFromRawStoreBytes(dir as string);
    }
    // A retry performs NO second effect (terminal replay only).
    const retry = (await fixture.executeRetry()) as Record<string, unknown>;
    expect(fixture.effectCount()).toBe(1);
    expect(retry.victCapabilityFailure).toBe('VICT_CAPABILITY_OUTCOME_UNKNOWN');
    expect(await fixture.stores.invocations.listInvocationsForTurn(fixture.turnId)).toHaveLength(1);
  } finally {
    fixture.close();
  }
}

describe('N-1 at the governed bridge: own __proto__ output settles fenced outcome_unknown', () => {
  it('read capability, IN-MEMORY stores', async () => {
    await assertN1HostileOutputContained('memory');
  });

  it('read capability, SQLITE stores (rows + raw DB/WAL/SHM bytes)', async () => {
    await assertN1HostileOutputContained('sqlite');
  });
});

describe('N-1 at the governed bridge: the scalar form is also rejected before completion', () => {
  it('scalar own __proto__ output: durable outcome_unknown, one effect, safe retry', async () => {
    const stores = createInMemoryAgentControlStores();
    const fixture = await makeN1Fixture(stores, () => ({
      saved: true,
      detail: withOwnProto(12345),
    }));
    try {
      const result = (await fixture.execute()) as Record<string, unknown>;
      expect(result.victCapabilityFailure).toBe('VICT_CAPABILITY_OUTCOME_UNKNOWN');
      expect(fixture.effectCount()).toBe(1);
      const invocations = await fixture.stores.invocations.listInvocationsForTurn(fixture.turnId);
      expect(invocations).toHaveLength(1);
      expect(invocations[0]?.status).toBe('outcome_unknown');
      expect(invocations[0]?.errorCode).toBe('VICT_CAPABILITY_UNSAFE_OUTPUT_STRUCTURE');
      const retry = (await fixture.executeRetry()) as Record<string, unknown>;
      expect(fixture.effectCount()).toBe(1);
      expect(retry.victCapabilityFailure).toBe('VICT_CAPABILITY_OUTCOME_UNKNOWN');
    } finally {
      fixture.close();
    }
  });
});
