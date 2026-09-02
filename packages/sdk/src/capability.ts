import type { Contract } from '@vict/contracts';

/**
 * Authoring vocabulary for executable capabilities.
 *
 * This module is part of the stable authoring ABI (`@vict/sdk`). It sits
 * BELOW the kernel and runtime in the dependency direction:
 *
 *   @vict/contracts -> @vict/sdk -> @vict/kernel -> @vict/runtime
 *
 * The kernel and runtime CONSUME these public authoring declarations; they
 * do not own author-facing definitions. Nothing in this module may import
 * or mention the runtime, a UI framework, or a schema library.
 */

/** Effect classification for a capability. */
export type EffectClass = 'pure' | 'read' | 'write' | 'irreversible';

/** Execution modes understood by the runtime policy. */
export type ExecutionMode = 'normal' | 'simulate' | 'test';

/**
 * Context handed to capability implementations and test doubles at
 * invocation time. Least-authority by construction: it exposes run/node
 * identity, durability metadata, and — when a pack declares them — SCOPED
 * configuration/secret accessors. It never exposes a service locator, a
 * store, a registry, or unrestricted mutation.
 */
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
  // ---- Stage 03 durable-orchestration extensions (additive, optional) ----
  /** Stable logical invocation identity (invariant across retries). */
  readonly invocationId?: string;
  /** This attempt's durable identity. */
  readonly attemptId?: string;
  /** 1-based attempt number within the logical invocation. */
  readonly attemptNumber?: number;
  /** Stable opaque idempotency key, when the node declared a retry policy. */
  readonly idempotencyKey?: string;
  /** Epoch-ms deadline for this attempt, when one applies. */
  readonly deadlineAt?: number;
  /** Cooperative abort signal; aborted on timeout or cancellation. */
  readonly abortSignal?: AbortSignal;
  /** Branch identity when executing inside a fork branch. */
  readonly branch?: {
    readonly forkId: string;
    readonly joinId: string;
    readonly branchKey: string;
    readonly lineage: string;
  };
  // ---- Stage 04 least-authority extensions (additive, optional) ----
  /**
   * Scoped configuration accessor, present only when the runtime was
   * constructed with a configuration provider. Only names the capability
   * (or its pack manifest) declares are readable; access to an undeclared
   * name is unavailable and fails with a structured authority error.
   */
  readonly config?: CapabilityConfigReader;
  /**
   * Scoped secret accessor, present only when the runtime was constructed
   * with a secret-resolution port. Only names the capability (or its pack
   * manifest) declares are resolvable; values are resolved just in time and
   * are never part of manifests, events, or retained history.
   */
  readonly secrets?: CapabilitySecretReader;
}

/** Scoped, name-checked configuration access for one capability. */
export interface CapabilityConfigReader {
  /**
   * Read a declared configuration value. Throws a structured authority
   * error when the name was not declared by this capability — undeclared
   * configuration is unavailable, never silently empty.
   */
  get(name: string): unknown;
}

/** Scoped, name-checked secret access for one capability. */
export interface CapabilitySecretReader {
  /**
   * Resolve a declared secret reference just in time. Resolves to
   * `undefined` when the named secret is not provisioned. Throws a
   * structured authority error when the name was not declared by this
   * capability.
   */
  get(name: string): Promise<string | undefined>;
}

/**
 * A typed operation a graph can invoke. `effect` classifies its external
 * impact; contracts are executable promises about its input and output.
 *
 * The `revision` is an author/build responsibility: changing handler logic,
 * effect class or bound contracts requires changing the revision so
 * activation identity can distinguish the change. Function bodies are never
 * hashed or serialized — identity is revision-based.
 *
 * Authority declarations (`permissions`, `requiredConfiguration`,
 * `requiredSecrets`) are enforced by the runtime BEFORE the handler is
 * invoked; a missing grant fails the invocation with a structured error and
 * never runs the handler.
 */
export interface CapabilityDefinition<I = unknown, O = unknown> {
  readonly id: string;
  readonly revision: string;
  readonly effect: EffectClass;
  readonly input?: Contract<I>;
  readonly output?: Contract<O>;
  invoke(input: I, context: CapabilityContext): Promise<O> | O;
  /**
   * Declared idempotency semantics for retryable writes: `'keyed'` means the
   * capability accepts a stable idempotency key (supplied through the
   * capability context) and repeats with the same key are reconciled to one
   * external mutation. Absent for non-write effects and for writes without
   * keyed support (which may never be auto-retried). Participates in
   * capability-set and activation identity when declared.
   */
  readonly idempotency?: 'keyed';
  /**
   * Stage 04: permission grants this capability requires. Every declared
   * grant must be explicitly granted to the runtime (or the installing
   * capability pack) or invocation fails before the handler runs.
   */
  readonly permissions?: readonly string[];
  /**
   * Stage 04: configuration names this capability may READ through its
   * scoped context reader. Undeclared names are unavailable.
   */
  readonly configuration?: readonly string[];
  /**
   * Stage 04: configuration names this capability requires. Each must
   * resolve through the runtime's configuration provider or invocation
   * fails before the handler runs.
   */
  readonly requiredConfiguration?: readonly string[];
  /**
   * Stage 04: secret references this capability may RESOLVE through its
   * scoped context reader (names only — never values). Undeclared names are
   * unavailable.
   */
  readonly secrets?: readonly string[];
  /**
   * Stage 04: secret references this capability requires (names only —
   * never values). Each must resolve through the runtime's secret port or
   * invocation fails before the handler runs.
   */
  readonly requiredSecrets?: readonly string[];
}

/** Test-double invocation. Contracts of the original capability still apply. */
export type DoubleInvoke = (input: unknown, context: CapabilityContext) => unknown;
