import type { VictError } from '@vict/contracts';
import {
  backoffDelayMs,
  isRetryable,
  resolveDecisionRoute,
  type CompiledGraph,
  type CompiledNode,
  type DecisionResult,
  type EffectClass,
  type RetryPolicy,
  type SignalWaitDefinition,
  type TimerWaitDefinition,
} from '@vict/kernel';
import {
  canonicalBranchLineage,
  forkChildTokenId,
  forkLineageOf,
  joinTokenId,
  waitIdFor,
} from './orchestration-activation.js';
import type {
  AttemptContinuation,
  AttemptOutcome,
  ClaimedAttempt,
  NewWaitCommand,
} from './orchestration-store-types.js';

/**
 * Continuation planning for one completed attempt, derived purely from the
 * pinned plan, the outcome, and the durable state the driver already read.
 * The store validates every guard; a stale driver view surfaces as a
 * structured conflict and the driver re-derives from fresh state.
 *
 * Effect-aware ambiguity rules for timed-out outcomes:
 * - pure/read: retry when policy permits, else error-edge/fail;
 * - keyed write: retry with the same key when policy permits, else block;
 * - non-keyed write / irreversible: never replay — block.
 */

export interface PlanInput {
  readonly graph: CompiledGraph;
  readonly claim: ClaimedAttempt;
  readonly now: number;
  readonly outcome: AttemptOutcome;
  /** For failed/timeout outcomes: the structured safe error. */
  readonly error?: VictError;
  /** For successful completions: the validated output (or decision result). */
  readonly validatedOutput?: unknown;
  /** The pinned descriptor of the node's capability (effect + idempotency). */
  readonly descriptor?: { readonly effect: EffectClass; readonly idempotency?: 'keyed' };
  /** True when the claimed node is a fork/join-adjacent branch arrival. */
  readonly isBranchArrival?: boolean;
}

export type PlannedCompletion =
  | {
      readonly kind: 'transition';
      readonly continuation: AttemptContinuation;
      readonly runStatus: 'running' | 'waiting' | 'blocked' | 'completed' | 'failed';
    }
  | { readonly kind: 'invalid'; readonly error: VictError };

export function invalidOutcome(message: string): VictError {
  return { code: 'VICT_ORCH_INVALID_TRANSITION', message, retryable: false } as unknown as VictError;
}

export function blockedOutcome(code: string, reason: string): { continuation: AttemptContinuation; runStatus: 'blocked' } {
  return { continuation: { kind: 'block', code, reason }, runStatus: 'blocked' };
}

function safeCode(error: VictError | undefined): string {
  return error?.code ?? 'VICT_ORCH_CAPABILITY_FAILED';
}

export function planContinuation(input: PlanInput): PlannedCompletion {
  const { graph, claim, outcome } = input;
  const node = graph.getNode(claim.token.nodeId);
  if (!node) {
    return { kind: 'invalid', error: invalidOutcome(`Compiled graph '${graph.id}' has no node '${claim.token.nodeId}'.`) };
  }
  if (outcome.kind === 'cancelled') {
    return { kind: 'transition', continuation: { kind: 'none' }, runStatus: 'running' };
  }
  if (outcome.kind === 'outcome_unknown') {
    return {
      kind: 'transition',
      continuation: {
        kind: 'block',
        code: 'VICT_ORCH_OUTCOME_UNKNOWN',
        reason: 'The attempt outcome is unknown; explicit operator resolution is required.',
      },
      runStatus: 'blocked',
    };
  }
  if (outcome.kind === 'failed') {
    return planFailure(input, safeCode(outcome.error));
  }
  if (outcome.kind === 'timed_out') {
    return planTimeout(input);
  }
  return planSuccess(input);
}

/** Failure routing: bounded retry → error edge → branch failure → run failed. */
function planFailure(input: PlanInput, code: string): PlannedCompletion {
  const { graph, claim } = input;
  const node = graph.getNode(claim.token.nodeId) as CompiledNode;
  if (node.retry !== undefined && claim.attempt.attemptNumber < node.retry.maxAttempts && isRetryable(node.retry, code)) {
    return {
      kind: 'transition',
      continuation: {
        kind: 'retry',
        dueAt: input.now + backoffDelayMs(node.retry, claim.attempt.attemptNumber),
        retryOnCode: code,
        maxAttempts: node.retry.maxAttempts,
      },
      runStatus: 'running',
    };
  }
  const errorTarget = graph.errorTargetOf(node.id);
  if (errorTarget !== undefined) {
    return {
      kind: 'transition',
      continuation: { kind: 'advance', toNodeId: errorTarget, payload: input.error },
      runStatus: 'running',
    };
  }
  if (claim.token.forkId !== null) {
    return { kind: 'transition', continuation: { kind: 'branchFailure' }, runStatus: 'failed' };
  }
  return { kind: 'transition', continuation: { kind: 'none' }, runStatus: 'failed' };
}

/** Timeout routing under effect-specific ambiguity rules (handoff §13). */
function planTimeout(input: PlanInput): PlannedCompletion {
  const { graph, claim } = input;
  const node = graph.getNode(claim.token.nodeId) as CompiledNode;
  const effect = input.descriptor?.effect ?? 'pure';
  const keyed = input.descriptor?.idempotency === 'keyed';
  const retry = node.retry;
  if (
    retry !== undefined &&
    claim.attempt.attemptNumber < retry.maxAttempts &&
    isRetryable(retry, 'timeout')
  ) {
    if (effect === 'irreversible') {
      const blocked = blockedOutcome(
        'VICT_ORCH_AMBIGUOUS_TIMEOUT',
        'A timed-out irreversible attempt is never replayed; operator resolution is required.',
      );
      return { kind: 'transition', ...blocked };
    }
    if (effect === 'write' && !keyed) {
      const blocked = blockedOutcome(
        'VICT_ORCH_OUTCOME_UNKNOWN',
        'A timed-out write without keyed idempotency has an ambiguous outcome.',
      );
      return { kind: 'transition', ...blocked };
    }
    return {
      kind: 'transition',
      continuation: {
        kind: 'retry',
        dueAt: input.now + backoffDelayMs(retry, claim.attempt.attemptNumber),
        retryOnCode: 'timeout',
        maxAttempts: retry.maxAttempts,
      },
      runStatus: 'running',
    };
  }
  if (effect === 'write' || effect === 'irreversible') {
    const blocked = blockedOutcome(
      'VICT_ORCH_OUTCOME_UNKNOWN',
      'A timed-out unsafe effect has an ambiguous outcome; it is never replayed automatically.',
    );
    return { kind: 'transition', ...blocked };
  }
  return planFailure(input, 'timeout');
}

/** Success routing: decision routes, waits, forks, terminal, and branch arrival. */
function planSuccess(input: PlanInput): PlannedCompletion {
  const { graph, claim } = input;
  const node = graph.getNode(claim.token.nodeId) as CompiledNode;
  if (node.kind === 'decision') {
    const result = input.validatedOutput as DecisionResult | undefined;
    if (!result || typeof result !== 'object' || typeof result.route !== 'string') {
      return {
        kind: 'invalid',
        error: invalidOutcome(`Decision node '${node.id}' must return a validated DecisionResult.`),
      };
    }
    const resolved = resolveDecisionRoute(graph.routeTargetsOf(node.id), result);
    if (!resolved.ok) {
      return {
        kind: 'invalid',
        error: invalidOutcome(
          resolved.code === 'EMPTY_ROUTE'
            ? `Decision node '${node.id}' returned an empty route; no target was invoked.`
            : `Decision node '${node.id}' returned undeclared route '${resolved.route}'; no target was invoked.`,
        ),
      };
    }
    return {
      kind: 'transition',
      continuation: { kind: 'advance', toNodeId: resolved.target, payload: result.value },
      runStatus: 'running',
    };
  }
  if (node.kind === 'wait') {
    const wait = node.wait as SignalWaitDefinition | TimerWaitDefinition;
    const waitId = waitIdFor(claim.token.runId, claim.token.lineage, node.id);
    if (wait.kind === 'timer') {
      const command: NewWaitCommand = {
        waitId,
        nodeId: node.id,
        kind: 'timer',
        signalName: null,
        contractId: null,
        contractRevision: null,
        dueAt: input.now + wait.delayMs,
        timeoutAt: null,
      };
      return { kind: 'transition', continuation: { kind: 'wait', wait: command }, runStatus: 'waiting' };
    }
    const command: NewWaitCommand = {
      waitId,
      nodeId: node.id,
      kind: 'signal',
      signalName: wait.name,
      contractId: wait.contract ?? null,
      contractRevision: null,
      dueAt: null,
      timeoutAt: wait.timeoutMs !== undefined ? input.now + wait.timeoutMs : null,
    };
    return { kind: 'transition', continuation: { kind: 'wait', wait: command }, runStatus: 'waiting' };
  }
  if (node.kind === 'fork') {
    const joinId = graph.joinOfFork(node.id);
    if (joinId === undefined) {
      return { kind: 'invalid', error: invalidOutcome(`Fork node '${node.id}' has no matching join.`) };
    }
    const children = graph
      .branchKeysOf(node.id)
      .map((branchKey) => ({
        branchKey,
        toNodeId: graph.branchTargetsOf(node.id)[branchKey] as string,
        forkId: node.id,
        lineage: canonicalBranchLineage(claim.token.lineage, node.id, branchKey),
        tokenId: forkChildTokenId(claim.token.runId, node.id, branchKey),
      }));
    return { kind: 'transition', continuation: { kind: 'fork', joinId, children }, runStatus: 'running' };
  }
  const successTarget = graph.successTargetOf(node.id);
  if (successTarget === undefined) {
    if (claim.token.forkId !== null) {
      // A branch path escaping to a terminal is a compile-time diagnostic;
      // treat defensively as a branch failure.
      return { kind: 'transition', continuation: { kind: 'branchFailure' }, runStatus: 'failed' };
    }
    return { kind: 'transition', continuation: { kind: 'none' }, runStatus: 'completed' };
  }
  const targetNode = graph.getNode(successTarget);
  if (targetNode !== undefined && targetNode.kind === 'join') {
    // Branch arrival: the branch token is consumed; the join fires once.
    return {
      kind: 'transition',
      continuation: {
        kind: 'branchArrival',
        forkId: targetNode.fork as string,
        joinId: successTarget,
        branchKey: claim.token.branchKey ?? '',
        joinContinuation: {
          tokenId: joinTokenId(claim.token.runId, successTarget),
          toNodeId: graph.successTargetOf(successTarget) as string,
          lineage: forkLineageOf(claim.token.lineage, targetNode.fork as string, claim.token.branchKey ?? ''),
        },
      },
      runStatus: 'running',
    };
  }
  return {
    kind: 'transition',
    continuation: { kind: 'advance', toNodeId: successTarget, payload: input.validatedOutput },
    runStatus: 'running',
  };
}