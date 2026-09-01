import type { Contract, ContractIssue, VictError } from '@vict/contracts';

/** Effect classification for a capability. */
export type EffectClass = 'pure' | 'read' | 'write' | 'irreversible';

/** Execution modes understood by the kernel policy port. */
export type ExecutionMode = 'normal' | 'simulate' | 'test';

/** Terminal run status. */
export type RunStatus = 'completed' | 'failed' | 'blocked';

/* ------------------------------------------------------------------ */
/* Graph definitions                                                   */
/* ------------------------------------------------------------------ */

export interface GraphNodeDefinition {
  readonly id: string;
  /** Capability invoked at this node. */
  readonly capability: string;
  /** Optional contract id overriding the capability's declared input contract. */
  readonly input?: string;
  /** Optional contract id overriding the capability's declared output contract. */
  readonly output?: string;
}

export interface GraphEdgeDefinition {
  readonly from: string;
  readonly to: string;
  /** Defaults to `'success'`. */
  readonly kind?: 'success' | 'error';
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

export interface CompiledNode {
  readonly id: string;
  readonly capability: string;
  /** Effective input contract id (node override, else capability declaration). */
  readonly inputContractId?: string;
  /** Effective output contract id (node override, else capability declaration). */
  readonly outputContractId?: string;
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
  | 'CONTRACT_INCOMPATIBLE';

export interface GraphEdgeRef {
  readonly from: string;
  readonly to: string;
  readonly kind: 'success' | 'error';
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
