import {
  canonicalJoinOutput,
  canTransitionAttempt,
  canTransitionRun,
  canTransitionToken,
  type BranchResultRecord,
  type DurableAttemptState,
  type DurableTokenState,
  type DurableWaitState,
  type KernelEvent,
  type OutputSummary,
  type SignalReceiptRecord,
} from '@vict/kernel';
import type { VictError } from '@vict/contracts';
import type {
  CompleteAttemptCommand,
  CancellationResult,
  ClaimDueTimersResult,
  ClaimedAttempt,
  ClaimReadyTokenCommand,
  ClaimReadyTokenResult,
  CompleteAttemptResult,
  DueTimerRecord,
  OrchestrationFaultHooks,
  OrchestrationRunQuery,
  OrchestrationSnapshotView,
  OrchestrationStore,
  RecoverableClaim,
  RecoverOrchestrationCommand,
  ResolveBlockedResult,
  ResolveDueTimerResult,
  SignalDeliveryResult,
  OrchestrationEventInput,
  StoredOrchestrationRun,
  TimerRecord,
} from './orchestration-store-types.js';
import { VictStoreError } from './store-errors.js';
import { canonicalPersistedValue, immutableSnapshot } from './serialization.js';
import { assertEventMatchesRun } from './store-validation.js';

/**
 * Conforming in-memory implementation of the Stage 03 durable orchestration
 * store port. Semantics match the SQLite adapter: atomic semantic
 * transitions, optimistic revisions/fences, deterministic ready-work
 * selection, idempotent signal/cancel/resolution commands, the private
 * operational checkpoint boundary, and immutable read snapshots.
 *
 * The private operational checkpoint payload rides on the internal token
 * record and is stripped from every public read (OrchestrationSnapshotView
 * exposes tokens WITHOUT payloads; only `claimReadyToken` returns the
 * claimed token's checkpoint, and branch outputs are exposed only through
 * the driver-facing snapshot's private `branchOutputs` field).
 */
export interface OrchestrationInMemoryOptions {
  readonly faults?: OrchestrationFaultHooks;
}

type Writable<T> = { -readonly [K in keyof T]: T[K] };

type InternalToken = Writable<DurableTokenState> & { checkpoint?: unknown };
type InternalAttempt = Writable<DurableAttemptState>;
type InternalWait = Writable<DurableWaitState>;
type InternalTimer = Writable<TimerRecord>;

interface InternalRun {
  run: StoredOrchestrationRun;
  tokens: Map<string, InternalToken>;
  attempts: Map<string, InternalAttempt>;
  waits: Map<string, InternalWait>;
  timers: Map<string, InternalTimer>;
  branchResults: BranchResultRecord[];
  /** Private operational branch-output payloads keyed forkId → branchKey → payload. */
  branchOutputs: Map<string, Map<string, unknown>>;
  signalReceipts: Map<string, SignalReceiptRecord>;
  cancellationRequests: Map<string, { requestId: string; reasonCode: string; commandHash: string }>;
  resolutionRequests: Map<string, { resolutionId: string; commandHash: string }>;
  events: KernelEvent[];
}

function wrap(cause: unknown, operation: string, runId?: string): VictStoreError {
  if (cause instanceof VictStoreError) {
    return cause;
  }
  return new VictStoreError(
    'VICT_STORE_UNAVAILABLE',
    'The storage operation failed and the transition was not committed.',
    { operation, runId },
    cause,
  );
}

function stripCheckpoint(token: InternalToken): DurableTokenState {
  const { checkpoint, ...rest } = token;
  void checkpoint;
  return rest;
}

/** Deterministic ready-token order: creation instant, then token id. */
function readyOrder(tokens: Iterable<InternalToken>): InternalToken[] {
  return [...tokens]
    .filter((token) => token.status === 'ready')
    .sort(
      (a, b) =>
        a.createdAt - b.createdAt || (a.tokenId < b.tokenId ? -1 : a.tokenId > b.tokenId ? 1 : 0),
    );
}

function nextEventSeq(stored: { events: readonly KernelEvent[] }): number {
  const last = stored.events.at(-1);
  return last === undefined ? 0 : last.seq + 1;
}

export function createInMemoryOrchestrationStore(
  options: OrchestrationInMemoryOptions = {},
): OrchestrationStore {
  const faults = options.faults;
  const runs = new Map<string, InternalRun>();

  const requireRun = (runId: string, operation: string): InternalRun => {
    const found = runs.get(runId);
    if (!found) {
      throw new VictStoreError('VICT_STORE_RUN_NOT_FOUND', 'Run not found.', { operation, runId });
    }
    return found;
  };

  /** Append the ordered safe events with dense sequence numbers (validated against the run identity). */
  const appendEvents = (
    stored: InternalRun,
    events: readonly OrchestrationEventInput[],
  ): number => {
    let seq = nextEventSeq(stored);
    for (const event of events) {
      const full = { ...event, seq } as KernelEvent;
      assertEventMatchesRun(full, stored.run);
      stored.events.push(full);
      seq += 1;
    }
    return seq;
  };

  const stageCheckpoint = (run: InternalRun, tokenId: string, payload: unknown): void => {
    // Private operational boundary: validate against the persisted-value
    // domain and canonicalize before it becomes durable.
    const validated = canonicalPersistedValue(payload);
    const token = run.tokens.get(tokenId);
    if (!token) {
      throw new VictStoreError(
        'VICT_STORE_INVALID_COMMAND',
        'A checkpoint references an unknown token.',
        { operation: 'orchestration.checkpoint', runId: run.run.runId, tokenId },
      );
    }
    token.checkpoint = validated;
  };

  const derive = (stored: InternalRun): OrchestrationSnapshotView => {
    const branchOutputs: Record<string, Record<string, unknown>> = {};
    for (const [forkId, byKey] of stored.branchOutputs) {
      branchOutputs[forkId] = Object.fromEntries(byKey);
    }
    return immutableSnapshot({
      run: stored.run,
      tokens: [...stored.tokens.values()].map(stripCheckpoint),
      attempts: [...stored.attempts.values()],
      waits: [...stored.waits.values()],
      timers: [...stored.timers.values()],
      branchResults: [...stored.branchResults],
      branchOutputs,
      nextEventSeq: nextEventSeq(stored),
    }) as unknown as OrchestrationSnapshotView;
  };

  const store: OrchestrationStore = {
    async createOrchestrationRun(command): Promise<StoredOrchestrationRun> {
      if (runs.has(command.runId)) {
        throw new VictStoreError('VICT_STORE_RUN_CONFLICT', 'A run with this id already exists.', {
          operation: 'orchestration.createRun',
          runId: command.runId,
        });
      }
      const now = command.now;
      const rootToken: InternalToken = {
        tokenId: command.rootTokenId,
        runId: command.runId,
        activationVersion: command.activationVersion,
        nodeId: command.entryNodeId,
        status: 'ready',
        parentTokenId: null,
        lineage: '',
        forkId: null,
        branchKey: null,
        revision: 1,
        createdAt: now,
        updatedAt: now,
      };
      const stored: InternalRun = {
        run: {
          runId: command.runId,
          graphId: command.graphId,
          graphVersion: command.graphVersion,
          capabilitySetVersion: command.capabilitySetVersion,
          activationVersion: command.activationVersion,
          status: 'running',
          mode: command.mode,
          retention: command.retention,
          steps: 0,
          currentNodeId: command.entryNodeId,
          recordRevision: 1,
          cancellation: null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        },
        tokens: new Map([[command.rootTokenId, rootToken]]),
        attempts: new Map(),
        waits: new Map(),
        timers: new Map(),
        branchResults: [],
        branchOutputs: new Map(),
        signalReceipts: new Map(),
        cancellationRequests: new Map(),
        resolutionRequests: new Map(),
        events: [],
      };
      runs.set(command.runId, stored);
      try {
        stageCheckpoint(stored, command.rootTokenId, command.checkpoint);
        appendEvents(stored, command.events);
        faults?.afterStateStage?.('orchestration.createRun');
        faults?.beforeCommit?.('orchestration.createRun');
        return immutableSnapshot(stored.run);
      } catch (cause) {
        runs.delete(command.runId);
        throw wrap(cause, 'orchestration.createRun', command.runId);
      }
    },

    async getOrchestrationRun(runId) {
      const stored = runs.get(runId);
      return stored ? immutableSnapshot(stored.run) : undefined;
    },

    async listOrchestrationRuns(query: OrchestrationRunQuery = {}) {
      const all = [...runs.values()]
        .map((entry) => entry.run)
        .filter(
          (run) =>
            (query.graphId === undefined || run.graphId === query.graphId) &&
            (query.activationVersion === undefined ||
              run.activationVersion === query.activationVersion) &&
            (query.status === undefined || run.status === query.status),
        )
        .sort((a, b) => a.createdAt - b.createdAt);
      const limited =
        query.limit !== undefined ? all.slice(0, Math.max(0, Math.floor(query.limit))) : all;
      return limited.map((run) => immutableSnapshot(run));
    },

    async getOrchestrationSnapshot(runId) {
      const stored = runs.get(runId);
      return stored ? derive(stored) : undefined;
    },

    async claimReadyToken(command: ClaimReadyTokenCommand): Promise<ClaimReadyTokenResult> {
      const stored = requireRun(command.runId, 'orchestration.claimReadyToken');
      const run = stored.run;
      if (run.status !== 'running' && run.status !== 'waiting') {
        return { claimed: false, reason: run.status === 'blocked' ? 'quiescent' : 'terminal' };
      }
      if (run.cancellation !== null) {
        return { claimed: false, reason: 'cancelled' };
      }
      const token = readyOrder(stored.tokens.values())[0];
      if (!token) {
        return { claimed: false, reason: 'quiescent' };
      }
      if (!canTransitionToken(token.status, 'claimed')) {
        return { claimed: false, reason: 'conflict' };
      }
      const plan = command.planner.planFor(token);
      const invocationId = command.planner.invocationIdFor(token);
      const attemptNumber =
        [...stored.attempts.values()].filter((candidate) => candidate.invocationId === invocationId)
          .length + 1;
      const attemptId = command.planner.attemptIdFor(token, attemptNumber);
      const now = command.now;

      const previousRun = stored.run;
      const previousStatus = token.status;
      const previousRevision = token.revision;
      const previousUpdatedAt = token.updatedAt;
      const attempt: DurableAttemptState = {
        attemptId,
        invocationId,
        runId: command.runId,
        tokenId: token.tokenId,
        nodeId: token.nodeId,
        capabilityId: plan.capabilityId,
        attemptNumber,
        effectClass: plan.effectClass,
        idempotencyKey: plan.idempotencyKey,
        state: 'started',
        ownerId: command.ownerId,
        leaseExpiresAt: command.leaseExpiresAt,
        deadlineAt: plan.deadlineAt,
        fence: attemptNumber,
        retryDueAt: null,
        createdAt: now,
        updatedAt: now,
      };
      stored.attempts.set(attemptId, attempt);
      token.status = 'claimed';
      token.revision += 1;
      token.updatedAt = now;
      stored.run = {
        ...stored.run,
        status: 'running',
        steps: stored.run.steps + 1,
        currentNodeId: token.nodeId,
        recordRevision: stored.run.recordRevision + 1,
        updatedAt: now,
      };
      try {
        appendEvents(stored, [
          {
            type: 'node.started',
            nodeId: token.nodeId,
            capabilityId: plan.capabilityId,
            runId: command.runId,
            graphId: stored.run.graphId,
            graphVersion: stored.run.graphVersion,
            capabilitySetVersion: stored.run.capabilitySetVersion,
            activationVersion: stored.run.activationVersion,
            timestamp: now,
          },
        ]);
        faults?.afterStateStage?.('orchestration.claimReadyToken');
        faults?.beforeCommit?.('orchestration.claimReadyToken');
        const claimed: ClaimedAttempt = {
          token: immutableSnapshot(stripCheckpoint(token)),
          attempt: immutableSnapshot(attempt),
          invocationId,
          checkpoint:
            token.checkpoint === undefined
              ? undefined
              : (structuredClone(token.checkpoint) as unknown),
          deadlineAt: plan.deadlineAt,
          idempotencyKey: plan.idempotencyKey,
          runRecordRevision: stored.run.recordRevision,
          runNextEventSeq: nextEventSeq(stored),
        };
        return { claimed: true, claim: claimed };
      } catch (cause) {
        stored.attempts.delete(attemptId);
        stored.run = previousRun;
        token.status = previousStatus;
        token.revision = previousRevision;
        token.updatedAt = previousUpdatedAt;
        throw wrap(cause, 'orchestration.claimReadyToken', command.runId);
      }
    },

    async completeAttempt(command): Promise<CompleteAttemptResult> {
      const stored = requireRun(command.runId, 'orchestration.completeAttempt');
      const attempt = stored.attempts.get(command.attemptId);
      if (!attempt) {
        throw new VictStoreError('VICT_STORE_INVALID_COMMAND', 'Unknown attempt.', {
          operation: 'orchestration.completeAttempt',
          runId: command.runId,
          attemptId: command.attemptId,
        });
      }
      if (attempt.fence !== command.expectedAttemptFence || attempt.ownerId !== command.ownerId) {
        throw new VictStoreError(
          'VICT_STORE_ATTEMPT_FENCE_CONFLICT',
          'The attempt completion carries a stale owner or fence.',
          {
            operation: 'orchestration.completeAttempt',
            runId: command.runId,
            attemptId: command.attemptId,
            expectedFence: command.expectedAttemptFence,
            actualFence: attempt.fence,
          },
        );
      }
      if (!canTransitionAttempt(attempt.state, outcomeState(command.outcome))) {
        throw new VictStoreError(
          'VICT_STORE_ATTEMPT_STATE_CONFLICT',
          `Attempt '${command.attemptId}' is in state '${attempt.state}' and cannot accept this outcome.`,
          {
            operation: 'orchestration.completeAttempt',
            runId: command.runId,
            attemptId: command.attemptId,
            state: attempt.state,
          },
        );
      }
      const token = stored.tokens.get(attempt.tokenId);
      if (!token) {
        throw new VictStoreError(
          'VICT_STORE_INVALID_COMMAND',
          'The attempt references an unknown token.',
          {
            operation: 'orchestration.completeAttempt',
            runId: command.runId,
            attemptId: command.attemptId,
          },
        );
      }
      if (
        command.run.status !== undefined &&
        !canTransitionRun(stored.run.status, command.run.status)
      ) {
        throw new VictStoreError(
          'VICT_STORE_RUN_CONFLICT',
          `Run status '${stored.run.status}' cannot transition to '${command.run.status}'.`,
          { operation: 'orchestration.completeAttempt', runId: command.runId },
        );
      }

      const now = command.now;
      const previousRun = stored.run;
      const previousAttemptState = attempt.state;
      const previousToken: InternalToken = { ...token };
      const previousChildTokens: InternalToken[] = [];
      const previousSiblingTokens: { token: InternalToken; status: DurableTokenState['status'] }[] =
        [];
      const previousWaits: { wait: InternalWait; status: DurableWaitState['status'] }[] = [];
      const previousTimers: { timer: InternalTimer; status: TimerRecord['status'] }[] = [];
      const previousBranchOutputs = new Map(stored.branchOutputs);
      let joinFired = false;

      const outcomeStateValue =
        command.outcome.kind === 'completed'
          ? ('completed' as const)
          : command.outcome.kind === 'failed'
            ? ('failed' as const)
            : command.outcome.kind === 'timed_out'
              ? ('timed_out' as const)
              : command.outcome.kind === 'cancelled'
                ? ('cancelled' as const)
                : ('outcome_unknown' as const);

      try {
        // 1. Attempt outcome.
        attempt.state = outcomeStateValue;
        attempt.updatedAt = now;

        // 2. Token movement per continuation.
        const continuation = command.continuation;
        if (continuation.kind === 'advance') {
          token.nodeId = continuation.toNodeId;
          token.status = 'ready';
          token.revision += 1;
          token.updatedAt = now;
        } else if (continuation.kind === 'wait') {
          if (!canTransitionToken(token.status, 'waiting')) {
            throw new VictStoreError(
              'VICT_STORE_TOKEN_CONFLICT',
              `Token '${token.tokenId}' cannot wait from state '${token.status}'.`,
              { operation: 'orchestration.completeAttempt', runId: command.runId },
            );
          }
          const wait: DurableWaitState = {
            waitId: continuation.wait.waitId,
            runId: command.runId,
            tokenId: token.tokenId,
            nodeId: token.nodeId,
            activationVersion: stored.run.activationVersion,
            kind: continuation.wait.kind,
            signalName: continuation.wait.signalName,
            contractId: continuation.wait.contractId,
            contractRevision: continuation.wait.contractRevision,
            dueAt: continuation.wait.dueAt,
            timeoutAt: continuation.wait.timeoutAt,
            status: 'open',
            revision: 1,
            createdAt: now,
            resolvedAt: null,
            resolvedBy: null,
          };
          stored.waits.set(wait.waitId, wait);
          token.status = 'waiting';
          token.revision += 1;
          token.updatedAt = now;
          if (continuation.wait.dueAt !== null) {
            const timerId = `timer_${continuation.wait.waitId}`;
            stored.timers.set(timerId, {
              timerId,
              runId: command.runId,
              kind: 'wait',
              waitId: continuation.wait.waitId,
              attemptId: null,
              tokenId: token.tokenId,
              dueAt: continuation.wait.dueAt,
              status: 'scheduled',
              ownerId: null,
              leaseExpiresAt: null,
              revision: 1,
              createdAt: now,
            });
          }
          if (continuation.wait.timeoutAt !== null) {
            const timerId = `timer_timeout_${continuation.wait.waitId}`;
            stored.timers.set(timerId, {
              timerId,
              runId: command.runId,
              kind: 'wait-timeout',
              waitId: continuation.wait.waitId,
              attemptId: null,
              tokenId: token.tokenId,
              dueAt: continuation.wait.timeoutAt,
              status: 'scheduled',
              ownerId: null,
              leaseExpiresAt: null,
              revision: 1,
              createdAt: now,
            });
          }
        } else if (continuation.kind === 'fork') {
          token.status = 'completed';
          token.revision += 1;
          token.updatedAt = now;
          for (const child of continuation.children) {
            const childToken: InternalToken = {
              tokenId: child.tokenId as string,
              runId: command.runId,
              activationVersion: stored.run.activationVersion,
              nodeId: child.toNodeId,
              status: 'ready',
              parentTokenId: token.tokenId,
              lineage: child.lineage as string,
              forkId: continuation.joinId !== undefined ? (child.forkId as string) : child.forkId,
              branchKey: child.branchKey,
              revision: 1,
              createdAt: now,
              updatedAt: now,
            };
            previousChildTokens.push(childToken);
            stored.tokens.set(childToken.tokenId, childToken);
          }
        } else if (continuation.kind === 'branchArrival') {
          // The branch token is consumed: its result + output are recorded.
          token.status = 'completed';
          token.revision += 1;
          token.updatedAt = now;
          const arrival = continuation;
          stored.branchResults.push({
            runId: command.runId,
            forkId: arrival.forkId,
            joinId: arrival.joinId,
            branchKey: arrival.branchKey,
            tokenId: token.tokenId,
            failed: false,
            createdAt: now,
          });
          if (command.branchOutput !== undefined) {
            let byKey = stored.branchOutputs.get(arrival.forkId);
            if (!byKey) {
              byKey = new Map<string, unknown>();
              stored.branchOutputs.set(arrival.forkId, byKey);
            }
            byKey.set(arrival.branchKey, canonicalPersistedValue(command.branchOutput));
          }
          const completedKeys = new Set(
            stored.branchResults
              .filter((result) => result.forkId === arrival.forkId && !result.failed)
              .map((result) => result.branchKey),
          );
          const declared = command.declaredBranchKeys ?? [];
          if (declared.length > 0 && declared.every((key) => completedKeys.has(key))) {
            joinFired = true;
            // Final arrival: create exactly ONE join-ready token AT THE
            // JOIN NODE with the canonical (lexicographically sorted)
            // join output as its private checkpoint. The runtime claims
            // this token, validates the join's declared output contract
            // outside the store, and completes the join in one atomic
            // transition (advance downstream, terminal completion, or a
            // sanitized contract failure). This keeps author-controlled
            // parsers out of the persistence layer and makes terminal
            // joins (zero success edges) well-defined.
            if (arrival.joinContinuation !== undefined) {
              const joinPayload = canonicalJoinOutput(
                Object.fromEntries(stored.branchOutputs.get(arrival.forkId) ?? new Map()),
              );
              const postJoinToken: InternalToken = {
                tokenId: arrival.joinContinuation.tokenId,
                runId: command.runId,
                activationVersion: stored.run.activationVersion,
                nodeId: arrival.joinContinuation.toNodeId,
                status: 'ready',
                parentTokenId: null,
                lineage: arrival.forkId,
                forkId: null,
                branchKey: null,
                revision: 1,
                createdAt: now,
                updatedAt: now,
              };
              previousChildTokens.push(postJoinToken);
              stored.tokens.set(postJoinToken.tokenId, postJoinToken);
              stageCheckpoint(stored, postJoinToken.tokenId, joinPayload);
            }
          }
        } else if (continuation.kind === 'branchFailure') {
          token.status = 'completed';
          token.revision += 1;
          token.updatedAt = now;
          // Cancel every unfinished sibling branch token and close their waits.
          for (const other of stored.tokens.values()) {
            if (
              other.tokenId !== token.tokenId &&
              (other.status === 'ready' || other.status === 'claimed' || other.status === 'waiting')
            ) {
              previousSiblingTokens.push({ token: { ...other }, status: other.status });
              other.status = 'cancelled';
              other.revision += 1;
              other.updatedAt = now;
            }
          }
          for (const wait of stored.waits.values()) {
            if (wait.status === 'open') {
              previousWaits.push({ wait, status: wait.status });
              wait.status = 'cancelled';
              wait.revision += 1;
              wait.resolvedAt = now;
              wait.resolvedBy = command.attemptId;
            }
          }
          for (const timer of stored.timers.values()) {
            if (timer.status === 'scheduled') {
              previousTimers.push({ timer, status: timer.status });
              timer.status = 'cancelled';
              timer.revision += 1;
            }
          }
        } else if (continuation.kind === 'retry') {
          // The token stays claimed (ineligible) until its durable retry
          // timer fires; the timer resolution makes it ready again.
          if (token.status !== 'claimed') {
            throw new VictStoreError(
              'VICT_STORE_TOKEN_CONFLICT',
              `Token '${token.tokenId}' cannot be rescheduled from state '${token.status}'.`,
              { operation: 'orchestration.completeAttempt', runId: command.runId },
            );
          }
          const timerId = `timer_retry_${command.attemptId}`;
          stored.timers.set(timerId, {
            timerId,
            runId: command.runId,
            kind: 'retry',
            waitId: null,
            attemptId: attempt.attemptId,
            tokenId: token.tokenId,
            dueAt: continuation.dueAt,
            status: 'scheduled',
            ownerId: null,
            leaseExpiresAt: null,
            revision: 1,
            createdAt: now,
          });
        } else if (continuation.kind === 'block') {
          token.status = 'blocked';
          token.revision += 1;
          token.updatedAt = now;
        } else {
          // 'none': the token's work is over (run completed or failed).
          token.status = command.outcome.kind === 'completed' ? 'completed' : token.status;
        }

        // 3. Run state.
        const nextStatus = command.run.status ?? 'running';
        if (!canTransitionRun(previousRun.status, nextStatus)) {
          throw new VictStoreError(
            'VICT_STORE_RUN_CONFLICT',
            `Run status '${previousRun.status}' cannot transition to '${nextStatus}'.`,
            { operation: 'orchestration.completeAttempt', runId: command.runId },
          );
        }
        stored.run = {
          ...stored.run,
          ...(command.run.steps !== undefined ? { steps: command.run.steps } : {}),
          ...(command.run.currentNodeId !== undefined
            ? { currentNodeId: command.run.currentNodeId }
            : {}),
          ...(command.run.outputSummary !== undefined
            ? { outputSummary: canonicalPersistedValue(command.run.outputSummary) as OutputSummary }
            : {}),
          ...(command.run.output !== undefined
            ? { output: canonicalPersistedValue(command.run.output) }
            : {}),
          ...(command.run.error !== undefined
            ? { error: canonicalPersistedValue(command.run.error) as VictError }
            : {}),
          status: nextStatus,
          recordRevision: stored.run.recordRevision + 1,
          updatedAt: now,
          completedAt:
            command.run.completedAt !== undefined
              ? command.run.completedAt
              : nextStatus === 'running' || nextStatus === 'waiting' || nextStatus === 'blocked'
                ? previousRun.completedAt
                : now,
        };

        // 4. Checkpoint lifecycle.
        if (command.checkpoint !== undefined && command.checkpoint !== null) {
          stageCheckpoint(stored, command.checkpoint.tokenId, command.checkpoint.payload);
        }
        for (const child of command.childCheckpoints ?? []) {
          stageCheckpoint(stored, child.tokenId, child.payload);
        }
        for (const tokenId of command.removeCheckpoints ?? []) {
          const token = stored.tokens.get(tokenId);
          if (token) {
            // Tombstone: the token row stays (audit), the private payload goes.
            token.checkpoint = undefined;
          }
        }
        if (['completed', 'failed', 'cancelled'].includes(stored.run.status)) {
          // Terminal cleanup: no private operational payload survives a
          // terminal transition (tested lifecycle rule).
          for (const token of stored.tokens.values()) {
            token.checkpoint = undefined;
          }
        }
        faults?.afterStateStage?.('orchestration.completeAttempt');
        // 5. Events (dense, atomic with the state). The join.completed fact
        // is supplied by the runtime in the atomic transition that records
        // the VALIDATED join completion — never by the store, because the
        // join's declared output contract must be validated outside the
        // persistence adapter. A final branch arrival only creates the
        // join-ready token (joinFired marks that durable fact).
        appendEvents(stored, command.events);
        faults?.beforeCommit?.('orchestration.completeAttempt');
        return {
          attempt: immutableSnapshot(attempt),
          token: immutableSnapshot(stripCheckpoint(token)),
          branchResult:
            command.continuation.kind === 'branchArrival'
              ? immutableSnapshot(stored.branchResults.at(-1) as BranchResultRecord)
              : null,
          joinFired,
          runRecordRevision: stored.run.recordRevision,
          runNextEventSeq: nextEventSeq(stored),
        };
      } catch (cause) {
        // Roll the staged transition back: no half-state becomes visible.
        stored.run = previousRun;
        attempt.state = previousAttemptState;
        const restored = { ...previousToken };
        token.status = restored.status;
        token.nodeId = restored.nodeId;
        token.revision = restored.revision;
        token.updatedAt = restored.updatedAt;
        token.checkpoint = restored.checkpoint;
        for (const child of previousChildTokens) {
          stored.tokens.delete(child.tokenId);
        }
        for (const { token: sibling, status } of previousSiblingTokens) {
          const current = stored.tokens.get(sibling.tokenId);
          if (current) {
            current.status = status;
          }
        }
        if (command.continuation.kind === 'branchArrival') {
          stored.branchResults.pop();
          stored.branchOutputs = previousBranchOutputs;
        }
        for (const { wait, status } of previousWaits) {
          wait.status = status;
        }
        const rolledBack = command.continuation;
        if (rolledBack.kind === 'wait') {
          stored.waits.delete(rolledBack.wait.waitId);
          stored.timers.delete(`timer_${rolledBack.wait.waitId}`);
          stored.timers.delete(`timer_timeout_${rolledBack.wait.waitId}`);
        }
        if (rolledBack.kind === 'retry') {
          stored.timers.delete(`timer_retry_${command.attemptId}`);
        }
        for (const { timer, status } of previousTimers) {
          timer.status = status;
        }
        throw wrap(cause, 'orchestration.completeAttempt', command.runId);
      }
    },

    async signalWait(command): Promise<SignalDeliveryResult> {
      const stored = requireRun(command.runId, 'orchestration.signalWait');
      const existing = stored.signalReceipts.get(command.signalId);
      if (existing) {
        if (existing.commandHash === command.commandHash) {
          return {
            status: 'duplicate',
            signalId: command.signalId,
            waitId: existing.waitId ?? command.waitId,
          };
        }
        return { status: 'conflict', signalId: command.signalId };
      }
      const wait = stored.waits.get(command.waitId);
      if (!wait) {
        throw new VictStoreError('VICT_STORE_WAIT_NOT_FOUND', 'Wait not found.', {
          operation: 'orchestration.signalWait',
          runId: command.runId,
          waitId: command.waitId,
        });
      }
      if (wait.status !== 'open') {
        return { status: 'already_resolved', waitId: wait.waitId };
      }
      if (
        command.signalName !== undefined &&
        wait.signalName !== null &&
        wait.signalName !== command.signalName
      ) {
        throw new VictStoreError(
          'VICT_STORE_SIGNAL_NAME_MISMATCH',
          'The signal name does not match the open wait.',
          { operation: 'orchestration.signalWait', runId: command.runId, waitId: command.waitId },
        );
      }
      if (
        command.expectedWaitRevision !== undefined &&
        wait.revision !== command.expectedWaitRevision
      ) {
        return { status: 'already_resolved', waitId: wait.waitId };
      }
      const token = stored.tokens.get(wait.tokenId);
      if (!token) {
        throw new VictStoreError(
          'VICT_STORE_INVALID_RECORD',
          'The wait references an unknown token.',
          {
            operation: 'orchestration.signalWait',
            runId: command.runId,
            waitId: command.waitId,
          },
        );
      }
      const now = command.now;
      const previousRun = stored.run;
      try {
        wait.status = 'resolved';
        wait.revision += 1;
        wait.resolvedAt = now;
        wait.resolvedBy = command.signalId;
        if (!canTransitionToken(token.status, 'ready')) {
          throw new VictStoreError(
            'VICT_STORE_WAIT_CONFLICT',
            'The wait lost the race against a concurrent resolution.',
            { operation: 'orchestration.signalWait', runId: command.runId, waitId: command.waitId },
          );
        }
        token.status = 'ready';
        token.revision += 1;
        token.updatedAt = now;
        // The resolved signal payload becomes the token's private
        // operational checkpoint (it is the continuation input).
        token.checkpoint = canonicalPersistedValue(command.payload);
        // Cancel the wait's outstanding timeout timer, if any.
        for (const timer of stored.timers.values()) {
          if (timer.waitId === command.waitId && timer.status === 'scheduled') {
            timer.status = 'cancelled';
            timer.revision += 1;
          }
        }
        stored.signalReceipts.set(command.signalId, {
          signalId: command.signalId,
          runId: command.runId,
          waitId: command.waitId,
          signalName: wait.signalName,
          commandHash: command.commandHash,
          status: 'accepted',
          eventSeq: null,
          createdAt: now,
        });
        stored.run = {
          ...stored.run,
          status: 'running',
          recordRevision: stored.run.recordRevision + 1,
          updatedAt: now,
        };
        faults?.afterStateStage?.('orchestration.signalWait');
        appendEvents(stored, command.events);
        faults?.beforeCommit?.('orchestration.signalWait');
        return {
          status: 'accepted',
          waitId: command.waitId,
          token: immutableSnapshot(stripCheckpoint(token)),
          runRecordRevision: stored.run.recordRevision,
          runNextEventSeq: nextEventSeq(stored),
          waitRevision: wait.revision,
        };
      } catch (cause) {
        stored.run = previousRun;
        wait.status = 'open';
        wait.resolvedAt = null;
        wait.resolvedBy = null;
        wait.revision = Math.max(1, wait.revision - 1);
        token.status = 'waiting';
        stored.signalReceipts.delete(command.signalId);
        throw wrap(cause, 'orchestration.signalWait', command.runId);
      }
    },

    async claimDueTimers(command): Promise<ClaimDueTimersResult> {
      const now = command.now;
      const pool =
        command.runId !== undefined
          ? [requireRun(command.runId, 'orchestration.claimDueTimers')]
          : [...runs.values()];
      const candidates: InternalTimer[] = [];
      for (const stored of pool) {
        for (const timer of stored.timers.values()) {
          if (timer.status === 'scheduled' && timer.dueAt <= now) {
            candidates.push(timer);
          } else if (
            // A pump that failed mid-resolution leaves the timer 'firing'
            // with a held lease; once that lease lapses the timer must be
            // reclaimable, or the wake would be lost forever.
            timer.status === 'firing' &&
            timer.leaseExpiresAt !== null &&
            timer.leaseExpiresAt <= now
          ) {
            candidates.push(timer);
          }
        }
      }
      candidates.sort(
        (a, b) => a.dueAt - b.dueAt || (a.timerId < b.timerId ? -1 : a.timerId > b.timerId ? 1 : 0),
      );
      const due: DueTimerRecord[] = [];
      for (const timer of candidates) {
        if (due.length >= Math.max(1, command.limit)) {
          break;
        }
        timer.status = 'firing';
        timer.ownerId = command.ownerId;
        timer.leaseExpiresAt = command.leaseExpiresAt;
        timer.revision += 1;
        due.push({
          timerId: timer.timerId,
          runId: timer.runId,
          kind: timer.kind,
          waitId: timer.waitId,
          attemptId: timer.attemptId,
          tokenId: timer.tokenId,
          dueAt: timer.dueAt,
          revision: timer.revision,
        });
      }
      return { timers: due.map((timer) => immutableSnapshot(timer)) };
    },

    async resolveDueTimer(command): Promise<ResolveDueTimerResult> {
      const stored = requireRun(command.runId, 'orchestration.resolveDueTimer');
      const timer = stored.timers.get(command.timerId);
      if (!timer) {
        throw new VictStoreError('VICT_STORE_TIMER_NOT_FOUND', 'Timer not found.', {
          operation: 'orchestration.resolveDueTimer',
          runId: command.runId,
          timerId: command.timerId,
        });
      }
      if (timer.revision !== command.expectedTimerFence || timer.ownerId !== command.ownerId) {
        return {
          runRecordRevision: stored.run.recordRevision,
          runNextEventSeq: nextEventSeq(stored),
          applied: false,
        };
      }
      if (timer.status !== 'firing') {
        return {
          runRecordRevision: stored.run.recordRevision,
          runNextEventSeq: nextEventSeq(stored),
          applied: false,
        };
      }
      const now = command.now;
      const previousRun = stored.run;
      const targetWait: InternalWait | undefined =
        timer.waitId !== null ? stored.waits.get(timer.waitId) : undefined;
      const targetToken: InternalToken | undefined =
        timer.tokenId !== null ? stored.tokens.get(timer.tokenId) : undefined;
      const previousWaitStatus = targetWait?.status;
      const previousTokenStatus = targetToken?.status;
      try {
        if (command.resolution.kind === 'wake' || command.resolution.kind === 'waitTimeout') {
          if (!targetWait || !targetToken || targetWait.status !== 'open') {
            return {
              runRecordRevision: stored.run.recordRevision,
              runNextEventSeq: nextEventSeq(stored),
              applied: false,
            };
          }
          targetWait.status = 'resolved';
          targetWait.revision += 1;
          targetWait.resolvedAt = now;
          targetWait.resolvedBy = timer.timerId;
          if (command.resolution.kind === 'wake') {
            targetToken.status = 'ready';
          } else if (command.resolution.toNodeId !== null) {
            targetToken.nodeId = command.resolution.toNodeId;
            targetToken.status = 'ready';
          } else {
            targetToken.status = 'blocked';
          }
          targetToken.revision += 1;
          targetToken.updatedAt = now;
        }
        if (command.resolution.kind === 'retry') {
          if (
            !targetToken ||
            (targetToken.status !== 'claimed' && targetToken.status !== 'blocked')
          ) {
            return {
              runRecordRevision: stored.run.recordRevision,
              runNextEventSeq: nextEventSeq(stored),
              applied: false,
            };
          }
          targetToken.status = 'ready';
          targetToken.revision += 1;
          targetToken.updatedAt = now;
        }
        timer.status = command.resolution.kind === 'cancel' ? 'cancelled' : 'fired';
        if (command.checkpoint !== undefined && command.checkpoint !== null && targetToken) {
          stageCheckpoint(stored, targetToken.tokenId, command.checkpoint.payload);
        }
        stored.run = {
          ...stored.run,
          ...(command.run ?? {}),
          recordRevision: stored.run.recordRevision + 1,
          updatedAt: now,
        };
        faults?.afterStateStage?.('orchestration.resolveDueTimer');
        appendEvents(stored, command.events);
        faults?.beforeCommit?.('orchestration.resolveDueTimer');
        return {
          runRecordRevision: stored.run.recordRevision,
          runNextEventSeq: nextEventSeq(stored),
          applied: true,
        };
      } catch (cause) {
        stored.run = previousRun;
        timer.status = 'firing';
        if (targetWait && previousWaitStatus) {
          targetWait.status = previousWaitStatus;
          targetWait.resolvedAt = null;
          targetWait.resolvedBy = null;
        }
        if (targetToken && previousTokenStatus) {
          targetToken.status = previousTokenStatus;
        }
        throw wrap(cause, 'orchestration.resolveDueTimer', command.runId);
      }
    },

    async requestCancellation(command): Promise<CancellationResult> {
      const stored = requireRun(command.runId, 'orchestration.requestCancellation');
      const existing = stored.cancellationRequests.get(command.requestId);
      if (existing) {
        if (existing.commandHash === command.commandHash) {
          return {
            status: 'duplicate',
            runId: command.runId,
            runCancelledNow: false,
            runRecordRevision: stored.run.recordRevision,
            runNextEventSeq: nextEventSeq(stored),
          };
        }
        return { status: 'conflict', requestId: command.requestId };
      }
      const runStatus = stored.run.status;
      if (runStatus === 'completed' || runStatus === 'failed' || runStatus === 'cancelled') {
        return { status: 'already_terminal', runId: command.runId, runStatus };
      }
      const now = command.now;
      const previousRun = stored.run;
      const touchedWaits: { wait: InternalWait; status: DurableWaitState['status'] }[] = [];
      const touchedTimers: { timer: InternalTimer; status: TimerRecord['status'] }[] = [];
      const touchedTokens: { token: InternalToken; status: DurableTokenState['status'] }[] = [];
      try {
        stored.cancellationRequests.set(command.requestId, {
          requestId: command.requestId,
          reasonCode: command.reasonCode,
          commandHash: command.commandHash,
        });
        stored.run = {
          ...stored.run,
          cancellation: { requestId: command.requestId, reasonCode: command.reasonCode },
          recordRevision: stored.run.recordRevision + 1,
          updatedAt: now,
        };
        for (const wait of stored.waits.values()) {
          if (wait.status === 'open') {
            touchedWaits.push({ wait, status: wait.status });
            wait.status = 'cancelled';
            wait.revision += 1;
            wait.resolvedAt = now;
            wait.resolvedBy = command.requestId;
          }
        }
        for (const timer of stored.timers.values()) {
          if (timer.status === 'scheduled') {
            touchedTimers.push({ timer, status: timer.status });
            timer.status = 'cancelled';
            timer.revision += 1;
          }
        }
        let hasInFlight = false;
        for (const token of stored.tokens.values()) {
          if (token.status === 'ready') {
            touchedTokens.push({ token, status: token.status });
            token.status = 'cancelled';
            token.revision += 1;
            token.updatedAt = now;
          }
          if (token.status === 'claimed') {
            hasInFlight = true;
          }
        }
        let runCancelledNow = false;
        if (!hasInFlight) {
          if (!canTransitionRun(stored.run.status, 'cancelled')) {
            throw new VictStoreError(
              'VICT_STORE_RUN_CONFLICT',
              'The run cannot be cancelled from its current status.',
              {
                operation: 'orchestration.requestCancellation',
                runId: command.runId,
                status: stored.run.status,
              },
            );
          }
          stored.run = { ...stored.run, status: 'cancelled', completedAt: now };
          runCancelledNow = true;
        }
        faults?.afterStateStage?.('orchestration.requestCancellation');
        const allEvents =
          runCancelledNow && command.terminalCancelEvent !== undefined
            ? [...command.events, command.terminalCancelEvent]
            : command.events;
        appendEvents(stored, allEvents);
        faults?.beforeCommit?.('orchestration.requestCancellation');
        return {
          status: 'accepted',
          runId: command.runId,
          runCancelledNow,
          runRecordRevision: stored.run.recordRevision,
          runNextEventSeq: nextEventSeq(stored),
        };
      } catch (cause) {
        stored.run = previousRun;
        stored.cancellationRequests.delete(command.requestId);
        for (const { wait, status } of touchedWaits) {
          wait.status = status;
          wait.resolvedAt = null;
          wait.resolvedBy = null;
        }
        for (const { timer, status } of touchedTimers) {
          timer.status = status;
        }
        for (const { token, status } of touchedTokens) {
          token.status = status;
        }
        throw wrap(cause, 'orchestration.requestCancellation', command.runId);
      }
    },

    async applyCancellation(command) {
      const stored = requireRun(command.runId, 'orchestration.applyCancellation');
      const now = command.now;
      const previousRun = stored.run;
      try {
        for (const token of stored.tokens.values()) {
          if (['ready', 'claimed', 'waiting', 'blocked'].includes(token.status)) {
            token.status = 'cancelled';
            token.revision += 1;
            token.updatedAt = now;
          }
        }
        for (const wait of stored.waits.values()) {
          if (wait.status === 'open') {
            wait.status = 'cancelled';
            wait.revision += 1;
            wait.resolvedAt = now;
            wait.resolvedBy = command.requestId;
          }
        }
        for (const timer of stored.timers.values()) {
          if (timer.status === 'scheduled' || timer.status === 'firing') {
            timer.status = 'cancelled';
            timer.revision += 1;
          }
        }
        if (stored.run.status === 'cancelled') {
          // Already finalized: idempotent no-op.
          return {
            runRecordRevision: stored.run.recordRevision,
            runNextEventSeq: nextEventSeq(stored),
          };
        }
        if (!canTransitionRun(stored.run.status, 'cancelled')) {
          throw new VictStoreError(
            'VICT_STORE_RUN_CONFLICT',
            'The run cannot be cancelled from its current status.',
            {
              operation: 'orchestration.applyCancellation',
              runId: command.runId,
              status: stored.run.status,
            },
          );
        }
        stored.run = {
          ...stored.run,
          status: 'cancelled',
          recordRevision: stored.run.recordRevision + 1,
          updatedAt: now,
          completedAt: now,
        };
        faults?.afterStateStage?.('orchestration.applyCancellation');
        appendEvents(stored, command.events);
        for (const token of stored.tokens.values()) {
          // Terminal cleanup tombstones every private operational payload.
          token.checkpoint = undefined;
        }
        faults?.beforeCommit?.('orchestration.applyCancellation');
        return {
          runRecordRevision: stored.run.recordRevision,
          runNextEventSeq: nextEventSeq(stored),
        };
      } catch (cause) {
        stored.run = previousRun;
        throw wrap(cause, 'orchestration.applyCancellation', command.runId);
      }
    },

    async findRecoverableClaims(
      _command: RecoverOrchestrationCommand,
    ): Promise<readonly RecoverableClaim[]> {
      const recoverable: RecoverableClaim[] = [];
      for (const stored of runs.values()) {
        if (stored.run.status !== 'running') {
          continue;
        }
        for (const token of stored.tokens.values()) {
          if (token.status !== 'claimed') {
            continue;
          }
          const attempt = [...stored.attempts.values()]
            .filter(
              (candidate) => candidate.tokenId === token.tokenId && candidate.state === 'started',
            )
            .sort((a, b) => b.attemptNumber - a.attemptNumber)[0];
          if (attempt && attempt.leaseExpiresAt !== null) {
            recoverable.push({
              runId: stored.run.runId,
              token: immutableSnapshot(stripCheckpoint(token)),
              attempt: immutableSnapshot(attempt),
              leaseExpiresAt: attempt.leaseExpiresAt,
            });
          }
        }
      }
      recoverable.sort((a, b) =>
        a.leaseExpiresAt < b.leaseExpiresAt ? -1 : a.leaseExpiresAt > b.leaseExpiresAt ? 1 : 0,
      );
      return recoverable;
    },

    async recoverAttempt(command) {
      const stored = requireRun(command.runId, 'orchestration.recoverAttempt');
      const attempt = stored.attempts.get(command.attemptId);
      if (!attempt) {
        throw new VictStoreError('VICT_STORE_INVALID_COMMAND', 'Unknown attempt.', {
          operation: 'orchestration.recoverAttempt',
          runId: command.runId,
          attemptId: command.attemptId,
        });
      }
      if (attempt.fence !== command.expectedAttemptFence) {
        throw new VictStoreError(
          'VICT_STORE_ATTEMPT_FENCE_CONFLICT',
          'The recovery carries a stale fence.',
          {
            operation: 'orchestration.recoverAttempt',
            runId: command.runId,
            attemptId: command.attemptId,
          },
        );
      }
      const now = command.now;
      const previousRun = stored.run;
      const previousAttemptState = attempt.state;
      const token = stored.tokens.get(attempt.tokenId);
      const previousTokenStatus = token?.status;
      try {
        if (!canTransitionAttempt(attempt.state, 'outcome_unknown')) {
          throw new VictStoreError(
            'VICT_STORE_ATTEMPT_STATE_CONFLICT',
            `Attempt '${attempt.attemptId}' is in state '${attempt.state}' and cannot be recovered.`,
            {
              operation: 'orchestration.recoverAttempt',
              runId: command.runId,
              attemptId: command.attemptId,
            },
          );
        }
        attempt.state = 'outcome_unknown';
        attempt.updatedAt = now;
        if (token) {
          if (command.action.kind === 'reclaim') {
            if (!canTransitionToken(token.status, 'ready')) {
              throw new VictStoreError(
                'VICT_STORE_TOKEN_CONFLICT',
                `Token '${token.tokenId}' is in state '${token.status}' and cannot be reclaimed.`,
                { operation: 'orchestration.recoverAttempt', runId: command.runId },
              );
            }
            token.status = 'ready';
          } else {
            if (!canTransitionToken(token.status, 'blocked')) {
              throw new VictStoreError(
                'VICT_STORE_TOKEN_CONFLICT',
                `Token '${token.tokenId}' is in state '${token.status}' and cannot be blocked.`,
                { operation: 'orchestration.recoverAttempt', runId: command.runId },
              );
            }
            token.status = 'blocked';
          }
          token.revision += 1;
          token.updatedAt = now;
        }
        stored.run = {
          ...stored.run,
          ...(command.run ?? {}),
          status: command.action.kind === 'block' ? 'blocked' : 'running',
          recordRevision: stored.run.recordRevision + 1,
          updatedAt: now,
        };
        faults?.afterStateStage?.('orchestration.recoverAttempt');
        appendEvents(stored, command.events);
        faults?.beforeCommit?.('orchestration.recoverAttempt');
        return {
          runRecordRevision: stored.run.recordRevision,
          runNextEventSeq: nextEventSeq(stored),
        };
      } catch (cause) {
        stored.run = previousRun;
        attempt.state = previousAttemptState;
        if (token && previousTokenStatus) {
          token.status = previousTokenStatus;
        }
        throw wrap(cause, 'orchestration.recoverAttempt', command.runId);
      }
    },

    async resolveBlocked(command): Promise<ResolveBlockedResult> {
      const stored = runs.get(command.runId);
      if (!stored) {
        return { status: 'unknown_run' };
      }
      const existing = stored.resolutionRequests.get(command.resolutionId);
      if (existing) {
        if (existing.commandHash === command.commandHash) {
          return {
            status: 'duplicate',
            runRecordRevision: stored.run.recordRevision,
            runNextEventSeq: nextEventSeq(stored),
            runStatus: stored.run.status,
          };
        }
        return { status: 'conflict', resolutionId: command.resolutionId };
      }
      if (stored.run.status !== 'blocked') {
        return { status: 'not_blocked', runId: command.runId, runStatus: stored.run.status };
      }
      if (stored.run.recordRevision !== command.expectedRunRevision) {
        return {
          status: 'stale_revision',
          runId: command.runId,
          actualRunRevision: stored.run.recordRevision,
        };
      }
      const now = command.now;
      const previousRun = stored.run;
      const blockedToken = [...stored.tokens.values()].find((token) => token.status === 'blocked');
      const previousBlockedStatus = blockedToken?.status;
      try {
        stored.resolutionRequests.set(command.resolutionId, {
          resolutionId: command.resolutionId,
          commandHash: command.commandHash,
        });
        if (command.action === 'cancel') {
          if (!canTransitionRun(stored.run.status, 'cancelled')) {
            throw new VictStoreError(
              'VICT_STORE_RUN_CONFLICT',
              'The run cannot be cancelled from its status.',
              { operation: 'orchestration.resolveBlocked', runId: command.runId },
            );
          }
          stored.run = { ...stored.run, status: 'cancelled', completedAt: now };
          for (const token of stored.tokens.values()) {
            if (['blocked', 'ready', 'claimed', 'waiting'].includes(token.status)) {
              token.status = 'cancelled';
              token.revision += 1;
            }
          }
        } else if (command.action === 'fail') {
          if (!canTransitionRun(stored.run.status, 'failed')) {
            throw new VictStoreError(
              'VICT_STORE_RUN_CONFLICT',
              'The run cannot fail from its status.',
              { operation: 'orchestration.resolveBlocked', runId: command.runId },
            );
          }
          stored.run = { ...stored.run, status: 'failed', completedAt: now };
          if (blockedToken) {
            blockedToken.status = 'cancelled';
            blockedToken.revision += 1;
          }
        } else {
          if (!blockedToken) {
            throw new VictStoreError(
              'VICT_STORE_INVALID_COMMAND',
              'The run is blocked without a blocked token.',
              { operation: 'orchestration.resolveBlocked', runId: command.runId },
            );
          }
          if (!canTransitionRun(stored.run.status, 'running')) {
            throw new VictStoreError(
              'VICT_STORE_RUN_CONFLICT',
              'The run cannot resume from its status.',
              { operation: 'orchestration.resolveBlocked', runId: command.runId },
            );
          }
          stored.run = { ...stored.run, status: 'running' };
          if (command.action === 'retry') {
            if (!canTransitionToken(blockedToken.status, 'ready')) {
              throw new VictStoreError(
                'VICT_STORE_TOKEN_CONFLICT',
                'The blocked token cannot be retried.',
                { operation: 'orchestration.resolveBlocked', runId: command.runId },
              );
            }
            blockedToken.status = 'ready';
            blockedToken.revision += 1;
          }
          if (command.action === 'confirm_applied' && command.continuation) {
            if (command.continuation.kind === 'advance') {
              blockedToken.nodeId = command.continuation.toNodeId;
              blockedToken.status = 'ready';
              blockedToken.revision += 1;
              if (command.checkpoint) {
                stageCheckpoint(stored, command.checkpoint.tokenId, command.checkpoint.payload);
              }
            } else if (command.continuation.kind === 'complete') {
              blockedToken.status = 'completed';
              blockedToken.revision += 1;
              if (!canTransitionRun('running', 'completed')) {
                throw new VictStoreError(
                  'VICT_STORE_RUN_CONFLICT',
                  'The run cannot complete from its status.',
                  { operation: 'orchestration.resolveBlocked', runId: command.runId },
                );
              }
              stored.run = {
                ...stored.run,
                status: 'completed',
                completedAt: now,
                ...(command.continuation.outputSummary !== undefined
                  ? {
                      outputSummary: canonicalPersistedValue(
                        command.continuation.outputSummary,
                      ) as OutputSummary,
                    }
                  : {}),
              };
            }
          }
        }
        stored.run = {
          ...stored.run,
          recordRevision: stored.run.recordRevision + 1,
          updatedAt: now,
        };
        faults?.afterStateStage?.('orchestration.resolveBlocked');
        appendEvents(stored, command.events);
        faults?.beforeCommit?.('orchestration.resolveBlocked');
        return {
          status: 'accepted',
          runRecordRevision: stored.run.recordRevision,
          runNextEventSeq: nextEventSeq(stored),
          runStatus: stored.run.status,
        };
      } catch (cause) {
        stored.run = previousRun;
        stored.resolutionRequests.delete(command.resolutionId);
        if (blockedToken && previousBlockedStatus) {
          blockedToken.status = previousBlockedStatus;
        }
        throw wrap(cause, 'orchestration.resolveBlocked', command.runId);
      }
    },

    async listWaits(runId) {
      const stored = requireRun(runId, 'orchestration.listWaits');
      return [...stored.waits.values()].map((wait) => immutableSnapshot(wait));
    },

    async listSignalReceipts(runId) {
      const stored = requireRun(runId, 'orchestration.listSignalReceipts');
      return [...stored.signalReceipts.values()].map((receipt) => immutableSnapshot(receipt));
    },

    async listOrchestrationEvents(runId) {
      const stored = requireRun(runId, 'orchestration.listEvents');
      return stored.events.map((event) => immutableSnapshot(event));
    },
  };

  return store;
}

function outcomeState(outcome: CompleteAttemptCommand['outcome']): DurableAttemptState['state'] {
  switch (outcome.kind) {
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'timed_out':
      return 'timed_out';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'outcome_unknown';
  }
}
