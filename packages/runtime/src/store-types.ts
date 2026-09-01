import type { EffectClass, ExecutionMode, KernelEvent, OutputSummary } from '@vict/kernel';
import type { VictError } from '@vict/contracts';
import type { PayloadRetention } from './types.js';

/* ------------------------------------------------------------------ */
/* Schema versions                                                     */
/* ------------------------------------------------------------------ */

/** Identity of the serializable activation-manifest shape. Independent of the SQLite schema version. */
export const ACTIVATION_MANIFEST_SCHEMA = 'vict.activation-manifest@1' as const;
/** Identity of the serialized durable event shape. Independent of the SQLite schema version. */
export const RUN_EVENT_SCHEMA = 'vict.run-event@1' as const;

/* ------------------------------------------------------------------ */
/* Activation catalog                                                  */
/* ------------------------------------------------------------------ */

/** One effective capability/contract binding recorded in an activation manifest. */
export interface ActivationManifestBinding {
  readonly capability: string;
  readonly revision: string;
  readonly effect: EffectClass;
  readonly input: { readonly id: string; readonly revision: string } | null;
  readonly output: { readonly id: string; readonly revision: string } | null;
}

/** One contract identity recorded in an activation manifest. */
export interface ActivationManifestContract {
  readonly id: string;
  readonly revision: string;
}

/**
 * Serializable activation meaning. Contains only JSON-safe material:
 * graph declaration, version identities, effective binding metadata and
 * contract identities. Functions, schema-library objects, live registry
 * maps and secrets are never part of a manifest.
 */
export interface ActivationManifest {
  readonly manifestSchema: typeof ACTIVATION_MANIFEST_SCHEMA;
  readonly graphId: string;
  /** Canonical semantic graph declaration (defaults filled, nodes/edges sorted). */
  readonly graph: unknown;
  readonly graphVersion: string;
  readonly capabilitySetVersion: string;
  readonly activationVersion: string;
  readonly bindings: readonly ActivationManifestBinding[];
  readonly contracts: readonly ActivationManifestContract[];
}

/** An immutable stored activation: the manifest plus storage metadata. */
export interface StoredActivation {
  readonly activationVersion: string;
  readonly manifestSchema: string;
  readonly graphId: string;
  readonly graphVersion: string;
  readonly capabilitySetVersion: string;
  /** Canonical manifest JSON. Byte-comparable; canonical form is a stage invariant. */
  readonly canonicalManifest: string;
  readonly createdAt: number;
}

export interface PublishActivationCommand {
  readonly manifest: ActivationManifest;
  /** Canonical JSON of the manifest; must equal `canonicalJson(manifest)`. */
  readonly canonicalManifest: string;
}

export interface PublishResult {
  readonly activationVersion: string;
  /** False when an equivalent activation already existed (idempotent republish). */
  readonly created: boolean;
}

export interface SelectActivationCommand {
  readonly graphId: string;
  readonly activationVersion: string;
  /**
   * Optimistic-concurrency guard. When provided, selection fails with a
   * structured conflict unless the current selection revision matches.
   */
  readonly expectedSelectionRevision?: number;
}

/** Current durable selection of an activation for one graph. */
export interface ActivationSelection {
  readonly graphId: string;
  readonly activationVersion: string;
  readonly selectionRevision: number;
  readonly selectedAt: number;
}

export interface PublishAndSelectCommand {
  readonly publish: PublishActivationCommand;
  readonly select: Omit<SelectActivationCommand, 'activationVersion'>;
}

/**
 * Durable catalog of immutable activation manifests and per-graph selection.
 *
 * Implementations must return immutable snapshots (no caller-mutable
 * references into canonical storage) and must reject the same
 * activationVersion paired with different canonical content.
 */
export interface ActivationCatalog {
  publish(command: PublishActivationCommand): Promise<PublishResult>;
  get(activationVersion: string): Promise<StoredActivation | undefined>;
  list(): Promise<readonly StoredActivation[]>;
  /** Atomically point `graphId` at an existing activation. */
  select(command: SelectActivationCommand): Promise<ActivationSelection>;
  getSelection(graphId: string): Promise<ActivationSelection | undefined>;
  /** Convenience read: the full activation currently selected for a graph. */
  getSelected(graphId: string): Promise<StoredActivation | undefined>;
  /** Publish and select in one atomic transaction (used by activation). */
  publishAndSelect(
    command: PublishAndSelectCommand,
  ): Promise<PublishResult & { selection: ActivationSelection }>;
}

/* ------------------------------------------------------------------ */
/* Runs and events                                                     */
/* ------------------------------------------------------------------ */

/** Durable run status. `running` is the pre-terminal state of an in-flight or interrupted run. */
export type StoredRunStatus = 'running' | 'completed' | 'failed' | 'blocked';

/**
 * Current durable run record. Contains safe material only: identifiers,
 * versions, status, sanitized error, safe output summary — and the complete
 * output only when the run's retention policy is explicitly `'full'`.
 */
export interface StoredRun {
  readonly runId: string;
  readonly graphId: string;
  readonly graphVersion: string;
  readonly capabilitySetVersion: string;
  readonly activationVersion: string;
  readonly status: StoredRunStatus;
  readonly mode: ExecutionMode;
  readonly retention: PayloadRetention;
  readonly steps: number;
  /** Last durable node context, when known. Never an input/output value. */
  readonly currentNodeId: string | null;
  readonly outputSummary?: OutputSummary;
  /** Complete validated output — present only under explicit `'full'` retention. */
  readonly output?: unknown;
  /** Sanitized structured error (safe code, safe message, safe details). */
  readonly error?: VictError;
  /** Optimistic-concurrency revision; starts at 1 and increments per transition. */
  readonly recordRevision: number;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly completedAt: number | null;
}

/** One durable append-only operational event. `seq` is dense per run and defines order. */
export interface StoredEvent {
  readonly runId: string;
  readonly seq: number;
  readonly eventSchema: string;
  readonly type: KernelEvent['type'];
  readonly graphId: string;
  readonly graphVersion: string;
  readonly capabilitySetVersion: string;
  readonly activationVersion: string;
  readonly nodeId: string | null;
  readonly capabilityId: string | null;
  /** Safe event payload: the full kernel event serialized as canonical JSON. */
  readonly payload: string;
  readonly timestamp: number;
}

export interface CreateRunCommand {
  readonly runId: string;
  readonly graphId: string;
  readonly graphVersion: string;
  readonly capabilitySetVersion: string;
  readonly activationVersion: string;
  readonly mode: ExecutionMode;
  readonly retention: PayloadRetention;
  readonly currentNodeId?: string;
  readonly steps?: number;
  /** Initial events (typically `run.started`), appended atomically with creation. */
  readonly events: readonly KernelEvent[];
  readonly timestamp: number;
}

/** Safe run-field updates applied by one transition. Only provided fields change. */
export interface RunStateUpdate {
  readonly status?: StoredRunStatus;
  readonly currentNodeId?: string | null;
  readonly steps?: number;
  readonly error?: VictError;
  readonly outputSummary?: OutputSummary;
  readonly output?: unknown;
  readonly completedAt?: number | null;
}

export interface CommitRunTransitionCommand {
  readonly runId: string;
  /** Optimistic-concurrency guard: the record revision the caller expects. */
  readonly expectedRecordRevision: number;
  /** The event sequence the appended batch must start at (dense, append-only). */
  readonly expectedNextEventSeq: number;
  readonly next: RunStateUpdate;
  /** Ordered batch of new events, appended atomically with the state update. */
  readonly events: readonly KernelEvent[];
  readonly timestamp: number;
}

export interface RunQuery {
  readonly graphId?: string;
  readonly activationVersion?: string;
  readonly status?: StoredRunStatus;
  readonly limit?: number;
}

export interface RecoveryCommand {
  /** Stable machine-readable interruption code recorded on the blocked event. */
  readonly code: string;
  /** Safe reason recorded on the blocked event. */
  readonly reason: string;
  /** Safe remediation recorded on the blocked event. */
  readonly remediation: string;
  readonly timestamp: number;
}

export interface RecoveredRun {
  readonly runId: string;
  readonly graphId: string;
  readonly activationVersion: string;
  readonly currentNodeId: string | null;
  readonly steps: number;
  /** Sequence number of the appended interruption event. */
  readonly eventSeq: number;
}

export interface RecoveryResult {
  /** Nonterminal runs found in a running state. */
  readonly scanned: number;
  readonly blocked: readonly RecoveredRun[];
}

/**
 * Durable execution store for runs and their append-only events.
 *
 * Atomicity contract (DATA-003): every `createRun` and `commitTransition`
 * commits the run-state update and its event batch together or not at all.
 * Reads return immutable snapshots; events cannot be updated or deleted
 * through this port; run updates require optimistic concurrency.
 */
export interface ExecutionStore {
  createRun(command: CreateRunCommand): Promise<StoredRun>;
  commitTransition(command: CommitRunTransitionCommand): Promise<StoredRun>;
  getRun(runId: string): Promise<StoredRun | undefined>;
  listRuns(query?: RunQuery): Promise<readonly StoredRun[]>;
  listEvents(runId: string, afterSeq?: number): Promise<readonly StoredEvent[]>;
  recoverInterruptedRuns(command: RecoveryCommand): Promise<RecoveryResult>;
}

/** The set of stores a runtime needs. Both ports share one backend. */
export interface VictStores {
  readonly catalog: ActivationCatalog;
  readonly execution: ExecutionStore;
}

/** Stores plus explicit lifecycle. Adapters should implement `dispose` for clean shutdown. */
export interface DisposableVictStores extends VictStores {
  /** Close underlying resources (e.g. the SQLite connection). Idempotent. */
  dispose(): Promise<void>;
}

/**
 * Test-only fault injection surface. Adapters MAY accept a hook that throws
 * between the logical run-state update and the event append inside one
 * transaction, so tests can prove no half-state becomes visible. Inert in
 * production use.
 */
export interface TransitionFaultHooks {
  /** Called after the run-state update is staged but before events are appended. */
  afterRunUpdate?(command: CommitRunTransitionCommand | CreateRunCommand): void;
  /** Called after events are appended but before the transaction commits. */
  beforeCommit?(command: CommitRunTransitionCommand | CreateRunCommand): void;
}
