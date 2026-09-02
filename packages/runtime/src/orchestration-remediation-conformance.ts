import { neutralJsonContract } from '@vict/sdk';
import type { KernelEvent } from '@vict/kernel';
import type { ManualOrchestrationClock } from './orchestration-race-conformance.js';
import type { OrchestrationStore } from './orchestration-store-types.js';
import type { VictRuntime } from './runtime.js';

/**
 * Stage 03 audit-remediation conformance suite.
 *
 * Permanent shared regression evidence for the three HIGH findings of
 * `docs/report/VICT-STAGE-03-INDEPENDENT-AUDIT.md`, executed against BOTH
 * conforming backends (in-memory store and SQLite adapter) through the same
 * durable driver:
 *
 * - HIGH-1: two sequential waits on ONE linear token lineage — the wake/park
 *   decision is bound to the current wait instance (token + node identity);
 *   a resolved earlier wait on the lineage never satisfies a later wait.
 * - HIGH-2: a plain signal wait with NO declared timeout creates no
 *   wait-timeout timer and survives timer pumping and far clock advances;
 *   a DECLARED timeout still times out correctly through its timeout edge.
 * - HIGH-3: the authorized operator `fail` action resolves a blocked run to
 *   terminal `failed` atomically, idempotently, and identically on both
 *   adapters (public `runtime.resolveBlocked` surface only).
 */

export interface OrchestrationRemediationStores {
  readonly runtime: VictRuntime;
  readonly orchestration: OrchestrationStore;
}

export interface OrchestrationRemediationHandle {
  readonly stores: OrchestrationRemediationStores;
  /**
   * Close and reopen the durable stores over the SAME state. SQLite
   * implementations perform a real close/reopen; the in-memory backend
   * returns its existing stores (nothing is persisted).
   */
  reopen(): Promise<OrchestrationRemediationStores>;
  /** An explicitly operator-authorized runtime over the SAME durable stores. */
  createOperatorRuntime(): Promise<VictRuntime>;
  dispose(): Promise<void>;
}

export interface OrchestrationRemediationFixture {
  readonly name: string;
  create(clock?: ManualOrchestrationClock): Promise<OrchestrationRemediationHandle>;
}

export interface ConformanceTestRunner {
  test(name: string, implementation: () => Promise<void> | void): unknown;
}

export type ConformanceExpect = (actual: unknown) => {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toBeDefined(): void;
  toBeUndefined(): void;
  toBeNull(): void;
  toBeTruthy(): void;
  toBeGreaterThan(n: number): void;
};

function countEvent(events: readonly KernelEvent[], type: string): number {
  return events.filter((event) => event.type === type).length;
}

function countTimeoutTimerEvents(events: readonly KernelEvent[]): number {
  return events.filter(
    (event) =>
      event.type === 'timer.scheduled' &&
      (event as unknown as { kind?: string }).kind === 'wait-timeout',
  ).length;
}

export function runOrchestrationRemediationSuite(
  runner: ConformanceTestRunner,
  expect: ConformanceExpect,
  factory: OrchestrationRemediationFixture,
): void {
  const t = runner.test;
  const label = (name: string): string => `[${factory.name}] ${name}`;

  t(
    label('HIGH-1: two sequential waits on one lineage each wait for their own signal'),
    async () => {
      const handle = await factory.create();
      try {
        const { runtime, orchestration } = handle.stores;
        let midCalls = 0;
        let doneCalls = 0;
        runtime
          .registerCapability({
            id: 'r-seed',
            revision: '1',
            effect: 'pure',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: (i: unknown) => i,
          })
          .registerCapability({
            id: 'r-mid',
            revision: '1',
            effect: 'pure',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: (i: unknown) => {
              midCalls += 1;
              return i;
            },
          })
          .registerCapability({
            id: 'r-done',
            revision: '1',
            effect: 'pure',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: (i: unknown) => {
              doneCalls += 1;
              return i;
            },
          });
        const activated = await runtime.activate({
          id: 'remediation-two-waits',
          entry: 's',
          nodes: [
            { id: 's', capability: 'r-seed' },
            { id: 'w1', kind: 'wait', wait: { kind: 'signal', name: 'first' } },
            { id: 'm', capability: 'r-mid' },
            { id: 'w2', kind: 'wait', wait: { kind: 'signal', name: 'second' } },
            { id: 'd', capability: 'r-done' },
          ],
          edges: [
            { from: 's', to: 'w1', kind: 'success' },
            { from: 'w1', to: 'm', kind: 'success' },
            { from: 'm', to: 'w2', kind: 'success' },
            { from: 'w2', to: 'd', kind: 'success' },
          ],
        });
        expect(activated.ok).toBeTruthy();

        // (1) The run reaches the first signal wait.
        const parked = await runtime.run('seed');
        expect(parked.status).toBe('waiting');
        expect(parked.waits?.length).toBe(1);
        const firstWaitId = parked.waits?.[0]?.waitId as string;

        // (2) The first signal resolves only that wait; execution advances
        // to and parks at the second wait; the run stays non-terminal.
        const signal1 = await runtime.signal({
          runId: parked.runId,
          waitId: firstWaitId,
          signalId: 'sig-first-1',
          signalName: 'first',
          payload: 'p1',
        });
        expect(signal1.ok).toBeTruthy();
        expect(signal1.ok ? signal1.status : '').toBe('accepted');
        const afterFirst = await runtime.resumeRun(parked.runId);
        expect(afterFirst.status).toBe('waiting');
        expect(afterFirst.waits?.length).toBe(1);
        const secondWaitId = afterFirst.waits?.[0]?.waitId as string;
        expect(secondWaitId === undefined || secondWaitId !== firstWaitId).toBeTruthy();
        expect((afterFirst.waits?.[0]?.signalName as string | undefined) ?? '').toBe('second');
        expect(midCalls).toBe(1);
        expect(doneCalls).toBe(0);

        // Durable facts after the first wake: the first wait is resolved,
        // the second is open.
        const waits = await orchestration.listWaits(parked.runId);
        expect(waits.filter((wait) => wait.status === 'resolved').length).toBe(1);
        expect(waits.filter((wait) => wait.status === 'open').length).toBe(1);

        // (6) Replaying the first signal can NEVER resolve the second wait.
        const replay = await runtime.signal({
          runId: parked.runId,
          waitId: firstWaitId,
          signalId: 'sig-first-1',
          signalName: 'first',
          payload: 'p1',
        });
        expect(replay.ok).toBeTruthy();
        expect(replay.ok ? replay.status : '').toBe('duplicate');
        const replayNewId = await runtime.signal({
          runId: parked.runId,
          waitId: firstWaitId,
          signalId: 'sig-first-2',
          signalName: 'first',
          payload: 'p1',
        });
        expect(replayNewId.ok).toBeTruthy();
        expect(replayNewId.ok ? replayNewId.status : '').toBe('already_resolved');
        const stillWaiting = await orchestration.getOrchestrationRun(parked.runId);
        expect(stillWaiting?.status).toBe('waiting');
        expect(doneCalls).toBe(0);

        // (7) Only the second declared signal permits completion.
        const signal2 = await runtime.signal({
          runId: parked.runId,
          waitId: secondWaitId,
          signalId: 'sig-second-1',
          signalName: 'second',
          payload: 'p2',
        });
        expect(signal2.ok).toBeTruthy();
        expect(signal2.ok ? signal2.status : '').toBe('accepted');
        const final = await runtime.resumeRun(parked.runId);
        expect(final.status).toBe('completed');

        // (8) Event, receipt, and continuation counts remain exactly once.
        const events = await orchestration.listOrchestrationEvents(parked.runId);
        expect(countEvent(events, 'signal.received')).toBe(2);
        expect(countEvent(events, 'run.waiting')).toBe(2);
        expect(countEvent(events, 'run.resumed')).toBe(2);
        expect(countEvent(events, 'run.completed')).toBe(1);
        // s(1) + w1(park+wake: 2) + m(1) + w2(park+wake: 2) + d(1)
        expect(countEvent(events, 'node.completed')).toBe(7);
        const receipts = await orchestration.listSignalReceipts(parked.runId);
        expect(receipts.length).toBe(2);
        expect(midCalls).toBe(1);
        expect(doneCalls).toBe(1);

        // (9) SQLite close/reopen between the waits preserves the behavior
        // (covered by the reopen variant below); here we additionally verify
        // the completed run is stable across reopen.
        const reopened = await handle.reopen();
        const stable = await reopened.orchestration.getOrchestrationRun(parked.runId);
        expect(stable?.status).toBe('completed');
        const reopenedEvents = await reopened.orchestration.listOrchestrationEvents(parked.runId);
        expect(reopenedEvents.length).toBe(events.length);
      } finally {
        await handle.dispose();
      }
    },
  );

  t(
    label('HIGH-1: SQLite close/reopen between two sequential waits preserves wait sequencing'),
    async () => {
      const handle = await factory.create();
      try {
        const { runtime } = handle.stores;
        runtime
          .registerCapability({
            id: 'r-seed',
            revision: '1',
            effect: 'pure',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: (i: unknown) => i,
          })
          .registerCapability({
            id: 'r-mid',
            revision: '1',
            effect: 'pure',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: (i: unknown) => i,
          })
          .registerCapability({
            id: 'r-done',
            revision: '1',
            effect: 'pure',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: (i: unknown) => i,
          });
        const activated = await runtime.activate({
          id: 'remediation-two-waits-reopen',
          entry: 's',
          nodes: [
            { id: 's', capability: 'r-seed' },
            { id: 'w1', kind: 'wait', wait: { kind: 'signal', name: 'first' } },
            { id: 'm', capability: 'r-mid' },
            { id: 'w2', kind: 'wait', wait: { kind: 'signal', name: 'second' } },
            { id: 'd', capability: 'r-done' },
          ],
          edges: [
            { from: 's', to: 'w1', kind: 'success' },
            { from: 'w1', to: 'm', kind: 'success' },
            { from: 'm', to: 'w2', kind: 'success' },
            { from: 'w2', to: 'd', kind: 'success' },
          ],
        });
        expect(activated.ok).toBeTruthy();
        const parked = await runtime.run('seed');
        expect(parked.status).toBe('waiting');
        const firstWaitId = parked.waits?.[0]?.waitId as string;

        // Close and reopen BEFORE the first signal. The reopened runtime
        // re-registers the identical pinned artifacts (revision-pinned
        // registry lookups resolve the exact stored activation).
        const reopened = await handle.reopen();
        reopened.runtime
          .registerCapability({
            id: 'r-seed',
            revision: '1',
            effect: 'pure',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: (i: unknown) => i,
          })
          .registerCapability({
            id: 'r-mid',
            revision: '1',
            effect: 'pure',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: (i: unknown) => i,
          })
          .registerCapability({
            id: 'r-done',
            revision: '1',
            effect: 'pure',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: (i: unknown) => i,
          });
        const signal1 = await reopened.runtime.signal({
          runId: parked.runId,
          waitId: firstWaitId,
          signalId: 'sig-first-1',
          signalName: 'first',
          payload: 'p1',
        });
        expect(signal1.ok).toBeTruthy();
        expect(signal1.ok ? signal1.status : '').toBe('accepted');
        const afterFirst = await reopened.runtime.resumeRun(parked.runId);
        expect(afterFirst.status).toBe('waiting');
        const secondWaitId = afterFirst.waits?.[0]?.waitId as string;
        expect(secondWaitId === undefined || secondWaitId !== firstWaitId).toBeTruthy();
        expect((afterFirst.waits?.[0]?.signalName as string | undefined) ?? '').toBe('second');

        // The replayed first signal still cannot resolve the second wait
        // after restart.
        const replay = await reopened.runtime.signal({
          runId: parked.runId,
          waitId: firstWaitId,
          signalId: 'sig-first-1',
          signalName: 'first',
          payload: 'p1',
        });
        expect(replay.ok).toBeTruthy();
        expect(replay.ok ? replay.status : '').toBe('duplicate');

        const signal2 = await reopened.runtime.signal({
          runId: parked.runId,
          waitId: secondWaitId,
          signalId: 'sig-second-1',
          signalName: 'second',
          payload: 'p2',
        });
        expect(signal2.ok).toBeTruthy();
        const final = await reopened.runtime.resumeRun(parked.runId);
        expect(final.status).toBe('completed');
        const events = await reopened.orchestration.listOrchestrationEvents(parked.runId);
        expect(countEvent(events, 'signal.received')).toBe(2);
        expect(countEvent(events, 'run.completed')).toBe(1);
      } finally {
        await handle.dispose();
      }
    },
  );

  t(
    label(
      'HIGH-2: a plain signal wait has no timeout timer and survives pumping and far clock advances',
    ),
    async () => {
      const { createManualOrchestrationClock } =
        await import('./orchestration-race-conformance.js');
      const manual = createManualOrchestrationClock();
      const handle = await factory.create(manual);
      try {
        const { runtime, orchestration } = handle.stores;
        let doneCalls = 0;
        runtime
          .registerCapability({
            id: 'r-seed',
            revision: '1',
            effect: 'pure',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: (i: unknown) => i,
          })
          .registerCapability({
            id: 'r-done',
            revision: '1',
            effect: 'pure',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: (i: unknown) => {
              doneCalls += 1;
              return i;
            },
          });
        const activated = await runtime.activate({
          id: 'remediation-plain-wait',
          entry: 's',
          nodes: [
            { id: 's', capability: 'r-seed' },
            { id: 'w', kind: 'wait', wait: { kind: 'signal', name: 'go' } },
            { id: 'd', capability: 'r-done' },
          ],
          edges: [
            { from: 's', to: 'w', kind: 'success' },
            { from: 'w', to: 'd', kind: 'success' },
          ],
        });
        expect(activated.ok).toBeTruthy();

        // (1) The plain signal wait parks with NO timeout timer of any kind.
        const parked = await runtime.run('seed');
        expect(parked.status).toBe('waiting');
        const events = await orchestration.listOrchestrationEvents(parked.runId);
        expect(countTimeoutTimerEvents(events)).toBe(0);
        const snapshot = await orchestration.getOrchestrationSnapshot(parked.runId);
        expect((snapshot?.timers ?? []).length).toBe(0);
        const waits = await orchestration.listWaits(parked.runId);
        expect(waits.length).toBe(1);
        expect(waits[0]?.timeoutAt).toBeNull();

        // (2) Pumping timers immediately does nothing.
        const pump1 = await runtime.processDueTimers({ runId: parked.runId });
        expect(pump1.fired).toBe(0);
        expect((await orchestration.getOrchestrationRun(parked.runId))?.status).toBe('waiting');

        // (3) Advancing the manual clock far into the future and pumping
        // still does nothing.
        manual.advance(365 * 24 * 60 * 60 * 1000);
        const pump2 = await runtime.processDueTimers({ runId: parked.runId });
        expect(pump2.fired).toBe(0);

        // (4) The run remains parked and recoverable — and (6) close/reopen
        // does not manufacture a timer.
        expect((await orchestration.getOrchestrationRun(parked.runId))?.status).toBe('waiting');
        const reopened = await handle.reopen();
        const reopenedSnapshot = await reopened.orchestration.getOrchestrationSnapshot(
          parked.runId,
        );
        expect((reopenedSnapshot?.timers ?? []).length).toBe(0);
        const reopenedEvents = await reopened.orchestration.listOrchestrationEvents(parked.runId);
        expect(countTimeoutTimerEvents(reopenedEvents)).toBe(0);
        const pump3 = await reopened.runtime.processDueTimers({ runId: parked.runId });
        expect(pump3.fired).toBe(0);
        expect((await reopened.orchestration.getOrchestrationRun(parked.runId))?.status).toBe(
          'waiting',
        );

        // (5) The proper signal resumes it exactly once (artifacts
        // re-registered identically on the reopened runtime).
        reopened.runtime
          .registerCapability({
            id: 'r-seed',
            revision: '1',
            effect: 'pure',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: (i: unknown) => i,
          })
          .registerCapability({
            id: 'r-done',
            revision: '1',
            effect: 'pure',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: (i: unknown) => {
              doneCalls += 1;
              return i;
            },
          });
        const signal = await reopened.runtime.signal({
          runId: parked.runId,
          waitId: parked.waits?.[0]?.waitId as string,
          signalId: 'sig-go-1',
          signalName: 'go',
          payload: 'resumed',
        });
        expect(signal.ok).toBeTruthy();
        expect(signal.ok ? signal.status : '').toBe('accepted');
        const final = await reopened.runtime.resumeRun(parked.runId);
        expect(final.status).toBe('completed');
        expect(doneCalls).toBe(1);
        const finalEvents = await reopened.orchestration.listOrchestrationEvents(parked.runId);
        expect(countEvent(finalEvents, 'signal.received')).toBe(1);
        expect(countEvent(finalEvents, 'run.resumed')).toBe(1);
        expect(countTimeoutTimerEvents(finalEvents)).toBe(0);
      } finally {
        await handle.dispose();
      }
    },
  );

  t(
    label('HIGH-2: a signal wait with a declared timeout still times out through its timeout edge'),
    async () => {
      const { createManualOrchestrationClock } =
        await import('./orchestration-race-conformance.js');
      const manual = createManualOrchestrationClock();
      const handle = await factory.create(manual);
      try {
        const { runtime, orchestration } = handle.stores;
        let doneCalls = 0;
        let fallbackCalls = 0;
        runtime
          .registerCapability({
            id: 'r-seed',
            revision: '1',
            effect: 'pure',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: (i: unknown) => i,
          })
          .registerCapability({
            id: 'r-done',
            revision: '1',
            effect: 'pure',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: (i: unknown) => {
              doneCalls += 1;
              return i;
            },
          })
          .registerCapability({
            id: 'r-fallback',
            revision: '1',
            effect: 'pure',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: (i: unknown) => {
              fallbackCalls += 1;
              return i;
            },
          });
        const activated = await runtime.activate({
          id: 'remediation-timed-wait',
          entry: 's',
          nodes: [
            { id: 's', capability: 'r-seed' },
            {
              id: 'w',
              kind: 'wait',
              wait: { kind: 'signal', name: 'tick', timeoutMs: 20 },
            },
            { id: 'd', capability: 'r-done' },
            { id: 'fb', capability: 'r-fallback' },
          ],
          edges: [
            { from: 's', to: 'w', kind: 'success' },
            { from: 'w', to: 'd', kind: 'success' },
            { from: 'w', to: 'fb', kind: 'timeout' },
          ],
        });
        expect(activated.ok).toBeTruthy();
        const parked = await runtime.run('seed');
        expect(parked.status).toBe('waiting');
        // A DECLARED timeout schedules exactly one wait-timeout timer.
        const events = await orchestration.listOrchestrationEvents(parked.runId);
        expect(countTimeoutTimerEvents(events)).toBe(1);

        // Advancing past the deadline and pumping fires the timeout exactly
        // once and routes through the timeout edge.
        manual.advance(25);
        const pumped = await runtime.processDueTimers({ runId: parked.runId });
        expect(pumped.fired).toBe(1);
        const final = await runtime.resumeRun(parked.runId);
        expect(final.status).toBe('completed');
        expect(fallbackCalls).toBe(1);
        expect(doneCalls).toBe(0);
        const finalEvents = await orchestration.listOrchestrationEvents(parked.runId);
        expect(countEvent(finalEvents, 'timer.fired')).toBe(1);
        expect(countEvent(finalEvents, 'signal.received')).toBe(0);
      } finally {
        await handle.dispose();
      }
    },
  );

  t(
    label(
      'HIGH-3: authorized operator fail resolves a blocked run to failed, atomically and idempotently',
    ),
    async () => {
      const handle = await factory.create();
      try {
        const stores = handle.stores;
        let invokeCount = 0;
        let release: (() => void) | undefined;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        stores.runtime
          .registerCapability({
            id: 'r-slow-write',
            revision: '1',
            effect: 'write',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: async () => {
              invokeCount += 1;
              await gate;
              return 'applied';
            },
          })
          .registerCapability({
            id: 'r-after',
            revision: '1',
            effect: 'pure',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: (i: unknown) => i,
          });
        const activated = await stores.runtime.activate({
          id: 'remediation-operator-fail',
          entry: 'w',
          nodes: [
            { id: 'w', capability: 'r-slow-write', timeoutMs: 20 },
            { id: 'z', capability: 'r-after' },
          ],
          edges: [{ from: 'w', to: 'z', kind: 'success' }],
        });
        expect(activated.ok).toBeTruthy();

        // Drive into the blocked state: the write is in flight when the
        // deadline passes (manual-style deterministic sequence via the
        // invocation barrier; the timeout deadline is real-time here, as in
        // the existing race suite).
        const started = stores.runtime.run('seed');
        await new Promise<void>((resolve) => {
          const check = setInterval(() => {
            if (invokeCount === 1) {
              clearInterval(check);
              resolve();
            }
          }, 5);
        });
        await new Promise((resolve) => setTimeout(resolve, 40));
        release?.();
        const blocked = await started;
        expect(blocked.status).toBe('blocked');
        expect(invokeCount).toBe(1);

        // Public surface denied by default.
        const denied = await stores.runtime.resolveBlocked({
          runId: blocked.runId,
          resolutionId: 'res-fail-1',
          action: 'fail',
          reasonCode: 'operator_request',
          failCode: 'VICT_ORCH_OPERATOR_FAILED',
        });
        expect(denied.ok).toBe(false);
        expect(denied.ok ? '' : denied.code).toBe('VICT_ORCH_OPERATOR_DENIED');

        // Authorized surface: same stores, explicit operator authorization.
        const operator = await handle.createOperatorRuntime();
        operator
          .registerCapability({
            id: 'r-slow-write',
            revision: '1',
            effect: 'write',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: async () => 'applied',
          })
          .registerCapability({
            id: 'r-after',
            revision: '1',
            effect: 'pure',
            input: neutralJsonContract,
            output: neutralJsonContract,
            invoke: (i: unknown) => i,
          });
        // Stale resolution (fresh ID, wrong expected revision) is rejected
        // while the run is still blocked.
        const runBefore = await stores.orchestration.getOrchestrationRun(blocked.runId);
        const stale = await operator.resolveBlocked({
          runId: blocked.runId,
          resolutionId: 'res-fail-stale',
          action: 'fail',
          reasonCode: 'operator_request',
          failCode: 'VICT_ORCH_OPERATOR_FAILED',
          expectedRunRevision: (runBefore?.recordRevision ?? 1) + 100,
        });
        expect(stale.ok).toBe(false);
        expect(stale.ok ? '' : stale.code).toBe('VICT_ORCH_STALE_REVISION');

        const accepted = await operator.resolveBlocked({
          runId: blocked.runId,
          resolutionId: 'res-fail-1',
          action: 'fail',
          reasonCode: 'operator_request',
          failCode: 'VICT_ORCH_OPERATOR_FAILED',
          expectedRunRevision: runBefore?.recordRevision,
        });
        expect(accepted.ok).toBeTruthy();
        expect(accepted.ok ? accepted.status : '').toBe('accepted');
        expect(accepted.ok ? accepted.runStatus : '').toBe('failed');

        // Atomicity and exactly-once events: one operator record, one
        // terminal failure, no downstream continuation.
        const events = await stores.orchestration.listOrchestrationEvents(blocked.runId);
        expect(countEvent(events, 'operator.intervened')).toBe(1);
        expect(countEvent(events, 'run.failed')).toBe(1);
        expect(countEvent(events, 'node.started')).toBe(1);
        const tokens = (await stores.orchestration.getOrchestrationSnapshot(blocked.runId))?.tokens;
        expect((tokens ?? []).some((token) => token.status === 'ready')).toBe(false);

        // Idempotent for a repeated identical resolution.
        const duplicate = await operator.resolveBlocked({
          runId: blocked.runId,
          resolutionId: 'res-fail-1',
          action: 'fail',
          reasonCode: 'operator_request',
          failCode: 'VICT_ORCH_OPERATOR_FAILED',
        });
        expect(duplicate.ok).toBeTruthy();
        expect(duplicate.ok ? duplicate.status : '').toBe('duplicate');
        const eventsAfterDuplicate = await stores.orchestration.listOrchestrationEvents(
          blocked.runId,
        );
        expect(eventsAfterDuplicate.length).toBe(events.length);

        // Conflicting resolution (same ID, different action) is rejected.
        const conflict = await operator.resolveBlocked({
          runId: blocked.runId,
          resolutionId: 'res-fail-1',
          action: 'cancel',
          reasonCode: 'operator_request',
        });
        expect(conflict.ok).toBe(false);
        expect(conflict.ok ? '' : conflict.code).toBe('VICT_ORCH_OPERATOR_CONFLICT');

        // Terminal state survives close/reopen and stays identical.
        const reopened = await handle.reopen();
        expect((await reopened.orchestration.getOrchestrationRun(blocked.runId))?.status).toBe(
          'failed',
        );
        const reopenedEvents = await reopened.orchestration.listOrchestrationEvents(blocked.runId);
        expect(countEvent(reopenedEvents, 'operator.intervened')).toBe(1);
        expect(countEvent(reopenedEvents, 'run.failed')).toBe(1);
      } finally {
        await handle.dispose();
      }
    },
  );
}
