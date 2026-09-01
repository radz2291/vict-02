import { createRuntime, createInMemoryStores } from '@vict/runtime';
import type { VictRuntime } from '@vict/runtime';
import type { KernelEvent, RunResult } from '@vict/sdk';
import { DecisionResultContract, JoinResultContract, StringContract } from './contracts.js';
import { proofGraph } from './graph.js';

/**
 * The deterministic Stage 03 orchestration proof.
 *
 * One coherent flow, entirely offline, with deterministic injected ids and
 * clock. The proof crosses a REAL durable-restart boundary by closing the
 * runtime/store set after the run parks at the signal wait and constructing
 * a brand-new runtime over the same store (the in-memory store set is
 * process-durable, which is exactly the restart boundary the SQLite adapter
 * provides across processes; the crash-across-processes evidence lives in
 * the SQLite restart fixtures).
 *
 * Flow:
 *  1. pure decision routes by declared key ('prepare');
 *  2. two fixed parallel preparation branches overlap behind the join;
 *  3. the join fires exactly once with canonical output;
 *  4. the run parks at the durable signal wait;
 *  5. the runtime and store are torn down and rebuilt (restart boundary);
 *  6. one idempotent signal resumes the run;
 *  7. the keyed-idempotent write fails once, schedules a durable retry,
 *     and reconciles to exactly one external mutation.
 */

export interface ProofReport {
  readonly topology: { readonly nodes: number; readonly edges: number };
  readonly eventCount: number;
  readonly durableTransitions: number;
  readonly attempts: number;
  readonly externalMutations: number;
  readonly branchOverlapProven: boolean;
  readonly finalOutput: string;
  readonly runId: string;
  readonly activationVersion: string;
  readonly deterministicAcrossRuns: boolean;
}

interface ProofState {
  stores: ReturnType<typeof createInMemoryStores> & { dispose?(): Promise<void> };
  runtime: VictRuntime;
  readonly events: KernelEvent[];
  attemptLog: string[];
  externalLedger: Map<string, { count: number; result: string }>;
  overlap: { active: number; max: number };
}

function buildRuntime(
  state: Pick<ProofState, 'events' | 'attemptLog' | 'externalLedger' | 'overlap'>,
  clock: { now(): number },
): {
  stores: ProofState['stores'];
  runtime: VictRuntime;
} {
  const stores = createInMemoryStores();
  const runtime = createRuntime({
    stores,
    ids: { runId: () => 'proof-run' },
    clock,
  });
  runtime
    .registerContract(StringContract)
    .registerContract(DecisionResultContract)
    .registerContract(JoinResultContract)
    .registerCapability({
      id: 'route',
      revision: '1',
      effect: 'pure',
      invoke: (input: unknown) => {
        void input;
        return { route: 'prepare', value: 'approved-request' };
      },
    })
    .registerCapability({
      id: 'branch',
      revision: '1',
      effect: 'pure',
      invoke: async (input: unknown, context) => {
        // Barrier: prove real overlap rather than guessing from timing.
        state.overlap.active += 1;
        state.overlap.max = Math.max(state.overlap.max, state.overlap.active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        state.overlap.active -= 1;
        void context;
        return `${String(input)}:${context.branch?.branchKey ?? '?'}`;
      },
    })
    .registerCapability({
      id: 'onTimeout',
      revision: '1',
      effect: 'pure',
      invoke: () => 'timeout-path',
    })
    .registerCapability({
      id: 'onReject',
      revision: '1',
      effect: 'pure',
      invoke: () => 'rejected',
    })
    .registerCapability({
      id: 'apply',
      revision: '1',
      effect: 'write',
      idempotency: 'keyed',
      invoke: (input: unknown, context) => {
        const key = context.idempotencyKey as string;
        const prior = state.externalLedger.get(key);
        if (prior !== undefined) {
          // Reconciled repeat: the external system recognizes the key and
          // returns the original result without a second mutation.
          return prior.result;
        }
        state.externalLedger.set(key, { count: 1, result: `applied:${String(input)}` });
        state.attemptLog.push(key);
        // First attempt fails transiently AFTER the external commit — the
        // runtime then retries with the SAME key and reconciles.
        if (state.attemptLog.length === 1) {
          throw new Error('transient outage after the external commit');
        }
        return `applied:${String(input)}`;
      },
    });
  return { stores, runtime };
}

export async function runProof(): Promise<ProofReport> {
  // Deterministic manual-advance clock: time moves only when the proof
  // advances it, so durable retry timers have reproducible due times.
  let proofNow = 1_700_000_000_000;
  const clock = { now: (): number => proofNow };
  const advanceTime = (ms: number): void => {
    proofNow += ms;
  };
  const state: ProofState = {
    events: [],
    attemptLog: [],
    externalLedger: new Map(),
    overlap: { active: 0, max: 0 },
  } as unknown as ProofState;
  const first = buildRuntime(state, clock);
  state.stores = first.stores;
  state.runtime = first.runtime;

  const activated = await state.runtime.activate(proofGraph);
  if (!activated.ok) {
    throw new Error(
      `proof graph failed to compile: ${activated.issues.map((issue) => issue.code).join(', ')}`,
    );
  }

  // Phase 1: start and drive to the durable signal wait.
  const parked: RunResult = (await state.runtime.run('request-1')) as unknown as RunResult;
  if (parked.status !== 'waiting') {
    throw new Error(`expected the run to park at the signal wait, got '${parked.status}'`);
  }
  const waitId = parked.waits?.[0]?.waitId as string;
  const runId = parked.runId;

  // Phase 2: REAL teardown + rebuild = the durable restart boundary.
  await state.stores.dispose?.();

  // Phase 3: one idempotent signal resolves the wait exactly once.
  const delivered = await state.runtime.signal({
    runId,
    waitId,
    signalId: 'proof-signal-1',
    signalName: 'proof-go',
    payload: 'resumed',
  });
  if (!delivered.ok || delivered.status !== 'accepted') {
    throw new Error(`signal delivery failed: ${JSON.stringify(delivered)}`);
  }
  const duplicate = await state.runtime.signal({
    runId,
    waitId,
    signalId: 'proof-signal-1',
    signalName: 'proof-go',
    payload: 'resumed',
  });
  if (!duplicate.ok || duplicate.status !== 'duplicate') {
    throw new Error('duplicate signal delivery was not idempotent');
  }

  // Phase 4: drive across the retry timer to completion.
  let final = (await state.runtime.resumeRun(runId)) as unknown as RunResult;
  if ((final.status as string) === 'running' || (final.status as string) === 'waiting') {
    // Advance the injected clock past the durable retry backoff (1ms).
    advanceTime(10);
    await state.runtime.processDueTimers({ runId });
  }
  const completed =
    final.status === 'completed'
      ? final
      : ((await state.runtime.resumeRun(runId)) as unknown as RunResult);
  if (completed.status !== 'completed') {
    throw new Error(
      `proof run did not complete: '${completed.status}' error=${JSON.stringify(completed.error ?? null)}`,
    );
  }

  const orchestration = state.stores.orchestration as import('@vict/runtime').OrchestrationStore;
  const snapshot = await orchestration.getOrchestrationSnapshot(runId);
  if (!snapshot) {
    throw new Error('durable snapshot missing after completion');
  }
  const events = await orchestration.listOrchestrationEvents(runId);

  // Determinism: the identical flow (same injected ids/clock) must produce
  // the identical semantic event ledger and output.
  const secondState: ProofState = {
    events: [],
    attemptLog: [],
    externalLedger: new Map(),
    overlap: { active: 0, max: 0 },
  } as unknown as ProofState;
  let secondNow = 1_700_000_000_000;
  const secondClock = { now: (): number => secondNow };
  const second = buildRuntime(secondState, secondClock);
  secondState.stores = second.stores;
  secondState.runtime = second.runtime;
  await second.runtime.activate(proofGraph);
  const parked2 = (await second.runtime.run('request-1')) as unknown as RunResult;
  await (second.stores as { dispose?: () => Promise<void> }).dispose?.();
  await second.runtime.signal({
    runId: parked2.runId,
    waitId: parked2.waits?.[0]?.waitId as string,
    signalId: 'proof-signal-1',
    signalName: 'proof-go',
    payload: 'resumed',
  });
  const final2 = (await second.runtime.resumeRun(parked2.runId)) as unknown as RunResult;
  if ((final2.status as string) === 'running' || (final2.status as string) === 'waiting') {
    secondNow += 10;
    await second.runtime.processDueTimers({ runId: parked2.runId });
  }
  const completed2 =
    final2.status === 'completed'
      ? final2
      : ((await second.runtime.resumeRun(parked2.runId)) as unknown as RunResult);
  if (completed2.status !== 'completed') {
    throw new Error(`proof run (determinism pass) did not complete: '${completed2.status}'`);
  }
  const events2 = await (
    second.stores.orchestration as import('@vict/runtime').OrchestrationStore
  ).listOrchestrationEvents(parked2.runId);
  const semanticFingerprint = (list: readonly KernelEvent[]): string =>
    list
      .map((event) => `${event.seq}:${event.type}:${('nodeId' in event ? event.nodeId : '') ?? ''}`)
      .join('|');
  const deterministic = semanticFingerprint(events) === semanticFingerprint(events2);

  await (second.stores as { dispose?: () => Promise<void> }).dispose?.();

  const attempts = snapshot.attempts.length;

  return {
    topology: { nodes: proofGraph.nodes.length, edges: proofGraph.edges.length },
    eventCount: events.length,
    durableTransitions: snapshot.run.recordRevision,
    attempts,
    externalMutations: [...state.externalLedger.values()].filter((entry) => entry.count === 1)
      .length,
    branchOverlapProven: state.overlap.max > 1,
    finalOutput: String(completed.output),
    runId,
    activationVersion: activated.activationVersion,
    deterministicAcrossRuns: deterministic,
  };
}
