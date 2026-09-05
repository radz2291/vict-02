import type { AgentStreamEvent } from '@vict/contracts';
import type { AgentReference, AgentProfileAuthoring } from '@vict/sdk';
import type { CompiledAgentProfile } from '@vict/kernel';

/**
 * Neutral product-agent runtime boundary (Stage 06A).
 *
 * This module defines the activation/turn/governance vocabulary of the
 * ProductAgent boundary. It is deliberately the agent framework-free (AI-002): no the agent framework
 * type, package name, chunk type, or error type may appear here. The
 * the adapter-backed implementation lives in the optional adapter package
 * adapter, which implements `ProductAgentPort` against these neutral types.
 *
 * Snapshot discipline (AI-004, amendment §6.4):
 * - activation resolves and deep-captures EVERY revisioned profile
 *   component into an immutable VICT-owned snapshot;
 * - required function references (helper-tool executes, processor
 *   transforms, guardrail checks) are bound by reference and are never
 *   hashed or serialized;
 * - an in-flight turn receives ONLY the frozen snapshot — it cannot retain
 *   or consult a live mutable registry, agent, processor list, model
 *   profile, or tool map;
 * - changed definitions apply only after explicit re-activation.
 */

/** Versioned marker of the agent-activation identity schema. */
export const AGENT_ACTIVATION_IDENTITY_SCHEMA = 'vict.agent-activation@1';

/** Versioned marker of persisted agent-activation records. */
export const AGENT_ACTIVATION_RECORD_SCHEMA = 'vict.agent-activation-record@1';

/** A binding of one profile reference to its resolved artifact implementation. */
export interface AgentArtifactBinding<B> {
  /** The exact reference the profile pinned. */
  readonly reference: AgentReference;
  /** The resolved, frozen artifact definition (function refs bound, not hashed). */
  readonly artifact: B;
}

/** The kind of a registered agent artifact. */
export type AgentArtifactKind =
  'instructions' | 'memory-policy' | 'helper-tool' | 'processor' | 'guardrail' | 'workflow';

/** One registered artifact (frozen capture). */
export type AgentArtifact =
  | AgentInstructionsArtifact
  | AgentMemoryPolicyArtifact
  | AgentHelperToolArtifact
  | AgentProcessorArtifact
  | AgentGuardrailArtifact
  | AgentWorkflowArtifact;

/** Instructions text bound to an exact revision. */
export interface AgentInstructionsArtifact {
  readonly kind: 'instructions';
  readonly id: string;
  readonly revision: string;
  /** The instruction text — resolved at activation, never hashed into identity. */
  readonly text: string;
}

/**
 * Declared memory policy (data only). Feature flags are explicit and
 * closed: this adapter revision supports an explicit message-history
 * window, optional static working-memory injection, and semantic recall
 * must be explicitly `false` (offline Stage 06A envelope — enabling it
 * requires an embedding model, which the pinned offline profile does not
 * provide). Nothing is defaulted.
 */
export interface AgentMemoryPolicyConfig {
  /** Explicit message-history window (`false` disables; `false` is explicit). */
  readonly lastMessages: number | false;
  /** Explicit working-memory declaration. */
  readonly workingMemory: {
    readonly enabled: boolean;
    /** Static template text injected as working memory when enabled. */
    readonly template?: string;
  };
  /** Must be explicitly `false` in this adapter revision. */
  readonly semanticRecall: false;
}

/** Memory-policy artifact bound to an exact revision. */
export interface AgentMemoryPolicyArtifact {
  readonly kind: 'memory-policy';
  readonly id: string;
  readonly revision: string;
  readonly config: AgentMemoryPolicyConfig;
}

/** A pure helper-tool definition (amendment §6.5). */
export interface AgentHelperToolDefinition {
  /** Stable tool identifier (referenced from the profile). */
  readonly id: string;
  /** Explicit revision; implementation changes require a revision change. */
  readonly revision: string;
  /** Bounded, human/author-declared description surfaced to the model. */
  readonly description: string;
  /**
   * Declared effect class. A helper is allowed ONLY as `pure`
   * (deterministic formatting/computation/transformation with no external
   * or durable effect). Any other declaration is rejected before
   * activation — effectful work belongs to VICT capabilities (§7).
   */
  readonly effect: 'pure';
  /** Neutral input contract — validated at the adapter boundary. */
  readonly input: AgentHelperToolIO;
  /** Neutral output contract — validated before any result is used. */
  readonly output: AgentHelperToolIO;
  /** The pure implementation. Captured by reference; never hashed or serialized. */
  readonly execute: (input: unknown) => Promise<unknown> | unknown;
}

/** Neutral contract binding for helper-tool I/O (id + revision + parse). */
export interface AgentHelperToolIO {
  /** Stable contract identifier. */
  readonly id: string;
  /** Explicit contract revision. */
  readonly revision: string;
  /**
   * The declarative JSON-Schema document (IETF vocabulary) describing the
   * contract to the model. Frozen canonical data; participates in adapter
   * tool construction, never in identity (identity carries id + revision).
   */
  readonly jsonSchema: Record<string, unknown>;
  /**
   * The parsing callable of a neutral VICT contract — the authoritative
   * validation boundary. Returns the parsed value or structured issues;
   * raw third-party schema messages never cross the boundary
   * (CONT-004/CONT-005).
   */
  readonly parse: (value: unknown) =>
    | { readonly ok: true; readonly value: unknown }
    | {
        readonly ok: false;
        readonly issues: ReadonlyArray<{ readonly path?: string; readonly message: string }>;
      };
}

/** A registered pure helper tool (frozen capture). */
export interface AgentHelperToolArtifact {
  readonly kind: 'helper-tool';
  readonly id: string;
  readonly revision: string;
  readonly definition: AgentHelperToolDefinition;
}

/**
 * A presentation-local processor: a PURE text transform applied to model
 * input/output text at the adapter boundary. Order in the profile chain is
 * execution order.
 */
export interface AgentProcessorArtifact {
  readonly kind: 'processor';
  readonly id: string;
  readonly revision: string;
  readonly transform: (text: string) => string;
}

/**
 * A guardrail check: a PURE predicate over response text. Returning a
 * stable failure code fails the turn closed — guardrails never mutate.
 */
export interface AgentGuardrailArtifact {
  readonly kind: 'guardrail';
  readonly id: string;
  readonly revision: string;
  readonly check: (
    text: string,
  ) => { readonly ok: true } | { readonly ok: false; readonly code: string };
}

/**
 * A declarative AI-internal workflow reference target (amendment §4:
 * the agent framework workflows serve AI-internal deterministic composition only). The
 * Stage 06A artifact is a bounded declaration; adapter execution of
 * workflows arrives with the Stage 06B tool bridge.
 */
export interface AgentWorkflowArtifact {
  readonly kind: 'workflow';
  readonly id: string;
  readonly revision: string;
  readonly description: string;
}

/** The immutable, resolved agent-profile activation snapshot. */
export interface AgentProfileActivation {
  /** Deterministic activation identity (schema + profile version + artifact set). */
  readonly activationVersion: string;
  /** The compiled profile identity. */
  readonly agentProfileVersion: string;
  /** The compiled profile — deep-frozen VICT-owned capture. */
  readonly profile: CompiledAgentProfile;
  /** Resolved instructions (exact revision). */
  readonly instructions: AgentArtifactBinding<AgentInstructionsArtifact>;
  /** Resolved memory policy (exact revision). */
  readonly memoryPolicy: AgentArtifactBinding<AgentMemoryPolicyArtifact>;
  /** Resolved helper tools, canonically sorted by id. */
  readonly helperTools: ReadonlyArray<AgentArtifactBinding<AgentHelperToolArtifact>>;
  /** Resolved processor chain in declared order. */
  readonly processors: ReadonlyArray<AgentArtifactBinding<AgentProcessorArtifact>>;
  /** Resolved guardrail chain in declared order. */
  readonly guardrails: ReadonlyArray<AgentArtifactBinding<AgentGuardrailArtifact>>;
  /** Resolved AI-internal workflow declarations, canonically sorted by id. */
  readonly workflows: ReadonlyArray<AgentArtifactBinding<AgentWorkflowArtifact>>;
  /** Resolved sub-agent profile versions, canonically sorted by id. */
  readonly subagents: ReadonlyArray<{
    readonly reference: AgentReference;
    readonly agentProfileVersion: string;
  }>;
  /** The capability authority envelope (exact revisions, canonically sorted). */
  readonly capabilities: readonly AgentReference[];
  /** Activation creation time from the injected clock (epoch ms). */
  readonly createdAt: number;
}

/** Persistable identity record of one activation (Stage 02 restart model). */
export interface AgentActivationRecord {
  readonly recordSchema: 'vict.agent-activation-record@1';
  readonly activationVersion: string;
  readonly agentProfileVersion: string;
  readonly agentId: string;
  readonly agentRevision: string;
  /** Canonical activation manifest JSON (identity, not executable code). */
  readonly canonicalManifest: string;
  /** Every resolved artifact reference, canonically sorted. */
  readonly artifacts: ReadonlyArray<{
    readonly kind: AgentArtifactKind;
    readonly id: string;
    readonly revision: string;
  }>;
  readonly createdAt: number;
}

/** Why an activation could not be restored (fail-closed reasons). */
export type AgentActivationRestoreFailureCode =
  | 'AGENT_ACTIVATION_RECORD_MISSING'
  | 'AGENT_ACTIVATION_PROFILE_MISMATCH'
  | 'AGENT_ACTIVATION_ARTIFACT_MISSING'
  | 'AGENT_ACTIVATION_ARTIFACT_REVISION_MISMATCH'
  | 'AGENT_ACTIVATION_CORRUPT_RECORD';

/** The result of restoring an activation identity. */
export type AgentActivationRestoreResult =
  | { readonly ok: true; readonly activation: AgentProfileActivation }
  | {
      readonly ok: false;
      readonly code: AgentActivationRestoreFailureCode;
      readonly message: string;
    };

/** One turn request against a pinned agent activation. */
export interface AgentTurnRequest {
  /** VICT turn identity. */
  readonly turnId: string;
  /** the agent framework thread identity for the conversation. */
  readonly threadId: string;
  /** VICT actor identity — the ONLY source of memory ownership (MSTR-007). */
  readonly actorId: string;
  /** The caller-validated user input for this turn. */
  readonly input: string;
}

/** The neutral credential-resolution port (MSTR-011). */
export interface AgentCredentialPort {
  /**
   * Resolve a named credential just in time. Returns `undefined` when not
   * provisioned. Values MUST never be serialized into profiles, snapshots,
   * messages, memory, traces, streams, diagnostics, errors, exports, or
   * databases. Implementations must not cache values across invocations.
   */
  get(name: string): Promise<string | undefined>;
}

/** Execution context handed to a bound ProductAgent port for one turn. */
export interface AgentTurnExecutionContext {
  /** The frozen activation snapshot — the ONLY execution semantics. */
  readonly activation: AgentProfileActivation;
  /** Just-in-time credential resolution (protected-only; never serialized). */
  readonly credentials?: AgentCredentialPort;
  /** Injected clock (epoch ms). */
  readonly clock?: () => number;
  /** Cooperative cancellation signal. */
  readonly abortSignal?: AbortSignal;
  /** Normalized event sink (`vict.agent-stream@1` in-process surface). */
  readonly onEvent?: (event: AgentStreamEvent) => void;
  /** VICT run identity for correlation, when the turn runs inside a run. */
  readonly victRunId?: string;
}

/** Terminal turn outcome with sanitized results only. */
export interface AgentTurnOutcome {
  readonly status: 'completed' | 'failed' | 'cancelled';
  /** Completed assistant text when the turn completed. */
  readonly text?: string;
  /** The normalized events produced by the turn (deterministic order). */
  readonly events: readonly AgentStreamEvent[];
  /** Usage summary when available (aggregated counts only). */
  readonly usage?: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly totalTokens: number;
  };
  /** Stable sanitized failure code when failed — never raw error content. */
  readonly errorCode?: string;
  /** The actually observed provider/model identity, when the fixture supplies it. */
  readonly providerModelIdentity?: string;
  /** The the agent framework trace identity for correlation, when tracing produced one. */
  readonly traceId?: string;
}

/**
 * The neutral ProductAgent port (AI-001). No the agent framework parameter, chunk, or
 * error type appears in this signature.
 */
export interface ProductAgentPort {
  /** The profile identity this port implementation is bound to. */
  readonly agentProfileVersion: string;
  /** Run one turn against the pinned activation snapshot. */
  runTurn(request: AgentTurnRequest, context: AgentTurnExecutionContext): Promise<AgentTurnOutcome>;
}

/** A runner pinned to ONE activation snapshot for its whole lifetime. */
export interface PinnedAgentTurnRunner {
  readonly activation: AgentProfileActivation;
  runTurn(
    request: AgentTurnRequest,
    context?: Omit<AgentTurnExecutionContext, 'activation'>,
  ): Promise<AgentTurnOutcome>;
}

/**
 * Pin a ProductAgent port to one immutable activation snapshot. The runner
 * captures the snapshot now: post-pin registry mutation or re-activation
 * cannot affect turns it starts, and the port is refused when it is bound
 * to a different profile identity (fail closed, never substitute).
 */
export function pinAgentTurnRunner(
  port: ProductAgentPort,
  activation: AgentProfileActivation,
): PinnedAgentTurnRunner {
  if (port.agentProfileVersion !== activation.agentProfileVersion) {
    throw new Error(
      'VICT_AGENT_PORT_MISMATCH: the ProductAgent port is bound to a different agentProfileVersion than the pinned activation; refusing to substitute.',
    );
  }
  return {
    activation,
    runTurn(request, context = {}) {
      return port.runTurn(request, { ...context, activation });
    },
  };
}

/**
 * Compile-time and documentation view of the profile authoring input the
 * registry accepts (re-exported so neutral runtime consumers do not need
 * to import `@vict/sdk` separately for the shape).
 */
export type { AgentProfileAuthoring };
