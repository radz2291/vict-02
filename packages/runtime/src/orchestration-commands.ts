import type { KernelEvent } from '@vict/kernel';
import type {
  OrchestrationEventInput,
  SignalDeliveryResult,
} from './orchestration-store-types.js';
import { VictRuntimeError } from './errors.js';
import { signalCommandHash, cancellationCommandHash, resolutionCommandHash } from './orchestration-activation.js';
import { CANCELLATION_REASON_CODES } from './orchestration-driver-types.js';
import type {
  CancelCommand,
  CancelResult,
  RecoverOrchestrationOptions,
  RecoverOrchestrationSummary,
  OrchestrationDriverDeps,
  ProcessDueTimersOptions,
  ProcessDueTimersResult,
  ResolveBlockedInput,
  ResolveBlockedOutcome,
  SignalCommand,
  SignalResult,
} from './orchestration-driver-types.js';

/**
 * Idempotent orchestration command APIs (handoff §14–16): signal delivery,
 * durable cancellation, due-timer pumping, blocked-run operator resolution,
 * and boot-time effect-aware recovery. All commands are concurrency-guarded
 * through the store's optimistic revisions and idempotency deduplication.
 */

async function requireRun(
  deps: OrchestrationDriverDeps,
  runId: string,
): Promise<import('./orchestration-store-types.js').StoredOrchestrationRun> {
  const run = await deps.orchestration.getOrchestrationRun(runId);
  if (!run) {
    throw new VictRuntimeError('VICT_RUN_NOT_FOUND', `No orchestration run '${runId}' exists.`);
  }
  return run;
}

function envelopeOf(run: {
  runId: string;
  graphId: string;
  graphVersion: string;
  capabilitySetVersion: string;
  activationVersion: string;
}): Record<string, unknown> {
  return {
    runId: run.runId,
    graphId: run.graphId,
    graphVersion: run.graphVersion,
    capabilitySetVersion: run.capabilitySetVersion,
    activationVersion: run.activationVersion,
  };
}

/** Idempotently deliver one signal to one exact wait. */
export async function signalWait(
  deps: OrchestrationDriverDeps,
  command: SignalCommand,
  resolveContract: (
    activationVersion: string,
    contractId: string,
    payload: unknown,
  ) => Promise<{ ok: boolean; message?: string }>,
): Promise<SignalResult> {
  if (typeof command.signalId !== 'string' || command.signalId.length === 0) {
    return { ok: false, code: 'VICT_ORCH_INVALID_SIGNAL', message: 'A signal requires a non-empty signalId.' };
  }
  const run = await deps.orchestration.getOrchestrationRun(command.runId);
  if (!run) {
    return { ok: false, code: 'VICT_ORCH_UNKNOWN_RUN', message: `No orchestration run '${command.runId}' exists.` };
  }
  const waits = await deps.orchestration.listWaits(command.runId);
  const wait = waits.find((candidate) => candidate.waitId === command.waitId);
  if (!wait) {
    return {
      ok: false,
      code: 'VICT_ORCH_WAIT_NOT_FOUND',
      message: `No wait '${command.waitId}' exists on run '${command.runId}'.`,
    };
  }
  if (wait.signalName !== null && command.signalName !== undefined && command.signalName !== wait.signalName) {
    return { ok: false, code: 'VICT_ORCH_SIGNAL_NAME_MISMATCH', message: 'The signal name does not match the open wait.' };
  }
  // Validate the payload against the pinned wait contract BEFORE consuming.
  if (wait.contractId !== null) {
    const validation = await resolveContract(run.activationVersion, wait.contractId, command.payload);
    if (!validation.ok) {
      return {
        ok: false,
        code: 'VICT_ORCH_SIGNAL_CONTRACT_REJECTED',
        message: validation.message ?? 'The signal payload was rejected by the pinned wait contract.',
      };
    }
  }
  const now = deps.clock.now();
  const envelope = envelopeOf(run);
  const result = await deps.orchestration.signalWait({
    runId: command.runId,
    waitId: command.waitId,
    signalId: command.signalId,
    signalName: command.signalName,
    payload: command.payload,
    expectedWaitRevision: command.expectedWaitRevision,
    commandHash: signalCommandHash(command),
    now,
    events: ([
      {
        type: 'signal.received',
        waitId: command.waitId,
        signalId: command.signalId,
        signalName: wait.signalName ?? command.signalName ?? '(unnamed)',
        ...envelope,
        timestamp: now,
      },
      {
        type: 'run.resumed',
        by: 'signal',
        waitId: command.waitId,
        signalId: command.signalId,
        ...envelope,
        timestamp: now,
      },
    ] as unknown as readonly OrchestrationEventInput[]),
  });
  switch (result.status) {
    case 'accepted':
      return { ok: true, status: 'accepted' };
    case 'duplicate':
      return { ok: true, status: 'duplicate' };
    case 'already_resolved':
      return { ok: true, status: 'already_resolved' };
    case 'conflict':
      return {
        ok: false,
        code: 'VICT_ORCH_SIGNAL_ID_CONFLICT',
        message: 'The signalId was already delivered with different content.',
      };
  }
}

/** Idempotently request cancellation of one run (durable request, not an undo). */
export async function cancelRun(deps: OrchestrationDriverDeps, command: CancelCommand): Promise<CancelResult> {
  if (!CANCELLATION_REASON_CODES.includes(command.reasonCode)) {
    return {
      ok: false,
      code: 'VICT_ORCH_INVALID_REASON',
      message: 'The cancellation reason code is not in the safe vocabulary.',
    };
  }
  const run = await deps.orchestration.getOrchestrationRun(command.runId);
  if (!run) {
    return { ok: false, code: 'VICT_ORCH_UNKNOWN_RUN', message: `No orchestration run '${command.runId}' exists.` };
  }
  const now = deps.clock.now();
  const envelope = envelopeOf(run);
  const result = await deps.orchestration.requestCancellation({
    runId: command.runId,
    requestId: command.requestId,
    reasonCode: command.reasonCode,
    commandHash: cancellationCommandHash(command),
    now,
    events: [
      {
        type: 'run.cancel_requested',
        requestId: command.requestId,
        reasonCode: command.reasonCode,
        ...envelope,
        timestamp: now,
      },
    ] as unknown as readonly OrchestrationEventInput[],
  });
  if (result.status === 'conflict') {
    return {
      ok: false,
      code: 'VICT_ORCH_CANCELLATION_CONFLICT',
      message: 'The requestId was already used with different content.',
    };
  }
  if (result.status === 'unknown_run') {
    return { ok: false, code: 'VICT_ORCH_UNKNOWN_RUN', message: `No orchestration run '${command.runId}' exists.` };
  }
  if (result.status === 'already_terminal') {
    return { ok: true, status: 'duplicate', cancelled: false };
  }
  if (result.runCancelledNow) {
    await deps.orchestration.applyCancellation({
      runId: command.runId,
      now: deps.clock.now(),
      requestId: command.requestId,
      reasonCode: command.reasonCode,
      steps: run.steps,
      removeCheckpoints: [],
      events: [
        {
          type: 'run.cancelled',
          requestId: command.requestId,
          reasonCode: command.reasonCode,
          steps: run.steps,
          ...envelope,
          timestamp: deps.clock.now(),
        },
      ] as unknown as readonly OrchestrationEventInput[],
    });
    return { ok: true, status: 'accepted', cancelled: true };
  }
  return { ok: true, status: 'accepted', cancelled: false };
}

/** Resolve bounded due timers (timer waits, wait timeouts, retry backoff). */
export async function processDueTimers(
  deps: OrchestrationDriverDeps,
  options: ProcessDueTimersOptions,
  resolveGraph: (
    activationVersion: string,
  ) => Promise<{ ok: true; graph: import('@vict/kernel').CompiledGraph } | { ok: false }>,
  nowMs: () => number,
): Promise<ProcessDueTimersResult> {
  const limit = Math.min(options.limit ?? 16, 256);
  const now = nowMs();
  const claimed = await deps.orchestration.claimDueTimers({
    now,
    limit,
    runId: options.runId,
    ownerId: deps.ownerId,
    leaseExpiresAt: now + 30_000,
  });
  const timers: { timerId: string; runId: string; kind: 'wait' | 'wait-timeout' | 'retry'; applied: boolean }[] = [];
  for (const timer of claimed.timers) {
    const applied = await resolveOneDueTimer(deps, timer, resolveGraph);
    if (applied) {
      timers.push({ timerId: timer.timerId, runId: timer.runId, kind: timer.kind, applied: true });
    }
  }
  return { fired: timers.length, timers };
}

async function resolveOneDueTimer(
  deps: OrchestrationDriverDeps,
  timer: {
    timerId: string;
    runId: string;
    kind: 'wait' | 'wait-timeout' | 'retry';
    waitId: string | null;
    tokenId: string | null;
    revision: number;
  },
  resolveGraph: (
    activationVersion: string,
  ) => Promise<{ ok: true; graph: import('@vict/kernel').CompiledGraph } | { ok: false }>,
): Promise<boolean> {
  const run = await deps.orchestration.getOrchestrationRun(timer.runId);
  if (!run) {
    return false;
  }
  const now = deps.clock.now();
  const envelope = envelopeOf(run);
  if (timer.kind === 'wait') {
    const result = await deps.orchestration.resolveDueTimer({
      runId: timer.runId,
      timerId: timer.timerId,
      ownerId: deps.ownerId,
      expectedTimerFence: timer.revision,
      now,
      resolution: { kind: 'wake' },
      events: [
        { type: 'timer.fired', timerId: timer.timerId, nodeId: run.currentNodeId ?? '(wait)', kind: 'wait', ...envelope, timestamp: now },
        { type: 'run.resumed', by: 'timer', ...envelope, timestamp: now },
      ] as unknown as readonly OrchestrationEventInput[],
      run: { status: 'running' },
    });
    return result.applied;
  }
  if (timer.kind === 'wait-timeout') {
    let toNodeId: string | null = null;
    try {
      const snapshot = await deps.orchestration.getOrchestrationSnapshot(timer.runId);
      const wait = timer.waitId !== null
        ? (await deps.orchestration.listWaits(timer.runId)).find((w) => w.waitId === timer.waitId)
        : undefined;
      if (snapshot && wait) {
        const graph = await resolveGraph(run.activationVersion);
        if (graph.ok) {
          const token = snapshot.tokens.find((candidate) => candidate.tokenId === wait.tokenId);
          const waitNode = token ? graph.graph.getNode(token.nodeId) : undefined;
          toNodeId = (waitNode && graph.graph.timeoutTargetOf(waitNode.id)) ?? null;
        }
      }
    } catch {
      toNodeId = null;
    }
    if (toNodeId === null) {
      // Fail closed: the exact plan (timeout edge) is unavailable.
      const result = await deps.orchestration.resolveDueTimer({
        runId: timer.runId,
        timerId: timer.timerId,
        ownerId: deps.ownerId,
        expectedTimerFence: timer.revision,
        now,
        resolution: { kind: 'waitTimeout', toNodeId: null, payload: undefined },
        events: [
          { type: 'timer.fired', timerId: timer.timerId, nodeId: run.currentNodeId ?? '(unknown)', kind: 'wait-timeout', ...envelope, timestamp: now },
          {
            type: 'run.blocked',
            steps: run.steps,
            code: 'VICT_ORCH_ACTIVATION_UNAVAILABLE',
            reason: 'The exact pinned activation could not be resolved to process the wait timeout.',
            remediation: 'Register the exact capability/contract revisions, then resolve the blocked run through the operator API.',
            ...envelope,
            timestamp: now,
          },
        ] as unknown as readonly OrchestrationEventInput[],
        run: { status: 'blocked' },
      });
      return result.applied;
    }
    const result = await deps.orchestration.resolveDueTimer({
      runId: timer.runId,
      timerId: timer.timerId,
      ownerId: deps.ownerId,
      expectedTimerFence: timer.revision,
      now,
      resolution: { kind: 'waitTimeout', toNodeId, payload: undefined },
      events: [
        { type: 'timer.fired', timerId: timer.timerId, nodeId: run.currentNodeId ?? '(unknown)', kind: 'wait-timeout', ...envelope, timestamp: now },
        { type: 'run.resumed', by: 'timer', ...envelope, timestamp: now },
      ] as unknown as readonly OrchestrationEventInput[],
      run: { status: 'running' },
    });
    return result.applied;
  }
  const result = await deps.orchestration.resolveDueTimer({
    runId: timer.runId,
    timerId: timer.timerId,
    ownerId: deps.ownerId,
    expectedTimerFence: timer.revision,
    now,
    resolution: { kind: 'retry' },
    events: [
      { type: 'timer.fired', timerId: timer.timerId, nodeId: run.currentNodeId ?? '(unknown)', kind: 'retry', ...envelope, timestamp: now },
    ] as unknown as readonly OrchestrationEventInput[],
  });
  return result.applied;
}
/**
 * Bounded authorized operator resolution for one blocked run (handoff §16).
 * Denied by default: the runtime only calls this when an explicit operator
 * authorization is configured. Idempotent through the caller-supplied
 * resolution ID and guarded by the expected run revision.
 */
export async function resolveBlocked(
  deps: OrchestrationDriverDeps,
  input: ResolveBlockedInput,
  resolvePlan: (
    runId: string,
    action: ResolveBlockedInput['action'],
    output: unknown,
  ) => Promise<
    | {
        ok: true;
        command: Omit<
          import('./orchestration-store-types.js').ResolveBlockedCommand,
          'resolutionId' | 'commandHash' | 'now' | 'expectedRunRevision' | 'events'
        >;
        events: readonly OrchestrationEventInput[];
      }
    | { ok: false; code: string; message: string }
  >,
): Promise<ResolveBlockedOutcome> {
  const run = await deps.orchestration.getOrchestrationRun(input.runId);
  if (!run) {
    return { ok: false, code: 'VICT_ORCH_UNKNOWN_RUN', message: `No orchestration run '${input.runId}' exists.` };
  }
  const now = deps.clock.now();
  const envelope = envelopeOf(run);
  const planned = await resolvePlan(input.runId, input.action, input.output);
  if (!planned.ok) {
    return { ok: false, code: planned.code, message: planned.message };
  }
  const commandHash = resolutionCommandHash({
    runId: input.runId,
    resolutionId: input.resolutionId,
    action: input.action,
    reasonCode: input.reasonCode,
    expectedRunRevision: input.expectedRunRevision,
    hasOutput: input.output !== undefined,
  });
  const result = await deps.orchestration.resolveBlocked({
    ...planned.command,
    resolutionId: input.resolutionId,
    reasonCode: input.reasonCode,
    commandHash,
    expectedRunRevision: input.expectedRunRevision ?? run.recordRevision,
    now,
    events: (
      [
        {
          type: 'operator.intervened',
          resolutionId: input.resolutionId,
          action: input.action,
          ...envelope,
          timestamp: now,
        },
        ...planned.events,
      ] as unknown as readonly OrchestrationEventInput[]
    ),
  });
  switch (result.status) {
    case 'accepted':
      return {
        ok: true,
        status: 'accepted',
        runStatus: result.runStatus,
        runRecordRevision: result.runRecordRevision,
      };
    case 'duplicate':
      return {
        ok: true,
        status: 'duplicate',
        runStatus: result.runStatus,
        runRecordRevision: result.runRecordRevision,
      };
    case 'conflict':
      return {
        ok: false,
        code: 'VICT_ORCH_OPERATOR_CONFLICT',
        message: 'The resolutionId was already used with different content.',
      };
    case 'stale_revision':
      return {
        ok: false,
        code: 'VICT_ORCH_STALE_REVISION',
        message: `The run record revision is stale (actual ${result.actualRunRevision}).`,
      };
    case 'unknown_run':
      return { ok: false, code: 'VICT_ORCH_UNKNOWN_RUN', message: `No orchestration run '${input.runId}' exists.` };
    case 'not_blocked':
      return {
        ok: false,
        code: 'VICT_ORCH_NOT_BLOCKED',
        message: `Run '${input.runId}' is '${result.runStatus}', not blocked.`,
      };
    case 'already_resolved':
      return {
        ok: false,
        code: 'VICT_ORCH_OPERATOR_CONFLICT',
        message: 'The resolution was already applied.',
      };
  }
}

/**
 * Boot-time effect-aware recovery (handoff OBS-005): find attempts whose
 * lease expired while in flight, and reclaim or block each by effect class
 * and policy. Replaces blanket interrupted-run blocking for orchestration
 * runs; historical Stage 02 sequential recovery is unchanged.
 */
export async function recoverOrchestration(
  deps: OrchestrationDriverDeps,
  options: RecoverOrchestrationOptions,
  policyFor: (
    runId: string,
    attempt: import('@vict/kernel').DurableAttemptState,
  ) => Promise<
    | { readonly action: 'reclaim'; readonly reason?: string }
    | { readonly action: 'block'; readonly reason: string }
    | { readonly action: 'skip'; readonly reason: string }
  >,
): Promise<RecoverOrchestrationSummary> {
  const now = deps.clock.now();
  const claims = await deps.orchestration.findRecoverableClaims({ now });
  const reclaimed: { runId: string; attemptId: string; effectClass: import('@vict/kernel').EffectClass }[] = [];
  const blocked: { runId: string; attemptId: string; effectClass: import('@vict/kernel').EffectClass; reason: string }[] = [];
  const skipped: { runId: string; attemptId: string; reason: string }[] = [];
  for (const claim of claims) {
    if (claim.leaseExpiresAt > now) {
      skipped.push({ runId: claim.runId, attemptId: claim.attempt.attemptId, reason: 'lease still active' });
      continue;
    }
    const run = await deps.orchestration.getOrchestrationRun(claim.runId);
    if (!run || isTerminal(run.status)) {
      continue;
    }
    const envelope = envelopeOf(run);
    const decision = await policyFor(claim.runId, claim.attempt);
    if (decision.action === 'skip') {
      skipped.push({ runId: claim.runId, attemptId: claim.attempt.attemptId, reason: decision.reason });
      continue;
    }
    if (decision.action === 'block') {
      await deps.orchestration.recoverAttempt({
        runId: claim.runId,
        attemptId: claim.attempt.attemptId,
        expectedAttemptFence: claim.attempt.fence,
        now,
        action: { kind: 'block', code: 'VICT_ORCH_OUTCOME_UNKNOWN', reason: decision.reason },
        events: [
          {
            type: 'run.blocked',
            steps: run.steps,
            code: 'VICT_ORCH_OUTCOME_UNKNOWN',
            reason: decision.reason,
            remediation: 'Resolve the blocked run through the operator API (runtime.resolveBlocked).',
            ...envelope,
            timestamp: now,
          },
        ] as unknown as readonly OrchestrationEventInput[],
        run: { status: 'blocked' },
      });
      blocked.push({
        runId: claim.runId,
        attemptId: claim.attempt.attemptId,
        effectClass: claim.attempt.effectClass,
        reason: decision.reason,
      });
      continue;
    }
    await deps.orchestration.recoverAttempt({
      runId: claim.runId,
      attemptId: claim.attempt.attemptId,
      expectedAttemptFence: claim.attempt.fence,
      now,
      action: { kind: 'reclaim' },
      events: [] as unknown as readonly OrchestrationEventInput[],
      run: { status: 'running' },
    });
    reclaimed.push({
      runId: claim.runId,
      attemptId: claim.attempt.attemptId,
      effectClass: claim.attempt.effectClass,
    });
  }
  return { reclaimed, blocked, skipped };
}

function isTerminal(status: string): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}
