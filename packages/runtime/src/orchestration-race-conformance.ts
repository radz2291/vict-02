import type { VictRuntime } from './runtime.js';
import type {
  ClaimPlanner,
  CompleteAttemptCommand,
  OrchestrationStore,
} from './orchestration-store-types.js';
import { signalWaitGraph, stringContract } from './orchestration-conformance.js';
import type {
  ConformanceExpect,
  ConformanceTestRunner,
  OrchestrationConformanceFixture,
  OrchestrationConformanceStores,
} from './orchestration-conformance.js';

/**
 * Adapter-neutral Stage 03 race and adversarial conformance suite
 * (corrective evidence for handoff §23–§24: races, fencing, cancellation,
 * blocked-state resolution, fan-out recovery). Every conforming backend
 * (in-memory, SQLite) runs this exact suite. Deterministic by
 * construction: barriers, injected deadlines and raw guarded store
 * commands — never timing guesses.
 */

export interface OrchestrationRaceStores extends OrchestrationConformanceStores {
  /** A SECOND runtime sharing the same durable stores with explicit operator authorization. */
  createOperatorRuntime(): Promise<VictRuntime>;
}

export interface OrchestrationRaceFixture extends OrchestrationConformanceFixture {
  /**
   * `clock` (optional) is injected as both the runtime clock and the
   * orchestration time port so timeout/race tests are fully deterministic.
   */
  create(clock?: ManualOrchestrationClock): Promise<OrchestrationRaceStores>;
}

/** Deterministic store-level planner for raw claim tests. */
function rawPlanner(effectClass: 'pure' | 'write' | 'irreversible' = 'pure'): ClaimPlanner {
  return {
    invocationIdFor: (token) => `inv_${token.tokenId}`,
    attemptIdFor: (token, attemptNumber) => `att_${token.tokenId}_${attemptNumber}`,
    planFor: (token) => {
      void token;
      return {
        capabilityId: 'raw',
        effectClass,
        deadlineAt: null,
        idempotencyKey: null,
      };
    },
  };
}

/**
 * A fully deterministic orchestration clock: `now()` is test-advanced,
 * `delay()` resolves only when the test advances past the requested due
 * time. Injected as BOTH the runtime `clock` and the orchestration time
 * port, so persisted deadlines, retry-timer eligibility, and deadline
 * racing all move only when the test moves them. No wall-clock guessing.
 */
export interface ManualOrchestrationClock {
  readonly now: () => number;
  readonly delay: (ms: number) => Promise<void>;
  readonly advance: (ms: number) => void;
}

export function createManualOrchestrationClock(start = 1_000_000): ManualOrchestrationClock {
  let current = start;
  let waiters: { due: number; resolve: () => void }[] = [];
  return {
    now: () => current,
    delay: (ms: number) =>
      new Promise<void>((resolve) => {
        const due = current + Math.max(0, ms);
        if (due <= current) {
          resolve();
          return;
        }
        waiters.push({ due, resolve });
      }),
    advance: (ms: number) => {
      current += Math.max(0, ms);
      const due = waiters.filter((w) => w.due <= current).sort((a, b) => a.due - b.due);
      waiters = waiters.filter((w) => w.due > current);
      for (const waiter of due) {
        waiter.resolve();
      }
    },
  };
}

async function envelopeOf(
  orchestration: OrchestrationStore,
  runId: string,
): Promise<{
  runId: string;
  graphId: string;
  graphVersion: string;
  capabilitySetVersion: string;
  activationVersion: string;
}> {
  const run = await orchestration.getOrchestrationRun(runId);
  return {
    runId,
    graphId: run?.graphId ?? '',
    graphVersion: run?.graphVersion ?? '',
    capabilitySetVersion: run?.capabilitySetVersion ?? '',
    activationVersion: run?.activationVersion ?? '',
  };
}

const settle = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export function runOrchestrationRaceSuite(
  runner: ConformanceTestRunner,
  expect: ConformanceExpect,
  factory: OrchestrationRaceFixture,
): void {
  const t = runner.test;

  t(`[${factory.name}] fencing: two competing claims cannot own one attempt`, async () => {
    const fixture = await factory.create();
    try {
      const { runtime, orchestration } = fixture;
      runtime.registerCapability({
        id: 'hold',
        revision: '1',
        effect: 'pure',
        invoke: () => 'x',
      });
      const activated = await runtime.activate({
        id: 'race-claims',
        entry: 'hold',
        nodes: [{ id: 'hold', capability: 'hold' }],
        edges: [],
      } as never);
      expect(activated.ok).toBe(true);
      const runId = `run_race_${Date.now()}`;
      const now = Date.now();
      await orchestration.createOrchestrationRun({
        runId,
        graphId: 'race-claims',
        graphVersion: 'v2_test',
        capabilitySetVersion: 'v1_test',
        activationVersion: (activated as { ok: true; activationVersion: string }).activationVersion,
        mode: 'normal',
        retention: 'summary',
        rootTokenId: `tok_${runId}_root`,
        entryNodeId: 'hold',
        checkpoint: 'seed',
        events: [],
        now,
      });
      // Two concurrent claimers: exactly one wins the only ready token.
      const results = await Promise.all([
        orchestration.claimReadyToken({
          runId,
          ownerId: 'owner-a',
          leaseExpiresAt: now + 60_000,
          now,
          planner: rawPlanner(),
        }),
        orchestration.claimReadyToken({
          runId,
          ownerId: 'owner-b',
          leaseExpiresAt: now + 60_000,
          now,
          planner: rawPlanner(),
        }),
      ]);
      const claimed = results.filter((result) => result.claimed);
      expect(claimed.length).toBe(1);
      const attemptId = (claimed[0] as { claim: { attempt: { attemptId: string } } }).claim.attempt
        .attemptId;
      expect(attemptId).toBeTruthy();
    } finally {
      await fixture.dispose();
    }
  });

  t(
    `[${factory.name}] fencing: stale owner cannot complete after lease recovery; invocation identity stable`,
    async () => {
      const fixture = await factory.create();
      try {
        const { runtime, orchestration } = fixture;
        runtime.registerCapability({
          id: 'hold',
          revision: '1',
          effect: 'pure',
          invoke: () => 'x',
        });
        const activated = await runtime.activate({
          id: 'race-fence',
          entry: 'hold',
          nodes: [{ id: 'hold', capability: 'hold' }],
          edges: [],
        } as never);
        expect(activated.ok).toBe(true);
        const runId = `run_fence_${Date.now()}`;
        const now = Date.now();
        await orchestration.createOrchestrationRun({
          runId,
          graphId: 'race-fence',
          graphVersion: 'v2_test',
          capabilitySetVersion: 'v1_test',
          activationVersion: (activated as { ok: true; activationVersion: string })
            .activationVersion,
          mode: 'normal',
          retention: 'summary',
          rootTokenId: `tok_${runId}_root`,
          entryNodeId: 'hold',
          checkpoint: 'seed',
          events: [],
          now,
        });
        // Owner A claims, then its lease lapses.
        const claimed = await orchestration.claimReadyToken({
          runId,
          ownerId: 'owner-a',
          leaseExpiresAt: now + 1,
          now,
          planner: rawPlanner(),
        });
        expect(claimed.claimed).toBe(true);
        const claim = (
          claimed as {
            claim: { attempt: { attemptId: string; fence: number; invocationId: string } };
          }
        ).claim;
        // Lease recovery reclaims the abandoned claim.
        const recoverable = await orchestration.findRecoverableClaims({ now: now + 5_000 });
        expect(recoverable.length).toBe(1);
        await orchestration.recoverAttempt({
          runId,
          attemptId: claim.attempt.attemptId,
          expectedAttemptFence: claim.attempt.fence,
          now: now + 5_000,
          action: { kind: 'reclaim' },
          events: [],
        });
        // The recovered token is claimed again by a fresh owner; that claim
        // creates attempt 2 of the SAME logical invocation.
        const reclaimed = await orchestration.claimReadyToken({
          runId,
          ownerId: 'owner-b',
          leaseExpiresAt: now + 60_000,
          now: now + 5_000,
          planner: rawPlanner(),
        });
        expect(reclaimed.claimed).toBe(true);
        // The stale owner's genuinely still-running result arrives late and
        // must be REJECTED — never applied.
        let rejected = false;
        try {
          await orchestration.completeAttempt({
            runId,
            attemptId: claim.attempt.attemptId,
            ownerId: 'owner-a',
            expectedAttemptFence: claim.attempt.fence,
            now: now + 5_000,
            outcome: { kind: 'completed', outputSummary: { shape: 'string', length: 3 } },
            continuation: { kind: 'none' },
            events: [],
            run: { status: 'completed' },
          } as CompleteAttemptCommand);
        } catch {
          rejected = true;
        }
        expect(rejected).toBe(true);
        // Attempt numbers and logical invocation identity remain stable.
        const snapshot = await orchestration.getOrchestrationSnapshot(runId);
        const attempts = snapshot?.attempts ?? [];
        expect(attempts.length).toBe(2);
        expect(attempts[0]?.invocationId === attempts[1]?.invocationId).toBe(true);
        expect(attempts.map((attempt) => attempt.attemptNumber).sort()).toEqual([1, 2]);
      } finally {
        await fixture.dispose();
      }
    },
  );

  t(
    `[${factory.name}] durable intent: attempt and node.started are durable before every invocation`,
    async () => {
      const fixture = await factory.create();
      try {
        const runtime = fixture.runtime;
        let observed: { attemptState: string; nodeStarted: boolean } | undefined;
        runtime.registerCapability({
          id: 'probe',
          revision: '1',
          effect: 'pure',
          invoke: async (input: unknown, context) => {
            const snapshot = await fixture.orchestration.getOrchestrationSnapshot(context.runId);
            const attempt = snapshot?.attempts.find(
              (candidate) => candidate.attemptId === context.attemptId,
            );
            const events = await fixture.orchestration.listOrchestrationEvents(context.runId);
            observed = {
              attemptState: attempt?.state ?? 'missing',
              nodeStarted: events.some(
                (event) => event.type === 'node.started' && event.nodeId === 'probe',
              ),
            };
            return `seen:${String(input)}`;
          },
        });
        const activated = await runtime.activate({
          id: 'race-intent',
          entry: 'probe',
          // A declared timeout forces the durable orchestration engine.
          nodes: [{ id: 'probe', capability: 'probe', timeoutMs: 30_000 }],
          edges: [],
        } as never);
        expect(activated.ok).toBe(true);
        const result = await runtime.run('seed');
        expect(result.status).toBe('completed');
        expect(observed?.attemptState === 'started' || observed?.attemptState === 'claimed').toBe(
          true,
        );
        expect(observed?.nodeStarted).toBe(true);
      } finally {
        await fixture.dispose();
      }
    },
  );

  t(
    `[${factory.name}] signal versus due-timeout race: exactly one winner, no duplicate continuation`,
    async () => {
      const fixture = await factory.create();
      try {
        const runtime = fixture.runtime;
        let downstreamCalls = 0;
        let timedOutCalls = 0;
        runtime
          .registerCapability({ id: 'first', revision: '1', effect: 'pure', invoke: () => 'one' })
          .registerCapability({
            id: 'second',
            revision: '1',
            effect: 'pure',
            invoke: (input: unknown) => {
              downstreamCalls += 1;
              return `got:${String(input)}`;
            },
          })
          .registerCapability({
            id: 'timedOut',
            revision: '1',
            effect: 'pure',
            invoke: () => {
              timedOutCalls += 1;
              return 'timed-out-path';
            },
          });
        const activated = await runtime.activate({
          id: 'race-signal-timeout',
          entry: 'a',
          nodes: [
            { id: 'a', capability: 'first' },
            { id: 'w', kind: 'wait', wait: { kind: 'signal', name: 'go', timeoutMs: 25 } },
            { id: 't', capability: 'timedOut' },
            { id: 'b', capability: 'second' },
          ],
          edges: [
            { from: 'a', to: 'w' },
            { from: 'w', to: 'b' },
            { from: 'w', to: 't', kind: 'timeout' },
          ],
        } as never);
        expect(activated.ok).toBe(true);
        const parked = await runtime.run('seed');
        expect(parked.status).toBe('waiting');
        const waitId = parked.waits?.[0]?.waitId as string;
        // Race a valid signal against the due-timeout pump at the same
        // instant. Exactly one wins: a losing signal arrives as
        // 'already_resolved', never a duplicate wake or receipt.
        await settle(40); // past the 25ms timeout
        const [signalOutcome, timerOutcome] = await Promise.all([
          runtime.signal({
            runId: parked.runId,
            waitId,
            signalId: 'race-sig-1',
            signalName: 'go',
            payload: 'in-time',
          }),
          runtime.processDueTimers({ runId: parked.runId }),
        ]);
        const signalWon =
          signalOutcome.ok && (signalOutcome as { status?: string }).status === 'accepted';
        const timerWon = timerOutcome.fired === 1;
        expect(signalWon !== timerWon).toBe(true);
        const final = await runtime.resumeRun(parked.runId);
        expect(final.status).toBe('completed');
        expect(downstreamCalls + timedOutCalls).toBe(1);
        const events = await fixture.orchestration.listOrchestrationEvents(parked.runId);
        const received = events.filter((event) => event.type === 'signal.received').length;
        const fired = events.filter((event) => event.type === 'timer.fired').length;
        expect(received + fired).toBe(1);
        expect(events.filter((event) => event.type === 'run.resumed').length).toBe(1);
        // The losing command creates no receipt when the timer won.
        const receipts = await fixture.orchestration.listSignalReceipts(parked.runId);
        expect(receipts.length).toBe(signalWon ? 1 : 0);
      } finally {
        await fixture.dispose();
      }
    },
  );

  t(
    `[${factory.name}] timeout wins before a late signal: the late command creates no receipt or wake`,
    async () => {
      const fixture = await factory.create();
      try {
        const runtime = fixture.runtime;
        let downstreamCalls = 0;
        let timedOutCalls = 0;
        runtime
          .registerCapability({ id: 'first', revision: '1', effect: 'pure', invoke: () => 'one' })
          .registerCapability({
            id: 'second',
            revision: '1',
            effect: 'pure',
            invoke: () => {
              downstreamCalls += 1;
              return 'success-path';
            },
          })
          .registerCapability({
            id: 'timedOut',
            revision: '1',
            effect: 'pure',
            invoke: () => {
              timedOutCalls += 1;
              return 'timed-out-path';
            },
          });
        const activated = await runtime.activate({
          id: 'race-late-signal',
          entry: 'a',
          nodes: [
            { id: 'a', capability: 'first' },
            { id: 'w', kind: 'wait', wait: { kind: 'signal', name: 'go', timeoutMs: 15 } },
            { id: 't', capability: 'timedOut' },
            { id: 'b', capability: 'second' },
          ],
          edges: [
            { from: 'a', to: 'w' },
            { from: 'w', to: 'b' },
            { from: 'w', to: 't', kind: 'timeout' },
          ],
        } as never);
        expect(activated.ok).toBe(true);
        const parked = await runtime.run('seed');
        expect(parked.status).toBe('waiting');
        // The timeout fires first; the signal arrives late.
        await settle(40);
        const pumped = await runtime.processDueTimers({ runId: parked.runId });
        expect(pumped.fired).toBe(1);
        const late = await runtime.signal({
          runId: parked.runId,
          waitId: parked.waits?.[0]?.waitId as string,
          signalId: 'late-1',
          signalName: 'go',
          payload: 'late',
        });
        expect(late.ok).toBe(true);
        expect(late.ok ? late.status : '').toBe('already_resolved');
        const receipts = await fixture.orchestration.listSignalReceipts(parked.runId);
        expect(receipts.length).toBe(0);
        const final = await runtime.resumeRun(parked.runId);
        expect(final.status).toBe('completed');
        expect(timedOutCalls).toBe(1);
        expect(downstreamCalls).toBe(0);
      } finally {
        await fixture.dispose();
      }
    },
  );

  t(
    `[${factory.name}] keyed-write timeout retries with the same idempotency key and completes once`,
    async () => {
      // Deterministic by construction: a manual clock drives BOTH the
      // persisted deadline and the retry-timer eligibility, and the first
      // attempt is held by an explicit invocation barrier. Nothing depends
      // on wall-clock sleeps (the previous real-time version could flake
      // under suite load: a slow claim-to-execution start legitimately
      // failed attempt two on its ALREADY-EXPIRED persisted deadline
      // before invocation, scheduling a second retry the test never
      // pumped — the runtime behaved correctly; the test guessed wrong).
      const clock = createManualOrchestrationClock();
      const fixture = await factory.create(clock);
      try {
        const runtime = fixture.runtime;
        const keys: (string | undefined)[] = [];
        let attempts = 0;
        let releaseFirstAttempt: (() => void) | undefined;
        const firstAttemptGate = new Promise<void>((resolve) => {
          releaseFirstAttempt = resolve;
        });
        let firstAttemptStartedResolve: (() => void) | undefined;
        const firstAttemptStarted = new Promise<void>((resolve) => {
          firstAttemptStartedResolve = resolve;
        });
        runtime.registerCapability({
          id: 'keyedSlow',
          revision: '1',
          effect: 'write',
          idempotency: 'keyed',
          invoke: async (input: unknown, context) => {
            attempts += 1;
            keys.push(context.idempotencyKey);
            if (attempts === 1) {
              // Hold attempt one open past its deadline until the test
              // releases it: its late return value must be fenced.
              firstAttemptStartedResolve?.();
              await firstAttemptGate;
              return `late:${String(input)}`;
            }
            return `applied:${String(input)}`;
          },
        });
        const activated = await runtime.activate({
          id: 'race-keyed-timeout',
          entry: 'w',
          nodes: [
            {
              id: 'w',
              capability: 'keyedSlow',
              timeoutMs: 20,
              retry: {
                maxAttempts: 3,
                retryOn: ['timeout'],
                backoff: { kind: 'fixed', delayMs: 1 },
              },
            },
          ],
          edges: [],
        } as never);
        expect(activated.ok).toBe(true);
        const startedRun = runtime.run('seed');
        // Barrier: attempt one is genuinely in flight (invoked) before the
        // clock moves — a state-based wait, never a sleep.
        await firstAttemptStarted;
        // Advance the manual clock past the persisted 20ms deadline: the
        // deadline promise fires, the attempt is classified timed_out, and
        // a DURABLE retry timer is scheduled (backoff 1ms).
        clock.advance(25);
        const parked = await startedRun;
        // Attempt one genuinely timed out; the retry is durable.
        expect(parked.status).toBe('running');
        expect(attempts).toBe(1);
        expect(parked.trace.some((event) => event.type === 'node.timed_out')).toBe(true);
        expect(parked.trace.some((event) => event.type === 'node.retry_scheduled')).toBe(true);
        expect(parked.trace.some((event) => event.type === 'timer.scheduled')).toBe(true);
        // Timer eligibility is deterministic: the retry timer became due
        // exactly when the clock passed (completion time + backoff).
        clock.advance(5);
        const pumped = await runtime.processDueTimers({ runId: parked.runId });
        expect(pumped.fired).toBe(1);
        expect(pumped.timers[0]?.kind).toBe('retry');
        // Attempt one's late value arrives only after its attempt was
        // terminally classified — the old attempt cannot overwrite the
        // result (the release order relative to attempt two is irrelevant).
        releaseFirstAttempt?.();
        const final = await runtime.resumeRun(parked.runId);
        expect(final.status).toBe('completed');
        // Attempt two used the SAME idempotency key: one logical
        // invocation, one external mutation, the late value discarded.
        expect(attempts).toBe(2);
        expect(keys[0]).toBeTruthy();
        expect(keys[0] === keys[1]).toBe(true);
        expect(final.output).toBe('applied:seed');
      } finally {
        await fixture.dispose();
      }
    },
  );

  t(`[${factory.name}] irreversible timeout blocks without replay`, async () => {
    // Deterministic: manual clock + invocation barrier (same mechanism and
    // rationale as the keyed-write timeout test above).
    const clock = createManualOrchestrationClock();
    const fixture = await factory.create(clock);
    try {
      const runtime = fixture.runtime;
      let invokeCount = 0;
      let invokedResolve: (() => void) | undefined;
      const invoked = new Promise<void>((resolve) => {
        invokedResolve = resolve;
      });
      let releaseIrreversible: (() => void) | undefined;
      const irreversibleGate = new Promise<void>((resolve) => {
        releaseIrreversible = resolve;
      });
      runtime.registerCapability({
        id: 'slowIrreversible',
        revision: '1',
        effect: 'irreversible',
        invoke: async () => {
          invokeCount += 1;
          invokedResolve?.();
          await irreversibleGate;
          return 'done';
        },
      });
      const activated = await runtime.activate({
        id: 'race-irreversible-timeout',
        entry: 'x',
        nodes: [{ id: 'x', capability: 'slowIrreversible', timeoutMs: 20 }],
        edges: [],
      } as never);
      expect(activated.ok).toBe(true);
      const startedRun = runtime.run('seed', { policy: { allowIrreversible: true } });
      await invoked;
      clock.advance(25);
      const result = await startedRun;
      releaseIrreversible?.();
      expect(result.status).toBe('blocked');
      expect(invokeCount).toBe(1);
      const run = await fixture.orchestration.getOrchestrationRun(result.runId);
      expect(run?.status).toBe('blocked');
      // Operator retry is denied for irreversible work even when authorized.
      const operatorRuntime = await fixture.createOperatorRuntime();
      operatorRuntime.registerCapability({
        id: 'slowIrreversible',
        revision: '1',
        effect: 'irreversible',
        invoke: async () => 'done',
      });
      const denied = await operatorRuntime.resolveBlocked({
        runId: result.runId,
        resolutionId: 'retry-attempt',
        action: 'retry',
        reasonCode: 'operator_request',
      });
      expect(denied.ok).toBe(false);
      expect(denied.ok ? '' : denied.code).toBe('VICT_ORCH_OPERATOR_DENIED');
      expect(invokeCount).toBe(1);
    } finally {
      await fixture.dispose();
    }
  });

  t(
    `[${factory.name}] timer polling is deterministic and repeated polling is idempotent`,
    async () => {
      const fixture = await factory.create();
      try {
        const runtime = fixture.runtime;
        let downstream = 0;
        runtime
          .registerCapability({ id: 'first', revision: '1', effect: 'pure', invoke: () => 'one' })
          .registerCapability({
            id: 'second',
            revision: '1',
            effect: 'pure',
            invoke: (input: unknown) => {
              downstream += 1;
              return `got:${String(input)}`;
            },
          });
        // Two independent runs with different timer delays.
        const graph = (delayMs: number): Parameters<VictRuntime['activate']>[0] =>
          ({
            id: `race-timer-order-${delayMs}`,
            entry: 'a',
            nodes: [
              { id: 'a', capability: 'first' },
              { id: 't', kind: 'wait', wait: { kind: 'timer', delayMs } },
              { id: 'b', capability: 'second' },
            ],
            edges: [
              { from: 'a', to: 't' },
              { from: 't', to: 'b' },
            ],
          }) as never;
        const activated1 = await runtime.activate(graph(5));
        expect(activated1.ok).toBe(true);
        const activated2 = await runtime.activate(graph(40));
        expect(activated2.ok).toBe(true);
        const parked1 = await runtime.run('seed');
        expect(parked1.status).toBe('waiting');
        const parked2 = await runtime.run('seed');
        expect(parked2.status).toBe('waiting');
        await settle(60);
        // First pump fires both due timers; repeated polling is idempotent.
        const fired = await runtime.processDueTimers({});
        expect(fired.fired).toBe(2);
        const repeat = await runtime.processDueTimers({});
        expect(repeat.fired).toBe(0);
        const final1 = await runtime.resumeRun(parked1.runId);
        const final2 = await runtime.resumeRun(parked2.runId);
        expect(final1.status).toBe('completed');
        expect(final2.status).toBe('completed');
        expect(downstream).toBe(2);
      } finally {
        await fixture.dispose();
      }
    },
  );

  t(
    `[${factory.name}] cancellation after durable claim: the run finalizes cancelled; no downstream work`,
    async () => {
      const fixture = await factory.create();
      try {
        const { runtime, orchestration } = fixture;
        let downstreamCalls = 0;
        runtime
          .registerCapability({ id: 'start', revision: '1', effect: 'pure', invoke: () => 'seed' })
          .registerCapability({
            id: 'next',
            revision: '1',
            effect: 'pure',
            invoke: () => {
              downstreamCalls += 1;
              return 'next';
            },
          });
        const activated = await runtime.activate({
          id: 'race-cancel-claim',
          entry: 'start',
          nodes: [
            { id: 'start', capability: 'start' },
            { id: 'next', capability: 'next' },
          ],
          edges: [{ from: 'start', to: 'next' }],
        } as never);
        expect(activated.ok).toBe(true);
        const runId = `run_cancel_claim_${Date.now()}`;
        const now = Date.now();
        await orchestration.createOrchestrationRun({
          runId,
          graphId: 'race-cancel-claim',
          graphVersion: 'v2_test',
          capabilitySetVersion: 'v1_test',
          activationVersion: (activated as { ok: true; activationVersion: string })
            .activationVersion,
          mode: 'normal',
          retention: 'summary',
          rootTokenId: `tok_${runId}_root`,
          entryNodeId: 'start',
          checkpoint: 'seed',
          events: [],
          now,
        });
        const identity = await envelopeOf(orchestration, runId);
        // Durable claim happens; the (hypothetical) handler is mid-flight.
        const claimed = await orchestration.claimReadyToken({
          runId,
          ownerId: 'owner-a',
          leaseExpiresAt: now + 60_000,
          now,
          planner: rawPlanner(),
        });
        expect(claimed.claimed).toBe(true);
        // Durable cancellation: request + apply (no driver loop is driving
        // this hand-built run, so the store transition is applied directly).
        const requested = await orchestration.requestCancellation({
          runId,
          requestId: 'cancel-1',
          reasonCode: 'operator_request',
          commandHash: 'hash-cancel-1',
          now: now + 5,
          events: [
            {
              type: 'run.cancel_requested',
              requestId: 'cancel-1',
              reasonCode: 'operator_request',
              ...identity,
              timestamp: now + 5,
            } as never,
          ],
        });
        expect(requested.status === 'accepted' || requested.status === 'duplicate').toBe(true);
        await orchestration.applyCancellation({
          runId,
          now: now + 6,
          requestId: 'cancel-1',
          reasonCode: 'operator_request',
          steps: 1,
          removeCheckpoints: [],
          events: [
            {
              type: 'run.cancelled',
              requestId: 'cancel-1',
              reasonCode: 'operator_request',
              steps: 1,
              ...identity,
              timestamp: now + 6,
            } as never,
          ],
        });
        // The late completion attempt must never resurrect downstream work.
        const claim = (
          claimed as {
            claim: { attempt: { attemptId: string; fence: number } };
          }
        ).claim;
        let lateRejected = false;
        try {
          await orchestration.completeAttempt({
            runId,
            attemptId: claim.attempt.attemptId,
            ownerId: 'owner-a',
            expectedAttemptFence: claim.attempt.fence,
            now: now + 10,
            outcome: { kind: 'completed', outputSummary: { shape: 'string', length: 4 } },
            continuation: { kind: 'advance', toNodeId: 'next', payload: 'late' },
            events: [],
            run: { status: 'running' },
          } as CompleteAttemptCommand);
        } catch {
          lateRejected = true;
        }
        void lateRejected;
        const run = await orchestration.getOrchestrationRun(runId);
        expect(run?.status).toBe('cancelled');
        const snapshot = await orchestration.getOrchestrationSnapshot(runId);
        expect((snapshot?.tokens ?? []).some((token) => token.status === 'ready')).toBe(false);
        expect(downstreamCalls).toBe(0);
      } finally {
        await fixture.dispose();
      }
    },
  );

  t(
    `[${factory.name}] an active capability observes its abort signal; downstream never starts`,
    async () => {
      const fixture = await factory.create();
      try {
        const runtime = fixture.runtime;
        let abortedObserved = false;
        let downstreamCalls = 0;
        runtime
          .registerCapability({ id: 'first', revision: '1', effect: 'pure', invoke: () => 'one' })
          .registerCapability({
            id: 'abortable',
            revision: '1',
            effect: 'pure',
            invoke: (input: unknown, context) =>
              new Promise<string>((resolve, reject) => {
                const signal = context.abortSignal;
                if (signal?.aborted) {
                  abortedObserved = true;
                  reject(new Error('aborted-before-start'));
                  return;
                }
                signal?.addEventListener(
                  'abort',
                  () => {
                    abortedObserved = true;
                    reject(new Error('aborted'));
                  },
                  { once: true },
                );
                void input;
                setTimeout(() => resolve('completed-anyway'), 10_000);
              }),
          })
          .registerCapability({
            id: 'after',
            revision: '1',
            effect: 'pure',
            invoke: () => {
              downstreamCalls += 1;
              return 'after';
            },
          });
        const activated = await runtime.activate({
          id: 'race-cancel-active',
          entry: 'a',
          nodes: [
            { id: 'a', capability: 'first' },
            { id: 'h', capability: 'abortable', timeoutMs: 30_000 },
            { id: 'z', capability: 'after' },
          ],
          edges: [
            { from: 'a', to: 'h' },
            { from: 'h', to: 'z' },
          ],
        } as never);
        expect(activated.ok).toBe(true);
        const driving = runtime.run('seed');
        const settled = await Promise.race([
          driving.then(() => 'done' as const),
          settle(200).then(() => 'waiting' as const),
        ]);
        expect(settled).toBe('waiting'); // the handler is genuinely in flight
        const parked = (await Promise.race([driving, settle(1).then(() => null)])) as {
          runId: string;
        } | null;
        const runId =
          parked?.runId ??
          (await (async () => {
            const runs = await fixture.orchestration.listOrchestrationRuns({ status: 'running' });
            return runs[0]?.runId;
          })());
        expect(runId).toBeTruthy();
        // Durable cancellation cooperatively aborts the in-flight context.
        const cancelled = await runtime.cancel({
          runId: runId as string,
          requestId: 'c-1',
          reasonCode: 'operator_request',
        });
        expect(cancelled.ok).toBe(true);
        const result = await driving;
        expect(abortedObserved).toBe(true);
        expect(result.status).toBe('cancelled');
        expect(downstreamCalls).toBe(0);
      } finally {
        await fixture.dispose();
      }
    },
  );

  t(
    `[${factory.name}] fan-out cancellation: unfinished siblings reach a consistent non-running state`,
    async () => {
      const fixture = await factory.create();
      try {
        const runtime = fixture.runtime;
        let releaseSlow: (() => void) | undefined;
        const slowGate = new Promise<void>((resolve) => {
          releaseSlow = resolve;
        });
        runtime
          .registerCapability({ id: 'first', revision: '1', effect: 'pure', invoke: () => 'one' })
          .registerCapability({ id: 'fast', revision: '1', effect: 'pure', invoke: () => 'fast' })
          .registerCapability({
            id: 'slow',
            revision: '1',
            effect: 'pure',
            invoke: (input: unknown, context) =>
              new Promise<string>((resolve) => {
                context.abortSignal?.addEventListener('abort', () => resolve('aborted'), {
                  once: true,
                });
                void slowGate.then(() => resolve('slow'));
                void input;
              }),
          })
          .registerCapability({
            id: 'after',
            revision: '1',
            effect: 'pure',
            invoke: () => 'after',
          });
        const activated = await runtime.activate({
          id: 'race-cancel-fanout',
          entry: 'a',
          nodes: [
            { id: 'a', capability: 'first' },
            { id: 'f', kind: 'fork', join: 'j' },
            { id: 'b1', capability: 'fast' },
            { id: 'b2', capability: 'slow' },
            { id: 'j', kind: 'join', fork: 'f' },
            { id: 'z', capability: 'after' },
          ],
          edges: [
            { from: 'a', to: 'f' },
            { from: 'f', to: 'b1', kind: 'branch', key: 'a' },
            { from: 'f', to: 'b2', kind: 'branch', key: 'b' },
            { from: 'b1', to: 'j' },
            { from: 'b2', to: 'j' },
            { from: 'j', to: 'z' },
          ],
        } as never);
        expect(activated.ok).toBe(true);
        const driving = runtime.run('seed', { concurrency: 2 });
        await settle(80); // fast branch completes; slow branch is in flight
        const runs = await fixture.orchestration.listOrchestrationRuns({ status: 'running' });
        const runId = runs[0]?.runId;
        expect(runId).toBeTruthy();
        // Durable cancellation mid-fan-out.
        const cancelled = await runtime.cancel({
          runId: runId as string,
          requestId: 'cx-1',
          reasonCode: 'shutdown',
        });
        expect(cancelled.ok).toBe(true);
        releaseSlow?.();
        const result = await driving;
        const snapshot = await fixture.orchestration.getOrchestrationSnapshot(runId as string);
        expect(result.status).toBe('cancelled');
        // No unfinished sibling remains ready, claimed, or waiting.
        const unfinished = (snapshot?.tokens ?? []).filter((token) =>
          ['ready', 'claimed', 'waiting'].includes(token.status),
        );
        expect(unfinished.length).toBe(0);
        // The completed branch stays completed (a durable fact, never reversed).
        const branchCompleted = (snapshot?.tokens ?? []).filter(
          (token) => token.nodeId === 'b1' && token.status === 'completed',
        );
        expect(branchCompleted.length).toBe(1);
      } finally {
        await fixture.dispose();
      }
    },
  );

  t(
    `[${factory.name}] cancellation idempotency: duplicate IDs dedupe; competing IDs one canonical outcome`,
    async () => {
      const fixture = await factory.create();
      try {
        const runtime = fixture.runtime;
        let downstreamCalls = 0;
        runtime
          .registerCapability({ id: 'first', revision: '1', effect: 'pure', invoke: () => 'one' })
          .registerCapability({
            id: 'second',
            revision: '1',
            effect: 'pure',
            invoke: () => {
              downstreamCalls += 1;
              return 'second';
            },
          })
          .registerContract(stringContract('conf-string'));
        const activated = await runtime.activate(signalWaitGraph());
        expect(activated.ok).toBe(true);
        const parked = await runtime.run('seed');
        expect(parked.status).toBe('waiting');
        // Duplicate ID: idempotent, no duplicate terminal event.
        const first = await runtime.cancel({
          runId: parked.runId,
          requestId: 'same-id',
          reasonCode: 'operator_request',
        });
        expect(first.ok).toBe(true);
        expect(first.ok ? first.status : '').toBe('accepted');
        const duplicate = await runtime.cancel({
          runId: parked.runId,
          requestId: 'same-id',
          reasonCode: 'operator_request',
        });
        expect(duplicate.ok).toBe(true);
        expect(duplicate.ok ? duplicate.status : '').toBe('duplicate');
        // Competing ID: still exactly one canonical terminal outcome.
        const competing = await runtime.cancel({
          runId: parked.runId,
          requestId: 'other-id',
          reasonCode: 'policy',
        });
        expect(competing.ok).toBe(true);
        const events = await fixture.orchestration.listOrchestrationEvents(parked.runId);
        expect(events.filter((event) => event.type === 'run.cancelled').length).toBe(1);
        const final = await runtime.resumeRun(parked.runId);
        expect(final.status).toBe('cancelled');
        expect(downstreamCalls).toBe(0);
      } finally {
        await fixture.dispose();
      }
    },
  );

  t(
    `[${factory.name}] unhandled branch failure cancels unfinished siblings and fails the run exactly once`,
    async () => {
      const fixture = await factory.create();
      try {
        const runtime = fixture.runtime;
        let downstreamCalls = 0;
        let releaseSlow: (() => void) | undefined;
        const slowGate = new Promise<void>((resolve) => {
          releaseSlow = resolve;
        });
        runtime
          .registerCapability({ id: 'first', revision: '1', effect: 'pure', invoke: () => 'one' })
          .registerCapability({
            id: 'boom',
            revision: '1',
            effect: 'pure',
            invoke: () => {
              throw new Error('SECRET-CAUSE-SHOULD-NOT-LEAK');
            },
          })
          .registerCapability({
            id: 'slow',
            revision: '1',
            effect: 'pure',
            invoke: (input: unknown, context) =>
              new Promise<string>((resolve) => {
                context.abortSignal?.addEventListener('abort', () => resolve('aborted'), {
                  once: true,
                });
                void slowGate.then(() => resolve('slow'));
                void input;
              }),
          })
          .registerCapability({
            id: 'after',
            revision: '1',
            effect: 'pure',
            invoke: () => {
              downstreamCalls += 1;
              return 'after';
            },
          });
        const activated = await runtime.activate({
          id: 'race-branch-failure',
          entry: 'a',
          nodes: [
            { id: 'a', capability: 'first' },
            { id: 'f', kind: 'fork', join: 'j' },
            { id: 'b1', capability: 'boom' },
            { id: 'b2', capability: 'slow' },
            { id: 'j', kind: 'join', fork: 'f' },
            { id: 'z', capability: 'after' },
          ],
          edges: [
            { from: 'a', to: 'f' },
            { from: 'f', to: 'b1', kind: 'branch', key: 'a' },
            { from: 'f', to: 'b2', kind: 'branch', key: 'b' },
            { from: 'b1', to: 'j' },
            { from: 'b2', to: 'j' },
            { from: 'j', to: 'z' },
          ],
        } as never);
        expect(activated.ok).toBe(true);
        // Release the slow branch after the failure has landed; its late
        // completion is then fenced by the cancelled sibling token.
        setTimeout(() => releaseSlow?.(), 150);
        const result = await runtime.run('seed', { concurrency: 2 });
        expect(result.status).toBe('failed');
        expect(downstreamCalls).toBe(0);
        const events = await fixture.orchestration.listOrchestrationEvents(result.runId);
        expect(events.filter((event) => event.type === 'run.failed').length).toBe(1);
        // The thrown message never enters the durable ledger.
        expect(JSON.stringify(events).includes('SECRET-CAUSE-SHOULD-NOT-LEAK')).toBe(false);
        const snapshot = await fixture.orchestration.getOrchestrationSnapshot(result.runId);
        const unfinished = (snapshot?.tokens ?? []).filter((token) =>
          ['ready', 'claimed', 'waiting'].includes(token.status),
        );
        expect(unfinished.length).toBe(0);
      } finally {
        await fixture.dispose();
      }
    },
  );

  t(
    `[${factory.name}] blocked resolution: public surface denied by default; authorized, validated, idempotent`,
    async () => {
      const fixture = await factory.create();
      try {
        const { runtime, orchestration } = fixture;
        let invokeCount = 0;
        runtime.registerCapability({
          id: 'slowWrite',
          revision: '1',
          effect: 'write',
          invoke: async () => {
            invokeCount += 1;
            await settle(120);
            return 'applied';
          },
        });
        runtime.registerCapability({
          id: 'after',
          revision: '1',
          effect: 'pure',
          invoke: (input: unknown) => `after:${JSON.stringify(input)}`,
        });
        runtime.registerContract({
          id: 'conf-blocked-output',
          revision: '1',
          expected: 'a record',
          parse: (input: unknown) =>
            typeof input === 'object' && input !== null
              ? { ok: true as const, value: input, issues: [] }
              : { ok: false as const, issues: [{ code: 'TYPE', path: '$', message: 'record' }] },
        });
        const activated = await runtime.activate({
          id: 'race-blocked',
          entry: 'w',
          nodes: [
            { id: 'w', capability: 'slowWrite', timeoutMs: 20, output: 'conf-blocked-output' },
            { id: 'z', capability: 'after' },
          ],
          edges: [{ from: 'w', to: 'z' }],
        } as never);
        expect(activated.ok).toBe(true);
        const result = await runtime.run('seed');
        expect(result.status).toBe('blocked');
        expect(invokeCount).toBe(1);
        // Denial by default: no resolution happens without authorization.
        const denied = await runtime.resolveBlocked({
          runId: result.runId,
          resolutionId: 'res-1',
          action: 'confirm_applied',
          output: { applied: true },
          reasonCode: 'operator_request',
        });
        expect(denied.ok).toBe(false);
        expect(denied.ok ? '' : denied.code).toBe('VICT_ORCH_OPERATOR_DENIED');
        expect(invokeCount).toBe(1);

        // Authorized surface: same stores, explicitly authorized runtime that
        // re-registers the identical pinned artifacts.
        const operatorRuntime = await fixture.createOperatorRuntime();
        operatorRuntime
          .registerCapability({
            id: 'slowWrite',
            revision: '1',
            effect: 'write',
            invoke: async () => {
              invokeCount += 1;
              return 'applied';
            },
          })
          .registerCapability({
            id: 'after',
            revision: '1',
            effect: 'pure',
            invoke: (input: unknown) => `after:${JSON.stringify(input)}`,
          })
          .registerContract({
            id: 'conf-blocked-output',
            revision: '1',
            expected: 'a record',
            parse: (input: unknown) =>
              typeof input === 'object' && input !== null
                ? { ok: true as const, value: input, issues: [] }
                : { ok: false as const, issues: [{ code: 'TYPE', path: '$', message: 'record' }] },
          });
        const runBefore = await orchestration.getOrchestrationRun(result.runId);
        const accepted = await operatorRuntime.resolveBlocked({
          runId: result.runId,
          resolutionId: 'res-2',
          action: 'confirm_applied',
          output: { applied: true },
          reasonCode: 'operator_request',
          expectedRunRevision: runBefore?.recordRevision,
        });
        expect(accepted.ok).toBe(true);
        expect(accepted.ok ? accepted.status : '').toBe('accepted');
        // Duplicate resolution ID is idempotent.
        const duplicate = await operatorRuntime.resolveBlocked({
          runId: result.runId,
          resolutionId: 'res-2',
          action: 'confirm_applied',
          output: { applied: true },
          reasonCode: 'operator_request',
          expectedRunRevision: runBefore?.recordRevision,
        });
        expect(duplicate.ok).toBe(true);
        expect(duplicate.ok ? duplicate.status : '').toBe('duplicate');
        // Same ID with different content conflicts.
        const conflicting = await operatorRuntime.resolveBlocked({
          runId: result.runId,
          resolutionId: 'res-2',
          action: 'fail',
          failCode: 'VICT_ORCH_OPERATOR_FAILED',
          reasonCode: 'policy',
        });
        expect(conflicting.ok).toBe(false);
        // Stale expected revision conflicts.
        const stale = await operatorRuntime.resolveBlocked({
          runId: result.runId,
          resolutionId: 'res-3',
          action: 'fail',
          failCode: 'VICT_ORCH_OPERATOR_FAILED',
          reasonCode: 'policy',
          expectedRunRevision: (runBefore?.recordRevision ?? 0) - 1,
        });
        expect(stale.ok).toBe(false);
        // The authorized resolution resumes the durable work; drive it to
        // completion under the same pinned activation.
        const final = await runtime.resumeRun(result.runId);
        expect(final.status).toBe('completed');
        expect(final.output).toBe('after:{"applied":true}');
        const events = await orchestration.listOrchestrationEvents(result.runId);
        expect(events.filter((event) => event.type === 'operator.intervened').length).toBe(1);
        const run = await orchestration.getOrchestrationRun(result.runId);
        expect(run?.status).toBe('completed');
      } finally {
        await fixture.dispose();
      }
    },
  );
}
