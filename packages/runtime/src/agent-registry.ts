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
  AgentWorkflowArtifact,
} from './agent-types.js';
import { AGENT_ACTIVATION_IDENTITY_SCHEMA } from './agent-types.js';
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
function validateHelperToolDefinition(definition: AgentHelperToolArtifact['definition']): void {
  requireId(definition.id, `Helper tool`);
  requireRevision(definition.revision, `Helper tool '${String(definition.id)}'`);
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

  /** Register one artifact atomically; duplicates of the same (id, revision) fail. */
  registerArtifact(artifact: AgentArtifact): void {
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
        this.#commit({
          kind: 'instructions',
          id: artifact.id,
          revision: artifact.revision,
          text: artifact.text,
        });
        return;
      }
      case 'memory-policy': {
        requireId(artifact.id, 'Memory-policy artifact');
        requireRevision(artifact.revision, `Memory policy '${artifact.id}'`);
        validateMemoryPolicyConfig(artifact.config, artifact.id);
        this.#commit({
          kind: 'memory-policy',
          id: artifact.id,
          revision: artifact.revision,
          config: frozenCopy(artifact.config),
        });
        return;
      }
      case 'helper-tool': {
        validateHelperToolDefinition(artifact.definition);
        this.#commit({
          kind: 'helper-tool',
          id: artifact.id,
          revision: artifact.revision,
          definition: frozenCopy(artifact.definition),
        });
        return;
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
        this.#commit({
          kind: 'processor',
          id: artifact.id,
          revision: artifact.revision,
          transform: artifact.transform,
        });
        return;
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
        this.#commit({
          kind: 'guardrail',
          id: artifact.id,
          revision: artifact.revision,
          check: artifact.check,
        });
        return;
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
        this.#commit({
          kind: 'workflow',
          id: artifact.id,
          revision: artifact.revision,
          description: artifact.description,
        });
        return;
      }
      default: {
        throw new VictRuntimeError(
          'VICT_AGENT_INVALID_ARTIFACT',
          'An artifact requires a supported kind.',
        );
      }
    }
  }

  /** Register many artifacts atomically: all-or-nothing. */
  installArtifacts(artifacts: readonly AgentArtifact[]): void {
    const staged: AgentArtifact[] = [];
    for (const artifact of artifacts) {
      // Re-validate into the staging list WITHOUT touching live maps. A
      // throw anywhere below leaves the registry byte-for-byte unchanged.
      switch (artifact.kind) {
        case 'instructions':
          requireId(artifact.id, 'Instructions artifact');
          requireRevision(artifact.revision, `Instructions '${artifact.id}'`);
          if (
            typeof artifact.text !== 'string' ||
            artifact.text.length === 0 ||
            artifact.text.length > MAX_TEXT_LENGTH
          ) {
            throw new VictRuntimeError(
              'VICT_AGENT_INVALID_ARTIFACT',
              `Instructions '${artifact.id}' require non-empty text.`,
              { artifactId: artifact.id },
            );
          }
          staged.push({
            kind: 'instructions',
            id: artifact.id,
            revision: artifact.revision,
            text: artifact.text,
          });
          break;
        case 'memory-policy':
          requireId(artifact.id, 'Memory-policy artifact');
          requireRevision(artifact.revision, `Memory policy '${artifact.id}'`);
          validateMemoryPolicyConfig(artifact.config, artifact.id);
          staged.push({
            kind: 'memory-policy',
            id: artifact.id,
            revision: artifact.revision,
            config: frozenCopy(artifact.config),
          });
          break;
        case 'helper-tool':
          validateHelperToolDefinition(artifact.definition);
          staged.push({
            kind: 'helper-tool',
            id: artifact.id,
            revision: artifact.revision,
            definition: frozenCopy(artifact.definition),
          });
          break;
        case 'processor':
          requireId(artifact.id, 'Processor artifact');
          requireRevision(artifact.revision, `Processor '${artifact.id}'`);
          if (typeof artifact.transform !== 'function') {
            throw new VictRuntimeError(
              'VICT_AGENT_INVALID_ARTIFACT',
              `Processor '${artifact.id}' must provide a transform.`,
            );
          }
          staged.push({
            kind: 'processor',
            id: artifact.id,
            revision: artifact.revision,
            transform: artifact.transform,
          });
          break;
        case 'guardrail':
          requireId(artifact.id, 'Guardrail artifact');
          requireRevision(artifact.revision, `Guardrail '${artifact.id}'`);
          if (typeof artifact.check !== 'function') {
            throw new VictRuntimeError(
              'VICT_AGENT_INVALID_ARTIFACT',
              `Guardrail '${artifact.id}' must provide a check.`,
            );
          }
          staged.push({
            kind: 'guardrail',
            id: artifact.id,
            revision: artifact.revision,
            check: artifact.check,
          });
          break;
        case 'workflow':
          requireId(artifact.id, 'Workflow artifact');
          requireRevision(artifact.revision, `Workflow '${artifact.id}'`);
          staged.push({
            kind: 'workflow',
            id: artifact.id,
            revision: artifact.revision,
            description: artifact.description,
          });
          break;
        default:
          throw new VictRuntimeError(
            'VICT_AGENT_INVALID_ARTIFACT',
            'An artifact requires a supported kind.',
          );
      }
    }
    for (const artifact of staged) {
      this.#commit(artifact);
    }
  }

  /** Commit one validated artifact (fails on duplicate id+revision). */
  #commit(artifact: AgentArtifact): void {
    const key = `${artifact.kind}\u0000${artifact.id}\u0000${artifact.revision}`;
    if (this.#artifacts.has(key)) {
      throw new VictRuntimeError(
        'VICT_AGENT_DUPLICATE_ARTIFACT',
        `A ${artifact.kind} artifact '${artifact.id}' (revision '${artifact.revision}') is already registered; use an intentional replacement API instead of re-registering.`,
        { artifactId: artifact.id, revision: artifact.revision },
      );
    }
    this.#artifacts.set(key, artifact);
  }

  /** Resolve one artifact by kind + exact revision (missing → undefined). */
  resolveArtifact<T extends AgentArtifact>(
    kind: T['kind'],
    id: string,
    revision: string,
  ): T | undefined {
    return this.#artifacts.get(`${kind}\u0000${id}\u0000${revision}`) as T | undefined;
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
   * exact revision, verify the capability envelope, and capture an
   * immutable snapshot. Missing or mismatched artifacts fail closed.
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

    // Sub-agents resolve to other registered agent profiles (exact revision).
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

    // Capability envelope: exact-revision existence (fail closed).
    for (const reference of profile.capabilities ?? []) {
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

    const manifest = {
      schema: AGENT_ACTIVATION_IDENTITY_SCHEMA,
      agentProfileVersion: compiled.agentProfileVersion,
      artifacts: [
        {
          kind: 'instructions',
          id: instructions.reference.id,
          revision: instructions.reference.revision,
        },
        {
          kind: 'memory-policy',
          id: memoryPolicy.reference.id,
          revision: memoryPolicy.reference.revision,
        },
        ...helperTools.map((binding) => ({
          kind: 'helper-tool',
          id: binding.reference.id,
          revision: binding.reference.revision,
        })),
        ...processors.map((binding) => ({
          kind: 'processor',
          id: binding.reference.id,
          revision: binding.reference.revision,
        })),
        ...guardrails.map((binding) => ({
          kind: 'guardrail',
          id: binding.reference.id,
          revision: binding.reference.revision,
        })),
        ...workflows.map((binding) => ({
          kind: 'workflow',
          id: binding.reference.id,
          revision: binding.reference.revision,
        })),
        ...subagents.map((binding) => ({
          kind: 'subagent',
          id: binding.reference.id,
          revision: binding.reference.revision,
        })),
        ...(profile.capabilities ?? []).map((reference) => ({
          kind: 'capability',
          id: reference.id,
          revision: reference.revision,
        })),
      ].sort((a, b) =>
        a.kind === b.kind
          ? a.id === b.id
            ? a.revision < b.revision
              ? -1
              : a.revision > b.revision
                ? 1
                : 0
            : a.id < b.id
              ? -1
              : 1
          : a.kind < b.kind
            ? -1
            : 1,
      ),
    };
    const activationVersion = `v1_${sha256Hex(canonicalJson(manifest))}`;

    const activation: AgentProfileActivation = frozenCopy({
      activationVersion,
      agentProfileVersion: compiled.agentProfileVersion,
      profile: compiled,
      instructions: { reference: profile.instructions, artifact: instructions.artifact },
      memoryPolicy: { reference: profile.memoryPolicy, artifact: memoryPolicy.artifact },
      helperTools,
      processors,
      guardrails,
      workflows,
      subagents,
      capabilities: frozenCopy(
        (profile.capabilities ?? []).map((reference) => ({
          id: reference.id,
          revision: reference.revision,
        })),
      ),
      createdAt: clock(),
    }) as unknown as AgentProfileActivation;

    // Frozen copy preserves function references (frozenCopy passes
    // functions through) — execute/transform/check stay bound while all
    // data becomes immutable.
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
   * identity, NOT executable code. Every artifact must re-resolve to the
   * EXACT revision in this process; any missing or mismatched executable
   * artifact fails closed (block — never substitute).
   */
  restoreActivation(record: AgentActivationRecord): AgentActivationRestoreResult {
    if (
      typeof record !== 'object' ||
      record === null ||
      record.recordSchema !== 'vict.agent-activation-record@1' ||
      typeof record.activationVersion !== 'string' ||
      typeof record.agentProfileVersion !== 'string' ||
      typeof record.canonicalManifest !== 'string'
    ) {
      return {
        ok: false,
        code: 'AGENT_ACTIVATION_CORRUPT_RECORD',
        message: 'The persisted agent-activation record is missing required identity members.',
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
    return { ok: true, activation };
  }
}

function sha256Hex(payload: string): string {
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}
