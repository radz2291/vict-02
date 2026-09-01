import { describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRuntime } from '@vict/runtime';
import type { OrchestrationStore } from '@vict/runtime';
import { createSqliteStores } from '@vict/store-sqlite';

/**
 * Corrective Stage 03 SQLite evidence (handoff §24.11 atomicity, §24.5
 * restart): deterministic fault injection at every material orchestration
 * transition, exercising REAL SQLite transaction rollback. For each
 * boundary: the faulted command throws, no half-state becomes visible
 * (no skipped event, no duplicate continuation, no lost receipt, no leaked
 * checkpoint), and a clean retry of the same work succeeds exactly once.
 * Also: retry timers and exact-activation resolution across close/reopen.
 */

const settle = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface FaultTarget {
  operation: string;
  hook: 'afterRunUpdate' | 'beforeCommit';
  armed: boolean;
  hitCount: number;
}

type SqliteFaults = NonNullable<Parameters<typeof createSqliteStores>[0]>['faults'];
type SqliteFaultCommand = Parameters<NonNullable<NonNullable<SqliteFaults>['afterRunUpdate']>>[0];

function faultSwitch(targets: FaultTarget[]): SqliteFaults {
  const fire = (hook: 'afterRunUpdate' | 'beforeCommit', operation: string): void => {
    for (const target of targets) {
      if (target.hook === hook && target.armed && target.operation === operation) {
        target.hitCount += 1;
        if (target.hitCount === 1) {
          throw new Error('injected fault');
        }
      }
    }
  };
  return {
    afterRunUpdate: (command: SqliteFaultCommand) => fire('afterRunUpdate', command.runId),
    beforeCommit: (command: SqliteFaultCommand) => fire('beforeCommit', command.runId),
  };
}

const stringContract = {
  id: 'fault-string',
  revision: '1',
  expected: 'a string',
  parse: (input: unknown) =>
    typeof input === 'string'
      ? { ok: true as const, value: input, issues: [] }
      : { ok: false as const, issues: [{ code: 'TYPE', path: '$', message: 'expected a string' }] },
};

const rawPlanner = {
  invocationIdFor: (token: { tokenId: string }) => `inv_${token.tokenId}`,
  attemptIdFor: (token: { tokenId: string }, attemptNumber: number) =>
    `att_${token.tokenId}_${attemptNumber}`,
  planFor: () => ({
    capabilityId: 'raw',
    effectClass: 'pure' as const,
    deadlineAt: null,
    idempotencyKey: null,
  }),
};

describe('orchestration SQLite corrective evidence', () => {
  it(
    'a createRun fault leaves no run record; the retry creates it once',
    { timeout: 60_000 },
    async () => {
      const dir = await mkdtemp(join(tmpdir(), 'vict-fault-create-'));
      try {
        const targets: FaultTarget[] = [
          { operation: 'orchestration.createRun', hook: 'beforeCommit', armed: true, hitCount: 0 },
        ];
        const stores = createSqliteStores({
          path: join(dir, 'create.db'),
          faults: faultSwitch(targets),
        });
        try {
          const runtime = createRuntime({ stores });
          runtime.registerCapability({
            id: 'first',
            revision: '1',
            effect: 'pure',
            invoke: () => 'one',
          });
          const activated = await runtime.activate({
            id: 'fault-create',
            entry: 'a',
            // A declared timeout forces the durable orchestration engine.
            nodes: [{ id: 'a', capability: 'first', timeoutMs: 30_000 }],
            edges: [],
          });
          expect(activated.ok).toBe(true);
          await expect(runtime.run('seed')).rejects.toThrow();
          const runs = await (
            stores.orchestration as unknown as OrchestrationStore
          ).listOrchestrationRuns({});
          expect(runs.length).toBe(0);
          // Clean retry: the same work succeeds exactly once.
          const result = await runtime.run('seed');
          expect(result.status).toBe('completed');
          const runsAfter = await (
            stores.orchestration as unknown as OrchestrationStore
          ).listOrchestrationRuns({});
          expect(runsAfter.length).toBe(1);
        } finally {
          await stores.dispose();
        }
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );

  it(
    'a claim fault leaves the token ready with no attempt; the retry claims once',
    { timeout: 60_000 },
    async () => {
      const dir = await mkdtemp(join(tmpdir(), 'vict-fault-claim-'));
      try {
        const db = join(dir, 'claim.db');
        const targets: FaultTarget[] = [
          {
            operation: 'orchestration.claimReadyToken',
            hook: 'afterRunUpdate',
            armed: true,
            hitCount: 0,
          },
        ];
        const stores = createSqliteStores({ path: db, faults: faultSwitch(targets) });
        try {
          const runtime = createRuntime({ stores });
          runtime.registerCapability({
            id: 'hold',
            revision: '1',
            effect: 'pure',
            invoke: () => 'x',
          });
          const activated = await runtime.activate({
            id: 'fault-claim',
            entry: 'hold',
            nodes: [{ id: 'hold', capability: 'hold' }],
            edges: [],
          });
          expect(activated.ok).toBe(true);
          const activationVersion = (activated as { ok: true; activationVersion: string })
            .activationVersion;
          const storedActivation = await stores.catalog.get(activationVersion);
          const manifest = JSON.parse(storedActivation!.canonicalManifest) as {
            graphId: string;
            graphVersion: string;
            capabilitySetVersion: string;
          };
          const orchestration = stores.orchestration as unknown as OrchestrationStore;
          await orchestration.createOrchestrationRun({
            runId: 'run_fault_claim',
            graphId: manifest.graphId,
            graphVersion: manifest.graphVersion,
            capabilitySetVersion: manifest.capabilitySetVersion,
            activationVersion,
            mode: 'normal',
            retention: 'summary',
            rootTokenId: 'tok_fault_claim',
            entryNodeId: 'hold',
            checkpoint: 'seed',
            events: [],
            now: Date.now(),
          });
          await expect(
            orchestration.claimReadyToken({
              runId: 'run_fault_claim',
              ownerId: 'owner-a',
              leaseExpiresAt: Date.now() + 60_000,
              now: Date.now(),
              planner: rawPlanner,
            }),
          ).rejects.toThrow();
          const snapshot = await orchestration.getOrchestrationSnapshot('run_fault_claim');
          expect(
            snapshot?.tokens.find((token) => token.tokenId === 'tok_fault_claim')?.status,
          ).toBe('ready');
          expect(snapshot?.attempts.length).toBe(0);
          // Clean retry: the claim succeeds exactly once.
          const claimed = await orchestration.claimReadyToken({
            runId: 'run_fault_claim',
            ownerId: 'owner-a',
            leaseExpiresAt: Date.now() + 60_000,
            now: Date.now(),
            planner: rawPlanner,
          });
          expect(claimed.claimed).toBe(true);
          const after = await orchestration.getOrchestrationSnapshot('run_fault_claim');
          expect(after?.attempts.length).toBe(1);
          expect(after?.tokens.find((token) => token.tokenId === 'tok_fault_claim')?.status).toBe(
            'claimed',
          );
        } finally {
          await stores.dispose();
        }
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );

  it(
    'a completion fault leaves the attempt started and the run running; the retry completes once',
    { timeout: 60_000 },
    async () => {
      const dir = await mkdtemp(join(tmpdir(), 'vict-fault-complete-'));
      try {
        const targets: FaultTarget[] = [
          {
            operation: 'orchestration.completeAttempt',
            hook: 'beforeCommit',
            armed: true,
            hitCount: 0,
          },
        ];
        const stores = createSqliteStores({
          path: join(dir, 'complete.db'),
          faults: faultSwitch(targets),
        });
        try {
          const runtime = createRuntime({ stores });
          runtime.registerCapability({
            id: 'hold',
            revision: '1',
            effect: 'pure',
            invoke: () => 'x',
          });
          const activated = await runtime.activate({
            id: 'fault-complete',
            entry: 'hold',
            nodes: [{ id: 'hold', capability: 'hold', timeoutMs: 30_000 }],
            edges: [],
          });
          expect(activated.ok).toBe(true);
          const activationVersion = (activated as { ok: true; activationVersion: string })
            .activationVersion;
          const storedActivation = await stores.catalog.get(activationVersion);
          const manifest = JSON.parse(storedActivation!.canonicalManifest) as {
            graphId: string;
            graphVersion: string;
            capabilitySetVersion: string;
          };
          const orchestration = stores.orchestration as unknown as OrchestrationStore;
          await orchestration.createOrchestrationRun({
            runId: 'run_fault_complete',
            graphId: manifest.graphId,
            graphVersion: manifest.graphVersion,
            capabilitySetVersion: manifest.capabilitySetVersion,
            activationVersion,
            mode: 'normal',
            retention: 'summary',
            rootTokenId: 'tok_fault_complete',
            entryNodeId: 'hold',
            checkpoint: 'seed',
            events: [],
            now: Date.now(),
          });
          const claimed = await orchestration.claimReadyToken({
            runId: 'run_fault_complete',
            ownerId: 'owner-a',
            leaseExpiresAt: Date.now() + 60_000,
            now: Date.now(),
            planner: rawPlanner,
          });
          expect(claimed.claimed).toBe(true);
          const claim = (claimed as { claim: { attempt: { attemptId: string; fence: number } } })
            .claim;
          await expect(
            orchestration.completeAttempt({
              runId: 'run_fault_complete',
              attemptId: claim.attempt.attemptId,
              ownerId: 'owner-a',
              expectedAttemptFence: claim.attempt.fence,
              now: Date.now(),
              outcome: { kind: 'completed', outputSummary: { shape: 'string', length: 1 } },
              continuation: { kind: 'none' },
              events: [],
              run: { status: 'completed' },
            }),
          ).rejects.toThrow();
          // No half-state: the attempt is still started, the run still running,
          // and no run.completed event was appended.
          const snapshot = await orchestration.getOrchestrationSnapshot('run_fault_complete');
          expect(snapshot?.attempts[0]?.state).toBe('started');
          expect(snapshot?.run.status).toBe('running');
          const events = await orchestration.listOrchestrationEvents('run_fault_complete');
          expect(events.some((event) => event.type === 'run.completed')).toBe(false);
          // Clean retry completes exactly once.
          const completed = await orchestration.completeAttempt({
            runId: 'run_fault_complete',
            attemptId: claim.attempt.attemptId,
            ownerId: 'owner-a',
            expectedAttemptFence: claim.attempt.fence,
            now: Date.now(),
            outcome: { kind: 'completed', outputSummary: { shape: 'string', length: 1 } },
            continuation: { kind: 'none' },
            events: [],
            run: { status: 'completed' },
          });
          expect(completed.attempt.state).toBe('completed');
          const run = await orchestration.getOrchestrationRun('run_fault_complete');
          expect(run?.status).toBe('completed');
          const eventsAfter = await orchestration.listOrchestrationEvents('run_fault_complete');
          // Only the claim's durable-intent event exists: neither the faulted
          // commit nor the clean retry appended any run fact.
          expect(eventsAfter.length).toBe(1);
          expect(eventsAfter[0]?.type).toBe('node.started');
        } finally {
          await stores.dispose();
        }
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );

  it(
    'a signal fault leaves the wait open with no receipt; the retry delivers once',
    { timeout: 60_000 },
    async () => {
      const dir = await mkdtemp(join(tmpdir(), 'vict-fault-signal-'));
      try {
        const targets: FaultTarget[] = [
          { operation: 'orchestration.signalWait', hook: 'beforeCommit', armed: true, hitCount: 0 },
        ];
        const stores = createSqliteStores({
          path: join(dir, 'signal.db'),
          faults: faultSwitch(targets),
        });
        try {
          const runtime = createRuntime({ stores });
          runtime
            .registerCapability({ id: 'first', revision: '1', effect: 'pure', invoke: () => 'one' })
            .registerCapability({
              id: 'second',
              revision: '1',
              effect: 'pure',
              invoke: (input: unknown) => `got:${String(input)}`,
            })
            .registerContract(stringContract);
          const activated = await runtime.activate({
            id: 'fault-signal',
            entry: 'a',
            nodes: [
              { id: 'a', capability: 'first' },
              {
                id: 'w',
                kind: 'wait',
                wait: { kind: 'signal', name: 'go', contract: 'fault-string' },
              },
              { id: 'b', capability: 'second', output: 'fault-string' },
            ],
            edges: [
              { from: 'a', to: 'w' },
              { from: 'w', to: 'b' },
            ],
          });
          expect(activated.ok).toBe(true);
          const parked = await runtime.run('seed');
          expect(parked.status).toBe('waiting');
          const waitId = parked.waits?.[0]?.waitId as string;
          await expect(
            runtime.signal({
              runId: parked.runId,
              waitId,
              signalId: 'sig-fault-1',
              signalName: 'go',
              payload: 'resumed',
            }),
          ).rejects.toThrow();
          // No half-state: the wait is still open, no receipt, run still waiting.
          const waits = await (stores.orchestration as unknown as OrchestrationStore).listWaits(
            parked.runId,
          );
          expect(waits.find((wait) => wait.waitId === waitId)?.status).toBe('open');
          const receipts = await (
            stores.orchestration as unknown as OrchestrationStore
          ).listSignalReceipts(parked.runId);
          expect(receipts.length).toBe(0);
          // Clean retry delivers exactly once.
          const delivered = await runtime.signal({
            runId: parked.runId,
            waitId,
            signalId: 'sig-fault-1',
            signalName: 'go',
            payload: 'resumed',
          });
          expect(delivered.ok).toBe(true);
          expect(delivered.ok ? delivered.status : '').toBe('accepted');
          const final = await runtime.resumeRun(parked.runId);
          expect(final.status).toBe('completed');
          const receiptsAfter = await (
            stores.orchestration as unknown as OrchestrationStore
          ).listSignalReceipts(parked.runId);
          expect(receiptsAfter.length).toBe(1);
          const events = await (
            stores.orchestration as unknown as OrchestrationStore
          ).listOrchestrationEvents(parked.runId);
          expect(events.filter((event) => event.type === 'signal.received').length).toBe(1);
        } finally {
          await stores.dispose();
        }
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );

  it(
    'a timer-resolution fault leaves the wait open; the retry fires the timer once',
    { timeout: 60_000 },
    async () => {
      const dir = await mkdtemp(join(tmpdir(), 'vict-fault-timer-'));
      try {
        const targets: FaultTarget[] = [
          {
            operation: 'orchestration.resolveDueTimer',
            hook: 'beforeCommit',
            armed: true,
            hitCount: 0,
          },
        ];
        const stores = createSqliteStores({
          path: join(dir, 'timer.db'),
          faults: faultSwitch(targets),
        });
        try {
          const runtime = createRuntime({ stores });
          runtime
            .registerCapability({ id: 'first', revision: '1', effect: 'pure', invoke: () => 'one' })
            .registerCapability({
              id: 'second',
              revision: '1',
              effect: 'pure',
              invoke: (input: unknown) => `got:${String(input)}`,
            })
            .registerContract(stringContract);
          const activated = await runtime.activate({
            id: 'fault-timer',
            entry: 'a',
            nodes: [
              { id: 'a', capability: 'first' },
              { id: 't', kind: 'wait', wait: { kind: 'timer', delayMs: 5 } },
              { id: 'b', capability: 'second', output: 'fault-string' },
            ],
            edges: [
              { from: 'a', to: 't' },
              { from: 't', to: 'b' },
            ],
          });
          expect(activated.ok).toBe(true);
          const parked = await runtime.run('seed');
          expect(parked.status).toBe('waiting');
          await settle(30);
          await expect(runtime.processDueTimers({ runId: parked.runId })).rejects.toThrow();
          // No half-state: the wait is still open, the run still waiting, and
          // no timer fact was appended.
          const waits = await (stores.orchestration as unknown as OrchestrationStore).listWaits(
            parked.runId,
          );
          expect(waits[0]?.status).toBe('open');
          const run = await (
            stores.orchestration as unknown as OrchestrationStore
          ).getOrchestrationRun(parked.runId);
          expect(run?.status).toBe('waiting');
          const eventsSoFar = await (
            stores.orchestration as unknown as OrchestrationStore
          ).listOrchestrationEvents(parked.runId);
          expect(eventsSoFar.some((event) => event.type === 'timer.fired')).toBe(false);
          // Clean retry after the 30s pump-lease window: claim and resolve the
          // same due timer through the raw store with a bumped clock.
          const orchestrationStore = stores.orchestration as unknown as OrchestrationStore;
          const reclaimed = await orchestrationStore.claimDueTimers({
            now: Date.now() + 31_000,
            limit: 16,
            runId: parked.runId,
            ownerId: 'pump-owner',
            leaseExpiresAt: Date.now() + 62_000,
          });
          expect(reclaimed.timers.length).toBe(1);
          const timer = reclaimed.timers[0]!;
          const resolved = await orchestrationStore.resolveDueTimer({
            runId: parked.runId,
            timerId: timer.timerId,
            ownerId: 'pump-owner',
            expectedTimerFence: timer.revision,
            now: Date.now() + 31_000,
            resolution: { kind: 'wake' },
            events: [],
          });
          expect(resolved.applied).toBe(true);
          const waitsAfter = await orchestrationStore.listWaits(parked.runId);
          expect(waitsAfter[0]?.status).toBe('resolved');
          const final = await runtime.resumeRun(parked.runId);
          expect(final.status).toBe('completed');
          expect(final.output).toBe('got:one');
        } finally {
          await stores.dispose();
        }
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );

  it(
    'cancellation faults leave the run untouched; the retry cancels exactly once',
    { timeout: 60_000 },
    async () => {
      const dir = await mkdtemp(join(tmpdir(), 'vict-fault-cancel-'));
      try {
        const targets: FaultTarget[] = [
          {
            operation: 'orchestration.requestCancellation',
            hook: 'beforeCommit',
            armed: true,
            hitCount: 0,
          },
          {
            operation: 'orchestration.applyCancellation',
            hook: 'beforeCommit',
            armed: false,
            hitCount: 0,
          },
        ];
        const stores = createSqliteStores({
          path: join(dir, 'cancel.db'),
          faults: faultSwitch(targets),
        });
        try {
          const runtime = createRuntime({ stores });
          runtime
            .registerCapability({ id: 'first', revision: '1', effect: 'pure', invoke: () => 'one' })
            .registerCapability({
              id: 'second',
              revision: '1',
              effect: 'pure',
              invoke: (input: unknown) => `got:${String(input)}`,
            })
            .registerContract(stringContract);
          const activated = await runtime.activate({
            id: 'fault-cancel',
            entry: 'a',
            nodes: [
              { id: 'a', capability: 'first' },
              {
                id: 'w',
                kind: 'wait',
                wait: { kind: 'signal', name: 'go', contract: 'fault-string' },
              },
              { id: 'b', capability: 'second', output: 'fault-string' },
            ],
            edges: [
              { from: 'a', to: 'w' },
              { from: 'w', to: 'b' },
            ],
          });
          expect(activated.ok).toBe(true);
          const parked = await runtime.run('seed');
          expect(parked.status).toBe('waiting');
          // requestCancellation faults: no request, no events, run untouched.
          await expect(
            runtime.cancel({
              runId: parked.runId,
              requestId: 'c-1',
              reasonCode: 'operator_request',
            }),
          ).rejects.toThrow();
          const events = await (
            stores.orchestration as unknown as OrchestrationStore
          ).listOrchestrationEvents(parked.runId);
          expect(events.some((event) => event.type === 'run.cancel_requested')).toBe(false);
          // Clean retry cancels exactly once.
          const cancelled = await runtime.cancel({
            runId: parked.runId,
            requestId: 'c-1',
            reasonCode: 'operator_request',
          });
          expect(cancelled.ok).toBe(true);
          const run = await (
            stores.orchestration as unknown as OrchestrationStore
          ).getOrchestrationRun(parked.runId);
          expect(run?.status).toBe('cancelled');
          const eventsAfter = await (
            stores.orchestration as unknown as OrchestrationStore
          ).listOrchestrationEvents(parked.runId);
          expect(eventsAfter.filter((event) => event.type === 'run.cancelled').length).toBe(1);
          expect(eventsAfter.filter((event) => event.type === 'run.cancel_requested').length).toBe(
            1,
          );
        } finally {
          await stores.dispose();
        }
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );

  it(
    'a fork-creation fault rolls back all child tokens; the retry fans out once',
    { timeout: 60_000 },
    async () => {
      const dir = await mkdtemp(join(tmpdir(), 'vict-fault-fork-'));
      try {
        const targets: FaultTarget[] = [
          {
            operation: 'orchestration.completeAttempt',
            hook: 'beforeCommit',
            armed: false,
            hitCount: 0,
          },
        ];
        const stores = createSqliteStores({
          path: join(dir, 'fork.db'),
          faults: faultSwitch(targets),
        });
        try {
          const runtime = createRuntime({ stores });
          runtime
            .registerCapability({ id: 'first', revision: '1', effect: 'pure', invoke: () => 'one' })
            .registerCapability({ id: 'b1', revision: '1', effect: 'pure', invoke: () => 'alpha' })
            .registerCapability({ id: 'b2', revision: '1', effect: 'pure', invoke: () => 'beta' })
            .registerCapability({
              id: 'after',
              revision: '1',
              effect: 'pure',
              invoke: () => 'after',
            })
            .registerContract(stringContract);
          const activated = await runtime.activate({
            id: 'fault-fork',
            entry: 'a',
            nodes: [
              { id: 'a', capability: 'first', timeoutMs: 30_000 },
              { id: 'f', kind: 'fork', join: 'j' },
              { id: 'x1', capability: 'b1' },
              { id: 'x2', capability: 'b2' },
              { id: 'j', kind: 'join', fork: 'f' },
              { id: 'z', capability: 'after' },
            ],
            edges: [
              { from: 'a', to: 'f' },
              { from: 'f', to: 'x1', kind: 'branch', key: 'a' },
              { from: 'f', to: 'x2', kind: 'branch', key: 'b' },
              { from: 'x1', to: 'j' },
              { from: 'x2', to: 'j' },
              { from: 'j', to: 'z' },
            ],
          });
          expect(activated.ok).toBe(true);
          const activationVersion = (activated as { ok: true; activationVersion: string })
            .activationVersion;
          const storedActivation = await stores.catalog.get(activationVersion);
          const manifest = JSON.parse(storedActivation!.canonicalManifest) as {
            graphId: string;
            graphVersion: string;
            capabilitySetVersion: string;
          };
          const orchestration = stores.orchestration as unknown as OrchestrationStore;
          const forkContinuation = {
            kind: 'fork' as const,
            joinId: 'j',
            children: [
              { branchKey: 'a', toNodeId: 'x1', forkId: 'f', lineage: 'a', tokenId: 'tok_fork_a' },
              { branchKey: 'b', toNodeId: 'x2', forkId: 'f', lineage: 'b', tokenId: 'tok_fork_b' },
            ],
          };
          await orchestration.createOrchestrationRun({
            runId: 'run_fault_fork',
            graphId: manifest.graphId,
            graphVersion: manifest.graphVersion,
            capabilitySetVersion: manifest.capabilitySetVersion,
            activationVersion,
            mode: 'normal',
            retention: 'summary',
            rootTokenId: 'tok_fork_root',
            entryNodeId: 'a',
            checkpoint: 'seed',
            events: [],
            now: Date.now(),
          });
          const claim1 = await orchestration.claimReadyToken({
            runId: 'run_fault_fork',
            ownerId: 'owner-a',
            leaseExpiresAt: Date.now() + 60_000,
            now: Date.now(),
            planner: rawPlanner,
          });
          expect(claim1.claimed).toBe(true);
          const c1 = (
            claim1 as {
              claim: { attempt: { attemptId: string; fence: number }; token: { tokenId: string } };
            }
          ).claim;
          await orchestration.completeAttempt({
            runId: 'run_fault_fork',
            attemptId: c1.attempt.attemptId,
            ownerId: 'owner-a',
            expectedAttemptFence: c1.attempt.fence,
            now: Date.now(),
            outcome: { kind: 'completed', outputSummary: { shape: 'string', length: 4 } },
            continuation: { kind: 'advance', toNodeId: 'f', payload: 'seed' },
            events: [],
            run: { status: 'running', steps: 1 },
            checkpoint: { tokenId: c1.token.tokenId, payload: 'seed' },
          });
          // Fault the FORK completion: the compound child-creation rolls back.
          targets[0]!.armed = true;
          const claim2 = await orchestration.claimReadyToken({
            runId: 'run_fault_fork',
            ownerId: 'owner-a',
            leaseExpiresAt: Date.now() + 60_000,
            now: Date.now(),
            planner: rawPlanner,
          });
          expect(claim2.claimed).toBe(true);
          const c2 = (claim2 as { claim: { attempt: { attemptId: string; fence: number } } }).claim;
          await expect(
            orchestration.completeAttempt({
              runId: 'run_fault_fork',
              attemptId: c2.attempt.attemptId,
              ownerId: 'owner-a',
              expectedAttemptFence: c2.attempt.fence,
              now: Date.now(),
              outcome: { kind: 'completed', outputSummary: { shape: 'string', length: 4 } },
              continuation: forkContinuation,
              events: [],
              run: { status: 'running', steps: 2 },
            }),
          ).rejects.toThrow();
          // No half-state: no child tokens, no fork membership.
          const snapshot = await orchestration.getOrchestrationSnapshot('run_fault_fork');
          expect((snapshot?.tokens ?? []).filter((token) => token.forkId === 'f').length).toBe(0);
          // Clean retry: the fork fans out exactly once.
          targets[0]!.armed = false;
          await orchestration.completeAttempt({
            runId: 'run_fault_fork',
            attemptId: c2.attempt.attemptId,
            ownerId: 'owner-a',
            expectedAttemptFence: c2.attempt.fence,
            now: Date.now(),
            outcome: { kind: 'completed', outputSummary: { shape: 'string', length: 4 } },
            continuation: forkContinuation,
            events: [],
            run: { status: 'running', steps: 2 },
            childCheckpoints: [
              { tokenId: 'tok_fork_a', payload: 'seed' },
              { tokenId: 'tok_fork_b', payload: 'seed' },
            ],
          });
          const after = await orchestration.getOrchestrationSnapshot('run_fault_fork');
          expect((after?.tokens ?? []).filter((token) => token.forkId === 'f').length).toBe(2);
        } finally {
          await stores.dispose();
        }
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );

  it(
    'a final-join fault records no join token; the retry rejoins exactly once',
    { timeout: 60_000 },
    async () => {
      const dir = await mkdtemp(join(tmpdir(), 'vict-fault-finaljoin-'));
      try {
        const targets: FaultTarget[] = [
          {
            operation: 'orchestration.completeAttempt',
            hook: 'beforeCommit',
            armed: false,
            hitCount: 0,
          },
        ];
        const stores = createSqliteStores({
          path: join(dir, 'finaljoin.db'),
          faults: faultSwitch(targets),
        });
        try {
          const runtime = createRuntime({ stores });
          runtime
            .registerCapability({ id: 'first', revision: '1', effect: 'pure', invoke: () => 'one' })
            .registerCapability({ id: 'b1', revision: '1', effect: 'pure', invoke: () => 'alpha' })
            .registerCapability({ id: 'b2', revision: '1', effect: 'pure', invoke: () => 'beta' })
            .registerCapability({
              id: 'after',
              revision: '1',
              effect: 'pure',
              invoke: () => 'after',
            })
            .registerContract(stringContract);
          const activated = await runtime.activate({
            id: 'fault-finaljoin',
            entry: 'a',
            nodes: [
              { id: 'a', capability: 'first', timeoutMs: 30_000 },
              { id: 'f', kind: 'fork', join: 'j' },
              { id: 'x1', capability: 'b1' },
              { id: 'x2', capability: 'b2' },
              { id: 'j', kind: 'join', fork: 'f', output: 'fault-string' },
              { id: 'z', capability: 'after' },
            ],
            edges: [
              { from: 'a', to: 'f' },
              { from: 'f', to: 'x1', kind: 'branch', key: 'a' },
              { from: 'f', to: 'x2', kind: 'branch', key: 'b' },
              { from: 'x1', to: 'j' },
              { from: 'x2', to: 'j' },
              { from: 'j', to: 'z' },
            ],
          });
          expect(activated.ok).toBe(true);
          const activationVersion = (activated as { ok: true; activationVersion: string })
            .activationVersion;
          const storedActivation = await stores.catalog.get(activationVersion);
          const manifest = JSON.parse(storedActivation!.canonicalManifest) as {
            graphId: string;
            graphVersion: string;
            capabilitySetVersion: string;
          };
          const orchestration = stores.orchestration as unknown as OrchestrationStore;
          await orchestration.createOrchestrationRun({
            runId: 'run_fault_fj',
            graphId: manifest.graphId,
            graphVersion: manifest.graphVersion,
            capabilitySetVersion: manifest.capabilitySetVersion,
            activationVersion,
            mode: 'normal',
            retention: 'summary',
            rootTokenId: 'tok_fj_root',
            entryNodeId: 'a',
            checkpoint: 'seed',
            events: [],
            now: Date.now(),
          });
          const forkContinuation = {
            kind: 'fork' as const,
            joinId: 'j',
            children: [
              { branchKey: 'a', toNodeId: 'x1', forkId: 'f', lineage: 'a', tokenId: 'tok_fj_a' },
              { branchKey: 'b', toNodeId: 'x2', forkId: 'f', lineage: 'b', tokenId: 'tok_fj_b' },
            ],
          };
          const arrival = (branchKey: string, tokenId: string) => ({
            kind: 'branchArrival' as const,
            forkId: 'f',
            joinId: 'j',
            branchKey,
            joinContinuation: { tokenId: 'tok_fj_join', toNodeId: 'j', lineage: '' },
          });
          // Entry advance to the fork.
          const c1 = await orchestration.claimReadyToken({
            runId: 'run_fault_fj',
            ownerId: 'owner-a',
            leaseExpiresAt: Date.now() + 60_000,
            now: Date.now(),
            planner: rawPlanner,
          });
          const cc1 = (
            c1 as {
              claim: { attempt: { attemptId: string; fence: number }; token: { tokenId: string } };
            }
          ).claim;
          await orchestration.completeAttempt({
            runId: 'run_fault_fj',
            attemptId: cc1.attempt.attemptId,
            ownerId: 'owner-a',
            expectedAttemptFence: cc1.attempt.fence,
            now: Date.now(),
            outcome: { kind: 'completed', outputSummary: { shape: 'string', length: 4 } },
            continuation: { kind: 'advance', toNodeId: 'f', payload: 'seed' },
            events: [],
            run: { status: 'running', steps: 1 },
            checkpoint: { tokenId: cc1.token.tokenId, payload: 'seed' },
          });
          // Fork completion creates the two branch children.
          const c2 = await orchestration.claimReadyToken({
            runId: 'run_fault_fj',
            ownerId: 'owner-a',
            leaseExpiresAt: Date.now() + 60_000,
            now: Date.now(),
            planner: rawPlanner,
          });
          const cc2 = (c2 as { claim: { attempt: { attemptId: string; fence: number } } }).claim;
          await orchestration.completeAttempt({
            runId: 'run_fault_fj',
            attemptId: cc2.attempt.attemptId,
            ownerId: 'owner-a',
            expectedAttemptFence: cc2.attempt.fence,
            now: Date.now(),
            outcome: { kind: 'completed', outputSummary: { shape: 'string', length: 4 } },
            continuation: forkContinuation,
            events: [],
            run: { status: 'running', steps: 2 },
            childCheckpoints: [
              { tokenId: 'tok_fj_a', payload: 'seed' },
              { tokenId: 'tok_fj_b', payload: 'seed' },
            ],
          });
          // Branch 'a' arrives (non-final).
          const a1 = await orchestration.claimReadyToken({
            runId: 'run_fault_fj',
            ownerId: 'owner-a',
            leaseExpiresAt: Date.now() + 60_000,
            now: Date.now(),
            planner: rawPlanner,
          });
          const ca1 = (
            a1 as {
              claim: { attempt: { attemptId: string; fence: number }; token: { tokenId: string } };
            }
          ).claim;
          await orchestration.completeAttempt({
            runId: 'run_fault_fj',
            attemptId: ca1.attempt.attemptId,
            ownerId: 'owner-a',
            expectedAttemptFence: ca1.attempt.fence,
            now: Date.now(),
            outcome: { kind: 'completed', outputSummary: { shape: 'string', length: 5 } },
            continuation: arrival('a', ca1.token.tokenId),
            events: [],
            run: { status: 'running', steps: 3 },
            removeCheckpoints: [ca1.token.tokenId],
            branchOutput: 'alpha',
            declaredBranchKeys: ['a', 'b'],
          });
          // Branch 'b' arrives (final) — the fault hits the join firing.
          targets[0]!.armed = true;
          const b1 = await orchestration.claimReadyToken({
            runId: 'run_fault_fj',
            ownerId: 'owner-a',
            leaseExpiresAt: Date.now() + 60_000,
            now: Date.now(),
            planner: rawPlanner,
          });
          const cb1 = (
            b1 as unknown as {
              claim: {
                attempt: { attemptId: string; fence: number };
                token: { tokenId: string };
              };
            }
          ).claim;
          await expect(
            orchestration.completeAttempt({
              runId: 'run_fault_fj',
              attemptId: cb1.attempt.attemptId,
              ownerId: 'owner-a',
              expectedAttemptFence: cb1.attempt.fence,
              now: Date.now(),
              outcome: { kind: 'completed', outputSummary: { shape: 'string', length: 4 } },
              continuation: arrival('b', cb1.token.tokenId),
              events: [],
              run: { status: 'running', steps: 4 },
              removeCheckpoints: [cb1.token.tokenId],
              branchOutput: 'beta',
              declaredBranchKeys: ['a', 'b'],
            }),
          ).rejects.toThrow();
          // No half-state: branch 'b' result NOT recorded, no join token.
          const snapshot = await orchestration.getOrchestrationSnapshot('run_fault_fj');
          expect(snapshot?.branchResults.length).toBe(1);
          expect((snapshot?.tokens ?? []).some((token) => token.tokenId === 'tok_fj_join')).toBe(
            false,
          );
          // Clean retry (same command): the join fires exactly once.
          targets[0]!.armed = false;
          const joinFired = await orchestration.completeAttempt({
            runId: 'run_fault_fj',
            attemptId: cb1.attempt.attemptId,
            ownerId: 'owner-a',
            expectedAttemptFence: cb1.attempt.fence,
            now: Date.now(),
            outcome: { kind: 'completed', outputSummary: { shape: 'string', length: 4 } },
            continuation: arrival('b', cb1.token.tokenId),
            events: [],
            run: { status: 'running', steps: 4 },
            removeCheckpoints: [cb1.token.tokenId],
            branchOutput: 'beta',
            declaredBranchKeys: ['a', 'b'],
          });
          expect(joinFired.joinFired).toBe(true);
          const after = await orchestration.getOrchestrationSnapshot('run_fault_fj');
          expect(after?.tokens.some((token) => token.tokenId === 'tok_fj_join')).toBe(true);
          // A duplicate final arrival is rejected (membership already complete).
          await expect(
            orchestration.completeAttempt({
              runId: 'run_fault_fj',
              attemptId: cb1.attempt.attemptId,
              ownerId: 'owner-a',
              expectedAttemptFence: cb1.attempt.fence,
              now: Date.now(),
              outcome: { kind: 'completed', outputSummary: { shape: 'string', length: 4 } },
              continuation: arrival('b', cb1.token.tokenId),
              events: [],
              run: { status: 'running', steps: 5 },
              removeCheckpoints: [cb1.token.tokenId],
              branchOutput: 'beta',
              declaredBranchKeys: ['a', 'b'],
            }),
          ).rejects.toThrow();
        } finally {
          await stores.dispose();
        }
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );
  it('retry timers survive close/reopen and fire exactly once', { timeout: 60_000 }, async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vict-retry-reopen-'));
    try {
      const db = join(dir, 'retry.db');
      // Phase 1: a keyed-write capability fails (throws) on attempt 1 with a
      // retry policy; the durable retry timer is scheduled.
      {
        const stores = createSqliteStores({ path: db });
        const runtime = createRuntime({ stores });
        let calls = 0;
        runtime.registerCapability({
          id: 'flakyWrite',
          revision: '1',
          effect: 'write',
          idempotency: 'keyed',
          invoke: (input: unknown, context) => {
            if (calls === 0) {
              calls += 1;
              throw new Error('transient');
            }
            void context;
            return `ok:${String(input)}`;
          },
        });
        runtime.registerCapability({
          id: 'flaky',
          revision: '1',
          effect: 'pure',
          invoke: (input: unknown, context) => {
            if (calls === 0) {
              calls += 1;
              void context;
              throw new Error('transient');
            }
            return `ok:${String(input)}`;
          },
        });
        runtime.registerContract(stringContract);
        const activated = await runtime.activate({
          id: 'retry-reopen',
          entry: 'w',
          nodes: [
            {
              id: 'w',
              capability: 'flaky',
              timeoutMs: 30_000,
              retry: {
                maxAttempts: 3,
                retryOn: ['VICT_RUNTIME_CAPABILITY_THREW'],
                backoff: { kind: 'fixed', delayMs: 500 },
              },
            },
          ],
          edges: [],
        });
        expect(activated.ok).toBe(true);
        const parked = await runtime.run('seed');
        // The retry timer is durable; the run pauses until it is pumped.
        expect(parked.status).toBe('running');
        await stores.dispose();
      }
      // Phase 2: reopen in a fresh process model; the timer is still there
      // and fires exactly once.
      {
        const stores = createSqliteStores({ path: db });
        const runtime = createRuntime({ stores });
        let calls = 0;
        runtime.registerCapability({
          id: 'flaky',
          revision: '1',
          effect: 'pure',
          invoke: (input: unknown) => {
            calls += 1;
            return `ok:${String(input)}`;
          },
        });
        await settle(550); // the 500ms backoff elapses while offline
        const pumped = await runtime.processDueTimers({});
        expect(pumped.fired).toBe(1);
        const runs = await (
          stores.orchestration as unknown as OrchestrationStore
        ).listOrchestrationRuns({});
        const final = await runtime.resumeRun(runs[0]!.runId);
        expect(final.status).toBe('completed');
        expect(final.output).toBe('ok:seed');
        const events = await (
          stores.orchestration as unknown as OrchestrationStore
        ).listOrchestrationEvents(runs[0]!.runId);
        expect(events.filter((event) => event.type === 'node.retry_scheduled').length).toBe(1);
        expect(events.filter((event) => event.type === 'timer.fired').length).toBe(1);
        await stores.dispose();
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it(
    'exact activation across suspension: full sequence survives close/reopen and blocks without artifacts',
    { timeout: 120_000 },
    async () => {
      const dir = await mkdtemp(join(tmpdir(), 'vict-exact-reopen-'));
      try {
        const db = join(dir, 'activation.db');
        const waitGraph = {
          id: 'exact-reopen',
          entry: 'a',
          nodes: [
            { id: 'a', capability: 'first' },
            {
              id: 'w',
              kind: 'wait',
              wait: { kind: 'signal', name: 'go', contract: 'fault-string' },
            },
            { id: 'b', capability: 'second', output: 'fault-string' },
          ],
          edges: [
            { from: 'a', to: 'w' },
            { from: 'w', to: 'b' },
          ],
        };
        const registerA = (rt: ReturnType<typeof createRuntime>): void => {
          rt.registerCapability({ id: 'first', revision: '1', effect: 'pure', invoke: () => 'one' })
            .registerCapability({
              id: 'second',
              revision: '1',
              effect: 'pure',
              invoke: (input: unknown) => `got:${String(input)}`,
            })
            .registerContract(stringContract);
        };
        // Steps 1–5: activate A; suspend a run; publish/select B; new runs use
        // B; resume the suspended run to completion using ONLY A's semantics.
        {
          const stores = createSqliteStores({ path: db });
          const runtime = createRuntime({ stores });
          registerA(runtime);
          const activatedA = await runtime.activate(waitGraph as never);
          expect(activatedA.ok).toBe(true);
          const activationA = (activatedA as { ok: true; activationVersion: string })
            .activationVersion;
          const parked = await runtime.run('seed');
          expect(parked.status).toBe('waiting');
          expect(parked.activationVersion).toBe(activationA);
          runtime.registerCapability({
            id: 'first',
            revision: '2',
            effect: 'pure',
            invoke: () => 'one-v2',
          });
          const activatedB = await runtime.activate(waitGraph as never);
          expect(activatedB.ok).toBe(true);
          const activationB = (activatedB as { ok: true; activationVersion: string })
            .activationVersion;
          expect(activationB).not.toBe(activationA);
          const fresh = await runtime.run('seed');
          expect(fresh.activationVersion).toBe(activationB);
          await runtime.signal({
            runId: parked.runId,
            waitId: parked.waits?.[0]?.waitId as string,
            signalId: 'exact-sig-1',
            signalName: 'go',
            payload: 'resumed',
          });
          const final = await runtime.resumeRun(parked.runId);
          expect(final.status).toBe('completed');
          expect(final.output).toBe('got:resumed'); // A's semantics, never B's
          await stores.dispose();
        }
        // Step 6: restart with both artifacts — a fresh suspended run resumes
        // exactly under its pinned activation across close/reopen.
        {
          const stores = createSqliteStores({ path: db });
          const runtime = createRuntime({ stores });
          runtime
            .registerCapability({ id: 'first', revision: '1', effect: 'pure', invoke: () => 'one' })
            .registerCapability({
              id: 'first',
              revision: '2',
              effect: 'pure',
              invoke: () => 'one-v2',
            })
            .registerCapability({
              id: 'second',
              revision: '1',
              effect: 'pure',
              invoke: (input: unknown) => `got2:${String(input)}`,
            })
            .registerContract(stringContract);
          const activated = await runtime.activate(waitGraph as never);
          expect(activated.ok).toBe(true);
          const suspended = await runtime.run('seed');
          expect(suspended.status).toBe('waiting');
          await stores.dispose();

          const stores2 = createSqliteStores({ path: db });
          const runtime2 = createRuntime({ stores: stores2 });
          runtime2
            .registerCapability({ id: 'first', revision: '1', effect: 'pure', invoke: () => 'one' })
            .registerCapability({
              id: 'first',
              revision: '2',
              effect: 'pure',
              invoke: () => 'one-v2',
            })
            .registerCapability({
              id: 'second',
              revision: '1',
              effect: 'pure',
              invoke: (input: unknown) => `got2:${String(input)}`,
            })
            .registerContract(stringContract);
          const sig = await runtime2.signal({
            runId: suspended.runId,
            waitId: suspended.waits?.[0]?.waitId as string,
            signalId: 'exact-sig-2',
            signalName: 'go',
            payload: 'resumed',
          });
          expect(sig.ok).toBe(true);
          const final = await runtime2.resumeRun(suspended.runId);
          expect(final.status).toBe('completed');
          expect(final.output).toBe('got2:resumed'); // the pinned activation's semantics
          await stores2.dispose();
        }
        // Steps 7–8: restart WITHOUT the pinned artifacts — the suspended run
        // blocks safely and the newer activation is never substituted.
        {
          const stores = createSqliteStores({ path: db });
          const runtime = createRuntime({ stores });
          runtime
            .registerCapability({
              id: 'first',
              revision: '2',
              effect: 'pure',
              invoke: () => 'one-v2',
            })
            .registerCapability({
              id: 'second',
              revision: '1',
              effect: 'pure',
              invoke: (input: unknown) => `got2:${String(input)}`,
            })
            .registerContract(stringContract);
          // Suspend a run under a dedicated A activation, then drop its
          // artifacts entirely.
          const storesWithA = createSqliteStores({ path: db });
          const runtimeWithA = createRuntime({ stores: storesWithA });
          registerA(runtimeWithA);
          const activatedA = await runtimeWithA.activate(waitGraph as never);
          expect(activatedA.ok).toBe(true);
          const suspended = await runtimeWithA.run('seed');
          expect(suspended.status).toBe('waiting');
          await storesWithA.dispose();
          // Resume must fail closed with a structured unavailable error and
          // the newer activation must never be substituted.
          await expect(runtime.resumeRun(suspended.runId)).rejects.toThrow();
          const run = await (
            stores.orchestration as unknown as OrchestrationStore
          ).getOrchestrationRun(suspended.runId);
          expect(run?.status).toBe('waiting'); // parked, unharmed, no substitute
          await stores.dispose();
        }
      } finally {
        for (let attempt = 0; attempt < 10; attempt++) {
          try {
            await rm(dir, { recursive: true, force: true });
            break;
          } catch {
            await settle(500);
          }
        }
      }
    },
  );
});
