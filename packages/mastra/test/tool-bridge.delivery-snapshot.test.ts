import { describe, expect, it } from 'vitest';
import type { CapabilityDefinition, Contract } from '@vict/sdk';
import { createInMemoryAgentControlStores, type AgentControlStores } from '@vict/runtime';
import { createSqliteAgentControlStores } from '@vict/store-sqlite';
import { DELIVERY_SNAPSHOT_BOUNDS, captureDeliverySafeSnapshot } from '../src/delivery-snapshot.js';
import {
  bridgeCapabilityToolToMastra,
  runWithBridgeTurnScope,
  type CapabilityBridgeDeps,
} from '../src/tool-bridge.js';

/**
 * Stage 06 H-1 remediation — the recursive delivery-safe snapshot boundary.
 *
 * The exact value returned to Mastra is captured into a fresh VICT-owned
 * snapshot BEFORE the fenced `completed` settlement. These tests pin:
 * - deep safe values round-trip without semantic change;
 * - the output contract parser executes EXACTLY once per invocation;
 * - the returned value is a fresh VICT-owned snapshot with ZERO aliasing
 *   at every nested level (caller mutation after capture has no effect on
 *   the delivered value, the summary, or the durable record);
 * - repeated safe serialization is deterministic;
 * - every bound fails CLOSED without echoing rejected content;
 * - the Section-6 compatibility dispositions (safe/nested/plain accepted;
 *   class instances, Date/Map/Set, thenables, functions, BigInts, Symbols,
 *   undefined, non-finite numbers, cycles, sparse arrays, accessors, and
 *   hostile nested proxies rejected BEFORE durable completion).
 */

const CANARY = 'CANARY-H1-SNAPSHOT';
const SCOPE = {
  turnId: 'turn-delivery-snapshot',
  streamId: 'stream-delivery-snapshot',
  actorId: 'actor-snapshot',
  agentProfileVersion: 'v1_profile',
} as const;

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

// ---- Unit tests: the snapshot capture itself --------------------------------

describe('delivery-safe snapshot capture (unit)', () => {
  it('deep safe values round-trip without semantic change', () => {
    const original = {
      null: null,
      bool: true,
      int: 42,
      neg: -7,
      float: 3.14,
      zero: 0,
      str: 'hello',
      empty: '',
      list: [1, 'two', [3, { four: 4 }], [], [[[[1]]]]],
      obj: { nested: { deeper: { deepest: { done: true } } } },
    };
    const result = captureDeliverySafeSnapshot(original);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(original);
      expect(JSON.stringify(result.value)).toBe(JSON.stringify(original));
    }
  });

  it('the snapshot is a fresh VICT-owned structure at EVERY nested level', () => {
    const inner = { deep: 'value' };
    const original = { outer: { inner }, list: [{ item: inner }] };
    const result = captureDeliverySafeSnapshot(original);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const snapshot = result.value as typeof original;
    expect(snapshot).not.toBe(original);
    expect(snapshot.outer).not.toBe(original.outer);
    expect(snapshot.outer.inner).not.toBe(inner);
    expect(snapshot.list).not.toBe(original.list);
    expect(snapshot.list[0]).not.toBe(original.list[0]);
    expect((snapshot.list[0] as { item: object }).item).not.toBe(inner);
    // Plain VICT-owned prototypes.
    expect(Object.getPrototypeOf(snapshot)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(snapshot.outer)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(snapshot.list)).toBe(Array.prototype);
  });

  it('a null-prototype object is accepted and delivered as a plain snapshot', () => {
    const original = Object.create(null) as Record<string, unknown>;
    original.saved = true;
    const result = captureDeliverySafeSnapshot(original);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ saved: true });
      expect(Object.getPrototypeOf(result.value)).toBe(Object.prototype);
    }
  });

  it('caller mutation after capture has NO effect on the snapshot (zero aliasing)', () => {
    const inner = { count: 1 };
    const original = { inner, list: [1, 2] as unknown[] };
    const result = captureDeliverySafeSnapshot(original);
    expect(result.ok).toBe(true);
    // Mutate the original deeply AFTER capture.
    inner.count = 999;
    (original.inner as unknown as { added: string }).added = `${CANARY}-LEAK`;
    original.list.push(`${CANARY}-LEAK`);
    original.list[0] = 42;
    if (result.ok) {
      expect(result.value).toEqual({ inner: { count: 1 }, list: [1, 2] });
      expect(JSON.stringify(result.value)).not.toContain(CANARY);
    }
  });

  it('repeated safe serialization is deterministic', () => {
    const original = { a: [1, 2, { b: 'x' }], c: null, d: true, e: 2.5 };
    const first = captureDeliverySafeSnapshot(original);
    const second = captureDeliverySafeSnapshot(original);
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(JSON.stringify(first.value)).toBe(JSON.stringify(second.value));
      expect(JSON.stringify(first.value)).toBe(JSON.stringify(first.value));
    }
  });

  it('shared (non-cyclic) substructures are captured independently, never aliased', () => {
    const shared = { v: 1 };
    const original = { a: shared, b: shared };
    const result = captureDeliverySafeSnapshot(original);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const snapshot = result.value as { a: { v: number }; b: { v: number } };
      expect(snapshot.a).not.toBe(snapshot.b);
      expect(snapshot.a).toEqual(snapshot.b);
    }
  });

  it('cycles are rejected', () => {
    const cyclic: Record<string, unknown> = { ok: true };
    cyclic.self = cyclic;
    expect(captureDeliverySafeSnapshot(cyclic)).toEqual({ ok: false, reason: 'cycle' });
    const inner: Record<string, unknown> = {};
    const outer = { inner };
    inner.outer = outer;
    expect(captureDeliverySafeSnapshot(outer)).toEqual({ ok: false, reason: 'cycle' });
    const arr: unknown[] = [];
    arr.push(arr);
    expect(captureDeliverySafeSnapshot(arr)).toEqual({ ok: false, reason: 'cycle' });
  });

  it('sparse arrays and extra array properties are rejected', () => {
    const sparse: unknown[] = new Array(3);
    sparse[0] = 1;
    sparse[2] = 3;
    expect(captureDeliverySafeSnapshot(sparse)).toEqual({ ok: false, reason: 'sparse-array' });
    const holed: unknown[] = [1, 2, 3];
    delete holed[1];
    expect(captureDeliverySafeSnapshot(holed)).toEqual({ ok: false, reason: 'sparse-array' });
    const extra: unknown[] = [1, 2];
    (extra as unknown as Record<string, unknown>).extra = `${CANARY}-EXTRA`;
    expect(captureDeliverySafeSnapshot(extra)).toEqual({
      ok: false,
      reason: 'extra-array-property',
    });
  });

  it('accessor fields are rejected UNREAD (getter runs zero times)', () => {
    let getterReads = 0;
    const original = {
      get poisoned(): string {
        getterReads += 1;
        return `${CANARY}-GETTER`;
      },
    };
    const result = captureDeliverySafeSnapshot(original);
    expect(result).toEqual({ ok: false, reason: 'accessor-field' });
    expect(getterReads).toBe(0);
    // A nested accessor is rejected unread as well.
    let nestedReads = 0;
    const nested = {
      data: 1,
      nested: {
        get alsoPoisoned(): number {
          nestedReads += 1;
          return 1;
        },
      },
    };
    expect(captureDeliverySafeSnapshot(nested)).toEqual({ ok: false, reason: 'accessor-field' });
    expect(nestedReads).toBe(0);
  });

  it('non-enumerable and symbol-keyed fields are rejected', () => {
    const hidden = {};
    Object.defineProperty(hidden, 'secret', {
      value: `${CANARY}-HIDDEN`,
      enumerable: false,
      configurable: true,
      writable: true,
    });
    expect(captureDeliverySafeSnapshot(hidden)).toEqual({
      ok: false,
      reason: 'non-enumerable-field',
    });
    const symbolized = { data: 1 };
    (symbolized as Record<symbol, unknown>)[Symbol('s')] = 'x';
    expect(captureDeliverySafeSnapshot(symbolized)).toEqual({ ok: false, reason: 'symbol-key' });
  });

  it('functions, BigInts, Symbols, undefined, and non-finite numbers are rejected', () => {
    expect(captureDeliverySafeSnapshot((): void => undefined)).toEqual({
      ok: false,
      reason: 'function-value',
    });
    expect(captureDeliverySafeSnapshot({ fn: (): void => undefined })).toEqual({
      ok: false,
      reason: 'function-value',
    });
    expect(captureDeliverySafeSnapshot(1n)).toEqual({ ok: false, reason: 'bigint-value' });
    expect(captureDeliverySafeSnapshot({ big: 1n })).toEqual({ ok: false, reason: 'bigint-value' });
    expect(captureDeliverySafeSnapshot(Symbol('s'))).toEqual({ ok: false, reason: 'symbol-value' });
    expect(captureDeliverySafeSnapshot(undefined)).toEqual({
      ok: false,
      reason: 'undefined-value',
    });
    expect(captureDeliverySafeSnapshot({ u: undefined })).toEqual({
      ok: false,
      reason: 'undefined-value',
    });
    expect(captureDeliverySafeSnapshot(Number.NaN)).toEqual({
      ok: false,
      reason: 'non-finite-number',
    });
    expect(captureDeliverySafeSnapshot(Number.POSITIVE_INFINITY)).toEqual({
      ok: false,
      reason: 'non-finite-number',
    });
    expect(captureDeliverySafeSnapshot([Number.NEGATIVE_INFINITY])).toEqual({
      ok: false,
      reason: 'non-finite-number',
    });
  });

  it('class instances, Date, Map, Set, and RegExp are rejected as exotic', () => {
    class Instance {
      value = 1;
    }
    expect(captureDeliverySafeSnapshot(new Instance())).toEqual({
      ok: false,
      reason: 'exotic-prototype',
    });
    expect(captureDeliverySafeSnapshot({ when: new Date(0) })).toEqual({
      ok: false,
      reason: 'exotic-prototype',
    });
    expect(captureDeliverySafeSnapshot(new Map([['k', 'v']]))).toEqual({
      ok: false,
      reason: 'exotic-prototype',
    });
    expect(captureDeliverySafeSnapshot(new Set([1, 2]))).toEqual({
      ok: false,
      reason: 'exotic-prototype',
    });
    expect(captureDeliverySafeSnapshot(/canary/)).toEqual({
      ok: false,
      reason: 'exotic-prototype',
    });
    expect(captureDeliverySafeSnapshot(Object.create({ inherited: 1 }))).toEqual({
      ok: false,
      reason: 'exotic-prototype',
    });
  });

  it('own `then` fields (any form, any depth) are rejected', () => {
    expect(captureDeliverySafeSnapshot({ then: 'data' })).toEqual({
      ok: false,
      reason: 'then-field',
    });
    expect(captureDeliverySafeSnapshot({ nested: { then: 'data' } })).toEqual({
      ok: false,
      reason: 'then-field',
    });
    const hiddenThen = {};
    Object.defineProperty(hiddenThen, 'then', {
      value: (): void => undefined,
      enumerable: false,
      configurable: true,
      writable: true,
    });
    expect(captureDeliverySafeSnapshot({ nested: hiddenThen })).toEqual({
      ok: false,
      reason: 'then-field',
    });
  });

  it('a top-level CALLABLE thenable resolves at the capability-author await; the RESOLVED value is captured', async () => {
    // The bridge awaits the capability invocation, so a top-level thenable
    // resolves BEFORE the snapshot runs (capability-author domain). The
    // capture sees and captures only the resolved value.
    const thenable = {
      then(resolve: (v: { saved: boolean }) => void): void {
        resolve({ saved: true });
      },
    };
    const resolved = await (thenable as unknown as Promise<{ saved: boolean }>);
    const result = captureDeliverySafeSnapshot(resolved);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ saved: true });
    }
    // A NESTED callable thenable is rejected before any value inspection:
    // the own-`then` rule fires first (both rules are safe rejections; the
    // closed reason here is `then-field`).
    expect(captureDeliverySafeSnapshot({ detail: { then: (): void => undefined } })).toEqual({
      ok: false,
      reason: 'then-field',
    });
  });

  it('nested hostile proxies (throwing reflection traps) are rejected without echo', () => {
    const hostile = new Proxy(
      { marker: `${CANARY}-TARGET` },
      {
        getOwnPropertyDescriptor() {
          throw new Error(`${CANARY}-DESCRIPTOR-TRAP`);
        },
        get() {
          throw new Error(`${CANARY}-GET-TRAP`);
        },
      },
    );
    let result = captureDeliverySafeSnapshot({ saved: true, detail: hostile });
    expect(result).toEqual({ ok: false, reason: 'uninspectable' });
    if ('reason' in result && result.ok === false) {
      expect(JSON.stringify(result)).not.toContain(CANARY);
    }
    const revokedHandle = Proxy.revocable({ a: 1 }, {});
    revokedHandle.revoke();
    result = captureDeliverySafeSnapshot({ detail: revokedHandle.proxy });
    expect(result).toEqual({ ok: false, reason: 'uninspectable' });
  });

  it('a nested proxy transparent to descriptor reflection contributes DATA only (no trap can ever fire on delivery)', () => {
    let getReads = 0;
    const target = { marker: 'plain-data' };
    const transparent = new Proxy(target, {
      get(t, key) {
        getReads += 1;
        return (t as Record<string | symbol, unknown>)[key];
      },
    });
    const result = captureDeliverySafeSnapshot({ detail: transparent });
    // THE capture reads the proxy ZERO times (descriptor reads only).
    // (Recorded BEFORE any assertion: the vitest matcher internals may
    // themselves read the proxy when it is passed to an assertion.)
    const readsDuringCapture = getReads;
    expect(readsDuringCapture).toBe(0);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // The snapshot is a plain rebuild: the proxy identity never survives.
      const delivered = result.value as { detail: Record<string, unknown> };
      expect(delivered.detail).not.toBe(transparent);
      expect(delivered.detail).toEqual({ marker: 'plain-data' });
      expect(Object.getPrototypeOf(delivered.detail)).toBe(Object.prototype);
      // Mutating the proxy target after capture cannot change the snapshot.
      target.marker = `${CANARY}-MUTATED`;
      expect(delivered.detail).toEqual({ marker: 'plain-data' });
    }
  });

  it('bounds fail closed: depth, nodes, collection length, property count, string size', () => {
    // Depth: a chain deeper than maxDepth.
    let deep: unknown = 'leaf';
    for (let i = 0; i < DELIVERY_SNAPSHOT_BOUNDS.maxDepth + 2; i += 1) {
      deep = { nested: deep };
    }
    expect(captureDeliverySafeSnapshot(deep).ok).toBe(false);
    let shallow: unknown = 'leaf';
    for (let i = 0; i < DELIVERY_SNAPSHOT_BOUNDS.maxDepth - 1; i += 1) {
      shallow = { nested: shallow };
    }
    expect(captureDeliverySafeSnapshot(shallow).ok).toBe(true);

    // Total nodes.
    expect(
      captureDeliverySafeSnapshot(
        Array.from({ length: DELIVERY_SNAPSHOT_BOUNDS.maxNodes + 1 }, (_, i) => i),
      ).ok,
    ).toBe(false);

    // Collection length.
    expect(
      captureDeliverySafeSnapshot(
        Array.from({ length: DELIVERY_SNAPSHOT_BOUNDS.maxCollectionLength + 1 }, () => 'x'),
      ),
    ).toEqual({ ok: false, reason: 'collection-length-exceeded' });

    // Property count.
    const wide: Record<string, unknown> = {};
    for (let i = 0; i <= DELIVERY_SNAPSHOT_BOUNDS.maxPropertyCount; i += 1) {
      wide[`k${i}`] = i;
    }
    expect(captureDeliverySafeSnapshot(wide)).toEqual({
      ok: false,
      reason: 'property-count-exceeded',
    });

    // String size.
    expect(
      captureDeliverySafeSnapshot('x'.repeat(DELIVERY_SNAPSHOT_BOUNDS.maxStringLength + 1)),
    ).toEqual({ ok: false, reason: 'string-length-exceeded' });
    expect(
      captureDeliverySafeSnapshot({
        s: `${CANARY}-${'x'.repeat(DELIVERY_SNAPSHOT_BOUNDS.maxStringLength)}`,
      }),
    ).toEqual({ ok: false, reason: 'string-length-exceeded' });
  });
});

// ---- Bridge integration: the snapshot gates durable completion --------------

interface SnapshotFixture {
  stores: AgentControlStores;
  deps: CapabilityBridgeDeps;
  effectCount: () => number;
  execute: () => Promise<unknown>;
  close: () => void;
}

async function makeSnapshotFixture(
  outputProvider: () => unknown,
  outputContract: Contract<unknown>,
): Promise<SnapshotFixture> {
  const stores = createInMemoryAgentControlStores();
  const clockValue = { v: 1000 };
  const clock = (): number => (clockValue.v += 1);
  await stores.actors.upsert({
    actorId: SCOPE.actorId,
    status: 'active',
    roles: ['developer'],
    createdAt: 0,
  });
  const counters = { effects: 0, ids: 0 };
  const capability = {
    id: 'cap.snapshot.read',
    revision: '1',
    effect: 'read',
    input: permissiveContract('cap.snapshot.read.input'),
    output: outputContract,
    invoke: async () => {
      counters.effects += 1;
      return outputProvider();
    },
  } as unknown as CapabilityDefinition;
  const { AgentTurnService } = await import('@vict/control');
  const turnService = new AgentTurnService({
    stores,
    clock,
    ids: {
      turnId: (): string => `${SCOPE.turnId}-${counters.ids}`,
      streamId: (): string => `stream-${counters.ids}`,
      invocationId: (): string => `inv-snap-${(counters.ids += 1)}`,
      approvalId: (): string => `approval-${counters.ids}`,
      idempotencyKey: (): string => `key-${counters.ids}`,
      cancelId: (): string => `cancel-${counters.ids}`,
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
    requestApproval: (input) => turnService.requestApproval(input),
    consumeApproval: (binding) => turnService.consumeApproval(binding),
    updateInvocationStatus: (command) => stores.invocations.updateInvocationStatus(command),
    clock,
    pollIntervalMs: 5,
    approvalExpiryMs: 5000,
  };
  const activation = {
    activationVersion: 'v1_act',
    agentProfileVersion: 'v1_profile',
    capabilities: [{ id: capability.id, revision: '1' }],
  } as unknown as Parameters<typeof bridgeCapabilityToolToMastra>[0];
  const tool = bridgeCapabilityToolToMastra(activation, capability, deps) as {
    execute: (i: unknown, c: unknown) => Promise<unknown>;
  };
  await stores.turns.createTurnIntent({
    turnId: SCOPE.turnId,
    streamId: SCOPE.streamId,
    threadId: 'thread-snapshot',
    actorId: SCOPE.actorId,
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
  await stores.turns.startTurn(SCOPE.turnId, 2);
  return {
    stores,
    deps,
    effectCount: () => counters.effects,
    execute: () =>
      runWithBridgeTurnScope({ ...SCOPE, threadId: 'thread-snapshot' }, () =>
        tool.execute({ k: 'v' }, { toolCallId: 'call-snapshot' }),
      ),
    close: () => {
      const maybeClose = (stores as { close?: () => void }).close;
      if (typeof maybeClose === 'function') {
        maybeClose.call(stores);
      }
    },
  };
}

describe('bridge delivery snapshot: completion is gated on provably safe delivery', () => {
  it('the output contract parser validates the RAW output exactly ONCE (authoritative); the framework schema pass sees only the delivered snapshot', async () => {
    const original = {
      saved: true,
      nested: { items: ['a', 'b'], meta: { count: 2, ok: true } },
    };
    const parsedValues: unknown[] = [];
    const countingOutput: Contract<unknown> = {
      id: 'cap.snapshot.read.output',
      revision: '1',
      expected: 'bounded test contract',
      parse: (input: unknown): ReturnType<Contract<unknown>['parse']> => {
        parsedValues.push(input);
        return { ok: true, value: input };
      },
    };
    const fixture = await makeSnapshotFixture(() => original, countingOutput);
    try {
      const delivered = (await fixture.execute()) as typeof original;
      // EXACTLY ONE parse saw the raw capability output — the AUTHORITATIVE
      // validation that gates the settlement. (The framework's own
      // output-schema pass at the delivery boundary parses the DELIVERED
      // SNAPSHOT — a different, VICT-owned value — never the raw output.)
      expect(parsedValues.filter((value) => value === original)).toHaveLength(1);
      for (const value of parsedValues) {
        if (value !== original) {
          expect(value).toBe(delivered);
        }
      }
      expect(fixture.effectCount()).toBe(1);
      // Fresh VICT-owned snapshot, not the caller's object.
      expect(delivered).not.toBe(original);
      expect(delivered.nested).not.toBe(original.nested);
      expect(delivered).toEqual(original);
      // Durable record: completed with a summary of the DELIVERED shape.
      const invocations = await fixture.stores.invocations.listInvocationsForTurn(SCOPE.turnId);
      expect(invocations[0]?.status).toBe('completed');
      expect(invocations[0]?.resultSummary).toBe('object(2 fields)');
    } finally {
      fixture.close();
    }
  });

  it('caller mutation after capture changes neither the delivered value nor the durable record', async () => {
    const inner = { token: 'original' };
    const fixture = await makeSnapshotFixture(
      () => ({ saved: true, inner }),
      permissiveContract('out'),
    );
    try {
      const delivered = (await fixture.execute()) as { saved: boolean; inner: { token: string } };
      expect(delivered.inner.token).toBe('original');
      const invocationsBefore = await fixture.stores.invocations.listInvocationsForTurn(
        SCOPE.turnId,
      );
      // Caller mutates the ORIGINAL output after capture (delivery).
      inner.token = `${CANARY}-MUTATED`;
      (inner as Record<string, unknown>).smuggled = `${CANARY}-SMUGGLED`;
      expect(delivered.inner.token).toBe('original');
      expect(JSON.stringify(delivered)).not.toContain(CANARY);
      const invocationsAfter = await fixture.stores.invocations.listInvocationsForTurn(
        SCOPE.turnId,
      );
      expect(JSON.stringify(invocationsAfter)).not.toContain(CANARY);
      expect(invocationsAfter.map((r) => [r.status, r.resultSummary])).toEqual(
        invocationsBefore.map((r) => [r.status, r.resultSummary]),
      );
    } finally {
      fixture.close();
    }
  });

  it.each([
    [
      'a class instance',
      (): object => {
        class Instance {
          value = 'x';
        }
        return new Instance();
      },
    ],
    ['a Date', (): object => ({ when: new Date(0) })],
    ['a Map', (): object => ({ data: new Map([['k', `${CANARY}-MAP`]]) })],
    ['a Set', (): object => ({ data: new Set([`${CANARY}-SET`]) })],
    ['a nested function', (): object => ({ cb: (): string => CANARY })],
    ['a BigInt', (): object => ({ big: 1n })],
    ['a Symbol', (): object => ({ sym: Symbol(CANARY) })],
    ['undefined', (): object => ({ missing: undefined })],
    ['a non-finite number', (): object => ({ score: Number.NaN })],
    [
      'a cyclic structure',
      (): object => {
        const cycle: Record<string, unknown> = { saved: true };
        cycle.self = cycle;
        return cycle;
      },
    ],
    [
      'a sparse array',
      (): object => {
        const list: unknown[] = [1, 2, 3];
        delete list[1];
        return { list };
      },
    ],
    [
      'a nested accessor',
      (): object => {
        let reads = 0;
        return {
          data: {
            get poisoned(): number {
              reads += 1;
              return reads;
            },
          },
          readsProbe: (): number => reads,
        };
      },
    ],
    [
      'a hostile nested proxy',
      (): object => ({
        saved: true,
        detail: new Proxy(
          { marker: `${CANARY}-PROXY` },
          {
            getOwnPropertyDescriptor() {
              throw new Error(`${CANARY}-DESCRIPTOR`);
            },
            get() {
              throw new Error(`${CANARY}-GET`);
            },
          },
        ),
      }),
    ],
    [
      'a depth bomb',
      (): unknown => {
        let deep: unknown = 'leaf';
        for (let i = 0; i < DELIVERY_SNAPSHOT_BOUNDS.maxDepth + 2; i += 1) {
          deep = { nested: deep };
        }
        return deep;
      },
    ],
    [
      'an oversized string',
      (): object => ({ blob: `${CANARY}-${'x'.repeat(DELIVERY_SNAPSHOT_BOUNDS.maxStringLength)}` }),
    ],
  ])(
    '%s is rejected BEFORE durable completion (outcome_unknown, never completed)',
    async (_label, provider) => {
      const fixture = await makeSnapshotFixture(provider, permissiveContract('out'));
      try {
        const result = (await fixture.execute()) as Record<string, unknown>;
        // Stable safe failure — no raw exception, no canary echo.
        expect(result).toEqual({ victCapabilityFailure: 'VICT_CAPABILITY_OUTCOME_UNKNOWN' });
        expect(JSON.stringify(result)).not.toContain(CANARY);
        // EXACTLY one effect; the durable status is outcome_unknown, NEVER
        // completed; the durable code is the stable non-echoing structure code.
        expect(fixture.effectCount()).toBe(1);
        const invocations = await fixture.stores.invocations.listInvocationsForTurn(SCOPE.turnId);
        expect(invocations[0]?.status).toBe('outcome_unknown');
        expect(invocations[0]?.errorCode).toBe('VICT_CAPABILITY_UNSAFE_OUTPUT_STRUCTURE');
        expect(JSON.stringify(invocations)).not.toContain(CANARY);
        // A retry performs NO second effect (terminal replay only).
        const retry = (await fixture.execute()) as Record<string, unknown>;
        expect(fixture.effectCount()).toBe(1);
        expect(retry.victCapabilityFailure).toBe('VICT_CAPABILITY_OUTCOME_UNKNOWN');
      } finally {
        fixture.close();
      }
    },
  );

  it('a nested accessor getter is read ZERO times across capture, summary, settlement, and delivery', async () => {
    const reads = { count: 0 };
    const fixture = await makeSnapshotFixture(
      () => ({
        data: {
          get poisoned(): string {
            reads.count += 1;
            return CANARY;
          },
        },
      }),
      permissiveContract('out'),
    );
    try {
      const result = (await fixture.execute()) as Record<string, unknown>;
      expect(result).toEqual({ victCapabilityFailure: 'VICT_CAPABILITY_OUTCOME_UNKNOWN' });
      expect(reads.count).toBe(0);
      expect(JSON.stringify(result)).not.toContain(CANARY);
    } finally {
      fixture.close();
    }
  });

  it('safe completion also holds over SQLITE stores (snapshot gates the durable row)', async () => {
    const dir = mkdtemp();
    const stores = createSqliteAgentControlStores({ path: join(dir, 'snapshot.db') });
    try {
      // Reuse the in-memory flow against SQLite by re-running the safe
      // scenario through a SQLite-backed fixture.
      const capability = {
        id: 'cap.snapshot.read',
        revision: '1',
        effect: 'read',
        input: permissiveContract('cap.snapshot.read.input'),
        output: permissiveContract('cap.snapshot.read.output'),
        invoke: async () => ({ saved: true, nested: { items: ['a', 'b'] } }),
      } as unknown as CapabilityDefinition;
      const clockValue = { v: 5000 };
      const clock = (): number => (clockValue.v += 1);
      await stores.actors.upsert({
        actorId: SCOPE.actorId,
        status: 'active',
        roles: ['developer'],
        createdAt: 0,
      });
      const { AgentTurnService } = await import('@vict/control');
      const turnService = new AgentTurnService({
        stores,
        clock,
        ids: {
          turnId: (): string => `${SCOPE.turnId}-sqlite`,
          streamId: (): string => `${SCOPE.streamId}-sqlite`,
          invocationId: (): string => 'inv-snapshot-sqlite',
          approvalId: (): string => 'approval-snapshot-sqlite',
          idempotencyKey: (): string => 'key-snapshot-sqlite',
          cancelId: (): string => 'cancel-snapshot-sqlite',
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
        requestApproval: (input) => turnService.requestApproval(input),
        consumeApproval: (binding) => turnService.consumeApproval(binding),
        updateInvocationStatus: (command) => stores.invocations.updateInvocationStatus(command),
        clock,
        pollIntervalMs: 5,
        approvalExpiryMs: 5000,
      };
      const activation = {
        activationVersion: 'v1_act',
        agentProfileVersion: 'v1_profile',
        capabilities: [{ id: capability.id, revision: '1' }],
      } as unknown as Parameters<typeof bridgeCapabilityToolToMastra>[0];
      const tool = bridgeCapabilityToolToMastra(activation, capability, deps) as {
        execute: (i: unknown, c: unknown) => Promise<unknown>;
      };
      await stores.turns.createTurnIntent({
        turnId: `${SCOPE.turnId}-sqlite`,
        streamId: `${SCOPE.streamId}-sqlite`,
        threadId: 'thread-snapshot-sqlite',
        actorId: SCOPE.actorId,
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
      await stores.turns.startTurn(`${SCOPE.turnId}-sqlite`, 2);
      const delivered = (await runWithBridgeTurnScope(
        {
          ...SCOPE,
          turnId: `${SCOPE.turnId}-sqlite`,
          streamId: `${SCOPE.streamId}-sqlite`,
          threadId: 'thread-snapshot-sqlite',
        },
        () => tool.execute({ k: 'v' }, { toolCallId: 'call-snapshot-sqlite' }),
      )) as { saved: boolean; nested: { items: string[] } };
      expect(delivered).toEqual({ saved: true, nested: { items: ['a', 'b'] } });
      expect(Object.getPrototypeOf(delivered)).toBe(Object.prototype);
      const invocations = await stores.invocations.listInvocationsForTurn(`${SCOPE.turnId}-sqlite`);
      expect(invocations[0]?.status).toBe('completed');
    } finally {
      const maybeClose = (stores as { close?: () => void }).close;
      if (typeof maybeClose === 'function') {
        maybeClose.call(stores);
      }
      rmSyncSafe(dir);
    }
  });
});

// ---- Small local helpers -----------------------------------------------------

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function mkdtemp(): string {
  return mkdtempSync(join(tmpdir(), 'vict-delivery-snapshot-'));
}

function rmSyncSafe(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Disposable directory; Windows may hold handles briefly.
  }
}
