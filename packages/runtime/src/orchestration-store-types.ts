import type {
  BranchResultRecord,
  DurableAttemptState,
  DurableTokenState,
  DurableWaitState,
  EffectClass,
  ExecutionMode,
  KernelEvent,
  OutputSummary,
  SignalReceiptRecord,
} from '@vict/kernel';
import type { VictError } from '@vict/contracts';
import type { PayloadRetention } from './types.js';

/**
 * A safe event input: a kernel event without its dense sequence number.
 * The store assigns sequence numbers inside the transition transaction and
 * validates each event's identity columns against the run.
 */
export type OrchestrationEventInput = KernelEvent extends infer E
  ? E extends KernelEvent
    ? Omit<E, 'seq'>
    : never
  : never;

/**
 * Stage 03 durable orchestration store port.
 *
 * Every command is an atomic semantic transition: state changes and their
 * event batches commit together or not at all (DATA-003), guarded by
 * optimistic revisions (expected run record revision, token revisions,
 * wait revisions, attempt fences). Commands express semantic transitions —
 * they never expose arbitrary row mutation.
 *
 * Both the in-memory adapter and the SQLite adapter implement this port and
 * must pass the same conformance suite. Implementations must reject stale
 * owners/fences/revisions with structured conflicts and must never let a
 * stale completion mutate canonical run state.
 *
 * Checkpoint payloads, join branch-output payloads, and signal-command
 * hashes are PRIVATE OPERATIONAL STATE: they exist only to continue active,
 * waiting, or blocked work. They are never part of ordinary run records,
 * events, list output, or trace diagnostics, and terminal cleanup
 * removes/tombstones them.
 */

/** A ready token was not claimed (quiescent, cancelled, or already owned). */
export type ClaimRejection = 'quiescent' | 'cancelled' | 'terminal' | 'conflict';

/** Node knowledge the store needs to record attempt intent. Supplied by the runtime driver from the pinned activation plan. */
export interface NodeExecutionPlanEntry {
  readonly capabilityId: string;
  readonly effectClass: EffectClass;
  /** Persisted deadline, when the node declares a timeout. */
  readonly deadlineAt: number | null;
  /** Stable idempotency key for the logical invocation, when applicable. */
  readonly idempotencyKey: string | null;
}

/** Planning callbacks the store uses inside the claim transaction. */
export interface ClaimPlanner {
  /** Deterministic logical-invocation identity for one token+node visit. */
  readonly invocationIdFor: (token: DurableTokenState) => string;
  /** Deterministic attempt id for the next attempt of an invocation. */
  readonly attemptIdFor: (token: DurableTokenState, attemptNumber: number) => string;
  /** Execution plan entry for the token's current node (capability/effect/timeout/idempotency). */
  readonly planFor: (token: DurableTokenState) => NodeExecutionPlanEntry;
}

export interface ClaimReadyTokenCommand {
  readonly runId: string;
  /** Injected process/worker owner id. */
  readonly ownerId: string;
  /** Absolute lease expiry (epoch ms). */
  readonly leaseExpiresAt: number;
  readonly now: number;
  readonly planner: ClaimPlanner;
}

export interface ClaimedAttempt {
  readonly token: DurableTokenState;
  readonly attempt: DurableAttemptState;
  readonly invocationId: string;
  /** Private operational checkpoint payload for the claimed node's input. */
  readonly checkpoint: unknown;
  readonly deadlineAt: number | null;
  readonly idempotencyKey: string | null;
  /** The run record revision AFTER the claim transaction committed. */
  readonly runRecordRevision: number;
  /** The next event sequence AFTER the claim transaction committed. */
  readonly runNextEventSeq: number;
}

export type ClaimReadyTokenResult =
  | { readonly claimed: true; readonly claim: ClaimedAttempt }
  | { readonly claimed: false; readonly reason: ClaimRejection };

/** The decision the kernel plan produced for one completed attempt. */
export type AttemptContinuation =
  | { readonly kind: 'none' }
  /** Move the token to the next node with a new checkpoint payload. */
  | { readonly kind: 'advance'; readonly toNodeId: string; readonly payload: unknown }
  /** Park the token behind a durable wait. */
  | { readonly kind: 'wait'; readonly wait: NewWaitCommand }
  /** Create the bounded set of branch child tokens. */
  | {
      readonly kind: 'fork';
      readonly joinId: string;
      readonly children: readonly {
        readonly branchKey: string;
        readonly toNodeId: string;
        readonly forkId: string;
        readonly lineage: string;
        readonly tokenId: string;
      }[];
    }
  /** Record one branch arrival; the store fires the join exactly once when the final key arrives. */
  | {
      readonly kind: 'branchArrival';
      readonly forkId: string;
      readonly joinId: string;
      readonly branchKey: string;
      /** Applied by the store only when this arrival is the final one. */
      readonly joinContinuation?: { readonly tokenId: string; readonly toNodeId: string; readonly lineage: string };
    }
  /** One unhandled branch failure: cancel unfinished siblings and fail the run once. */
  | { readonly kind: 'branchFailure' }
  /** Schedule a durable retry timer for the same logical invocation. */
  | { readonly kind: 'retry'; readonly dueAt: number; readonly retryOnCode: string; readonly maxAttempts: number }
  /** The token needs explicit operator resolution. */
  | { readonly kind: 'block'; readonly code: string; readonly reason: string };

export interface NewWaitCommand {
  readonly waitId: string;
  readonly nodeId: string;
  readonly kind: 'signal' | 'timer';
  readonly signalName: string | null;
  readonly contractId: string | null;
  readonly contractRevision: string | null;
  /** Absolute due time (timer waits). */
  readonly dueAt: number | null;
  /** Absolute timeout (timed signal waits). */
  readonly timeoutAt: number | null;
}

export type AttemptOutcome =
  | { readonly kind: 'completed'; readonly outputSummary: OutputSummary }
  | { readonly kind: 'failed'; readonly error: VictError }
  | { readonly kind: 'timed_out' }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'outcome_unknown'; readonly error: VictError };

export interface CompleteAttemptCommand {
  readonly runId: string;
  readonly attemptId: string;
  readonly ownerId: string;
  /** Fencing token: the attempt fence observed at claim time. */
  readonly expectedAttemptFence: number;
  readonly now: number;
  readonly outcome: AttemptOutcome;
  readonly continuation: AttemptContinuation;
  /**
   * Ordered safe events. The store assigns the dense sequence numbers
   * starting at the stored next sequence inside the transaction and
   * validates each event's identity columns.
   */
  readonly events: readonly OrchestrationEventInput[];
  /** Run-state fields the transition applies (status, steps, terminal fields). */
  readonly run: {
    readonly status?: 'running' | 'waiting' | 'blocked' | 'completed' | 'failed' | 'cancelled';
    readonly steps?: number;
    readonly currentNodeId?: string | null;
    readonly completedAt?: number | null;
    readonly outputSummary?: OutputSummary;
    readonly output?: unknown;
    readonly error?: VictError;
  };
  /** New checkpoint payload for the claimed token (advance), omitted otherwise. */
  readonly checkpoint?: { readonly tokenId: string; readonly payload: unknown } | null;
  /** Child checkpoints to create (fork children), keyed by token id. */
  readonly childCheckpoints?: readonly { readonly tokenId: string; readonly payload: unknown }[];
  /** Checkpoint removals (branch arrival consumes the branch token's payload). */
  readonly removeCheckpoints?: readonly string[];
  /** Private operational output payload of the arriving branch (branchArrival continuations). */
  readonly branchOutput?: unknown;
  /** All declared branch keys of the fork (branchArrival continuations) — join membership reference. */
  readonly declaredBranchKeys?: readonly string[];
}

export interface CompleteAttemptResult {
  /** The attempt state after the transition. */
  readonly attempt: DurableAttemptState;
  readonly token: DurableTokenState | null;
  /** Branch results recorded by this transition, when the continuation was a branch arrival. */
  readonly branchResult: BranchResultRecord | null;
  /** True when this transition fired the join (exactly once per fork). */
  readonly joinFired: boolean;
  /** Run record revision after the transition. */
  readonly runRecordRevision: number;
  /** Next event sequence after the transition. */
  readonly runNextEventSeq: number;
}

export interface SignalWaitCommand {
  readonly runId: string;
  readonly waitId: string;
  /** Caller-supplied non-empty idempotency key. */
  readonly signalId: string;
  /** Expected signal name (defense in depth). */
  readonly signalName?: string;
  /** Pre-validated signal payload. */
  readonly payload: unknown;
  /** Optimistic guard on the open wait. */
  readonly expectedWaitRevision?: number;
  /** Canonical command hash used for duplicate/conflict detection. */
  readonly commandHash: string;
  readonly now: number;
  /** Ordered safe events (signal.received, run.resumed). */
  readonly events: readonly OrchestrationEventInput[];
}

export type SignalDeliveryResult =
  | {
      readonly status: 'accepted';
      readonly waitId: string;
      readonly token: DurableTokenState;
      readonly runRecordRevision: number;
      readonly runNextEventSeq: number;
      readonly waitRevision: number;
    }
  | { readonly status: 'duplicate'; readonly signalId: string; readonly waitId: string }
  | { readonly status: 'already_resolved'; readonly waitId: string }
  | { readonly status: 'conflict'; readonly signalId: string };

export interface ResolveDueTimerCommand {
  readonly runId: string;
  readonly timerId: string;
  readonly ownerId: string;
  readonly expectedTimerFence: number;
  readonly now: number;
  readonly resolution:
    | { readonly kind: 'wake' }
    | { readonly kind: 'waitTimeout'; readonly toNodeId: string | null; readonly payload: unknown }
    | { readonly kind: 'retry' }
    | { readonly kind: 'cancel' };
  /** Ordered safe events (timer.fired, run.resumed, signal.routed, ...). */
  readonly events: readonly OrchestrationEventInput[];
  readonly run?: {
    readonly status?: 'running' | 'waiting' | 'blocked' | 'completed' | 'failed' | 'cancelled';
    readonly currentNodeId?: string | null;
    readonly steps?: number;
  };
  readonly checkpoint?: { readonly tokenId: string; readonly payload: unknown } | null;
  readonly outputSummary?: OutputSummary;
  readonly output?: unknown;
  readonly error?: VictError;
}

export interface ResolveDueTimerResult {
  readonly runRecordRevision: number;
  readonly runNextEventSeq: number;
  readonly applied: boolean;
}

export interface DueTimerRecord {
  readonly timerId: string;
  readonly runId: string;
  readonly kind: 'wait' | 'wait-timeout' | 'retry';
  readonly waitId: string | null;
  readonly attemptId: string | null;
  readonly tokenId: string | null;
  readonly dueAt: number;
  readonly revision: number;
}

export interface ClaimDueTimersCommand {
  readonly now: number;
  readonly limit: number;
  /** Restrict the pump to one run when provided. */
  readonly runId?: string;
  readonly ownerId: string;
  /** Lease expiry for claimed timers (epoch ms). */
  readonly leaseExpiresAt: number;
}

export interface ClaimDueTimersResult {
  readonly timers: readonly DueTimerRecord[];
}

export interface TimerRecord {
  readonly timerId: string;
  readonly runId: string;
  readonly kind: 'wait' | 'wait-timeout' | 'retry';
  readonly waitId: string | null;
  readonly attemptId: string | null;
  readonly tokenId: string | null;
  readonly dueAt: number;
  readonly status: 'scheduled' | 'firing' | 'fired' | 'cancelled';
  readonly ownerId: string | null;
  readonly leaseExpiresAt: number | null;
  readonly revision: number;
  readonly createdAt: number;
}

export interface RequestCancellationCommand {
  readonly runId: string;
  /** Caller-supplied non-empty idempotency key. */
  readonly requestId: string;
  /** Stable reason code from the safe vocabulary. */
  readonly reasonCode: string;
  readonly commandHash: string;
  readonly now: number;
  /** Ordered safe events (run.cancel_requested, run.cancelled, node.cancelled...). */
  readonly events: readonly OrchestrationEventInput[];
}

export type CancellationResult =
  | {
      readonly status: 'accepted' | 'duplicate';
      readonly runId: string;
      readonly runCancelledNow: boolean;
      readonly runRecordRevision: number;
      readonly runNextEventSeq: number;
    }
  | { readonly status: 'conflict'; readonly requestId: string }
  | { readonly status: 'unknown_run'; readonly runId: string }
  | { readonly status: 'already_terminal'; readonly runId: string; readonly runStatus: string };

export interface ApplyCancellationCommand {
  readonly runId: string;
  readonly now: number;
  readonly requestId: string;
  readonly reasonCode: string;
  /** Ordered safe events terminating the run. */
  readonly events: readonly OrchestrationEventInput[];
  readonly steps: number;
  /** Cancel remaining checkpoint payloads. */
  readonly removeCheckpoints: readonly string[];
}

export interface RecoverableClaim {
  readonly runId: string;
  readonly token: DurableTokenState;
  readonly attempt: DurableAttemptState;
  readonly leaseExpiresAt: number;
}

export interface RecoverAttemptCommand {
  readonly runId: string;
  readonly attemptId: string;
  readonly expectedAttemptFence: number;
  readonly now: number;
  readonly action:
    | { readonly kind: 'reclaim' }
    | { readonly kind: 'block'; readonly code: string; readonly reason: string };
  /** Ordered safe events. */
  readonly events: readonly OrchestrationEventInput[];
  readonly run?: {
    readonly status?: 'running' | 'waiting' | 'blocked' | 'completed' | 'failed' | 'cancelled';
    readonly currentNodeId?: string | null;
    readonly steps?: number;
    readonly error?: VictError;
  };
}

export interface RecoverOrchestrationCommand {
  readonly now: number;
}

export interface RecoverOrchestrationResult {
  /** Claims whose lease expired while their attempt was in flight. */
  readonly recoverable: readonly RecoverableClaim[];
  /** Runs parked in a quiescent nonterminal state (waiting/blocked). */
  readonly quiescent: readonly { readonly runId: string; readonly status: string }[];
}

export interface ResolveBlockedCommand {
  readonly runId: string;
  /** Caller-supplied non-empty idempotency key. */
  readonly resolutionId: string;
  readonly action: 'retry' | 'confirm_applied' | 'fail' | 'cancel';
  /** Validated output for confirm_applied (validated against the pinned output contract by the runtime before this command). */
  readonly output?: unknown;
  /** Approved safe failure code for the fail action. */
  readonly failCode?: string;
  readonly reasonCode: string;
  readonly commandHash: string;
  readonly expectedRunRevision: number;
  readonly now: number;
  /** Ordered safe events (operator.intervened plus resulting work events). */
  readonly events: readonly OrchestrationEventInput[];
  /** For confirm_applied: token advance target and payload (computed by the driver from the pinned plan). */
  readonly continuation?:
    | { readonly kind: 'advance'; readonly toNodeId: string; readonly payload: unknown }
    | { readonly kind: 'complete'; readonly outputSummary: OutputSummary; readonly output?: unknown }
    | { readonly kind: 'none' };
  readonly checkpoint?: { readonly tokenId: string; readonly payload: unknown } | null;
}

export type ResolveBlockedResult =
  | {
      readonly status: 'accepted' | 'duplicate';
      readonly runRecordRevision: number;
      readonly runNextEventSeq: number;
      readonly runStatus: string;
    }
  | { readonly status: 'conflict'; readonly resolutionId: string }
  | { readonly status: 'stale_revision'; readonly runId: string; readonly actualRunRevision: number }
  | { readonly status: 'unknown_run' }
  | { readonly status: 'not_blocked'; readonly runId: string; readonly runStatus: string }
  | { readonly status: 'already_resolved'; readonly resolutionId: string };

export interface CreateOrchestrationRunCommand {
  readonly runId: string;
  readonly graphId: string;
  readonly graphVersion: string;
  readonly capabilitySetVersion: string;
  readonly activationVersion: string;
  readonly mode: ExecutionMode;
  readonly retention: PayloadRetention;
  readonly rootTokenId: string;
  readonly entryNodeId: string;
  /** Private operational checkpoint payload (validated run input). */
  readonly checkpoint: unknown;
  /** Initial ordered safe events (typically `run.started`). */
  readonly events: readonly OrchestrationEventInput[];
  readonly now: number;
}

export interface StoredOrchestrationRun {
  readonly runId: string;
  readonly graphId: string;
  readonly graphVersion: string;
  readonly capabilitySetVersion: string;
  readonly activationVersion: string;
  readonly status: 'running' | 'waiting' | 'blocked' | 'completed' | 'failed' | 'cancelled';
  readonly mode: ExecutionMode;
  readonly retention: PayloadRetention;
  readonly steps: number;
  readonly currentNodeId: string | null;
  readonly recordRevision: number;
  readonly cancellation: { readonly requestId: string; readonly reasonCode: string } | null;
  /** Safe output summary (never a payload); present under summary/full retention. */
  readonly outputSummary?: OutputSummary;
  /** Complete validated output; present only under explicit full retention. */
  readonly output?: unknown;
  /** Sanitized structured terminal error. */
  readonly error?: VictError;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly completedAt: number | null;
}

export interface OrchestrationRunQuery {
  readonly graphId?: string;
  readonly activationVersion?: string;
  readonly status?: StoredOrchestrationRun['status'];
  readonly limit?: number;
}

/**
 * Durable orchestration store for token/attempt/wait/timer semantics.
 * In-memory and SQLite adapters implement the identical semantic commands.
 */
export interface OrchestrationStore {
  createOrchestrationRun(command: CreateOrchestrationRunCommand): Promise<StoredOrchestrationRun>;
  getOrchestrationRun(runId: string): Promise<StoredOrchestrationRun | undefined>;
  listOrchestrationRuns(query?: OrchestrationRunQuery): Promise<readonly StoredOrchestrationRun[]>;
  /** Private operational read model for the driver. */
  getOrchestrationSnapshot(runId: string): Promise<OrchestrationSnapshotView | undefined>;
  claimReadyToken(command: ClaimReadyTokenCommand): Promise<ClaimReadyTokenResult>;
  completeAttempt(command: CompleteAttemptCommand): Promise<CompleteAttemptResult>;
  signalWait(command: SignalWaitCommand): Promise<SignalDeliveryResult>;
  claimDueTimers(command: ClaimDueTimersCommand): Promise<ClaimDueTimersResult>;
  resolveDueTimer(command: ResolveDueTimerCommand): Promise<ResolveDueTimerResult>;
  requestCancellation(command: RequestCancellationCommand): Promise<CancellationResult>;
  applyCancellation(command: ApplyCancellationCommand): Promise<{ runRecordRevision: number; runNextEventSeq: number }>;
  findRecoverableClaims(command: RecoverOrchestrationCommand): Promise<readonly RecoverableClaim[]>;
  recoverAttempt(command: RecoverAttemptCommand): Promise<{ runRecordRevision: number; runNextEventSeq: number }>;
  resolveBlocked(command: ResolveBlockedCommand): Promise<ResolveBlockedResult>;
  /** Read open waits for a run (safe descriptors; never checkpoint payloads). */
  listWaits(runId: string): Promise<readonly DurableWaitState[]>;
  /** Read signal receipts for a run (safe identity metadata only). */
  listSignalReceipts(runId: string): Promise<readonly SignalReceiptRecord[]>;
}

/**
 * Driver-facing snapshot of one orchestration run's durable state.
 *
 * NOTE: `branchOutputs` belongs to the private operational checkpoint
 * boundary. It exists so a suspended fork/join can be continued after a
 * process restart; it is never part of ordinary run records, events, list
 * output, or trace diagnostics.
 */
export interface OrchestrationSnapshotView {
  readonly run: StoredOrchestrationRun;
  readonly tokens: readonly DurableTokenState[];
  readonly attempts: readonly DurableAttemptState[];
  readonly waits: readonly DurableWaitState[];
  readonly timers: readonly TimerRecord[];
  readonly branchResults: readonly BranchResultRecord[];
  /** Private operational branch-output payloads keyed by fork then branch key. */
  readonly branchOutputs: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly nextEventSeq: number;
}

/** Test-only fault injection surface for orchestration transitions. */
export interface OrchestrationFaultHooks {
  /** Called after state is staged but before events are appended. */
  afterStateStage?(operation: string): void;
  /** Called after events are appended but before the transaction commits. */
  beforeCommit?(operation: string): void;
}