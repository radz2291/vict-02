import { createHash } from 'node:crypto';
import { canonicalJson } from '@vict/kernel';
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

/**
 * Versioned marker of the agent-activation identity schema.
 *
 * `@2` records the normative corrective change of the canonical activation
 * manifest: it now covers the complete resolved executable activation —
 * every artifact binding (including a declared structured-output contract)
 * AND the adapter compatibility metadata (id, revision, and every pinned
 * runtime package version). `@1` records cannot be accepted under `@2`
 * because their stored manifest bytes cannot match the reconstructed
 * activation; restoration fails closed instead of substituting.
 *
 * `@3` records the further normative boundary-remediation correction: the
 * manifest now ALSO carries the RESOLVED identity of every referenced
 * sub-agent profile (`subagents: [{id, revision, agentProfileVersion}]`,
 * canonically sorted). A stored activation therefore pins not only WHICH
 * sub-agent revision it referenced but WHAT that resolved child profile
 * identity was at activation time; restoration under a changed child
 * profile rejects the record instead of accepting a silently different
 * resolved executable activation. `@2` records cannot be accepted under
 * `@3` (their stored manifest bytes cannot match the reconstructed
 * activation); restoration and persistence both fail closed.
 */
export const AGENT_ACTIVATION_IDENTITY_SCHEMA = 'vict.agent-activation@3';

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
  | 'instructions'
  | 'memory-policy'
  | 'helper-tool'
  | 'processor'
  | 'guardrail'
  | 'structured-output-contract'
  | 'workflow';

/** One registered artifact (frozen capture). */
export type AgentArtifact =
  | AgentInstructionsArtifact
  | AgentMemoryPolicyArtifact
  | AgentHelperToolArtifact
  | AgentProcessorArtifact
  | AgentGuardrailArtifact
  | AgentStructuredOutputContractArtifact
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
  /**
   * The closed set of failure codes this guardrail may return. Only a code
   * declared here is embedded into the public VICT error code
   * (`VICT_GUARDRAIL_<CODE>`); any other returned code — and any throw —
   * maps to the single stable framework code `VICT_GUARDRAIL_REJECTED`,
   * so arbitrary author strings can never enter the public error-code
   * space. Declared codes must match `^[A-Z][A-Z0-9_]{0,31}$`.
   */
  readonly failureCodes?: readonly string[];
}

/**
 * A structured-output contract bound to an exact revision. The `parse`
 * callable IS the contract's actual parser semantics, captured by
 * reference at activation (never hashed, never serialized). A profile that
 * declares `structuredOutput` cannot activate unless the exact contract
 * id+revision is registered — identity-only references are never treated
 * as executable bindings.
 */
export interface AgentStructuredOutputContractArtifact {
  readonly kind: 'structured-output-contract';
  readonly id: string;
  readonly revision: string;
  /** Bounded human/author description (never surfaced as authority). */
  readonly description: string;
  /**
   * The authoritative parser over completed model text. Throwing parsers
   * are untrusted: the adapter reduces any throw to a sanitized structured
   * failure; issue payloads never propagate raw.
   */
  readonly parse: (text: string) =>
    | { readonly ok: true; readonly value: unknown }
    | {
        readonly ok: false;
        readonly issues: ReadonlyArray<{ readonly path?: string; readonly message: string }>;
      };
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
  /**
   * The resolved structured-output contract (exact revision) when the
   * profile declares structured output; otherwise `undefined`.
   */
  readonly structuredOutput?: AgentArtifactBinding<AgentStructuredOutputContractArtifact>;
  /** Resolved AI-internal workflow declarations, canonically sorted by id. */
  readonly workflows: ReadonlyArray<AgentArtifactBinding<AgentWorkflowArtifact>>;
  /** Resolved sub-agent profile versions, canonically sorted by id. */
  readonly subagents: ReadonlyArray<{
    readonly reference: AgentReference;
    readonly agentProfileVersion: string;
  }>;
  /** The capability authority envelope (exact revisions, canonically sorted). */
  readonly capabilities: readonly AgentReference[];
  /**
   * The exact adapter compatibility the activation was resolved under
   * (defensive copy of the compiled profile's adapter marker).
   */
  readonly adapterCompatibility: {
    readonly id: string;
    readonly revision: string;
    readonly runtimePackages: Readonly<Record<string, string>>;
  };
  /** The canonical activation manifest JSON (deterministic bytes). */
  readonly canonicalManifestJson: string;
  /** Every resolved artifact reference, canonically sorted (manifest order). */
  readonly artifactList: ReadonlyArray<{
    readonly kind: AgentArtifactKind | 'subagent' | 'capability';
    readonly id: string;
    readonly revision: string;
  }>;
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
    readonly kind: AgentArtifactKind | 'subagent' | 'capability';
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

/**
 * Structural validation result for a persisted activation record. Store
 * adapters MUST run this before persistence so malformed, inconsistent, or
 * secret-bearing records can never enter durable storage.
 */
export type AgentActivationRecordValidation =
  { readonly ok: true } | { readonly ok: false; readonly reason: string };

/**
 * The closed field set of a persisted activation record. Any additional
 * member — including a smuggled secret-bearing field — fails validation.
 */
const ACTIVATION_RECORD_FIELDS: ReadonlySet<string> = new Set([
  'recordSchema',
  'activationVersion',
  'agentProfileVersion',
  'agentId',
  'agentRevision',
  'canonicalManifest',
  'artifacts',
  'createdAt',
]);

const ACTIVATION_ARTIFACT_ENTRY_FIELDS: ReadonlySet<string> = new Set(['kind', 'id', 'revision']);

/** The closed field set of the canonical activation manifest (identity @3). */
const ACTIVATION_MANIFEST_FIELDS: ReadonlySet<string> = new Set([
  'schema',
  'agentProfileVersion',
  'adapter',
  'artifacts',
  'subagents',
]);

/** The closed field set of the manifest adapter-compatibility entry. */
const ACTIVATION_MANIFEST_ADAPTER_FIELDS: ReadonlySet<string> = new Set([
  'id',
  'revision',
  'runtimePackages',
]);

/** The closed field set of one manifest subagent-identity entry. */
const ACTIVATION_MANIFEST_SUBAGENT_FIELDS: ReadonlySet<string> = new Set([
  'id',
  'revision',
  'agentProfileVersion',
]);

const VERSION_STRING_PATTERN = /^v1_[0-9a-f]{64}$/;

/** Canonical order of activation-manifest artifact entries (mirror of the registry order). */
function compareManifestArtifactEntries(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): number {
  if (a.kind !== b.kind) {
    return (a.kind as string) < (b.kind as string) ? -1 : 1;
  }
  if (a.id !== b.id) {
    return (a.id as string) < (b.id as string) ? -1 : 1;
  }
  if (a.revision === b.revision) {
    return 0;
  }
  return (a.revision as string) < (b.revision as string) ? -1 : 1;
}

/**
 * Validate a persisted activation record at the durable boundary (shared by
 * restoration AND by every store adapter before persistence).
 *
 * STRUCTURAL validation: closed field sets, exact schema marker, canonical
 * version forms, well-formed artifact entries with known kinds.
 *
 * CONTENT validation (the persistence-time gate): the canonical manifest is
 * PARSED and validated against its closed schema; the manifest is recomputed
 * into canonical form and compared byte-for-byte with the stored text; the
 * activation identity is RECOMPUTED from the manifest bytes and cross-checked
 * against the record's `activationVersion`; the manifest's profile version
 * and artifact list are cross-checked against the record's own fields. A
 * record with fabricated hashes, a fabricated or non-canonical manifest,
 * contradictory identity fields, unknown manifest content, or hostile
 * property access is rejected BEFORE storage — with stable, non-echoing
 * diagnostics (no raw exceptions, no payload-derived text in reasons).
 *
 * This is structural/hash validation only: it does NOT resolve executable
 * artifacts — that remains restoration's exclusive job (re-resolution plus
 * byte-exact reconstruction comparison).
 */
export function validateAgentActivationRecord(record: unknown): AgentActivationRecordValidation {
  try {
    return validateActivationRecordShape(record);
  } catch {
    // Hostile getters/proxies must never escape as raw exceptions, and no
    // payload-derived text ever reaches the diagnostic.
    return {
      ok: false,
      reason: 'The activation record could not be validated safely; hostile input is rejected.',
    };
  }
}

function validateActivationRecordShape(record: unknown): AgentActivationRecordValidation {
  if (typeof record !== 'object' || record === null || Array.isArray(record)) {
    return { ok: false, reason: 'The activation record must be a plain object.' };
  }
  const candidate = record as Record<string, unknown>;
  for (const key of Object.keys(candidate)) {
    if (!ACTIVATION_RECORD_FIELDS.has(key)) {
      return {
        ok: false,
        reason: 'The activation record declares unknown fields; the record schema is closed.',
      };
    }
  }
  if (candidate.recordSchema !== 'vict.agent-activation-record@1') {
    return { ok: false, reason: 'The activation record schema marker is not recognized.' };
  }
  for (const key of ['activationVersion', 'agentProfileVersion'] as const) {
    const value = candidate[key];
    if (typeof value !== 'string' || !VERSION_STRING_PATTERN.test(value)) {
      return {
        ok: false,
        reason: `The activation record '${key}' is not a canonical version string.`,
      };
    }
  }
  for (const key of ['agentId', 'agentRevision'] as const) {
    const value = candidate[key];
    if (typeof value !== 'string' || value.length === 0 || value.length > 128) {
      return { ok: false, reason: `The activation record '${key}' is missing or malformed.` };
    }
  }
  if (typeof candidate.canonicalManifest !== 'string' || candidate.canonicalManifest.length === 0) {
    return { ok: false, reason: 'The activation record canonical manifest is missing.' };
  }
  if (
    typeof candidate.createdAt !== 'number' ||
    !Number.isFinite(candidate.createdAt) ||
    candidate.createdAt < 0
  ) {
    return {
      ok: false,
      reason: 'The activation record createdAt is not a finite epoch-ms number.',
    };
  }
  if (!Array.isArray(candidate.artifacts)) {
    return { ok: false, reason: 'The activation record artifact list must be an array.' };
  }
  for (const entry of candidate.artifacts) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      return { ok: false, reason: 'The activation record artifact entries must be plain objects.' };
    }
    const artifact = entry as Record<string, unknown>;
    for (const key of Object.keys(artifact)) {
      if (!ACTIVATION_ARTIFACT_ENTRY_FIELDS.has(key)) {
        return {
          ok: false,
          reason: 'The activation record artifact entry declares unknown fields.',
        };
      }
    }
    if (typeof artifact.kind !== 'string' || !VALID_RECORD_ARTIFACT_KINDS.has(artifact.kind)) {
      return { ok: false, reason: 'The activation record artifact entry has an unknown kind.' };
    }
    for (const key of ['id', 'revision'] as const) {
      const value = artifact[key];
      if (typeof value !== 'string' || value.length === 0 || value.length > 128) {
        return {
          ok: false,
          reason: `The activation record artifact entry '${key}' is missing or malformed.`,
        };
      }
    }
  }
  return validateActivationManifestContent(candidate, candidate.canonicalManifest);
}

/**
 * Content validation of the canonical manifest: closed schema, canonical
 * bytes, recomputed identity, and record/manifest cross-checks. The input
 * is plain parsed JSON (and the record's own validated fields), so no
 * getter can run here; the caller's try/catch still bounds every access.
 */
function validateActivationManifestContent(
  candidate: Record<string, unknown>,
  manifestText: string,
): AgentActivationRecordValidation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(manifestText);
  } catch {
    return { ok: false, reason: 'The activation record canonical manifest is not valid JSON.' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      ok: false,
      reason: 'The activation record canonical manifest must be a JSON object.',
    };
  }
  const manifest = parsed as Record<string, unknown>;
  for (const key of Object.keys(manifest)) {
    if (!ACTIVATION_MANIFEST_FIELDS.has(key)) {
      return {
        ok: false,
        reason: 'The activation manifest declares unknown fields; the manifest schema is closed.',
      };
    }
  }
  if (manifest.schema !== AGENT_ACTIVATION_IDENTITY_SCHEMA) {
    return { ok: false, reason: 'The activation manifest schema marker is not recognized.' };
  }
  if (
    typeof manifest.agentProfileVersion !== 'string' ||
    !VERSION_STRING_PATTERN.test(manifest.agentProfileVersion)
  ) {
    return {
      ok: false,
      reason: 'The activation manifest profile version is not a canonical version string.',
    };
  }
  if (manifest.agentProfileVersion !== candidate.agentProfileVersion) {
    return {
      ok: false,
      reason: 'The activation manifest profile version contradicts the record profile version.',
    };
  }
  const adapterValidation = validateManifestAdapterEntry(manifest.adapter);
  if (!adapterValidation.ok) {
    return adapterValidation;
  }
  const artifactsValidation = validateManifestArtifacts(manifest.artifacts, candidate.artifacts);
  if (!artifactsValidation.ok) {
    return artifactsValidation;
  }
  const subagentsValidation = validateManifestSubagents(manifest.subagents);
  if (!subagentsValidation.ok) {
    return subagentsValidation;
  }
  // Canonical bytes: the stored manifest text must be EXACTLY the canonical
  // serialization of its own parsed content.
  let reserialized: string;
  try {
    reserialized = canonicalJson(parsed);
  } catch {
    return {
      ok: false,
      reason: 'The activation record canonical manifest is not canonical data.',
    };
  }
  if (reserialized !== manifestText) {
    return {
      ok: false,
      reason: 'The activation record canonical manifest is not in canonical form.',
    };
  }
  // Identity recompute: the record version must be the canonical hash of
  // the manifest bytes.
  const recomputed = `v1_${createHash('sha256').update(manifestText, 'utf8').digest('hex')}`;
  if (recomputed !== candidate.activationVersion) {
    return {
      ok: false,
      reason: 'The activation record version does not match the recomputed activation identity.',
    };
  }
  return { ok: true };
}

function validateManifestAdapterEntry(adapter: unknown): AgentActivationRecordValidation {
  if (typeof adapter !== 'object' || adapter === null || Array.isArray(adapter)) {
    return {
      ok: false,
      reason: 'The activation manifest adapter entry must be a plain object.',
    };
  }
  const adapterRecord = adapter as Record<string, unknown>;
  for (const key of Object.keys(adapterRecord)) {
    if (!ACTIVATION_MANIFEST_ADAPTER_FIELDS.has(key)) {
      return {
        ok: false,
        reason: 'The activation manifest adapter entry declares unknown fields.',
      };
    }
  }
  for (const key of ['id', 'revision'] as const) {
    const value = adapterRecord[key];
    if (typeof value !== 'string' || value.length === 0 || value.length > 128) {
      return {
        ok: false,
        reason: `The activation manifest adapter '${key}' is missing or malformed.`,
      };
    }
  }
  const runtimePackages = adapterRecord.runtimePackages;
  if (
    typeof runtimePackages !== 'object' ||
    runtimePackages === null ||
    Array.isArray(runtimePackages)
  ) {
    return {
      ok: false,
      reason: 'The activation manifest adapter runtime packages must be a plain object.',
    };
  }
  for (const key of Object.keys(runtimePackages as Record<string, unknown>)) {
    const value = (runtimePackages as Record<string, unknown>)[key];
    if (
      key.length === 0 ||
      key.length > 128 ||
      typeof value !== 'string' ||
      value.length === 0 ||
      value.length > 128
    ) {
      return {
        ok: false,
        reason: 'The activation manifest adapter runtime package entries are malformed.',
      };
    }
  }
  return { ok: true };
}

function validateManifestArtifacts(
  manifestArtifacts: unknown,
  recordArtifacts: unknown,
): AgentActivationRecordValidation {
  if (!Array.isArray(manifestArtifacts)) {
    return { ok: false, reason: 'The activation manifest artifact list must be an array.' };
  }
  if (!Array.isArray(recordArtifacts)) {
    return { ok: false, reason: 'The activation record artifact list must be an array.' };
  }
  if (manifestArtifacts.length !== recordArtifacts.length) {
    return {
      ok: false,
      reason: 'The activation manifest artifact list contradicts the record artifact list.',
    };
  }
  for (let index = 0; index < manifestArtifacts.length; index += 1) {
    const entry = manifestArtifacts[index];
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      return {
        ok: false,
        reason: 'The activation manifest artifact entries must be plain objects.',
      };
    }
    const artifact = entry as Record<string, unknown>;
    for (const key of Object.keys(artifact)) {
      if (!ACTIVATION_ARTIFACT_ENTRY_FIELDS.has(key)) {
        return {
          ok: false,
          reason: 'The activation manifest artifact entry declares unknown fields.',
        };
      }
    }
    if (typeof artifact.kind !== 'string' || !VALID_RECORD_ARTIFACT_KINDS.has(artifact.kind)) {
      return { ok: false, reason: 'The activation manifest artifact entry has an unknown kind.' };
    }
    for (const key of ['id', 'revision'] as const) {
      const value = artifact[key];
      if (typeof value !== 'string' || value.length === 0 || value.length > 128) {
        return {
          ok: false,
          reason: `The activation manifest artifact entry '${key}' is missing or malformed.`,
        };
      }
    }
    const recordEntry = recordArtifacts[index] as Record<string, unknown>;
    if (
      artifact.kind !== recordEntry.kind ||
      artifact.id !== recordEntry.id ||
      artifact.revision !== recordEntry.revision
    ) {
      return {
        ok: false,
        reason: 'The activation manifest artifact list contradicts the record artifact list.',
      };
    }
    if (
      index > 0 &&
      compareManifestArtifactEntries(
        manifestArtifacts[index - 1] as Record<string, unknown>,
        artifact,
      ) > 0
    ) {
      return {
        ok: false,
        reason: 'The activation manifest artifact list is not in canonical order.',
      };
    }
  }
  return { ok: true };
}

function validateManifestSubagents(subagents: unknown): AgentActivationRecordValidation {
  // Resolved subagent identities: every referenced sub-agent's RESOLVED
  // profile identity is part of the authoritative binding (closed fields,
  // canonical versions, canonically sorted by id then revision).
  if (!Array.isArray(subagents)) {
    return { ok: false, reason: 'The activation manifest subagent list must be an array.' };
  }
  for (let index = 0; index < subagents.length; index += 1) {
    const entry = subagents[index];
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      return {
        ok: false,
        reason: 'The activation manifest subagent entries must be plain objects.',
      };
    }
    const subagent = entry as Record<string, unknown>;
    for (const key of Object.keys(subagent)) {
      if (!ACTIVATION_MANIFEST_SUBAGENT_FIELDS.has(key)) {
        return {
          ok: false,
          reason: 'The activation manifest subagent entry declares unknown fields.',
        };
      }
    }
    for (const key of ['id', 'revision'] as const) {
      const value = subagent[key];
      if (typeof value !== 'string' || value.length === 0 || value.length > 128) {
        return {
          ok: false,
          reason: `The activation manifest subagent entry '${key}' is missing or malformed.`,
        };
      }
    }
    if (
      typeof subagent.agentProfileVersion !== 'string' ||
      !VERSION_STRING_PATTERN.test(subagent.agentProfileVersion)
    ) {
      return {
        ok: false,
        reason:
          'The activation manifest subagent resolved identity is not a canonical version string.',
      };
    }
    if (
      index > 0 &&
      compareManifestArtifactEntries(subagents[index - 1] as Record<string, unknown>, subagent) > 0
    ) {
      return {
        ok: false,
        reason: 'The activation manifest subagent list is not in canonical order.',
      };
    }
  }
  return { ok: true };
}

/** Artifact kinds that may appear inside a persisted activation record. */
const VALID_RECORD_ARTIFACT_KINDS: ReadonlySet<string> = new Set([
  'instructions',
  'memory-policy',
  'helper-tool',
  'processor',
  'guardrail',
  'structured-output-contract',
  'workflow',
  'subagent',
  'capability',
]);

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
