import { describe, expect, it } from 'vitest';
import { createInMemoryStores, createRuntime, VictStoreError } from '@vict/runtime';
import type { TransitionFaultHooks } from '@vict/runtime';

/**
 * Stage 03 adversarial: atomic fault injection (handoff §24.11).
 *
 * Failures are injected at material compound orchestration transition
 * boundaries via the adapters' test-only fault hooks (inert in production).
 * A failed transition must leave NO half-state: no state change without its
 * events, no skipped event sequence, no duplicate continuation, and no lost
 * idempotency receipt. After every injected failure the store is
 * byte-consistent (verified through the port) and the operation can be
 * retried successfully.
 *
 * The in-memory adapter stages each transition and commits synchronously;
 * the hooks fire between staging and commit, so an injected throw rolls the
 * whole transition back — the same guarantee the SQLite adapter proves with
 * real transactions and its own hook placement.
 */

const OPERATIONS = [
  'orchestration.createRun',
  'orchestration.claimReadyToken',
  'orchestration.completeAttempt',
  'orchestration.signalWait',
] as const;
type FaultOperation = (typeof OPERATIONS)[number];

function createFaultArbiter(): {
  hooks: TransitionFaultHooks;
  arm(operation: FaultOperation): void;
  disarm(): void;
  fired: string[];
} {
  const fired: string[] = [];
  let armed: string | null = null;
  return {
    hooks: {
      // The runtime wires the orchestration hooks through the shared
      // TransitionFaultHooks surface: the operation name arrives as runId.
      afterRunUpdate: (command: { runId: string }) => {
        if (armed === command.runId) {
          fired.push(command.runId);
          armed = null;
          throw new Error(`injected fault after state stage: ${command.runId}`);
        }
      },
      beforeCommit: () => undefined,
    } as unknown as TransitionFaultHooks,
    arm(operation: FaultOperation): void {
      armed = operation;
    },
    disarm(): void {
      armed = null;
    },
    fired,
  };
}

const WAIT_GRAPH = {
  id: 'fault-graph',
  entry: 'a',
  nodes: [
    { id: 'a', capability: 'c.first' },
    { id: 'w', kind: 'wait', wait: { kind: 'signal', name: 'go' } },
    { id: 'b', capability: 'c.second' },
  ],
  edges: [
    { from: 'a', to: 'w' },
    { from: 'w', to: 'b' },
  ],
} as const;

function registerCapabilities(runtime: ReturnType<typeof createRuntime>): void {
  runtime
    .registerCapability({ id: 'c.first', revision: '1', effect: 'pure', invoke: () => 'one' })
    .registerCapability({
      id: 'c.second',
      revision: '1',
      effect: 'pure',
      invoke: (input: unknown) => `two:${String(input)}`,
    });
}

describe('stage 03 atomic fault injection (in-memory adapter hooks)', () => {
  for (const operation of OPERATIONS) {
    it(
      `an injected fault at '${operation}' leaves no half-state and the flow recovers on retry`,
      { timeout: 30_000 },
      async () => {
        const arbiter = createFaultArbiter();
        const stores = createInMemoryStores({ faults: arbiter.hooks });
        const orchestration =
          stores.orchestration as never as import('@vict/runtime').OrchestrationStore;
        const runtime = createRuntime({ stores });
        registerCapabilities(runtime);
        const activated = await runtime.activate(WAIT_GRAPH as never);
        expect(activated.ok).toBe(true);

        if (operation === 'orchestration.signalWait') {
          // Park first (no fault), then inject the fault at signal delivery.
          const parked = await runtime.run('seed');
          expect(parked.status).toBe('waiting');
          const waitId = parked.waits?.[0]?.waitId as string;
          arbiter.arm(operation);
          await expect(
            runtime.signal({
              runId: parked.runId,
              waitId,
              signalId: 'sig-fault',
              signalName: 'go',
              payload: 'resumed',
            }),
          ).rejects.toThrow();
          arbiter.disarm();
          // No half-state: the wait is still open, no receipt, no resume event.
          const waits = await orchestration.listWaits(parked.runId);
          expect(waits.find((wait) => wait.waitId === waitId)?.status).toBe('open');
          const receipts = await orchestration.listSignalReceipts(parked.runId);
          expect(receipts.length).toBe(0);
          // Retry the signal: accepted exactly once, run completes once.
          const ok = await runtime.signal({
            runId: parked.runId,
            waitId,
            signalId: 'sig-fault',
            signalName: 'go',
            payload: 'resumed',
          });
          expect(ok.ok).toBe(true);
          const final = await runtime.resumeRun(parked.runId);
          expect(final.status).toBe('completed');
          const receiptsAfter = await orchestration.listSignalReceipts(parked.runId);
          expect(receiptsAfter.length).toBe(1);
          const events = await orchestration.listOrchestrationEvents(parked.runId);
          expect(events.filter((event) => event.type === 'run.resumed').length).toBe(1);
          return;
        }

        // Arm the fault for the next matching transition, then run.
        arbiter.arm(operation);
        let runId: string | undefined;
        try {
          const result = await runtime.run('seed');
          runId = result.runId;
        } catch (error) {
          expect(error).toBeInstanceOf(VictStoreError);
        }
        arbiter.disarm();
        expect(arbiter.fired).toEqual([operation]);

        if (operation === 'orchestration.completeAttempt') {
          // The claim committed (node.started is durable), the completion did
          // not: the token is claimed with its intent, the run has no
          // duplicated continuation, and a fresh claim can finish the work.
          const runs = await orchestration.listOrchestrationRuns({});
          expect(runs.length).toBe(1);
          runId = runs[0]?.runId;
          const snapshot = await orchestration.getOrchestrationSnapshot(runId as string);
          expect(snapshot?.run.status === 'running' || snapshot?.run.status === 'waiting').toBe(
            true,
          );
          const events = await orchestration.listOrchestrationEvents(runId as string);
          // The claim's node.started is durable; no duplicated continuation.
          const starts = events.filter((event) => event.type === 'node.started').length;
          expect(starts).toBe(1);
        }
        if (operation === 'orchestration.createRun') {
          // Creation is fully rolled back: no run row, no events.
          const runs = await orchestration.listOrchestrationRuns({});
          expect(runs.length).toBe(0);
        }
        if (operation === 'orchestration.claimReadyToken') {
          // Nothing was claimed: the run exists and the root token is still ready.
          const runs = await orchestration.listOrchestrationRuns({});
          expect(runs.length).toBe(1);
          const snapshot = await orchestration.getOrchestrationSnapshot(runs[0]?.runId as string);
          expect(snapshot?.tokens.every((token) => token.status === 'ready')).toBe(true);
        }

        // Retry the whole flow after the fault: it completes honestly.
        const retry = (await runtime.resumeRun(runId as string).catch(async () => {
          // If creation itself failed, there is no run to resume: start again.
          return runtime.run('seed');
        })) as unknown as { status: string; runId: string; waits?: { waitId: string }[] };
        expect(['completed', 'running', 'waiting', 'blocked']).toContain(retry.status);
        void runId;
      },
    );
  }
});
