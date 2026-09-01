import type { VictError } from '@vict/contracts';
import type { EffectClass, KernelEvent } from '@vict/kernel';
import type { OrchestrationStore } from './orchestration-store-types.js';
import type { CapabilityRegistry } from './registry.js';
import type { EffectPolicyOverrides } from './effect-policy.js';

/**
 * Public Stage 03 orchestration surface: types shared by the durable
 * orchestration engine, the VictRuntime facade, and consumers.
 */

/** Hard bounds for the Stage 03 local worker pool and timer pump. */
export const ORCHESTRATION_LIMITS = Object.freeze({
  /** Maximum local worker concurrency. */
  maxConcurrency: 32,
  defaultConcurrency: 4,
  /** Maximum due-timer batch per pump call. */
  maxTimerBatch: 256,
  defaultTimerBatch: 16,
});

/** Safe cancellation reason vocabulary (arbitrary caller text is never persisted). */
export const CANCELLATION_REASON_CODES = Object.freeze([
  'operator_request',
  'shutdown',
  'policy',
  'superseded',
] as const);
export type CancellationReasonCode = (typeof CANCELLATION_REASON_CODES)[number];

export interface OrchestrationTimePort {
  now(): number;
  delay(ms: number): Promise<void>;
}

export interface WaitDescriptor {
  readonly waitId: string;
  readonly kind: 'signal' | 'timer';
  readonly signalName?: string;
  readonly dueAt?: number;
}

export interface OrchestrationRunResult<T = unknown> {
  readonly runId: string;
  readonly graphId: string;
  readonly graphVersion: string;
  readonly capabilitySetVersion: string;
  readonly activationVersion: string;
  readonly status: 'completed' | 'failed' | 'cancelled' | 'waiting' | 'blocked';
  readonly output?: T;
  readonly error?: VictError;
  /** Safe open-wait descriptors when the run is waiting (never checkpoint payloads). */
  readonly waits?: readonly WaitDescriptor[];
  readonly steps: number;
  readonly trace: readonly KernelEvent[];
}

export interface SignalCommand {
  readonly runId: string;
  readonly waitId: string;
  /** Caller-supplied non-empty idempotency key. */
  readonly signalId: string;
  /** Expected signal name (defense in depth). */
  readonly signalName?: string;
  readonly payload: unknown;
  readonly expectedWaitRevision?: number;
}

export type SignalResult =
  | { readonly ok: true; readonly status: 'accepted' | 'duplicate' | 'already_resolved' }
  | { readonly ok: false; readonly code: string; readonly message: string };

export interface CancelCommand {
  readonly runId: string;
  /** Caller-supplied non-empty idempotency key. */
  readonly requestId: string;
  /** Stable reason code from the safe vocabulary. */
  readonly reasonCode: CancellationReasonCode;
}

export type CancelResult =
  | { readonly ok: true; readonly status: 'accepted' | 'duplicate'; readonly cancelled: boolean }
  | { readonly ok: false; readonly code: string; readonly message: string };

export interface ProcessDueTimersOptions {
  readonly runId?: string;
  readonly limit?: number;
}

export interface ProcessDueTimersResult {
  readonly fired: number;
  readonly timers: readonly {
    readonly timerId: string;
    readonly runId: string;
    readonly kind: 'wait' | 'wait-timeout' | 'retry';
    readonly applied: boolean;
  }[];
}

export interface ResolveBlockedInput {
  readonly runId: string;
  /** Caller-supplied non-empty idempotency key. */
  readonly resolutionId: string;
  readonly action: 'retry' | 'confirm_applied' | 'fail' | 'cancel';
  /** Validated output for confirm_applied (validated against the pinned output contract). */
  readonly output?: unknown;
  /** Approved safe failure code for the fail action. */
  readonly failCode?: string;
  readonly reasonCode: string;
  readonly expectedRunRevision?: number;
}

export type ResolveBlockedOutcome =
  | {
      readonly ok: true;
      readonly status: 'accepted' | 'duplicate';
      readonly runStatus: string;
      readonly runRecordRevision: number;
    }
  | { readonly ok: false; readonly code: string; readonly message: string };

export interface RecoverOrchestrationOptions {
  /** Drive recovered runs to quiescence/terminal after reclaiming safe work. */
  readonly resume?: boolean;
  readonly concurrency?: number;
}

export interface RecoverOrchestrationSummary {
  readonly reclaimed: readonly {
    readonly runId: string;
    readonly attemptId: string;
    readonly effectClass: EffectClass;
  }[];
  readonly blocked: readonly {
    readonly runId: string;
    readonly attemptId: string;
    readonly effectClass: EffectClass;
    readonly reason: string;
  }[];
  readonly skipped: readonly { readonly runId: string; readonly attemptId: string; readonly reason: string }[];
}

/** Internal dependency view used by the command modules. */
export interface OrchestrationDriverDeps extends Omit<OrchestrationEngineDeps, 'catalog'> {
  readonly catalog: {
    get(activationVersion: string): Promise<import('./store-types.js').StoredActivation | undefined>;
  };
}

export interface OrchestrationEngineDeps {
  readonly registry: CapabilityRegistry;
  readonly clock: { now(): number };
  readonly ids: { readonly runId: () => string; readonly errorId?: () => string };
  readonly defaultOverrides: EffectPolicyOverrides;
  readonly retention: 'none' | 'summary' | 'full';
  readonly ownerId: string;
  readonly orchestration: OrchestrationStore;
  readonly catalog: {
    get(activationVersion: string): Promise<import('./store-types.js').StoredActivation | undefined>;
  };
  readonly time?: OrchestrationTimePort;
}