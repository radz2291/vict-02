/**
 * Authoring vocabulary for application graphs (Stage 01–03 verified graph
 * language, now owned by the stable authoring ABI).
 *
 * Moved to `@vict/sdk` by Stage 04 so the kernel and runtime CONSUME public
 * authoring declarations instead of owning author-facing definitions.
 * Schema-neutral: no schema library, no runtime, and no UI framework
 * appears anywhere in these declarations.
 */

/** Bounded declarative retry policy. `maxAttempts` includes the first attempt. */
export interface RetryPolicy {
  /** Total attempts allowed, including the first. Must be 1..RETRY_MAX_ATTEMPTS_LIMIT. */
  readonly maxAttempts: number;
  /** Stable safe error codes that trigger a retry (never raw messages). */
  readonly retryOn: readonly string[];
  readonly backoff:
    | { readonly kind: 'fixed'; readonly delayMs: number }
    | {
        readonly kind: 'exponential';
        readonly initialMs: number;
        readonly multiplier: number;
        readonly maxMs: number;
      };
}

/** Hard upper bound for `RetryPolicy.maxAttempts` (compiler-enforced). */
export const RETRY_MAX_ATTEMPTS_LIMIT = 10;
/**
 * Operational upper bound for a single retry-backoff delay or a single
 * capability-attempt timeout (compiler-enforced). This is an operational
 * scheduling bound for bounded retry/timeout machinery — it does NOT apply
 * to wait-level `timeoutMs`/`delayMs`, which support long-lived waits
 * (approvals, reminders, delayed workflows) and accept any positive finite
 * safe integer that stays within the safe persisted-timestamp domain at
 * scheduling time.
 */
export const MAX_DELAY_MS_LIMIT = 7 * 24 * 60 * 60 * 1000;
/** Hard upper bound for fork branch count (compiler-enforced). */
export const MAX_BRANCH_COUNT = 64;

export interface SignalWaitDefinition {
  readonly kind: 'signal';
  /** Exact signal name this wait accepts. */
  readonly name: string;
  /** Optional contract the signal payload must pass before the wait resolves. */
  readonly contract?: string;
  /**
   * Optional durable timeout in milliseconds. When present (`undefined` or
   * `null` means absent) it must be a positive finite safe integer in
   * milliseconds (zero, negative, fractional, NaN and infinite values are
   * rejected at graph compilation with the stable `INVALID_WAIT_BOUND`
   * diagnostic). There is NO seven-day ceiling: waits support long-lived
   * approvals, reminders, and delayed workflows. Durations whose scheduled
   * deadline would exceed the safe persisted-timestamp domain are rejected
   * structurally when the timer is scheduled. A declared timeout requires
   * a declared `timeout` edge.
   */
  readonly timeoutMs?: number;
}

export interface TimerWaitDefinition {
  readonly kind: 'timer';
  /**
   * Relative delay from the moment the wait becomes durable. Must be a
   * positive finite safe integer in milliseconds (see
   * `SignalWaitDefinition.timeoutMs`); compilation rejects anything else
   * with `INVALID_WAIT_BOUND`. Long-lived delays (days, months, a year)
   * are supported; durations that would overflow the safe persisted
   * timestamp domain are rejected when scheduled.
   */
  readonly delayMs: number;
}

export interface CapabilityNodeFields {
  readonly id: string;
  /** Capability invoked at this node. */
  readonly capability: string;
  /** Optional contract id overriding the capability's declared input contract. */
  readonly input?: string;
  /** Optional contract id overriding the capability's declared output contract. */
  readonly output?: string;
  /** Optional bounded retry policy. Compilation enforces effect compatibility. */
  readonly retry?: RetryPolicy;
  /** Optional invocation deadline in milliseconds. Persisted before invocation. */
  readonly timeoutMs?: number;
}

export interface CapabilityNodeDefinition extends CapabilityNodeFields {
  readonly kind?: 'capability';
}

/** A decision node invokes a pure capability and routes by declared typed key. */
export interface DecisionNodeDefinition extends CapabilityNodeFields {
  readonly kind: 'decision';
}

/** A wait node parks the continuation behind a durable signal wait or timer. */
export interface WaitNodeDefinition {
  readonly id: string;
  readonly kind: 'wait';
  readonly wait: SignalWaitDefinition | TimerWaitDefinition;
}

/** A fork node fans out into a statically declared, bounded set of branches. */
export interface ForkNodeDefinition {
  readonly id: string;
  readonly kind: 'fork';
  /** Id of the matching join node. */
  readonly join: string;
  /** Optional concurrency bound for branch execution (default: unbounded within the worker pool). */
  readonly maxConcurrency?: number;
}

/** A join node consumes exactly one completed token per declared branch key. */
export interface JoinNodeDefinition {
  readonly id: string;
  readonly kind: 'join';
  /** Id of the matching fork node. */
  readonly fork: string;
  /** Optional contract id validating the canonical joined output. */
  readonly output?: string;
}

export type GraphNodeDefinition =
  | CapabilityNodeDefinition
  | DecisionNodeDefinition
  | WaitNodeDefinition
  | ForkNodeDefinition
  | JoinNodeDefinition;

/** Edge kinds. `route` carries a typed decision key; `branch` connects a fork to a branch; `timeout` leaves a timed signal wait. */
export type GraphEdgeKind = 'success' | 'error' | 'route' | 'branch' | 'timeout';

interface EdgeFields {
  readonly from: string;
  readonly to: string;
}

export interface SuccessEdgeDefinition extends EdgeFields {
  readonly kind?: 'success';
}

export interface ErrorEdgeDefinition extends EdgeFields {
  readonly kind: 'error';
}

export interface RouteEdgeDefinition extends EdgeFields {
  readonly kind: 'route';
  /** Non-empty declared route key. Unique per source node. */
  readonly key: string;
}

export interface BranchEdgeDefinition extends EdgeFields {
  readonly kind: 'branch';
  /** Non-empty declared branch key. Unique per fork node. */
  readonly key: string;
}

export interface TimeoutEdgeDefinition extends EdgeFields {
  readonly kind: 'timeout';
}

export type GraphEdgeDefinition =
  | SuccessEdgeDefinition
  | ErrorEdgeDefinition
  | RouteEdgeDefinition
  | BranchEdgeDefinition
  | TimeoutEdgeDefinition;

/** The validated result a decision capability must return. */
export interface DecisionResult {
  /** Must match exactly one declared route key of the decision node. */
  readonly route: string;
  /** Validated decision value; becomes the input of the routed target node. */
  readonly value: unknown;
}

export interface ApplicationGraphDefinition {
  readonly id: string;
  /** Id of the entry node; exactly one entry per graph for Night 01. */
  readonly entry: string;
  readonly nodes: readonly GraphNodeDefinition[];
  readonly edges: readonly GraphEdgeDefinition[];
}
