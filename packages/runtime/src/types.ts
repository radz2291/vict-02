import type { Contract } from '@vict/contracts';
import type { EffectClass, ExecutionMode, GraphIssue, KernelEvent, RunStatus } from '@vict/kernel';
import type { VictError } from '@vict/contracts';

/** Context handed to capability implementations and test doubles at invocation time. */
export interface CapabilityContext {
  readonly runId: string;
  readonly graphId: string;
  readonly graphVersion: string;
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
 */
export interface CapabilityDefinition<I = unknown, O = unknown> {
  readonly id: string;
  readonly effect: EffectClass;
  readonly input?: Contract<I>;
  readonly output?: Contract<O>;
  invoke(input: I, context: CapabilityContext): Promise<O> | O;
}

/** Test-double invocation. Contracts of the original capability still apply. */
export type DoubleInvoke = (input: unknown, context: CapabilityContext) => unknown;

export interface RunResult<T = unknown> {
  readonly runId: string;
  readonly graphId: string;
  readonly graphVersion: string;
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
  readonly version: string;
  readonly entryNodeId: string;
  readonly nodeCount: number;
}

export type ActivationResult =
  | {
      readonly ok: true;
      readonly graphId: string;
      readonly graphVersion: string;
      readonly nodeCount: number;
    }
  | {
      readonly ok: false;
      readonly issues: readonly GraphIssue[];
      readonly previousGraph?: ActiveGraphInfo;
    };

export interface RunRecord {
  readonly runId: string;
  readonly graphId: string;
  readonly graphVersion: string;
  readonly mode: ExecutionMode;
  readonly status: RunStatus;
  readonly startedAt: number;
  readonly durationMs: number;
  readonly steps: number;
  readonly output?: unknown;
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
}
