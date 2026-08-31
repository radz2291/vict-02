import type { Contract } from '@vict/contracts';
import type {
  EffectClass,
  ExecutionMode,
  GraphIssue,
  KernelEvent,
  OutputSummary,
  RunStatus,
} from '@vict/kernel';
import type { VictError } from '@vict/contracts';

/** Context handed to capability implementations and test doubles at invocation time. */
export interface CapabilityContext {
  readonly runId: string;
  readonly graphId: string;
  readonly graphVersion: string;
  readonly capabilitySetVersion: string;
  readonly activationVersion: string;
  readonly nodeId: string;
  readonly capabilityId: string;
  readonly mode: ExecutionMode;
  readonly step: number;
  /** `'double'` when the policy required the registered test double to run. */
  readonly invokedVia: 'real' | 'double';
}

/**
 * A typed operation a graph can invoke. `effect` classifies its external
 * impact; contracts are executable promises about its input and output.
 *
 * The `revision` is an author/build responsibility: changing handler logic,
 * effect class or bound contracts requires changing the revision so
 * activation identity can distinguish the change. Function bodies are never
 * hashed or serialized — identity is revision-based.
 */
export interface CapabilityDefinition<I = unknown, O = unknown> {
  readonly id: string;
  readonly revision: string;
  readonly effect: EffectClass;
  readonly input?: Contract<I>;
  readonly output?: Contract<O>;
  invoke(input: I, context: CapabilityContext): Promise<O> | O;
}

/** Test-double invocation. Contracts of the original capability still apply. */
export type DoubleInvoke = (input: unknown, context: CapabilityContext) => unknown;

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
}

export interface RunOptions {
  /** Defaults to `'normal'`. */
  readonly mode?: ExecutionMode;
  /** Explicit policy permissions, e.g. allowing irreversible effects in normal mode. */
  readonly policy?: { readonly allowIrreversible?: boolean };
  readonly maxSteps?: number;
  /** Streaming hook for run events. */
  readonly onEvent?: (event: KernelEvent) => void;
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

/**
 * A stored run record.
 *
 * Retention policy (see `PayloadRetention`):
 * - `trace` is always the safe, summarized event stream (values never).
 * - `error` is always the sanitised structured error.
 * - `outputSummary` (safe shape/key description) appears under `'summary'`
 *   and `'full'`.
 * - `output` (the complete validated payload) appears ONLY under `'full'`.
 */
export interface RunRecord {
  readonly runId: string;
  readonly graphId: string;
  readonly graphVersion: string;
  readonly capabilitySetVersion: string;
  readonly activationVersion: string;
  readonly mode: ExecutionMode;
  readonly status: RunStatus;
  readonly startedAt: number;
  readonly durationMs: number;
  readonly steps: number;
  readonly retention: PayloadRetention;
  readonly outputSummary?: OutputSummary;
  /** Complete validated output — present only when retention is `'full'`. */
  readonly output?: unknown;
  /** Sanitised structured error (safe code, safe message, safe details). */
  readonly error?: VictError;
  readonly trace: readonly KernelEvent[];
}

export interface RunRepository {
  record(record: RunRecord): void;
  get(runId: string): RunRecord | undefined;
  list(): readonly RunRecord[];
}

export interface VictRuntimeOptions {
  /** Default policy permissions applied to every run unless overridden per run. */
  readonly policy?: { readonly allowIrreversible?: boolean };
  readonly repository?: RunRepository;
  readonly maxSteps?: number;
  /** Payload retention for stored run records. Default: `'summary'`. Use `'full'` only with explicit intent. */
  readonly payloadRetention?: PayloadRetention;
}
