import type { Contract, ContractIssue, VictError } from '@vict/contracts';

/** Effect classification for a capability. */
export type EffectClass = 'pure' | 'read' | 'write' | 'irreversible';

/** Execution modes understood by the kernel policy port. */
export type ExecutionMode = 'normal' | 'simulate' | 'test';

/**
 * Run status.
 *
 * - `completed` / `failed` / `cancelled` are terminal.
 * - `blocked` is quiescent: continuation requires explicit resolution.
 * - `waiting` is quiescent: durable continuation awaits a signal or timer.
 *
 * Stage 02 verified `completed` | `failed` | `blocked`; the Stage 03 durable
 * orchestration model adds `waiting` and `cancelled`.
 */
export type RunStatus = 'completed' | 'failed' | 'blocked' | 'waiting' | 'cancelled';

/** Quiescent nonterminal statuses: no eligible local work exists. */
export type QuiescentStatus = 'waiting' | 'blocked';

/* ------------------------------------------------------------------ */
/* Graph definitions                                                   */
/* ------------------------------------------------------------------ */

/**
 * Bounded declarative retry policy. `maxAttempts` includes the first
 * attempt. Retry classification uses safe stable error codes — raw thrown
 * messages never drive retry decisions. Backoff is deterministic
 * (non-jittered) so due times are reproducible.
 */
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
/** Hard upper bound for a single backoff delay, timeout, or timer delay (compiler-enforced): 7 days. */
export const MAX_DELAY_MS_LIMIT = 7 * 24 * 60 * 60 * 1000;
/** Hard upper bound for fork branch count (compiler-enforced). */
export const MAX_BRANCH_COUNT = 64;

export interface SignalWaitDefinition {
  readonly kind: 'signal';
  /** Exact signal name this wait accepts. */
  readonly name: string;
  /** Optional contract the signal payload must pass before the wait resolves. */
  readonly contract?: string;
  /** Optional durable timeout. When present, a `timeout` edge is required. */
  readonly timeoutMs?: number;
}

export interface TimerWaitDefinition {
  readonly kind: 'timer';
  /** Relative delay from the moment the wait becomes durable. Must be positive. */
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

/* ------------------------------------------------------------------ */
/* Capability knowledge supplied to the kernel through ports           */
/* ------------------------------------------------------------------ */

export interface ContractSummary {
  readonly id: string;
  readonly revision: string;
  readonly expected: string;
}

/**
 * Execution-relevant knowledge about one capability. The `revision` fields
 * are author/build-owned markers: changing handler logic, effect class or
 * contract semantics requires changing the revision. Revisions feed the
 * capability-set and activation identity; function bodies are never hashed.
 */
export interface CapabilityDescriptor {
  readonly id: string;
  readonly revision: string;
  readonly effect: EffectClass;
  /**
   * Declared idempotency semantics for retryable writes. `'keyed'` means the
   * capability accepts a stable idempotency key and repeats with the same key
   * are reconciled to one external mutation. Absent for non-write effects
   * and for writes without keyed support (which may never be auto-retried).
   * Participates in capability-set identity when declared.
   */
  readonly idempotency?: 'keyed';
  readonly inputContractId?: string;
  readonly inputRevision?: string;
  readonly outputContractId?: string;
  readonly outputRevision?: string;
}

export interface CapabilityIndex {
  getCapabilityDescriptor(capabilityId: string): CapabilityDescriptor | undefined;
}

/**
 * Contract knowledge supplied by the environment. The kernel owns the
 * validation *rules* (referenced contracts must exist; adjacent contracts
 * must be compatible where statically determinable); the environment owns
 * the *judgment* (which contracts exist, whether two ids are compatible).
 */
export interface ContractEnvironment {
  has(contractId: string): boolean;
  isCompatible(fromContractId: string | undefined, toContractId: string | undefined): boolean;
  get(contractId: string): Contract<unknown> | undefined;
}

/* ------------------------------------------------------------------ */
/* Compiled graph                                                      */
/* ------------------------------------------------------------------ */

export type CompiledNodeKind = 'capability' | 'decision' | 'wait' | 'fork' | 'join';

export interface CompiledNode {
  readonly id: string;
  readonly kind: CompiledNodeKind;
  /** Capability id (capability/decision nodes only). */
  readonly capability: string;
  /** Effective input contract id (node override, else capability declaration). */
  readonly inputContractId?: string;
  /** Effective output contract id (node override, else capability declaration). */
  readonly outputContractId?: string;
  /** Declared retry policy (capability/decision nodes only). */
  readonly retry?: RetryPolicy;
  /** Declared invocation deadline in milliseconds (capability/decision nodes only). */
  readonly timeoutMs?: number;
  /** Wait descriptor (wait nodes only). */
  readonly wait?: SignalWaitDefinition | TimerWaitDefinition;
  /** Matching join id (fork nodes only). */
  readonly join?: string;
  /** Concurrency bound for branch execution (fork nodes only). */
  readonly maxConcurrency?: number;
  /** Matching fork id (join nodes only). */
  readonly fork?: string;
}

/**
 * Immutable compiled graph. Frozen at compile time.
 *
 * Three distinct identity layers:
 * - `graphVersion`: topology/declaration identity ONLY (id, entry, nodes,
 *   capability references, contract override references, edges). It makes no
 *   claim about executable semantics.
 * - `capabilitySetVersion`: identity of the effective capability/contract
 *   bindings required by this graph (capability id + revision + effect class
 *   + effective input/output contract id + revision, per resolved node,
 *   deduplicated, canonically ordered).
 * - `activationVersion`: hash over graphVersion + capabilitySetVersion + an
 *   activation schema marker — the identity of the exact executable
 *   activation.
 */
export interface CompiledGraph {
  readonly id: string;
  readonly graphVersion: string;
  readonly capabilitySetVersion: string;
  readonly activationVersion: string;
  readonly entryNodeId: string;
  readonly nodeCount: number;
  readonly nodeIds: readonly string[];
  getNode(nodeId: string): CompiledNode | undefined;
  successTargetOf(nodeId: string): string | undefined;
  errorTargetOf(nodeId: string): string | undefined;
  /** Declared route targets of a decision node, canonically sorted by key. */
  routeTargetsOf(nodeId: string): Readonly<Record<string, string>>;
  /** Declared branch targets of a fork node, canonically sorted by key. */
  branchTargetsOf(forkId: string): Readonly<Record<string, string>>;
  /** Declared branch keys of a fork node, canonically sorted. */
  branchKeysOf(forkId: string): readonly string[];
  /** The declared timeout target of a signal-wait node, if any. */
  timeoutTargetOf(nodeId: string): string | undefined;
  /** The join node matched by a fork node, if declared. */
  joinOfFork(forkId: string): string | undefined;
  /** The fork node matched by a join node, if declared. */
  forkOfJoin(joinId: string): string | undefined;
  /** True when the graph declares any control node or control declaration. */
  readonly hasControlNodes: boolean;
  /** Canonical semantic snapshot (defaults filled, nodes/edges sorted). */
  toDefinition(): ApplicationGraphDefinition;
}

export type GraphIssueCode =
  | 'EMPTY_GRAPH_ID'
  | 'EMPTY_NODE_ID'
  | 'EMPTY_CAPABILITY_REFERENCE'
  | 'MISSING_ENTRY_NODE'
  | 'DUPLICATE_NODE'
  | 'EDGE_REFERENCES_UNKNOWN_NODE'
  | 'DUPLICATE_EDGE'
  | 'MULTIPLE_SUCCESS_EDGES'
  | 'MULTIPLE_ERROR_EDGES'
  | 'UNSUPPORTED_CYCLE'
  | 'UNKNOWN_CAPABILITY'
  | 'MISSING_CONTRACT'
  | 'CONTRACT_INCOMPATIBLE'
  // Stage 03 control-graph diagnostics (stable order follows compile order).
  | 'UNKNOWN_NODE_KIND'
  | 'EDGE_KIND_INVALID_FOR_SOURCE'
  | 'MISSING_ROUTE_KEY'
  | 'EMPTY_ROUTE_KEY'
  | 'DUPLICATE_ROUTE_KEY'
  | 'DECISION_WITHOUT_ROUTES'
  | 'MISSING_BRANCH_KEY'
  | 'EMPTY_BRANCH_KEY'
  | 'DUPLICATE_BRANCH_KEY'
  | 'FORK_TOO_FEW_BRANCHES'
  | 'FORK_REFERENCES_MISSING_JOIN'
  | 'FORK_REFERENCES_NON_JOIN'
  | 'JOIN_REFERENCES_MISSING_FORK'
  | 'JOIN_REFERENCES_NON_FORK'
  | 'MISMATCHED_FORK_JOIN'
  | 'BRANCH_CANNOT_REACH_JOIN'
  | 'ILLEGAL_BRANCH_ESCAPE'
  | 'TIMEOUT_EDGE_WITHOUT_SIGNAL_TIMEOUT'
  | 'SIGNAL_TIMEOUT_WITHOUT_TIMEOUT_EDGE'
  | 'TIMER_WAIT_WITH_TIMEOUT_EDGE'
  | 'WAIT_WITHOUT_SUCCESS_EDGE'
  | 'DECISION_NOT_PURE'
  | 'INVALID_RETRY_POLICY'
  | 'INVALID_TIMEOUT_BOUND'
  | 'WRITE_RETRY_NOT_IDEMPOTENT'
  | 'IRREVERSIBLE_RETRY_DENIED'
  | 'UNSUPPORTED_NESTED_FORK'
  | 'UNKNOWN_WAIT_CONTRACT'
  | 'UNKNOWN_JOIN_CONTRACT'
  | 'INVALID_FORK_CONCURRENCY'
  | 'INVALID_ENTRY_KIND'
  | 'JOIN_SUCCESS_EDGE_INVALID';

export type GraphEdgeRefKind = 'success' | 'error' | 'route' | 'branch' | 'timeout';

export interface GraphEdgeRef {
  readonly from: string;
  readonly to: string;
  readonly kind: GraphEdgeRefKind;
  /** Route/branch key when applicable. */
  readonly key?: string;
}

export interface GraphIssue {
  readonly code: GraphIssueCode;
  readonly message: string;
  readonly nodeIds?: readonly string[];
  readonly edge?: GraphEdgeRef;
  readonly contractIds?: readonly string[];
}

export type CompileResult =
  | { readonly ok: true; readonly graph: CompiledGraph }
  | { readonly ok: false; readonly issues: readonly GraphIssue[] };

/* ------------------------------------------------------------------ */
/* Kernel events                                                       */
/* ------------------------------------------------------------------ */

/**
 * Safe output summary used in trace metadata. Never contains values:
 * objects contribute key names only (secret-like names redacted), strings
 * contribute only their length.
 */
export type OutputSummary =
  | { readonly shape: 'undefined' }
  | { readonly shape: 'null' }
  | { readonly shape: 'string'; readonly length: number }
  | { readonly shape: 'number' }
  | { readonly shape: 'boolean' }
  | { readonly shape: 'bigint' }
  | { readonly shape: 'array'; readonly length: number }
  | { readonly shape: 'object'; readonly keys: readonly string[] }
  | { readonly shape: 'unknown' };

export interface EventEnvelope {
  /** Monotonically increasing per-run sequence number. Event order is defined by `seq`, never timestamps. */
  readonly seq: number;
  readonly runId: string;
  readonly graphId: string;
  /** Topology/declaration identity of the pinned graph. */
  readonly graphVersion: string;
  /** Identity of the effective capability/contract bindings pinned by the activation. */
  readonly capabilitySetVersion: string;
  /** Identity of the exact executable activation the run is pinned to. */
  readonly activationVersion: string;
  /** Epoch milliseconds; diagnostics only, never used for ordering. */
  readonly timestamp: number;
}

export type KernelEvent = EventEnvelope &
  (
    | { readonly type: 'run.started' }
    | { readonly type: 'run.waiting'; readonly nodeId: string; readonly waitId: string; readonly waitKind: 'signal' | 'timer'; readonly signalName?: string; readonly dueAt?: number }
    | { readonly type: 'run.resumed'; readonly by: 'signal' | 'timer' | 'operator'; readonly waitId?: string; readonly signalId?: string }
    | { readonly type: 'run.cancel_requested'; readonly requestId: string; readonly reasonCode: string }
    | { readonly type: 'run.cancelled'; readonly requestId: string; readonly reasonCode: string; readonly steps: number }
    | { readonly type: 'node.retry_scheduled'; readonly nodeId: string; readonly capabilityId: string; readonly attempt: number; readonly maxAttempts: number; readonly dueAt: number; readonly retryOnCode: string }
    | { readonly type: 'node.timed_out'; readonly nodeId: string; readonly capabilityId: string; readonly attempt: number; readonly deadlineAt: number }
    | { readonly type: 'node.cancelled'; readonly nodeId: string; readonly capabilityId: string; readonly attempt: number }
    | { readonly type: 'signal.received'; readonly waitId: string; readonly signalId: string; readonly signalName: string }
    | { readonly type: 'timer.scheduled'; readonly timerId: string; readonly nodeId: string; readonly dueAt: number; readonly kind: 'wait' | 'wait-timeout' | 'retry' }
    | { readonly type: 'timer.fired'; readonly timerId: string; readonly nodeId: string; readonly kind: 'wait' | 'wait-timeout' | 'retry' }
    | { readonly type: 'fork.created'; readonly forkId: string; readonly joinId: string; readonly branchKeys: readonly string[] }
    | { readonly type: 'branch.completed'; readonly forkId: string; readonly joinId: string; readonly branchKey: string }
    | { readonly type: 'join.completed'; readonly forkId: string; readonly joinId: string; readonly branchKeys: readonly string[] }
    | { readonly type: 'operator.intervened'; readonly resolutionId: string; readonly action: 'retry' | 'confirm_applied' | 'fail' | 'cancel'; readonly nodeId?: string; readonly attemptId?: string }
    | { readonly type: 'node.started'; readonly nodeId: string; readonly capabilityId: string }
    | {
        readonly type: 'node.completed';
        readonly nodeId: string;
        readonly capabilityId: string;
        readonly durationMs: number;
        readonly invokedVia: 'real' | 'double';
        readonly output: OutputSummary;
      }
    | {
        readonly type: 'node.failed';
        readonly nodeId: string;
        readonly capabilityId: string;
        readonly durationMs: number;
        readonly error: VictError;
      }
    | {
        readonly type: 'contract.rejected';
        readonly stage: 'input' | 'output';
        readonly nodeId: string;
        readonly capabilityId: string;
        readonly contractId: string;
        readonly issues: readonly ContractIssue[];
      }
    | {
        readonly type: 'signal.routed';
        readonly kind: 'success' | 'error';
        readonly fromNodeId: string;
        readonly toNodeId: string;
      }
    | {
        readonly type: 'effect.blocked';
        readonly nodeId: string;
        readonly capabilityId: string;
        readonly effect: EffectClass;
        readonly mode: ExecutionMode;
        readonly reason: string;
        readonly remediation: string;
      }
    | { readonly type: 'run.completed'; readonly steps: number; readonly output: OutputSummary }
    | { readonly type: 'run.failed'; readonly steps: number; readonly error: VictError }
    | {
        readonly type: 'run.blocked';
        readonly steps: number;
        readonly reason: string;
        /** Stable machine-readable blocking code (e.g. an interruption code set by durable recovery). */
        readonly code?: string;
        readonly capabilityId?: string;
        readonly effect?: EffectClass;
        readonly remediation: string;
      }
  );

export type KernelEventType = KernelEvent['type'];

/* ------------------------------------------------------------------ */
/* Ports                                                               */
/* ------------------------------------------------------------------ */

export interface CapabilityInvocationContext {
  readonly runId: string;
  readonly graphId: string;
  readonly graphVersion: string;
  readonly capabilitySetVersion: string;
  readonly activationVersion: string;
  readonly nodeId: string;
  readonly capabilityId: string;
  readonly mode: ExecutionMode;
  readonly step: number;
  /** True when the policy requires the registered test double to run instead of the real implementation. */
  readonly useDouble: boolean;
}

/**
 * Extended capability context supplied by the durable orchestration runtime.
 * Everything here is derived from durable identity, never from wall-clock
 * time, process memory, or attempt randomness.
 */
export interface DurableInvocationContext {
  /** Stable logical invocation identity (invariant across retries). */
  readonly invocationId: string;
  /** This attempt's durable identity. */
  readonly attemptId: string;
  /** 1-based attempt number within the logical invocation. */
  readonly attemptNumber: number;
  /**
   * Stable opaque idempotency key derived from run + activation + token
   * lineage + node + logical invocation generation. Present when the node
   * declared a retry policy (or the runtime requires keyed effects).
   */
  readonly idempotencyKey?: string;
  /** Epoch-ms deadline for this attempt, when one applies. */
  readonly deadlineAt?: number;
  /** Cooperative abort signal; aborted on timeout or cancellation. */
  readonly abortSignal?: AbortSignal;
  /** Branch identity when executing inside a fork branch. */
  readonly branch?: { readonly forkId: string; readonly joinId: string; readonly branchKey: string; readonly lineage: string };
}

/** Explicit invocation result. Failures are values, never guessed from payloads. */
export type CapabilityInvocation =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly error: VictError };

export interface CapabilityPort {
  invoke(
    capabilityId: string,
    input: unknown,
    context: CapabilityInvocationContext,
  ): Promise<CapabilityInvocation>;
}

export interface EffectAuthorizationRequest {
  readonly capabilityId: string;
  readonly effect: EffectClass;
  readonly mode: ExecutionMode;
}

export interface EffectAuthorizationDecision {
  /** False blocks the effect before invocation. */
  readonly allowed: boolean;
  /** True routes the invocation to the registered test double. */
  readonly useDouble: boolean;
  readonly reason?: string;
  readonly remediation?: string;
}

export interface PolicyPort {
  authorize(request: EffectAuthorizationRequest): EffectAuthorizationDecision;
}

/** The exact invocation a durable-boundary guard is asked to release. */
export interface InvocationBoundary {
  readonly runId: string;
  readonly nodeId: string;
  readonly capabilityId: string;
  readonly step: number;
}

export interface Clock {
  now(): number;
}

export interface IdFactory {
  runId(): string;
  /** Correlation id for sanitised failure diagnostics. Optional; a default is supplied. */
  errorId?(): string;
}

/** Everything the kernel needs from the outside world, supplied explicitly. */
export interface KernelPorts {
  readonly capabilities: CapabilityPort;
  readonly policy: PolicyPort;
  readonly descriptors: CapabilityIndex;
  readonly contracts: ContractEnvironment;
  readonly clock?: Clock;
  readonly ids?: IdFactory;
  /** Optional streaming hook; called for every event as it is emitted. */
  readonly onEvent?: (event: KernelEvent) => void;
  /**
   * Optional asynchronous invocation guard (the durable write-ahead
   * boundary). When supplied, the kernel awaits it after emitting
   * `node.started` for a node and before invoking that node's capability,
   * every invocation, sequentially. The environment uses it to guarantee
   * that every durable write enqueued so far — run creation, the preceding
   * node-result batch, and this node's `node.started` transition — has
   * committed before the side effect may begin (Stage 02 write-ahead rule).
   *
   * A rejection is an infrastructure failure: the capability is NOT invoked
   * and the error propagates out of `executeGraph` unchanged. It is
   * deliberately not converted into a domain event, routed along an error
   * edge, or sanitised — hiding or downgrading a durability failure would
   * misrepresent what is durably known about the run.
   */
  readonly beforeInvoke?: (boundary: InvocationBoundary) => Promise<void>;
}

/* ------------------------------------------------------------------ */
/* Runs                                                                */
/* ------------------------------------------------------------------ */

export interface KernelRunInput {
  readonly graph: CompiledGraph;
  readonly input: unknown;
  readonly mode: ExecutionMode;
  readonly ports: KernelPorts;
  /** Hard upper bound on executed steps. Compilation rejects cycles, so this is defense in depth. */
  readonly maxSteps?: number;
}

export interface KernelRunOutput {
  readonly runId: string;
  readonly graphId: string;
  readonly graphVersion: string;
  readonly capabilitySetVersion: string;
  readonly activationVersion: string;
  readonly status: RunStatus;
  readonly output?: unknown;
  readonly error?: VictError;
  readonly events: readonly KernelEvent[];
  readonly steps: number;
}
