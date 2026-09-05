import type {
  AgentArtifact,
  AgentArtifactBinding,
  AgentArtifactKind,
  AgentActivationRecord,
  AgentActivationRestoreResult,
  AgentHelperToolArtifact,
  AgentInstructionsArtifact,
  AgentMemoryPolicyArtifact,
  AgentProfileActivation,
  AgentProcessorArtifact,
  AgentGuardrailArtifact,
  AgentStructuredOutputContractArtifact,
  AgentWorkflowArtifact,
} from './agent-types.js';
import { AGENT_ACTIVATION_IDENTITY_SCHEMA, validateAgentActivationRecord } from './agent-types.js';
import { createHash } from 'node:crypto';
import { canonicalJson, compileAgentProfile } from '@vict/kernel';
import type { CompiledAgentProfile } from '@vict/kernel';
import type { AgentProfileAuthoring, AgentReference } from '@vict/sdk';
import { VictRuntimeError } from './errors.js';

/**
 * Stage 06A — agent-profile registry, artifact registry, and immutable
 * activation snapshots.
 *
 * Registration discipline (established atomic-staging pattern):
 * - direct registration is atomic — a failed registration leaves the
 *   registries semantically unchanged;
 * - duplicates fail; intentional replacement goes through an explicit
 *   `replaceProfile` that pins the expected previous revision;
 * - caller objects are deep-captured at registration: later mutation of an
 *   original definition has no effect;
 * - activation resolves EVERY revisioned component to its EXACT revision
 *   and deep-captures an immutable VICT-owned snapshot; missing or
 *   mismatched artifacts fail closed — a current definition never silently
 *   substitutes for a pinned older revision;
 * - registry maps are never exposed; consumers receive frozen descriptors
 *   or activation snapshots.
 *
 * Function references (helper-tool executes, processor transforms,
 * guardrail checks) are captured by reference at activation and are never
 * hashed or serialized. Their bodies never participate in identity.
 */

const MAX_TEXT_LENGTH = 64 * 1024;
const WORKING_MEMORY_FIELDS: ReadonlySet<string> = new Set(['enabled', 'template']);

/** Bounded pattern for author-declared guardrail failure codes. */
const GUARDRAIL_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,31}$/;
const MAX_GUARDRAIL_CODES = 16;

/** Frozen deep copy of plain canonical data (validated before capture). */
function frozenCopy<T>(value: T): T {
  if (Array.isArray(value)) {
    return Object.freeze(value.map(frozenCopy)) as unknown as T;
  }
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      out[key] = frozenCopy((value as Record<string, unknown>)[key]);
    }
    return Object.freeze(out) as unknown as T;
  }
  return value;
}

/**
 * Defensive descriptor of an artifact: data is deep-copied and frozen;
 * function references (helper executes, processor transforms, guardrail
 * checks, contract parsers) are preserved BY REFERENCE and never copied or
 * serialized. Every resolution returns a FRESH descriptor, so mutating a
 * previously resolved value can never affect a later resolution or an
 * activation, and the registry's internal objects are never exposed.
 */
function defensiveArtifactDescriptor<T extends AgentArtifact>(artifact: T): T {
  return frozenCopy(artifact);
}

function requireId(id: unknown, what: string): string {
  if (typeof id !== 'string' || id.trim().length === 0 || id.length > 128) {
    throw new VictRuntimeError(
      'VICT_AGENT_INVALID_ARTIFACT',
      `${what} requires a non-empty id of at most 128 characters.`,
    );
  }
  return id;
}

function requireRevision(revision: unknown, what: string): string {
  if (typeof revision !== 'string' || revision.trim().length === 0 || revision.length > 128) {
    throw new VictRuntimeError(
      'VICT_AGENT_INVALID_ARTIFACT',
      `${what} requires a non-empty revision of at most 128 characters.`,
    );
  }
  return revision;
}

/** The strict closed field set of a helper-tool definition. */
const HELPER_TOOL_FIELDS: ReadonlySet<string> = new Set([
  'id',
  'revision',
  'description',
  'effect',
  'input',
  'output',
  'execute',
]);

const HELPER_IO_FIELDS: ReadonlySet<string> = new Set(['id', 'revision', 'jsonSchema', 'parse']);

/** Validate a helper-tool definition at the public registration boundary. */
function validateHelperToolDefinition(
  artifactId: string,
  artifactRevision: string,
  definition: AgentHelperToolArtifact['definition'],
): void {
  requireId(definition.id, `Helper tool`);
  requireRevision(definition.revision, `Helper tool '${String(definition.id)}'`);
  // The artifact wrapper's id/revision must agree with the definition's
  // own identity: a disagreement means the declared reference does not
  // name the implementation that would execute.
  if (definition.id !== artifactId || definition.revision !== artifactRevision) {
    throw new VictRuntimeError(
      'VICT_AGENT_INVALID_ARTIFACT',
      `Helper tool artifact declares outer identity '${artifactId}' (revision '${artifactRevision}') but its definition declares '${definition.id}' (revision '${definition.revision}'); the outer id/revision must agree with the definition.`,
      { artifactId },
    );
  }
  for (const key of Object.keys(definition as unknown as Record<string, unknown>)) {
    if (!HELPER_TOOL_FIELDS.has(key)) {
      throw new VictRuntimeError(
        'VICT_AGENT_UNKNOWN_ARTIFACT_FIELD',
        `Helper tool '${definition.id}' declares unknown field '${key}'; the helper-tool schema is closed.`,
        { helperToolId: definition.id, field: key },
      );
    }
  }
  if (
    typeof definition.description !== 'string' ||
    definition.description.length === 0 ||
    definition.description.length > 512
  ) {
    throw new VictRuntimeError(
      'VICT_AGENT_INVALID_ARTIFACT',
      `Helper tool '${definition.id}' requires a non-empty description of at most 512 characters.`,
      { helperToolId: definition.id },
    );
  }
  // §6.5: a helper is allowed only when it is genuinely pure. Any other
  // declared effect — including the runtime effect vocabulary — is rejected
  // BEFORE activation. Effectful work belongs to VICT capabilities.
  if (definition.effect !== 'pure') {
    throw new VictRuntimeError(
      'VICT_AGENT_HELPER_TOOL_NOT_PURE',
      `Helper tool '${definition.id}' declares effect '${String(definition.effect)}'; adapter-native helper tools must be exactly 'pure' (deterministic formatting/computation/transformation with no external or durable effect). Effectful work must cross the VICT capability boundary.`,
      { helperToolId: definition.id, effect: String(definition.effect) },
    );
  }
  for (const role of ['input', 'output'] as const) {
    const io = definition[role] as unknown;
    if (typeof io !== 'object' || io === null) {
      throw new VictRuntimeError(
        'VICT_AGENT_INVALID_ARTIFACT',
        `Helper tool '${definition.id}' must declare a neutral ${role} contract.`,
        { helperToolId: definition.id, role },
      );
    }
    const record = io as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (!HELPER_IO_FIELDS.has(key)) {
        throw new VictRuntimeError(
          'VICT_AGENT_UNKNOWN_ARTIFACT_FIELD',
          `Helper tool '${definition.id}' declares unknown field '${key}' in its ${role} contract; the contract binding is closed.`,
          { helperToolId: definition.id, field: key },
        );
      }
    }
    requireId(record.id, `Helper tool '${definition.id}' ${role} contract`);
    requireRevision(record.revision, `Helper tool '${definition.id}' ${role} contract`);
    if (typeof record.parse !== 'function') {
      throw new VictRuntimeError(
        'VICT_AGENT_INVALID_ARTIFACT',
        `Helper tool '${definition.id}' ${role} contract must provide a parse callable.`,
        { helperToolId: definition.id, role },
      );
    }
  }
  if (typeof definition.execute !== 'function') {
    throw new VictRuntimeError(
      'VICT_AGENT_INVALID_ARTIFACT',
      `Helper tool '${definition.id}' must provide an execute function.`,
      { helperToolId: definition.id },
    );
  }
}

/** Validate a memory-policy config at the public registration boundary. */
function validateMemoryPolicyConfig(config: AgentMemoryPolicyArtifact['config'], id: string): void {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    throw new VictRuntimeError(
      'VICT_AGENT_INVALID_ARTIFACT',
      `Memory policy '${id}' requires a plain config object.`,
      { memoryPolicyId: id },
    );
  }
  const record = config as unknown as Record<string, unknown>;
  const allowed: ReadonlySet<string> = new Set(['lastMessages', 'workingMemory', 'semanticRecall']);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      throw new VictRuntimeError(
        'VICT_AGENT_UNKNOWN_ARTIFACT_FIELD',
        `Memory policy '${id}' declares unknown field '${key}'; the memory-policy config schema is closed.`,
        { memoryPolicyId: id, field: key },
      );
    }
  }
  const lastMessages = record.lastMessages;
  if (lastMessages === undefined) {
    throw new VictRuntimeError(
      'VICT_AGENT_INVALID_ARTIFACT',
      `Memory policy '${id}' must declare 'lastMessages' explicitly (a positive integer or exactly false).`,
      { memoryPolicyId: id },
    );
  }
  if (
    lastMessages !== false &&
    (typeof lastMessages !== 'number' ||
      !Number.isInteger(lastMessages) ||
      lastMessages < 1 ||
      lastMessages > 1000)
  ) {
    throw new VictRuntimeError(
      'VICT_AGENT_INVALID_ARTIFACT',
      `Memory policy '${id}' declares an invalid 'lastMessages' window; use an integer within [1, 1000] or exactly false.`,
      { memoryPolicyId: id },
    );
  }
  if (
    record.workingMemory === undefined ||
    typeof record.workingMemory !== 'object' ||
    record.workingMemory === null
  ) {
    throw new VictRuntimeError(
      'VICT_AGENT_INVALID_ARTIFACT',
      `Memory policy '${id}' must declare 'workingMemory' explicitly.`,
      { memoryPolicyId: id },
    );
  }
  const workingMemory = record.workingMemory as unknown as Record<string, unknown>;
  for (const key of Object.keys(workingMemory)) {
    if (!WORKING_MEMORY_FIELDS.has(key)) {
      throw new VictRuntimeError(
        'VICT_AGENT_UNKNOWN_ARTIFACT_FIELD',
        `Memory policy '${id}' declares unknown working-memory field '${key}'.`,
        { memoryPolicyId: id, field: key },
      );
    }
  }
  if (typeof workingMemory.enabled !== 'boolean') {
    throw new VictRuntimeError(
      'VICT_AGENT_INVALID_ARTIFACT',
      `Memory policy '${id}' must declare 'workingMemory.enabled' as a boolean.`,
      { memoryPolicyId: id },
    );
  }
  if (
    workingMemory.template !== undefined &&
    (typeof workingMemory.template !== 'string' || workingMemory.template.length > MAX_TEXT_LENGTH)
  ) {
    throw new VictRuntimeError(
      'VICT_AGENT_INVALID_ARTIFACT',
      `Memory policy '${id}' declares an invalid working-memory template (non-empty string of at most ${MAX_TEXT_LENGTH} characters when enabled).`,
      { memoryPolicyId: id },
    );
  }
  if (record.semanticRecall !== false) {
    throw new VictRuntimeError(
      'VICT_AGENT_INVALID_ARTIFACT',
      `Memory policy '${id}' must declare 'semanticRecall: false' explicitly in this adapter revision; enabling semantic recall requires an embedding model, which the pinned offline profile does not provide.`,
      { memoryPolicyId: id },
    );
  }
}

/** Options for constructing an AgentProfileRegistry. */
export interface AgentProfileRegistryOptions {
  /**
   * Resolves a capability reference to exact-revision existence for the
   * authority envelope (fail closed at activation when missing). The
   * composition wires this to the capability registry's revision history.
   */
  readonly resolveCapabilityRevision?: (id: string, revision: string) => boolean;
  /** Injected clock (epoch ms); defaults to `Date.now`. */
  readonly clock?: () => number;
}

/**
 * Owns registered agent artifacts and compiled agent profiles for one
 * runtime composition. Not a global registry: every composition carries
 * its own.
 */
export class AgentProfileRegistry {
  readonly #artifacts = new Map<string, AgentArtifact>();
  readonly #profiles = new Map<string, Map<string, AgentProfileAuthoring>>();
  readonly #compiled = new Map<string, Map<string, CompiledAgentProfile>>();
  readonly #options: AgentProfileRegistryOptions;

  constructor(options: AgentProfileRegistryOptions = {}) {
    this.#options = options;
  }

  // ---- Artifacts -----------------------------------------------------------

  /**
   * Validate one artifact and produce the normalized frozen internal
   * capture — WITHOUT touching the registry. Throws on any invalid input.
   */
  #stage(artifact: AgentArtifact): AgentArtifact {
    switch (artifact.kind) {
      case 'instructions': {
        requireId(artifact.id, 'Instructions artifact');
        requireRevision(artifact.revision, `Instructions '${artifact.id}'`);
        if (
          typeof artifact.text !== 'string' ||
          artifact.text.length === 0 ||
          artifact.text.length > MAX_TEXT_LENGTH
        ) {
          throw new VictRuntimeError(
            'VICT_AGENT_INVALID_ARTIFACT',
            `Instructions '${artifact.id}' require non-empty text of at most ${MAX_TEXT_LENGTH} characters.`,
            { artifactId: artifact.id },
          );
        }
        return Object.freeze({
          kind: 'instructions',
          id: artifact.id,
          revision: artifact.revision,
          text: artifact.text,
        });
      }
      case 'memory-policy': {
        requireId(artifact.id, 'Memory-policy artifact');
        requireRevision(artifact.revision, `Memory policy '${artifact.id}'`);
        validateMemoryPolicyConfig(artifact.config, artifact.id);
        return Object.freeze({
          kind: 'memory-policy',
          id: artifact.id,
          revision: artifact.revision,
          config: frozenCopy(artifact.config),
        });
      }
      case 'helper-tool': {
        requireId(artifact.id, 'Helper-tool artifact');
        requireRevision(artifact.revision, `Helper tool '${artifact.id}'`);
        validateHelperToolDefinition(artifact.id, artifact.revision, artifact.definition);
        return Object.freeze({
          kind: 'helper-tool',
          id: artifact.id,
          revision: artifact.revision,
          definition: frozenCopy(artifact.definition),
        });
      }
      case 'processor': {
        requireId(artifact.id, 'Processor artifact');
        requireRevision(artifact.revision, `Processor '${artifact.id}'`);
        if (typeof artifact.transform !== 'function') {
          throw new VictRuntimeError(
            'VICT_AGENT_INVALID_ARTIFACT',
            `Processor '${artifact.id}' must provide a pure transform function.`,
            { artifactId: artifact.id },
          );
        }
        return Object.freeze({
          kind: 'processor',
          id: artifact.id,
          revision: artifact.revision,
          transform: artifact.transform,
        });
      }
      case 'guardrail': {
        requireId(artifact.id, 'Guardrail artifact');
        requireRevision(artifact.revision, `Guardrail '${artifact.id}'`);
        if (typeof artifact.check !== 'function') {
          throw new VictRuntimeError(
            'VICT_AGENT_INVALID_ARTIFACT',
            `Guardrail '${artifact.id}' must provide a pure check function.`,
            { artifactId: artifact.id },
          );
        }
        if (artifact.failureCodes !== undefined) {
          if (
            !Array.isArray(artifact.failureCodes) ||
            artifact.failureCodes.length > MAX_GUARDRAIL_CODES
          ) {
            throw new VictRuntimeError(
              'VICT_AGENT_INVALID_ARTIFACT',
              `Guardrail '${artifact.id}' declares an invalid failureCodes set (at most ${MAX_GUARDRAIL_CODES} codes).`,
              { artifactId: artifact.id },
            );
          }
          const seen = new Set<string>();
          for (const code of artifact.failureCodes) {
            if (typeof code !== 'string' || !GUARDRAIL_CODE_PATTERN.test(code) || seen.has(code)) {
              throw new VictRuntimeError(
                'VICT_AGENT_INVALID_ARTIFACT',
                `Guardrail '${artifact.id}' declares an invalid or duplicate failure code; codes must match ^[A-Z][A-Z0-9_]{0,31}$ and must not repeat.`,
                { artifactId: artifact.id },
              );
            }
            seen.add(code);
          }
        }
        return Object.freeze({
          kind: 'guardrail',
          id: artifact.id,
          revision: artifact.revision,
          check: artifact.check,
          ...(artifact.failureCodes !== undefined
            ? { failureCodes: Object.freeze([...artifact.failureCodes]) }
            : {}),
        });
      }
      case 'structured-output-contract': {
        requireId(artifact.id, 'Structured-output contract artifact');
        requireRevision(artifact.revision, `Structured-output contract '${artifact.id}'`);
        if (
          typeof artifact.description !== 'string' ||
          artifact.description.length === 0 ||
          artifact.description.length > 512
        ) {
          throw new VictRuntimeError(
            'VICT_AGENT_INVALID_ARTIFACT',
            `Structured-output contract '${artifact.id}' requires a non-empty description of at most 512 characters.`,
            { artifactId: artifact.id },
          );
        }
        if (typeof artifact.parse !== 'function') {
          throw new VictRuntimeError(
            'VICT_AGENT_INVALID_ARTIFACT',
            `Structured-output contract '${artifact.id}' must provide a parse callable.`,
            { artifactId: artifact.id },
          );
        }
        return Object.freeze({
          kind: 'structured-output-contract',
          id: artifact.id,
          revision: artifact.revision,
          description: artifact.description,
          parse: artifact.parse,
        });
      }
      case 'workflow': {
        requireId(artifact.id, 'Workflow artifact');
        requireRevision(artifact.revision, `Workflow '${artifact.id}'`);
        if (typeof artifact.description !== 'string' || artifact.description.length === 0) {
          throw new VictRuntimeError(
            'VICT_AGENT_INVALID_ARTIFACT',
            `Workflow '${artifact.id}' requires a non-empty description.`,
            { artifactId: artifact.id },
          );
        }
        return Object.freeze({
          kind: 'workflow',
          id: artifact.id,
          revision: artifact.revision,
          description: artifact.description,
        });
      }
      default: {
        throw new VictRuntimeError(
          'VICT_AGENT_INVALID_ARTIFACT',
          'An artifact requires a supported kind.',
        );
      }
    }
  }

  /** Register one artifact atomically; duplicates of the same (id, revision) fail. */
  registerArtifact(artifact: AgentArtifact): void {
    const staged = this.#stage(artifact);
    if (this.#artifacts.has(artifactKey(staged))) {
      throw new VictRuntimeError(
        'VICT_AGENT_DUPLICATE_ARTIFACT',
        `A ${staged.kind} artifact '${staged.id}' (revision '${staged.revision}') is already registered; use an intentional replacement API instead of re-registering.`,
        { artifactId: staged.id, revision: staged.revision },
      );
    }
    this.#artifacts.set(artifactKey(staged), staged);
  }

  /**
   * Register many artifacts atomically: ALL or NOTHING.
   *
   * Preflight (before anything becomes observable):
   * 1. every artifact is validated and staged;
   * 2. every staged key is checked against the EXISTING registry content;
   * 3. every staged key is checked against the OTHER staged entries
   *    (intra-batch duplicates).
   *
   * If any artifact is invalid or conflicting, nothing from the batch is
   * committed — the registry is byte-for-byte unchanged, and a corrected
   * batch can be retried.
   */
  installArtifacts(artifacts: readonly AgentArtifact[]): void {
    const staged: AgentArtifact[] = [];
    for (const artifact of artifacts) {
      staged.push(this.#stage(artifact));
    }
    const seen = new Set<string>();
    for (const artifact of staged) {
      const key = artifactKey(artifact);
      if (this.#artifacts.has(key)) {
        throw new VictRuntimeError(
          'VICT_AGENT_DUPLICATE_ARTIFACT',
          `A ${artifact.kind} artifact '${artifact.id}' (revision '${artifact.revision}') is already registered; the batch was rejected atomically and nothing from it was installed.`,
          { artifactId: artifact.id, revision: artifact.revision },
        );
      }
      if (seen.has(key)) {
        throw new VictRuntimeError(
          'VICT_AGENT_DUPLICATE_ARTIFACT',
          `The batch declares ${artifact.kind} '${artifact.id}' (revision '${artifact.revision}') more than once; the batch was rejected atomically and nothing from it was installed.`,
          { artifactId: artifact.id, revision: artifact.revision },
        );
      }
      seen.add(key);
    }
    for (const artifact of staged) {
      this.#artifacts.set(artifactKey(artifact), artifact);
    }
  }

  /**
   * Resolve one artifact by kind + exact revision. The result is a FRESH
   * defensive descriptor: data members are deep-copied and frozen, function
   * references are preserved by reference, and the registry's internal
   * objects are never exposed. Mutating a resolved value cannot alter a
   * later resolution or an activation.
   */
  resolveArtifact<T extends AgentArtifact>(
    kind: T['kind'],
    id: string,
    revision: string,
  ): T | undefined {
    const internal = this.#artifacts.get(`${kind}\u0000${id}\u0000${revision}`);
    return internal === undefined ? undefined : (defensiveArtifactDescriptor(internal) as T);
  }

  // ---- Profiles -------------------------------------------------------------

  /**
   * Register a compiled agent profile atomically. Duplicate registration
   * of the same (id, revision) fails; a NEW revision for the same id adds
   * a resolvable revision for exact pinned restoration.
   */
  registerProfile(profile: AgentProfileAuthoring): { readonly agentProfileVersion: string } {
    const compiled = compileAgentProfile(profile);
    if (!compiled.ok) {
      throw new VictRuntimeError(
        'VICT_AGENT_INVALID_PROFILE',
        `Agent profile '${String((profile as { id?: unknown }).id)}' failed compilation with ${compiled.issues.length} issue(s); the first issue is ${compiled.issues[0]?.code} at '${compiled.issues[0]?.path ?? '(profile)'}'.`,
      );
    }
    return this.#commitProfile(compiled.value);
  }

  /**
   * Intentional replacement: registers a new profile revision and REPLACES
   * the current pointer only when the caller pins the expected previous
   * revision. Affects only later activations — never an active snapshot.
   */
  replaceProfile(options: {
    readonly profile: AgentProfileAuthoring;
    readonly expectedPreviousRevision: string;
  }): { readonly agentProfileVersion: string } {
    const { profile } = options;
    const compiled = compileAgentProfile(profile);
    if (!compiled.ok) {
      throw new VictRuntimeError(
        'VICT_AGENT_INVALID_PROFILE',
        `Agent profile replacement failed compilation with ${compiled.issues.length} issue(s).`,
      );
    }
    const id = compiled.value.profile.id;
    const previous = this.#currentRevision(id);
    if (previous !== options.expectedPreviousRevision) {
      throw new VictRuntimeError(
        'VICT_AGENT_REPLACE_CONFLICT',
        `Agent profile '${id}' current revision is '${String(previous)}', not the expected '${options.expectedPreviousRevision}'; refusing the replace.`,
        { agentId: id },
      );
    }
    return this.#commitProfile(compiled.value);
  }

  #currentRevision(id: string): string | undefined {
    const revisions = this.#profiles.get(id);
    if (revisions === undefined || revisions.size === 0) {
      return undefined;
    }
    // Registration order is preserved by Map; the last registered revision
    // is the current one.
    return [...revisions.keys()].at(-1);
  }

  #commitProfile(compiled: CompiledAgentProfile): { readonly agentProfileVersion: string } {
    const id = compiled.profile.id;
    const revision = compiled.profile.revision;
    let revisions = this.#profiles.get(id);
    if (revisions !== undefined && revisions.has(revision)) {
      throw new VictRuntimeError(
        'VICT_AGENT_DUPLICATE_PROFILE',
        `Agent profile '${id}' (revision '${revision}') is already registered; use replaceProfile for an intentional replacement.`,
        { agentId: id, revision },
      );
    }
    if (revisions === undefined) {
      revisions = new Map();
      this.#profiles.set(id, revisions);
      this.#compiled.set(id, new Map());
    }
    revisions.set(revision, compiled.profile);
    this.#compiled.get(id)!.set(revision, compiled);
    return { agentProfileVersion: compiled.agentProfileVersion };
  }

  /** Resolve a compiled profile by id + exact revision (default: current). */
  resolveProfile(id: string, revision?: string): CompiledAgentProfile | undefined {
    const revisions = this.#compiled.get(id);
    if (revisions === undefined) {
      return undefined;
    }
    const target = revision ?? this.#currentRevision(id);
    if (target === undefined) {
      return undefined;
    }
    return revisions.get(target);
  }

  // ---- Activation -------------------------------------------------------------

  /**
   * Activate an agent profile: resolve EVERY revisioned component to its
   * exact revision — including a declared structured-output contract —
   * verify the capability envelope (fail closed when a resolver is missing),
   * and capture an immutable snapshot. Missing or mismatched artifacts fail
   * closed; identity-only references are never treated as executable
   * bindings.
   */
  activateAgentProfile(options: {
    readonly id: string;
    readonly revision?: string;
  }): AgentProfileActivation {
    const compiled = this.resolveProfile(options.id, options.revision);
    if (compiled === undefined) {
      throw new VictRuntimeError(
        'VICT_AGENT_PROFILE_NOT_FOUND',
        `Agent profile '${options.id}' (revision '${String(options.revision ?? 'current')}') is not registered; activation fails closed.`,
        { agentId: options.id, revision: options.revision },
      );
    }
    const profile = compiled.profile;
    const clock = this.#options.clock ?? (() => Date.now());

    const instructions = this.#resolveExact<AgentInstructionsArtifact>(
      'instructions',
      profile.instructions,
    );
    const memoryPolicy = this.#resolveExact<AgentMemoryPolicyArtifact>(
      'memory-policy',
      profile.memoryPolicy,
    );
    const helperTools = (profile.helperTools ?? []).map((reference) =>
      this.#resolveExact<AgentHelperToolArtifact>('helper-tool', reference),
    );
    const processors = (profile.processors ?? []).map((reference) =>
      this.#resolveExact<AgentProcessorArtifact>('processor', reference),
    );
    const guardrails = (profile.guardrails ?? []).map((reference) =>
      this.#resolveExact<AgentGuardrailArtifact>('guardrail', reference),
    );
    const workflows = (profile.workflows ?? []).map((reference) =>
      this.#resolveExact<AgentWorkflowArtifact>('workflow', reference),
    );

    // A declared structured-output contract is an executable binding: it
    // must resolve at its exact id + revision, and its actual parser
    // semantics are captured by reference. A nonexistent or mismatched
    // contract fails activation — the identity reference alone is never
    // treated as a binding.
    const structuredOutput = profile.structuredOutput
      ? this.#resolveExact<AgentStructuredOutputContractArtifact>(
          'structured-output-contract',
          profile.structuredOutput.contract,
        )
      : undefined;

    // Sub-agents resolve to other registered agent profiles (exact revision).
    // The RESOLVED child profile identity (its computed agentProfileVersion)
    // becomes part of the authoritative activation binding below: a stored
    // activation pins not only which child revision it referenced but what
    // that child resolved to. A differently-resolved child profile can never
    // silently restore under the same activation identity.
    const subagents = (profile.subagents ?? []).map((reference) => {
      const sub = this.resolveProfile(reference.id, reference.revision);
      if (sub === undefined) {
        throw new VictRuntimeError(
          'VICT_AGENT_ARTIFACT_MISSING',
          `Sub-agent '${reference.id}' (revision '${reference.revision}') is not registered; activation fails closed.`,
          { agentId: reference.id, revision: reference.revision },
        );
      }
      return { reference, agentProfileVersion: sub.agentProfileVersion };
    });

    // Capability envelope: exact-revision existence, fail closed. A profile
    // that DECLARES capability references but is activated WITHOUT an
    // exact-revision resolver cannot prove its authority envelope and
    // fails closed — the envelope is never silently accepted.
    const declaredCapabilities = profile.capabilities ?? [];
    if (declaredCapabilities.length > 0 && this.#options.resolveCapabilityRevision === undefined) {
      throw new VictRuntimeError(
        'VICT_AGENT_CAPABILITY_RESOLVER_MISSING',
        `The profile declares ${declaredCapabilities.length} capability reference(s) but no exact-revision capability resolver is configured; the authority envelope cannot be proven and activation fails closed.`,
        { agentId: profile.id },
      );
    }
    for (const reference of declaredCapabilities) {
      const resolver = this.#options.resolveCapabilityRevision;
      if (resolver !== undefined && !resolver(reference.id, reference.revision)) {
        throw new VictRuntimeError(
          'VICT_AGENT_CAPABILITY_MISSING',
          `Capability '${reference.id}' (revision '${reference.revision}') is not registered; the pinned authority envelope cannot be resolved.`,
          { capabilityId: reference.id, revision: reference.revision },
        );
      }
    }

    helperTools.sort((a, b) =>
      a.reference.id < b.reference.id ? -1 : a.reference.id > b.reference.id ? 1 : 0,
    );
    workflows.sort((a, b) =>
      a.reference.id < b.reference.id ? -1 : a.reference.id > b.reference.id ? 1 : 0,
    );

    // Adapter compatibility: the exact marker the activation was resolved
    // under (defensive canonical copy of the compiled profile's marker).
    const adapterCompatibility = frozenCopy({
      id: profile.adapter.id,
      revision: profile.adapter.revision,
      runtimePackages: { ...profile.adapter.runtimePackages },
    }) as AgentProfileActivation['adapterCompatibility'];

    // Canonical ACTIVATION manifest (distinct from the profile manifest):
    // covers the exact resolved executable activation — the profile
    // identity, the adapter compatibility metadata, every resolved
    // artifact binding (including the structured-output contract,
    // sub-agents, and the capability envelope), AND the resolved identity
    // of every referenced sub-agent profile. Canonically sorted;
    // insertion order never matters.
    const subagentIdentities = subagents
      .map((binding) => ({
        id: binding.reference.id,
        revision: binding.reference.revision,
        agentProfileVersion: binding.agentProfileVersion,
      }))
      .sort((a, b) =>
        a.id < b.id
          ? -1
          : a.id > b.id
            ? 1
            : a.revision < b.revision
              ? -1
              : a.revision > b.revision
                ? 1
                : 0,
      );
    const artifactList = [
      {
        kind: 'instructions' as const,
        id: instructions.reference.id,
        revision: instructions.reference.revision,
      },
      {
        kind: 'memory-policy' as const,
        id: memoryPolicy.reference.id,
        revision: memoryPolicy.reference.revision,
      },
      ...(structuredOutput !== undefined
        ? [
            {
              kind: 'structured-output-contract' as const,
              id: structuredOutput.reference.id,
              revision: structuredOutput.reference.revision,
            },
          ]
        : []),
      ...helperTools.map((binding) => ({
        kind: 'helper-tool' as const,
        id: binding.reference.id,
        revision: binding.reference.revision,
      })),
      ...processors.map((binding) => ({
        kind: 'processor' as const,
        id: binding.reference.id,
        revision: binding.reference.revision,
      })),
      ...guardrails.map((binding) => ({
        kind: 'guardrail' as const,
        id: binding.reference.id,
        revision: binding.reference.revision,
      })),
      ...workflows.map((binding) => ({
        kind: 'workflow' as const,
        id: binding.reference.id,
        revision: binding.reference.revision,
      })),
      ...subagents.map((binding) => ({
        kind: 'subagent' as const,
        id: binding.reference.id,
        revision: binding.reference.revision,
      })),
      ...declaredCapabilities.map((reference) => ({
        kind: 'capability' as const,
        id: reference.id,
        revision: reference.revision,
      })),
    ].sort(compareArtifactEntries);

    const manifest = {
      schema: AGENT_ACTIVATION_IDENTITY_SCHEMA,
      agentProfileVersion: compiled.agentProfileVersion,
      adapter: adapterCompatibility,
      artifacts: artifactList,
      subagents: subagentIdentities,
    };
    const manifestJson = canonicalJson(manifest);
    const activationVersion = `v1_${sha256Hex(manifestJson)}`;

    const activation: AgentProfileActivation = frozenCopy({
      activationVersion,
      agentProfileVersion: compiled.agentProfileVersion,
      profile: compiled,
      instructions: { reference: profile.instructions, artifact: instructions.artifact },
      memoryPolicy: { reference: profile.memoryPolicy, artifact: memoryPolicy.artifact },
      helperTools,
      processors,
      guardrails,
      ...(structuredOutput !== undefined ? { structuredOutput } : {}),
      workflows,
      subagents,
      capabilities: frozenCopy(
        declaredCapabilities.map((reference) => ({
          id: reference.id,
          revision: reference.revision,
        })),
      ),
      adapterCompatibility,
      canonicalManifestJson: manifestJson,
      artifactList,
      createdAt: clock(),
    }) as unknown as AgentProfileActivation;

    // Frozen copy preserves function references (frozenCopy passes
    // functions through) — execute/transform/check/parse stay bound while
    // all data becomes immutable.
    return activation;
  }

  #resolveExact<T extends AgentArtifact>(
    kind: T['kind'],
    reference: AgentReference,
  ): AgentArtifactBinding<T> {
    const artifact = this.resolveArtifact<T>(kind, reference.id, reference.revision);
    if (artifact === undefined) {
      const currentExists = this.#hasAnyRevision(kind, reference.id);
      throw new VictRuntimeError(
        currentExists ? 'VICT_AGENT_ARTIFACT_REVISION_MISMATCH' : 'VICT_AGENT_ARTIFACT_MISSING',
        currentExists
          ? `A ${kind} artifact '${reference.id}' is registered but revision '${reference.revision}' is not; a current definition never substitutes for a pinned older revision.`
          : `A ${kind} artifact '${reference.id}' (revision '${reference.revision}') is not registered; activation fails closed.`,
        { artifactId: reference.id, revision: reference.revision },
      );
    }
    return { reference: { id: reference.id, revision: reference.revision }, artifact };
  }

  #hasAnyRevision(kind: AgentArtifactKind, id: string): boolean {
    for (const key of this.#artifacts.keys()) {
      const [existingKind, existingId] = key.split('\u0000');
      if (existingKind === kind && existingId === id) {
        return true;
      }
    }
    return false;
  }

  // ---- Restart restoration (Stage 02 model) ---------------------------------

  /**
   * Restore an activation from its persisted identity record: the record is
   * identity, NOT executable code, and it is NEVER trusted on identity
   * strings alone. Restoration:
   *
   * 1. structurally validates the record (closed field sets, canonical
   *    version forms, well-formed artifact entries — extra or
   *    secret-bearing injected fields fail);
   * 2. re-activates from the exact pinned revision (re-resolving EVERY
   *    artifact — a newer live definition never substitutes);
   * 3. recomputes the canonical activation manifest (including the resolved
   *    sub-agent identities) and compares the stored manifest BYTES exactly
   *    (tampered manifests, and activations whose resolved sub-agent
   *    profiles differ from the pinned ones, fail);
   * 4. compares both derived identities (profile + activation versions);
   * 5. compares the stored artifact list against the reconstructed
   *    activation for exact kind/id/revision equality in canonical order
   *    (missing, additional, reordered, or inconsistent entries fail);
   * 6. preserves the stored activation `createdAt`: the restored snapshot
   *    carries the PERSISTED creation time, never the current clock of the
   *    restoring process.
   */
  restoreActivation(record: AgentActivationRecord): AgentActivationRestoreResult {
    const structural = validateAgentActivationRecord(record);
    if (!structural.ok) {
      return {
        ok: false,
        code: 'AGENT_ACTIVATION_CORRUPT_RECORD',
        message: `The persisted agent-activation record is malformed: ${structural.reason}`,
      };
    }
    const compiled = this.#compiled.get(record.agentId)?.get(record.agentRevision);
    if (compiled === undefined) {
      return {
        ok: false,
        code: 'AGENT_ACTIVATION_PROFILE_MISMATCH',
        message: `The persisted activation pins agent profile '${record.agentId}' (revision '${record.agentRevision}'), which is not registered in this process; refusing to substitute.`,
      };
    }
    if (compiled.agentProfileVersion !== record.agentProfileVersion) {
      return {
        ok: false,
        code: 'AGENT_ACTIVATION_PROFILE_MISMATCH',
        message:
          'The persisted activation pins a different agentProfileVersion than the registered profile; refusing to substitute.',
      };
    }
    // Re-activate from the exact pinned revision, then verify identity.
    let activation: AgentProfileActivation;
    try {
      activation = this.activateAgentProfile({
        id: record.agentId,
        revision: record.agentRevision,
      });
    } catch (error) {
      const code = error instanceof VictRuntimeError ? error.code : undefined;
      return {
        ok: false,
        code:
          code === 'VICT_AGENT_ARTIFACT_REVISION_MISMATCH'
            ? 'AGENT_ACTIVATION_ARTIFACT_REVISION_MISMATCH'
            : 'AGENT_ACTIVATION_ARTIFACT_MISSING',
        message:
          code === 'VICT_AGENT_ARTIFACT_REVISION_MISMATCH'
            ? 'The persisted activation pins an artifact revision that is not registered in this process; refusing to substitute.'
            : 'The persisted activation could not restore its exact pinned artifacts in this process.',
      };
    }
    if (activation.activationVersion !== record.activationVersion) {
      return {
        ok: false,
        code: 'AGENT_ACTIVATION_ARTIFACT_REVISION_MISMATCH',
        message:
          'The restored activation identity does not match the persisted record; refusing to substitute.',
      };
    }
    // Tampered canonical bytes: the stored manifest must equal the
    // recomputed manifest BYTE FOR BYTE.
    if (activation.canonicalManifestJson !== record.canonicalManifest) {
      return {
        ok: false,
        code: 'AGENT_ACTIVATION_CORRUPT_RECORD',
        message:
          'The stored canonical activation manifest does not match the reconstructed activation; refusing the record.',
      };
    }
    // Exact artifact-list correspondence: kind/id/revision equality in the
    // canonical order. Missing, additional, reordered-when-semantic, or
    // otherwise inconsistent stored lists are rejected.
    const stored = record.artifacts;
    const reconstructed = activation.artifactList;
    if (stored.length !== reconstructed.length) {
      return {
        ok: false,
        code: 'AGENT_ACTIVATION_CORRUPT_RECORD',
        message:
          'The stored artifact list does not cover exactly the reconstructed activation artifacts; refusing the record.',
      };
    }
    for (let index = 0; index < reconstructed.length; index += 1) {
      const expected = reconstructed[index] as { kind: string; id: string; revision: string };
      const found = stored[index] as { kind: string; id: string; revision: string };
      if (
        found.kind !== expected.kind ||
        found.id !== expected.id ||
        found.revision !== expected.revision
      ) {
        return {
          ok: false,
          code: 'AGENT_ACTIVATION_ARTIFACT_REVISION_MISMATCH',
          message:
            'The stored artifact list is inconsistent with the reconstructed activation (kind, id, revision, or order differs); refusing the record.',
        };
      }
    }
    // The restored snapshot carries the PERSISTED creation time: a
    // restoration through a changed clock never rewrites when the
    // activation was originally created.
    const restored: AgentProfileActivation =
      activation.createdAt === record.createdAt
        ? activation
        : (Object.freeze({ ...activation, createdAt: record.createdAt }) as AgentProfileActivation);
    return { ok: true, activation: restored };
  }
}

function sha256Hex(payload: string): string {
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

/** The registry-internal dedup key of one artifact (kind + id + revision). */
function artifactKey(artifact: AgentArtifact): string {
  return `${artifact.kind}\u0000${artifact.id}\u0000${artifact.revision}`;
}

/** Canonical order of activation-manifest artifact entries. */
function compareArtifactEntries(
  a: { readonly kind: string; readonly id: string; readonly revision: string },
  b: { readonly kind: string; readonly id: string; readonly revision: string },
): number {
  if (a.kind !== b.kind) {
    return a.kind < b.kind ? -1 : 1;
  }
  if (a.id !== b.id) {
    return a.id < b.id ? -1 : 1;
  }
  if (a.revision === b.revision) {
    return 0;
  }
  return a.revision < b.revision ? -1 : 1;
}
