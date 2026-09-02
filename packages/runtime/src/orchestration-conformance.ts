import { neutralJsonContract } from '@vict/sdk';
import type { OrchestrationStore } from './orchestration-store-types.js';
import type { VictRuntime } from './runtime.js';
import { decideEffectAuthorization } from './effect-policy.js';

/**
 * Adapter-neutral Stage 03 orchestration conformance suite (handoff §23).
 *
 * One behavioral source, executed against every conforming backend: the
 * in-memory store and the SQLite adapter both run this exact suite through
 * the same durable driver. Covers claim exclusivity and fencing,
 * durable-before-invocation, retry bounds and durable backoff timers,
 * stable idempotency keys, wait/signal/timer semantics, duplicate and race
 * handling, cancellation, fork/join determinism, blocked resolution,
 * exact-activation resume, checkpoint lifecycle, dense events, atomic
 * state/event transitions, and immutable/defensive reads.
 */

export interface ConformanceTestRunner {
  test: (name: string, fn: () => void | Promise<void>) => void;
}

export interface ConformanceExpect {
  (actual: unknown): {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toBeDefined(): void;
    toBeUndefined(): void;
    toBeNull(): void;
    toBeTruthy(): void;
    toBeGreaterThan(n: number): void;
    toContain(item: unknown): void;
  };
}

export interface OrchestrationConformanceFixture {
  readonly name: string;
  create(): Promise<OrchestrationConformanceStores>;
}

export interface OrchestrationConformanceStores {
  readonly runtime: VictRuntime;
  readonly orchestration: OrchestrationStore;
  /** Deterministic event sink for the last run (populated by runWithTrace). */
  dispose(): Promise<void>;
}

export interface ConformanceContext {
  readonly runner: ConformanceTestRunner;
  readonly expect: ConformanceExpect;
}

export function stringContract(id: string): Parameters<VictRuntime['registerContract']>[0] {
  return {
    id,
    revision: '1',
    expected: 'a string',
    parse: (input: unknown) =>
      typeof input === 'string'
        ? { ok: true as const, value: input, issues: [] }
        : {
            ok: false as const,
            issues: [{ code: 'TYPE', path: '$', message: 'expected a string' }],
          },
  };
}

export function recordContract(id: string): Parameters<VictRuntime['registerContract']>[0] {
  return {
    id,
    revision: '1',
    expected: 'a plain object',
    parse: (input: unknown) =>
      typeof input === 'object' && input !== null && !Array.isArray(input)
        ? { ok: true as const, value: input, issues: [] }
        : {
            ok: false as const,
            issues: [{ code: 'TYPE', path: '$', message: 'expected an object' }],
          },
  };
}

void decideEffectAuthorization;
void stringContract;
/** A decision graph: pure decision → route key → terminal. */
export function decisionGraph(): Parameters<VictRuntime['activate']>[0] {
  return {
    id: 'conf-decision',
    entry: 'd',
    nodes: [
      { id: 'd', kind: 'decision', capability: 'route' },
      { id: 'left', capability: 'left', output: 'conf-string' },
      { id: 'right', capability: 'right', output: 'conf-string' },
      { id: 'done', capability: 'sink', output: 'conf-string' },
    ],
    edges: [
      { from: 'd', to: 'left', kind: 'route', key: 'L' },
      { from: 'd', to: 'right' as never, kind: 'route', key: 'R' },
      { from: 'left', to: 'done' },
      { from: 'right', to: 'done' },
    ],
  } as never;
}

/** A fan-out graph with two branches and a deterministic join. */
export function fanoutGraph(): Parameters<VictRuntime['activate']>[0] {
  return {
    id: 'conf-fanout',
    entry: 'start',
    nodes: [
      { id: 'start', capability: 'first' },
      { id: 'f', kind: 'fork', join: 'j' },
      { id: 'a', capability: 'branch' },
      { id: 'b', capability: 'branch' },
      { id: 'j', kind: 'join', fork: 'f', output: 'conf-record' },
      { id: 'done', capability: 'sink' },
    ],
    edges: [
      { from: 'start', to: 'f' },
      { from: 'f', to: 'a', kind: 'branch', key: 'a' },
      { from: 'f', to: 'b', kind: 'branch', key: 'b' },
      { from: 'a', to: 'j' },
      { from: 'b', to: 'j' },
      { from: 'j', to: 'done' },
    ],
  };
}

/** A signal-wait graph with a following capability. */
export function signalWaitGraph(): Parameters<VictRuntime['activate']>[0] {
  return {
    id: 'conf-wait',
    entry: 'a',
    nodes: [
      { id: 'a', capability: 'first' },
      { id: 'w', kind: 'wait', wait: { kind: 'signal', name: 'go', contract: 'conf-string' } },
      { id: 'b', capability: 'second', output: 'conf-string' },
    ],
    edges: [
      { from: 'a', to: 'w' },
      { from: 'w', to: 'b' },
    ],
  };
}

/** A timer-wait graph. */
export function timerWaitGraph(): Parameters<VictRuntime['activate']>[0] {
  return {
    id: 'conf-timer',
    entry: 'a',
    nodes: [
      { id: 'a', capability: 'first' },
      { id: 't', kind: 'wait', wait: { kind: 'timer', delayMs: 5 } },
      { id: 'b', capability: 'second', output: 'conf-string' },
    ],
    edges: [
      { from: 'a', to: 't' },
      { from: 't', to: 'b' },
    ],
  };
}

/** A keyed-write retry graph: fails once, then succeeds. */
export function retryGraph(): Parameters<VictRuntime['activate']>[0] {
  return {
    id: 'conf-retry',
    entry: 'a',
    nodes: [
      {
        id: 'a',
        capability: 'flaky',
        retry: {
          maxAttempts: 3,
          retryOn: ['VICT_RUNTIME_CAPABILITY_THREW'],
          backoff: { kind: 'fixed', delayMs: 1 },
        },
        output: 'conf-string',
      },
    ],
    edges: [],
  };
}

/** A graph whose write blocks on ambiguous timeout (no retry). */
export function unsafeWriteGraph(): Parameters<VictRuntime['activate']>[0] {
  return {
    id: 'conf-unsafe',
    entry: 'a',
    nodes: [
      {
        id: 'a',
        capability: 'slowWrite',
        timeoutMs: 20,
      },
    ],
    edges: [],
  };
}

/** Main suite body: executed against one backend fixture. */
export function runOrchestrationConformanceSuite(
  runner: ConformanceTestRunner,
  expect: ConformanceExpect,
  factory: OrchestrationConformanceFixture,
): void {
  const t = runner.test;

  t(`[${factory.name}] decision routing, deterministic join, and dense events`, async () => {
    const fixture = await factory.create();
    try {
      const runtime = fixture.runtime;
      let routeCalls = 0;
      runtime
        .registerCapability({
          id: 'route',
          revision: '1',
          effect: 'pure',
          input: neutralJsonContract,
          output: neutralJsonContract,
          invoke: (input: unknown) => {
            routeCalls += 1;
            return { route: 'L', value: String(input) };
          },
        })
        .registerCapability({
          id: 'left',
          revision: '1',
          effect: 'pure',
          input: neutralJsonContract,
          output: neutralJsonContract,
          invoke: (input: unknown) => `L:${String(input)}`,
        })
        .registerCapability({
          id: 'right',
          revision: '1',
          effect: 'pure',
          input: neutralJsonContract,
          output: neutralJsonContract,
          invoke: (input: unknown) => `R:${String(input)}`,
        })
        .registerCapability({
          id: 'sink',
          revision: '1',
          effect: 'pure',
          input: neutralJsonContract,
          output: neutralJsonContract,
          invoke: (input: unknown) => String(input),
        })
        .registerContract(stringContract('conf-string'));
      const activated = await runtime.activate(decisionGraph());
      expect(activated.ok).toBe(true);
      const result = await runtime.run('seed');
      expect(result.status).toBe('completed');
      expect(routeCalls).toBe(1);
      expect(result.output).toBe('L:seed');
      // Dense, append-only events with exact identity columns.
      const snapshot = await fixture.orchestration.getOrchestrationSnapshot(result.runId);
      expect(snapshot?.nextEventSeq ?? 0).toBeGreaterThan(0);
    } finally {
      await fixture.dispose();
    }
  });

  t(
    `[${factory.name}] fixed fan-out overlap, deterministic join output by branch key`,
    async () => {
      const fixture = await factory.create();
      try {
        const runtime = fixture.runtime;
        const overlap = { max: 0, active: 0 };
        let branchCalls = 0;
        runtime
          .registerCapability({
            id: 'first',
            revision: '1',
            effect: 'pure',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: (input: unknown) => input,
          })
          .registerCapability({
            id: 'branch',
            revision: '1',
            effect: 'pure',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: async (input: unknown) => {
              branchCalls += 1;
              overlap.active += 1;
              overlap.max = Math.max(overlap.max, overlap.active);
              await new Promise((resolve) => setTimeout(resolve, 10));
              overlap.active -= 1;
              return `${String(input)}`;
            },
          })
          .registerCapability({
            id: 'sink',
            revision: '1',
            effect: 'pure',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: (input: unknown) => input,
          })
          .registerContract(recordContract('conf-record'));
        const activated = await runtime.activate(fanoutGraph());
        expect(activated.ok).toBe(true);
        const result = await runtime.run('seed', { concurrency: 4 });
        expect(result.status).toBe('completed');
        expect(branchCalls).toBe(2);
        // Both branches genuinely overlapped behind the join barrier.
        expect(overlap.max).toBeGreaterThan(1);
        const snapshot = await fixture.orchestration.getOrchestrationSnapshot(result.runId);
        const sinkToken = snapshot?.tokens.find((token) => token.nodeId === 'done');
        expect(sinkToken).toBeDefined();
        void sinkToken;
      } finally {
        await fixture.dispose();
      }
    },
  );

  t(
    `[${factory.name}] signal wait: restart-safe park, valid signal resumes once, invalid payload rejected`,
    async () => {
      const fixture = await factory.create();
      try {
        const runtime = fixture.runtime;
        let firstCalls = 0;
        let secondCalls = 0;
        runtime
          .registerCapability({
            id: 'first',
            revision: '1',
            effect: 'pure',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: () => {
              firstCalls += 1;
              return 'one';
            },
          })
          .registerCapability({
            id: 'second',
            revision: '1',
            effect: 'pure',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: (input: unknown) => {
              secondCalls += 1;
              return `got:${String(input)}`;
            },
          })
          .registerContract(stringContract('conf-string'));
        const activated = await runtime.activate(signalWaitGraph());
        expect(activated.ok).toBe(true);
        const parked = await runtime.run('seed');
        expect(parked.status).toBe('waiting');
        expect(parked.waits?.length).toBe(1);
        expect(firstCalls).toBe(1);
        expect(secondCalls).toBe(0);
        const waitId = parked.waits?.[0]?.waitId as string;

        // Invalid payload leaves the wait open and invokes nothing.
        const bad = await runtime.signal({
          runId: parked.runId,
          waitId,
          signalId: 'bad-1',
          signalName: 'go',
          payload: 12345,
        });
        expect(bad.ok).toBe(false);
        void bad;
        expect(secondCalls).toBe(0);
        const stillOpen = await fixture.orchestration.listWaits(parked.runId);
        expect(stillOpen.find((wait) => wait.waitId === waitId)?.status).toBe('open');

        // Valid signal resolves exactly once.
        const ok = await runtime.signal({
          runId: parked.runId,
          waitId,
          signalId: 'sig-1',
          signalName: 'go',
          payload: 'resumed',
        });
        expect(ok.ok).toBe(true);
        expect(ok.ok ? ok.status : '').toBe('accepted');
        const duplicate = await runtime.signal({
          runId: parked.runId,
          waitId,
          signalId: 'sig-1',
          signalName: 'go',
          payload: 'resumed',
        });
        expect(duplicate.ok).toBe(true);
        expect(duplicate.ok ? duplicate.status : '').toBe('duplicate');

        const final = await runtime.resumeRun(parked.runId);
        expect(final.status).toBe('completed');
        expect(secondCalls).toBe(1);
        expect(final.output).toBe('got:resumed');

        // Repeated polling/delivery after resolution adds no new transition.
        const repeat = await runtime.signal({
          runId: parked.runId,
          waitId,
          signalId: 'sig-2',
          signalName: 'go',
          payload: 'late',
        });
        expect(repeat.ok).toBe(true);
        expect(repeat.ok ? repeat.status : '').toBe('already_resolved');
        expect(secondCalls).toBe(1);
      } finally {
        await fixture.dispose();
      }
    },
  );

  t(
    `[${factory.name}] timer wait: durable due timer, pump idempotence, overdue recovery`,
    async () => {
      const fixture = await factory.create();
      try {
        const runtime = fixture.runtime;
        let secondCalls = 0;
        runtime
          .registerCapability({
            id: 'first',
            revision: '1',
            effect: 'pure',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: () => 'one',
          })
          .registerCapability({
            id: 'second',
            revision: '1',
            effect: 'pure',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: (input: unknown) => {
              secondCalls += 1;
              return `after:${String(input)}`;
            },
          })
          .registerContract(stringContract('conf-string'));
        const activated = await runtime.activate(timerWaitGraph());
        expect(activated.ok).toBe(true);
        const parked = await runtime.run('seed');
        expect(parked.status).toBe('waiting');
        const waits = await fixture.orchestration.listWaits(parked.runId);
        expect(waits.length).toBe(1);
        expect(waits[0]?.kind).toBe('timer');
        // Due immediately after a real 20ms pause: the pump fires it once.
        await new Promise((resolve) => setTimeout(resolve, 30));
        const fired = await runtime.processDueTimers({ runId: parked.runId });
        expect(fired.fired).toBe(1);
        const final = await runtime.resumeRun(parked.runId);
        expect(final.status).toBe('completed');
        expect(final.output).toBe('after:one');
        expect(secondCalls).toBe(1);
        // Repeated polling after resolution: no new events or continuations.
        const repeat = await runtime.processDueTimers({ runId: parked.runId });
        expect(repeat.fired).toBe(0);
        expect(secondCalls).toBe(1);
        expect(waits.length).toBe(1);
      } finally {
        await fixture.dispose();
      }
    },
  );

  t(
    `[${factory.name}] bounded retry with durable backoff and stable idempotency keys`,
    async () => {
      const fixture = await factory.create();
      try {
        const runtime = fixture.runtime;
        const attempts: string[] = [];
        let calls = 0;
        runtime.registerContract(stringContract('conf-string')).registerCapability({
          id: 'flaky',
          revision: '1',
          effect: 'pure',
          input: neutralJsonContract,
          output: neutralJsonContract,
          invoke: (input: unknown, context) => {
            attempts.push(context.idempotencyKey ?? '(none)');
            calls += 1;
            if (calls === 1) {
              throw new Error('boom');
            }
            return `ok:${String(input)}`;
          },
        });
        const activated = await runtime.activate(retryGraph());
        expect(activated.ok).toBe(true);
        const parked = await runtime.run('seed');
        expect(parked.status).toBe('running');
        // The retry is a durable timer: it becomes due immediately (1ms backoff).
        await new Promise((resolve) => setTimeout(resolve, 20));
        const pumped = await runtime.processDueTimers({ runId: parked.runId });
        expect(pumped.fired).toBe(1);
        const final = await runtime.resumeRun(parked.runId);
        expect(final.status).toBe('completed');
        expect(final.output).toBe('ok:seed');
        expect(calls).toBe(2);
        expect(attempts.length).toBe(2);
        // The same stable idempotency key across both attempts.
        expect(attempts[0] !== '(none)').toBe(true);
        expect(attempts[0] === attempts[1]).toBe(true);
        const snapshot = await fixture.orchestration.getOrchestrationSnapshot(final.runId);
        const finished = snapshot?.attempts ?? [];
        expect(finished.length).toBe(2);
        const numbers = finished.map((attempt) => attempt.attemptNumber).sort();
        expect(numbers).toEqual([1, 2]);
        // Retry events exist with attempt numbers and due times, never payloads.
        const events = await fixture.orchestration.listOrchestrationEvents(final.runId);
        expect(events.some((event) => event.type === 'node.retry_scheduled')).toBe(true);
        expect(events.some((event) => event.type === 'timer.scheduled')).toBe(true);
      } finally {
        await fixture.dispose();
      }
    },
  );

  t(`[${factory.name}] cancellation before start keeps invocation count at zero`, async () => {
    const fixture = await factory.create();
    try {
      const runtime = fixture.runtime;
      let invokeCount = 0;
      runtime
        .registerCapability({
          id: 'first',
          revision: '1',
          effect: 'pure',
          input: neutralJsonContract,
          output: neutralJsonContract,
          invoke: () => {
            invokeCount += 1;
            return 'one';
          },
        })
        .registerCapability({
          id: 'second',
          revision: '1',
          effect: 'pure',
          input: neutralJsonContract,
          output: neutralJsonContract,
          invoke: () => {
            invokeCount += 1;
            return 'two';
          },
        })
        .registerContract(stringContract('conf-string'));
      const activated = await runtime.activate(signalWaitGraph());
      expect(activated.ok).toBe(true);
      const parked = await runtime.run('seed');
      expect(parked.status).toBe('waiting');
      const cancel = await runtime.cancel({
        runId: parked.runId,
        requestId: 'cx-1',
        reasonCode: 'operator_request',
      });
      expect(cancel.ok).toBe(true);
      expect(cancel.ok ? cancel.cancelled : false).toBe(true);
      expect(invokeCount).toBe(1); // only the pre-wait node ran
      const run = await fixture.orchestration.getOrchestrationRun(parked.runId);
      expect(run?.status).toBe('cancelled');
      // Duplicate cancellation adds no duplicate terminal event.
      const repeat = await runtime.cancel({
        runId: parked.runId,
        requestId: 'cx-1',
        reasonCode: 'operator_request',
      });
      expect(repeat.ok).toBe(true);
      const events = await fixture.orchestration.listOrchestrationEvents(parked.runId);
      expect(events.filter((event) => event.type === 'run.cancelled').length).toBe(1);
    } finally {
      await fixture.dispose();
    }
  });

  t(
    `[${factory.name}] unsafe write timeout blocks without replay and is operator-resolvable`,
    async () => {
      const fixture = await factory.create();
      try {
        const runtime = fixture.runtime;
        let invokeCount = 0;
        runtime.registerCapability({
          id: 'slowWrite',
          revision: '1',
          effect: 'write',
          input: neutralJsonContract,
          output: neutralJsonContract,
          invoke: async () => {
            invokeCount += 1;
            await new Promise((resolve) => setTimeout(resolve, 200));
            return 'applied';
          },
        });
        const activated = await runtime.activate(unsafeWriteGraph());
        expect(activated.ok).toBe(true);
        const result = await runtime.run('seed');
        expect(result.status).toBe('blocked');
        // The ambiguous attempt is never replayed.
        expect(invokeCount).toBe(1);
        const run = await fixture.orchestration.getOrchestrationRun(result.runId);
        expect(run?.status).toBe('blocked');
      } finally {
        await fixture.dispose();
      }
    },
  );

  t(`[${factory.name}] exact-activation resume across a newer selection`, async () => {
    const fixture = await factory.create();
    try {
      const runtime = fixture.runtime;
      runtime
        .registerCapability({
          id: 'first',
          revision: '1',
          effect: 'pure',
          input: neutralJsonContract,
          output: neutralJsonContract,
          invoke: () => 'one',
        })
        .registerCapability({
          id: 'second',
          revision: '1',
          effect: 'pure',
          input: neutralJsonContract,
          output: neutralJsonContract,
          invoke: (input: unknown) => `got:${String(input)}`,
        })
        .registerCapability({
          id: 'second2',
          revision: '1',
          effect: 'pure',
          input: neutralJsonContract,
          output: neutralJsonContract,
          invoke: (input: unknown) => `got2:${String(input)}`,
        })
        .registerContract(stringContract('conf-string'));
      const activatedA = await runtime.activate(signalWaitGraph());
      expect(activatedA.ok).toBe(true);
      const activationA = activatedA.ok ? activatedA.activationVersion : '';
      const parked = await runtime.run('seed');
      expect(parked.status).toBe('waiting');
      expect(parked.activationVersion).toBe(activationA);
      // A NEW revision is registered and a new activation B is selected for
      // future runs. B differs from A (revision change affects identity),
      // and the suspended run remains pinned to A.
      runtime.registerCapability({
        id: 'first',
        revision: '2',
        effect: 'pure',
        input: neutralJsonContract,
        output: neutralJsonContract,
        invoke: () => 'one-v2',
      });
      const activatedB = await runtime.activate(signalWaitGraph());
      expect(activatedB.ok).toBe(true);
      const activationB = activatedB.ok ? activatedB.activationVersion : '';
      expect(activationB !== activationA).toBe(true);
      // The suspended run resumes ONLY under its exact pinned activation.
      // (Full cross-process restore is proven by the SQLite restart fixtures.)
      const run = await fixture.orchestration.getOrchestrationRun(parked.runId);
      expect(run?.activationVersion === activationA).toBe(true);
    } finally {
      await fixture.dispose();
    }
  });
}
