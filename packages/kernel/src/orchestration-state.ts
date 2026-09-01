/**
 * Pure durable-orchestration state model.
 *
 * These types and helpers define the serializable durable state and the
 * pure state machines the runtime and stores enforce. The kernel performs
 * no I/O: persistence, clocks, and randomness stay behind ports in the
 * runtime; this module only decides what is legal and what comes next.
 *
 * All identifiers that need randomness are supplied by the environment;
 * everything here is derived from stable durable identity.
 */

import type { EffectClass, RetryPolicy } from './types.js';

/* ------------------------------------------------------------------ */
/* Durable records                                                     */
/* ------------------------------------------------------------------ */

/**
 * Serializable durable continuation token state. Tokens are the unit of
 * work ownership; a token identifies one current node, its branch lineage,
 * and (via the private checkpoint boundary) its continuation payload.
 *
 * Token IDs are derived deterministically from run/node/branch/generation
 * identity; randomness enters only through an injected ID port and never
 * affects activation identity.
 */
export interface DurableTokenState {
  readonly tokenId: string;
  readonly runId: string;
  readonly activationVersion: string;
  readonly nodeId: string;
  readonly status:
    | 'ready'
    | 'claimed'
    | 'waiting'
    | 'completed'
    | 'joined'
    | 'cancelled'
    | 'blocked';
  /** Parent token when this token was created by a fork. */
  readonly parentTokenId: string | null;
  /** Canonical branch lineage, e.g. `"fork1.a"`; empty for the root token. */
  readonly lineage: string;
  /** Fork node id when this token is a branch child. */
  readonly forkId: string | null;
  /** Branch key when this token is a branch child. */
  readonly branchKey: string | null;
  /** Monotonic revision used as an optimistic-concurrency/fencing token. */
  readonly revision: number;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/**
 * Serializable durable attempt state for one logical invocation attempt.
 * The logical invocation is stable across retries; the attempt id and
 * number change per attempt.
 */
export interface DurableAttemptState {
  readonly attemptId: string;
  readonly invocationId: string;
  readonly runId: string;
  readonly tokenId: string;
  readonly nodeId: string;
  readonly capabilityId: string;
  readonly attemptNumber: number;
  readonly effectClass: EffectClass;
  /** Stable idempotency key, when applicable. */
  readonly idempotencyKey: string | null;
  readonly state:
    | 'ready'
    | 'claimed'
    | 'started'
    | 'completed'
    | 'failed'
    | 'timed_out'
    | 'cancelled'
    | 'outcome_unknown';
  readonly ownerId: string | null;
  /** Lease/ownership expiry (epoch ms), when claimed. */
  readonly leaseExpiresAt: number | null;
  /** Persisted invocation deadline, when the node declares a timeout. */
  readonly deadlineAt: number | null;
  /** Monotonic fence; completion commands must carry the current fence. */
  readonly fence: number;
  /** Due time for a scheduled retry attempt (durable backoff timer). */
  readonly retryDueAt: number | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Serializable durable wait state (signal wait or timer wait). */
export interface DurableWaitState {
  readonly waitId: string;
  readonly runId: string;
  readonly tokenId: string;
  readonly nodeId: string;
  readonly activationVersion: string;
  readonly kind: 'signal' | 'timer';
  /** Expected signal name (signal waits only). */
  readonly signalName: string | null;
  /** Signal payload contract identity (signal waits only). */
  readonly contractId: string | null;
  readonly contractRevision: string | null;
  /** Absolute due time for timer waits. */
  readonly dueAt: number | null;
  /** Absolute timeout for timed signal waits. */
  readonly timeoutAt: number | null;
  readonly status: 'open' | 'resolved' | 'cancelled';
  readonly revision: number;
  readonly createdAt: number;
  readonly resolvedAt: number | null;
  /** Winning resolution identity (signal id, timer id, or cancellation request id). */
  readonly resolvedBy: string | null;
}

/** A recorded signal receipt (safe identity/hash metadata only, never raw payload). */
export interface SignalReceiptRecord {
  readonly signalId: string;
  readonly runId: string;
  readonly waitId: string | null;
  readonly signalName: string | null;
  /** Canonical command hash used for duplicate/conflict detection. */
  readonly commandHash: string;
  readonly status: 'accepted' | 'duplicate' | 'conflict' | 'rejected';
  readonly eventSeq: number | null;
  readonly createdAt: number;
}

/** One completed branch result of a fork (canonical join membership). */
export interface BranchResultRecord {
  readonly runId: string;
  readonly forkId: string;
  readonly joinId: string;
  readonly branchKey: string;
  readonly tokenId: string;
  /** True when the branch failed unhandled. */
  readonly failed: boolean;
  readonly createdAt: number;
}

/** Serializable durable run-level orchestration state snapshot (read model). */
export interface OrchestrationSnapshot {
  readonly runId: string;
  readonly activationVersion: string;
  readonly status:
    | 'created'
    | 'running'
    | 'waiting'
    | 'blocked'
    | 'completed'
    | 'failed'
    | 'cancelled';
  readonly steps: number;
  readonly recordRevision: number;
  readonly nextEventSeq: number;
  readonly tokens: readonly DurableTokenState[];
  readonly attempts: readonly DurableAttemptState[];
  readonly waits: readonly DurableWaitState[];
  readonly branchResults: readonly BranchResultRecord[];
  readonly cancellation: { readonly requestId: string; readonly reasonCode: string } | null;
}

/* ------------------------------------------------------------------ */
/* Pure state machines                                                 */
/* ------------------------------------------------------------------ */

/** Token status transitions (runtime and stores enforce the same table). */
export const TOKEN_TRANSITIONS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  ready: ['claimed', 'waiting', 'cancelled', 'blocked'],
  claimed: ['ready', 'waiting', 'completed', 'cancelled', 'blocked'],
  waiting: ['ready', 'cancelled', 'blocked'],
  completed: [],
  joined: [],
  cancelled: [],
  blocked: ['ready', 'cancelled'],
});

/** Attempt status transitions. */
export const ATTEMPT_TRANSITIONS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  ready: ['claimed', 'cancelled'],
  claimed: ['started', 'cancelled'],
  started: ['completed', 'failed', 'timed_out', 'cancelled', 'outcome_unknown'],
  completed: [],
  failed: [],
  timed_out: [],
  cancelled: [],
  outcome_unknown: ['completed', 'failed'],
});

/** Run status transitions (handoff §9.1 lifecycle). */
export const RUN_TRANSITIONS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  created: ['running'],
  running: ['running', 'waiting', 'blocked', 'completed', 'failed', 'cancelled'],
  waiting: ['waiting', 'running', 'cancelled'],
  blocked: ['blocked', 'running', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
});

/** True when the given run status transition is legal. */
export function canTransitionRun(from: string, to: string): boolean {
  return (RUN_TRANSITIONS[from] ?? []).includes(to);
}

/** True when the given token status transition is legal. */
export function canTransitionToken(from: string, to: string): boolean {
  return (TOKEN_TRANSITIONS[from] ?? []).includes(to);
}

/** True when the given attempt status transition is legal. */
export function canTransitionAttempt(from: string, to: string): boolean {
  return (ATTEMPT_TRANSITIONS[from] ?? []).includes(to);
}

/* ------------------------------------------------------------------ */
/* Pure decision helpers                                               */
/* ------------------------------------------------------------------ */

/**
 * Pure deterministic backoff: the delay before the retry of the attempt
 * numbered `attemptNumber` (the attempt that just failed, 1-based). Fixed
 * backoff is constant; exponential grows as initialMs * multiplier^n and is
 * capped at maxMs. Non-jittered and reproducible.
 */
export function backoffDelayMs(policy: RetryPolicy, attemptNumber: number): number {
  const backoff = policy.backoff;
  if (backoff.kind === 'fixed') {
    return backoff.delayMs;
  }
  const exponent = Math.max(0, attemptNumber - 1);
  const raw = backoff.initialMs * Math.pow(backoff.multiplier, exponent);
  if (!Number.isFinite(raw)) {
    return backoff.maxMs;
  }
  return Math.min(backoff.maxMs, Math.round(raw));
}

/**
 * Pure retry classification. A retry is allowed only when the failure's
 * safe stable code is explicitly listed in `retryOn` (the timeout class is
 * the stable code `'timeout'`). Raw thrown messages never classify.
 */
export function isRetryable(policy: RetryPolicy, safeCode: string): boolean {
  if (safeCode === 'timeout' && policy.retryOn.includes('timeout')) {
    return true;
  }
  return policy.retryOn.includes(safeCode);
}

/** Validated decision routing outcome. */
export type DecisionRouteOutcome =
  | { readonly ok: true; readonly target: string }
  | { readonly ok: false; readonly code: 'EMPTY_ROUTE' | 'UNKNOWN_ROUTE'; readonly route: string };

/**
 * Validate a decision result against a decision node's declared route
 * targets. Returns the target node id, or a structured failure. No
 * expressions are evaluated: the route must be a declared key.
 */
export function resolveDecisionRoute(
  routes: Readonly<Record<string, string>>,
  result: DecisionResultInput,
): DecisionRouteOutcome {
  const route = result.route;
  if (typeof route !== 'string' || route.length === 0) {
    return { ok: false, code: 'EMPTY_ROUTE', route: '' };
  }
  const target = routes[route];
  if (target === undefined) {
    return { ok: false, code: 'UNKNOWN_ROUTE', route };
  }
  return { ok: true, target };
}

/** The validated result a decision capability must return. */
export interface DecisionResultInput {
  readonly route: string;
  readonly value: unknown;
}

/**
 * Canonical join output: branch results keyed by branch key in
 * lexicographic order, never by completion timing or insertion order.
 */
export function canonicalJoinOutput(results: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(results).sort()) {
    out[key] = results[key];
  }
  return out;
}

/** Inputs for pure quiescence derivation. */
export interface QuiescenceInput {
  readonly rootTerminal: 'completed' | 'failed' | 'cancelled' | null;
  readonly hasReadyWork: boolean;
  readonly hasInFlightWork: boolean;
  readonly hasOpenWaits: boolean;
  readonly hasBlockedWork: boolean;
  readonly cancellationRequested: boolean;
}

/**
 * Pure quiescence derivation (handoff §9.3): derive the durable run status
 * from durable work, never from in-memory queue state.
 *
 * - terminal root completion wins;
 * - `running` when ready/in-flight work exists;
 * - `cancelled` when a cancellation request exists and no eligible work remains;
 * - `blocked` when continuation requires explicit resolution;
 * - `waiting` when all unresolved work is parked behind waits/timers/joins.
 */
export function deriveRunStatus(
  input: QuiescenceInput,
): 'running' | 'waiting' | 'blocked' | 'completed' | 'failed' | 'cancelled' {
  if (input.rootTerminal !== null) {
    return input.rootTerminal;
  }
  if (input.hasReadyWork || input.hasInFlightWork) {
    return 'running';
  }
  if (input.cancellationRequested) {
    return 'cancelled';
  }
  if (input.hasBlockedWork) {
    return 'blocked';
  }
  if (input.hasOpenWaits) {
    return 'waiting';
  }
  // No work, no waits, nothing blocked, not terminal: blocked so quiescence
  // never fabricates a completed run.
  return 'blocked';
}