import type { GraphIssue, KernelEvent, OutputSummary, RunStatus } from '@vict/kernel';
import type { VictError } from '@vict/contracts';
import type { VictStores } from './store-types.js';

/**
 * Stage 04: capability authoring declarations (capability context,
 * capability definition, double invocation, effect/execution modes) now
 * live in `@vict/sdk`, the authoring ABI below the kernel and runtime. The
 * runtime consumes them; they are re-exported here (and from the runtime
 * index) for consumer convenience — `@vict/sdk` is the single home.
 */
export type {
  CapabilityConfigReader,
  CapabilityContext,
  CapabilityDefinition,
  CapabilitySecretReader,
  DoubleInvoke,
  EffectClass,
  ExecutionMode,
} from '@vict/sdk';
import type { ExecutionMode } from '@vict/sdk';

/**
 * How much payload data the runtime retains in stored run records.
 *
 * - `'none'`: retain metadata, status, trace and sanitised error only.
 * - `'summary'` (default): additionally retain the safe output summary
 *   (shape/length/key-names, secret-like key names redacted).
 * - `'full'`: additionally retain the complete validated output. Explicit
 *   opt-in for runtimes that legitimately need full payload history.
 *
 * `RunResult` returned to the caller always carries the actual validated
 * output regardless of retention; retention governs *stored history* only.
 *
 * WARNING (full retention): selecting `'full'` makes the caller/operator
 * responsible for the sensitivity, access control, minimization, and
 * lifecycle of the complete output that will be persisted. Vict cannot make
 * arbitrary retained payloads safe merely by labeling the mode; pair `'full'`
 * with an explicit deletion/lifecycle policy and access control. Inputs are
 * never stored in Stage 02, including under `'full'` retention.
 */
export type PayloadRetention = 'none' | 'summary' | 'full';

export interface RunResult<T = unknown> {
  readonly runId: string;
  readonly graphId: string;
  readonly graphVersion: string;
  readonly capabilitySetVersion: string;
  readonly activationVersion: string;
  readonly status: RunStatus;
  readonly output?: T;
  readonly error?: VictError;
  readonly trace: readonly KernelEvent[];
  /** Safe open-wait descriptors when a durable orchestration run is waiting. */
  readonly waits?: readonly {
    readonly waitId: string;
    readonly kind: 'signal' | 'timer';
    readonly signalName?: string;
    readonly dueAt?: number;
  }[];
  readonly steps?: number;
}
export interface RunOptions {
  /** Defaults to `'normal'`. */
  readonly mode?: ExecutionMode;
  /** Explicit policy permissions, e.g. allowing irreversible effects in normal mode. */
  readonly policy?: { readonly allowIrreversible?: boolean };
  readonly maxSteps?: number;
  /** Streaming hook for run events. */
  readonly onEvent?: (event: KernelEvent) => void;
  /** Local worker-pool bound for durable orchestration runs (default 4, max 32). */
  readonly concurrency?: number;
}

export interface RunNodeOptions {
  readonly maxSteps?: number;
  readonly onEvent?: (event: KernelEvent) => void;
}

export interface ActiveGraphInfo {
  readonly id: string;
  /** Topology/declaration identity. Does not identify executable semantics. */
  readonly version: string;
  /** Identity of the effective capability/contract bindings. */
  readonly capabilitySetVersion: string;
  /** Identity of the exact executable activation. */
  readonly activationVersion: string;
  readonly entryNodeId: string;
  readonly nodeCount: number;
}

export type ActivationResult =
  | {
      readonly ok: true;
      readonly graphId: string;
      readonly graphVersion: string;
      readonly capabilitySetVersion: string;
      readonly activationVersion: string;
      readonly nodeCount: number;
    }
  | {
      readonly ok: false;
      readonly issues: readonly GraphIssue[];
      readonly previousGraph?: ActiveGraphInfo;
    };

/** Why an exact-activation restoration failed. */
export type RestorationFailureCode =
  | 'VICT_RUNTIME_ACTIVATION_NOT_FOUND'
  | 'VICT_RUNTIME_ACTIVATION_MISMATCH'
  | 'VICT_RUNTIME_ACTIVATION_UNAVAILABLE';

/**
 * Result of restoring an activation from the durable catalog.
 *
 * Restoration verifies availability against the current registered code:
 * it never executes a capability, never chooses a “closest” revision, and
 * never replaces the currently active graph on failure.
 */
export type RestorationResult =
  | {
      readonly ok: true;
      readonly graphId: string;
      readonly graphVersion: string;
      readonly capabilitySetVersion: string;
      readonly activationVersion: string;
      readonly nodeCount: number;
    }
  | {
      readonly ok: false;
      readonly code: RestorationFailureCode;
      readonly message: string;
      /** Stored activation identity, when one was found. */
      readonly expectedActivationVersion?: string;
      /** Identity rebuilt from current code, when compilation succeeded. */
      readonly actualActivationVersion?: string;
      /** Safe description of what differs, for mismatches. */
      readonly differences?: readonly string[];
      /** Compile issues, when current code cannot compile the graph at all. */
      readonly issues?: readonly GraphIssue[];
    };

/**
 * A stored run record (assembled view: run state plus its ordered trace).
 *
 * Retention policy (see `PayloadRetention`):
 * - `trace` is always the safe, summarized event stream (values never).
 * - `error` is always the sanitised structured error.
 * - `outputSummary` (safe shape/key description) appears under `'summary'`
 *   and `'full'`.
 * - `output` (the complete validated payload) appears ONLY under `'full'`.
 *   Selecting `'full'` makes the caller/operator responsible for the
 *   sensitivity, access control, minimization, and lifecycle of the
 *   complete persisted output.
 */
export interface RunRecord {
  readonly runId: string;
  readonly graphId: string;
  readonly graphVersion: string;
  readonly capabilitySetVersion: string;
  readonly activationVersion: string;
  readonly mode: ExecutionMode;
  /** Lifecycle status. `running` means nonterminal (in flight or interrupted). */
  readonly status: RunStatus | 'running';
  readonly startedAt: number;
  readonly durationMs: number;
  readonly steps: number;
  readonly retention: PayloadRetention;
  /** Last durable node context, when known. Never a payload value. */
  readonly currentNodeId?: string | null;
  /** Durable record revision; increments with every committed transition. */
  readonly recordRevision: number;
  readonly outputSummary?: OutputSummary;
  /** Complete validated output — present only when retention is `'full'`. */
  readonly output?: unknown;
  /** Sanitised structured error (safe code, safe message, safe details). */
  readonly error?: VictError;
  readonly trace: readonly KernelEvent[];
}

export interface VictRuntimeOptions {
  /** Default policy permissions applied to every run unless overridden per run. */
  readonly policy?: { readonly allowIrreversible?: boolean };
  /**
   * Stage 04 least-authority boundary: explicit permission grants plus the
   * configuration/secret ports that scoped capability readers resolve
   * through. Capability packs declare the names they require; anything
   * undeclared or ungranted fails before the handler runs.
   */
  readonly authority?: {
    readonly grants?: readonly string[];
    readonly configuration?: { readonly get: (name: string) => unknown };
    readonly secrets?: { readonly get: (name: string) => Promise<string | undefined> };
  };
  /**
   * Durable activation/execution stores. Defaults to a private in-memory
   * store set with identical semantics. To persist across process restarts
   * inject an adapter such as `createSqliteStores()` from `@vict/store-sqlite`.
   */
  readonly stores?: VictStores;
  /** Clock used for run and event timestamps. Defaults to the system clock. */
  readonly clock?: { readonly now: () => number };
  /** Identity factory for run ids. Defaults to random UUID-based ids. */
  readonly ids?: { readonly runId: () => string; readonly errorId?: () => string };
  readonly maxSteps?: number;
  /**
   * Payload retention for stored run records. Default: `'summary'`.
   *
   * WARNING: `'full'` persists the complete validated output of every run.
   * Selecting full retention makes the caller/operator responsible for the
   * sensitivity, access control, minimization, and lifecycle of the complete
   * output that will be persisted. Use only with explicit intent and an
   * explicit deletion/lifecycle policy.
   */
  readonly payloadRetention?: PayloadRetention;
  /**
   * Stage 03 durable orchestration options.
   *
   * - `concurrency`: default local worker-pool bound (default 4, max 32).
   * - `operatorAuthorized`: explicit operator authorization for the bounded
   *   blocked-run resolution API. DENIED by default.
   * - `time`: injected time port (now/delay) for deterministic tests.
   * - `ownerId`: stable process/worker owner id for claim leases.
   */
  readonly orchestration?: {
    readonly concurrency?: number;
    readonly operatorAuthorized?: boolean;
    readonly time?: import('./orchestration-driver-types.js').OrchestrationTimePort;
    readonly ownerId?: string;
    /** Claim lease duration in ms (default 30000). */
    readonly leaseMs?: number;
  };
}
