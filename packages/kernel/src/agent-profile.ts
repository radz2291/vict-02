import { canonicalJson } from './canonical.js';
import { createHash } from 'node:crypto';
import type { AgentProfileAuthoring, AgentReference } from '@vict/sdk';

/**
 * Stage 06A — strict agent-profile compilation and deterministic identity.
 *
 * The profile is the VICT-authored, revision-addressable definition of a
 * product agent (agent-framework amendment §6). This module is the SINGLE
 * authority for:
 *
 * - the strict canonical-input boundary (plain, own-enumerable, dense
 *   canonical data; accessors rejected by descriptor inspection without
 *   invocation; hostile/revoked proxies fail closed with structured,
 *   non-echoing diagnostics);
 * - the CLOSED profile schema (unknown fields are rejected at every level;
 *   required members are never silently defaulted);
 * - the complete deterministic `agentProfileVersion` covering every
 *   runtime-affecting component (amendment §6.1): schema marker, agent
 *   id/revision, instructions id/revision, model profile incl. provider
 *   intent, generation defaults, turn policy, memory policy, ORDERED
 *   processor and guardrail chains, structured-output contract when
 *   enabled, canonically SORTED helper-tool/capability/subagent/workflow
 *   reference sets, and the adapter compatibility marker including every
 *   runtime-affecting pinned runtime package version.
 *
 * Identity is a versioned SHA-256 over the canonical manifest. Forbidden
 * inputs are structurally unreachable: function bodies, credentials,
 * timestamps, random values, framework/schema-library internals, mutable
 * memory contents, and raw conversation payloads are not part of the
 * profile domain (amendment §6.3). No invalid profile ever produces a
 * partial compiled profile or version.
 */

/** Versioned identity marker of the canonical agent-profile manifest. */
export const AGENT_PROFILE_IDENTITY_SCHEMA = 'vict.agent-profile-identity@1';

/** Stable issue codes for agent-profile compilation. */
export type AgentProfileIssueCode =
  | 'AGENT_PROFILE_NON_CANONICAL_VALUE'
  | 'AGENT_PROFILE_UNKNOWN_FIELD'
  | 'AGENT_PROFILE_REQUIRED_MEMBER'
  | 'AGENT_PROFILE_EMPTY_ID'
  | 'AGENT_PROFILE_EMPTY_REVISION'
  | 'AGENT_PROFILE_INVALID_IDENTITY_MEMBER'
  | 'AGENT_PROFILE_INVALID_ENUM'
  | 'AGENT_PROFILE_INVALID_BOUND'
  | 'AGENT_PROFILE_DUPLICATE_REFERENCE'
  | 'AGENT_PROFILE_UNKNOWN_SCHEMA'
  | 'AGENT_PROFILE_SELF_REFERENCE'
  | 'AGENT_PROFILE_HOSTILE_INPUT';

/** A structured, deterministic, non-echoing profile diagnostic. */
export interface AgentProfileIssue {
  readonly code: AgentProfileIssueCode;
  /** Dot/bracket path of the offending member (key names, never values). */
  readonly path?: string;
  /** Stable description; invalid input VALUES are never echoed. */
  readonly message: string;
}

/** The result of compiling an agent profile. */
export type AgentProfileCompileResult =
  | { readonly ok: true; readonly value: CompiledAgentProfile }
  | { readonly ok: false; readonly issues: readonly AgentProfileIssue[] };

/** Deep-frozen canonical profile data (VICT-owned capture). */
export type FrozenAgentProfile = Readonly<AgentProfileAuthoring>;

/** A compiled, immutable agent profile with its deterministic identity. */
export interface CompiledAgentProfile {
  /** The compiled profile data — a deep-frozen VICT-owned capture. */
  readonly profile: FrozenAgentProfile;
  /** The canonical identity manifest — deep-frozen canonical data. */
  readonly manifest: Readonly<Record<string, unknown>>;
  /** Deterministic identity: `v1_<64 hex>` over the canonical manifest. */
  readonly agentProfileVersion: string;
  /** The canonical JSON serialization of the manifest (deterministic bytes). */
  readonly manifestJson: string;
}

/** Codes of every known top-level profile member (closed schema). */
const PROFILE_FIELDS: ReadonlySet<string> = new Set([
  'schema',
  'id',
  'revision',
  'instructions',
  'modelProfile',
  'generation',
  'turnPolicy',
  'memoryPolicy',
  'processors',
  'guardrails',
  'structuredOutput',
  'helperTools',
  'capabilities',
  'subagents',
  'workflows',
  'adapter',
]);

const MODEL_PROFILE_FIELDS: ReadonlySet<string> = new Set([
  'id',
  'revision',
  'routerModel',
  'provider',
  'providerCredentialVar',
]);

const GENERATION_FIELDS: ReadonlySet<string> = new Set([
  'temperature',
  'topP',
  'maxOutputTokens',
  'maxRetries',
]);

const TURN_POLICY_FIELDS: ReadonlySet<string> = new Set(['maxSteps', 'maxToolCalls', 'onLimit']);

const STRUCTURED_OUTPUT_FIELDS: ReadonlySet<string> = new Set(['contract']);

const ADAPTER_FIELDS: ReadonlySet<string> = new Set(['id', 'revision', 'runtimePackages']);

/** Bounded generation ranges (closed; outside values are schema violations). */
const GENERATION_BOUNDS = {
  temperature: { min: 0, max: 2, integral: false },
  topP: { min: 0, max: 1, integral: false, exclusiveMin: true },
  maxOutputTokens: { min: 1, max: 200000, integral: true },
  maxRetries: { min: 0, max: 8, integral: true },
} as const;

/** Bounded turn-policy ranges. */
const TURN_BOUNDS = {
  maxSteps: { min: 1, max: 64 },
  maxToolCalls: { min: 0, max: 64 },
} as const;

const MAX_ID_LENGTH = 128;
const MAX_ROUTER_MODEL_LENGTH = 128;
const MAX_PROVIDER_LENGTH = 64;
const MAX_PACKAGE_NAME_LENGTH = 214;
const MAX_PACKAGE_VERSION_LENGTH = 64;
const MAX_CHAIN_LENGTH = 64;
const MAX_REFERENCE_SET_LENGTH = 256;

/* ------------------------------------------------------------------ */
/* Canonical input boundary (strict, total, non-invoking)              */
/* ------------------------------------------------------------------ */

class IssueCollector {
  readonly #issues: AgentProfileIssue[] = [];

  add(code: AgentProfileIssueCode, message: string, path?: string): void {
    this.#issues.push(path === undefined ? { code, message } : { code, path, message });
  }

  /** Path-sorted, then code-sorted, then message-sorted (deterministic order). */
  sorted(): readonly AgentProfileIssue[] {
    return [...this.#issues].sort((a, b) => {
      const pathA = a.path ?? '';
      const pathB = b.path ?? '';
      if (pathA !== pathB) {
        return pathA < pathB ? -1 : 1;
      }
      if (a.code !== b.code) {
        return a.code < b.code ? -1 : 1;
      }
      return a.message < b.message ? -1 : a.message > b.message ? 1 : 0;
    });
  }
}

/**
 * Total structural walk over the profile input. Never throws, never invokes
 * a getter: accessors are rejected by DESCRIPTOR inspection. Reports every
 * independently detectable non-canonical member.
 */
function collectCanonicalInputIssues(input: unknown, collector: IssueCollector): void {
  const seen = new Set<object>();
  const reject = (path: string, reason: string): void => {
    collector.add(
      'AGENT_PROFILE_NON_CANONICAL_VALUE',
      `The agent profile rejects ${reason} at '${path}'; profile inputs must be plain, own-enumerable canonical data.`,
      path,
    );
  };

  const walk = (value: unknown, path: string, depth: number): void => {
    if (depth > 64) {
      collector.add(
        'AGENT_PROFILE_NON_CANONICAL_VALUE',
        `The agent profile exceeds the maximum structural depth at '${path}'; nesting beyond 64 levels is rejected.`,
        path,
      );
      return;
    }
    if (value === null) {
      return;
    }
    const type = typeof value;
    if (type === 'string' || type === 'boolean') {
      return;
    }
    if (type === 'number') {
      if (!Number.isFinite(value)) {
        reject(path, 'a non-finite number');
      } else if (Object.is(value, -0)) {
        reject(path, 'negative zero');
      }
      return;
    }
    if (type === 'undefined') {
      return; // an undefined OBJECT member means absent; array slots are rejected below
    }
    if (type === 'bigint') {
      reject(path, 'a BigInt value');
      return;
    }
    if (type === 'function') {
      reject(path, 'a function value');
      return;
    }
    if (type === 'symbol') {
      reject(path, 'a symbol value');
      return;
    }

    if (seen.has(value as object)) {
      reject(path, 'a cyclic structure');
      return;
    }
    let descriptors: Record<string | symbol, PropertyDescriptor>;
    try {
      descriptors = Object.getOwnPropertyDescriptors(value as object) as Record<
        string | symbol,
        PropertyDescriptor
      >;
    } catch {
      reject(
        path,
        'a value whose property descriptors could not be inspected (hostile or revoked proxy)',
      );
      return;
    }

    if (Array.isArray(value)) {
      const array = value as unknown[];
      seen.add(array);
      try {
        for (const key of Reflect.ownKeys(descriptors)) {
          const descriptor = descriptors[key] as PropertyDescriptor;
          if (typeof key === 'symbol') {
            reject(`${path}[(symbol)]`, 'a symbol-keyed array property');
            continue;
          }
          if (key === 'length') {
            continue;
          }
          if (descriptor.get !== undefined || descriptor.set !== undefined) {
            reject(
              `${path}[${key}]`,
              'an accessor array element (rejected by descriptor inspection, never invoked)',
            );
            continue;
          }
          const index = Number(key);
          if (
            !Number.isInteger(index) ||
            index < 0 ||
            index >= array.length ||
            String(index) !== key
          ) {
            reject(`${path}.${key}`, 'an unsupported additional array property');
            continue;
          }
          if (!descriptor.enumerable) {
            reject(`${path}[${key}]`, 'a non-enumerable array element');
          }
        }
        for (let index = 0; index < array.length; index += 1) {
          if (!Object.prototype.hasOwnProperty.call(descriptors, String(index))) {
            reject(`${path}[${index}]`, 'a sparse array slot (declare an explicit null instead)');
            continue;
          }
          let item: unknown;
          try {
            item = array[index];
          } catch {
            reject(
              `${path}[${index}]`,
              'an array element that could not be read (hostile getter or proxy)',
            );
            continue;
          }
          if (item === undefined) {
            reject(`${path}[${index}]`, 'an undefined array element (declare an explicit null)');
            continue;
          }
          walk(item, `${path}[${index}]`, depth + 1);
        }
      } finally {
        seen.delete(array);
      }
      return;
    }

    let proto: object | null;
    try {
      proto = Object.getPrototypeOf(value as object);
    } catch {
      reject(path, 'a value whose prototype could not be inspected (hostile or revoked proxy)');
      return;
    }
    if (proto !== Object.prototype && proto !== null) {
      reject(path, 'an object with an unsupported prototype');
      return;
    }
    seen.add(value as object);
    try {
      for (const key of Reflect.ownKeys(descriptors)) {
        const descriptor = descriptors[key] as PropertyDescriptor;
        if (typeof key === 'symbol') {
          reject(`${path}[(symbol)]`, 'a symbol-keyed profile field');
          continue;
        }
        if (descriptor.get !== undefined || descriptor.set !== undefined) {
          reject(
            `${path}.${key}`,
            'an accessor profile field (rejected by descriptor inspection, never invoked)',
          );
          continue;
        }
        if (!descriptor.enumerable) {
          reject(`${path}.${key}`, 'a non-enumerable profile field');
          continue;
        }
        let item: unknown;
        try {
          item = (value as Record<string, unknown>)[key];
        } catch {
          reject(`${path}.${key}`, `the field could not be read (hostile getter or proxy)`);
          continue;
        }
        walk(item, `${path}.${key}`, depth + 1);
      }
    } finally {
      seen.delete(value as object);
    }
  };

  walk(input, '(profile)', 0);
}

/* ------------------------------------------------------------------ */
/* Closed-schema semantic validation                                   */
/* ------------------------------------------------------------------ */

const IDENTITY_PATTERN = /^[\x20-\x7E]+$/;

function isValidId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_ID_LENGTH &&
    value.trim().length > 0 &&
    IDENTITY_PATTERN.test(value)
  );
}

/** Check the closed field set of one object level. */
function checkClosedFields(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: string,
  collector: IssueCollector,
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      collector.add(
        'AGENT_PROFILE_UNKNOWN_FIELD',
        `Unknown field '${key}' at '${path}': the agent-profile schema is closed and does not accept it. An unlisted runtime-affecting option is a profile-schema defect, never a free field.`,
        `${path}.${key}`,
      );
    }
  }
}

/** Validate one reference ({ id, revision }); returns true when structurally valid. */
function checkReference(
  value: unknown,
  path: string,
  collector: IssueCollector,
): value is AgentReference {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    collector.add(
      'AGENT_PROFILE_REQUIRED_MEMBER',
      `'${path}' must be a reference object with non-empty 'id' and 'revision' members.`,
      path,
    );
    return false;
  }
  const record = value as Record<string, unknown>;
  checkClosedFields(record, new Set(['id', 'revision']), path, collector);
  if (record.id === undefined) {
    collector.add('AGENT_PROFILE_REQUIRED_MEMBER', `'${path}.id' is required.`, `${path}.id`);
  } else if (!isValidId(record.id)) {
    collector.add(
      'AGENT_PROFILE_EMPTY_ID',
      `'${path}.id' must be a non-empty printable identifier of at most ${MAX_ID_LENGTH} characters.`,
      `${path}.id`,
    );
  }
  if (record.revision === undefined) {
    collector.add(
      'AGENT_PROFILE_REQUIRED_MEMBER',
      `'${path}.revision' is required; required values are never silently defaulted.`,
      `${path}.revision`,
    );
  } else if (!isValidId(record.revision)) {
    collector.add(
      'AGENT_PROFILE_EMPTY_REVISION',
      `'${path}.revision' must be a non-empty printable revision string.`,
      `${path}.revision`,
    );
  }
  return isValidId(record.id) && isValidId(record.revision);
}

/** Validate an ordered chain (processors/guardrails). */
function checkChain(
  value: unknown,
  path: string,
  collector: IssueCollector,
): readonly AgentReference[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    collector.add(
      'AGENT_PROFILE_REQUIRED_MEMBER',
      `'${path}' must be an array of references.`,
      path,
    );
    return undefined;
  }
  if (value.length > MAX_CHAIN_LENGTH) {
    collector.add(
      'AGENT_PROFILE_INVALID_BOUND',
      `'${path}' exceeds the maximum chain length of ${MAX_CHAIN_LENGTH}.`,
      path,
    );
    return undefined;
  }
  const resolved: AgentReference[] = [];
  let valid = true;
  for (let index = 0; index < value.length; index += 1) {
    const ok = checkReference(value[index], `${path}[${index}]`, collector);
    if (!ok) {
      valid = false;
      continue;
    }
    resolved.push(value[index] as AgentReference);
  }
  return valid ? resolved : undefined;
}

/**
 * Validate a set-like reference collection: duplicates are rejected (set
 * multiplicity is not canonical data), and entries are canonically sorted
 * by (id, revision) for identity.
 */
function checkReferenceSet(
  value: unknown,
  path: string,
  collector: IssueCollector,
): readonly AgentReference[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    collector.add(
      'AGENT_PROFILE_REQUIRED_MEMBER',
      `'${path}' must be an array of references.`,
      path,
    );
    return undefined;
  }
  if (value.length > MAX_REFERENCE_SET_LENGTH) {
    collector.add(
      'AGENT_PROFILE_INVALID_BOUND',
      `'${path}' exceeds the maximum set size of ${MAX_REFERENCE_SET_LENGTH}.`,
      path,
    );
    return undefined;
  }
  const resolved: AgentReference[] = [];
  let valid = true;
  const seen = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const entryPath = `${path}[${index}]`;
    const ok = checkReference(value[index], entryPath, collector);
    if (!ok) {
      valid = false;
      continue;
    }
    const reference = value[index] as AgentReference;
    const key = `${reference.id}\u0000${reference.revision}`;
    if (seen.has(key)) {
      collector.add(
        'AGENT_PROFILE_DUPLICATE_REFERENCE',
        `'${path}' declares reference '${reference.id}' (revision '${reference.revision}') more than once; set-like collections must not repeat entries.`,
        entryPath,
      );
      valid = false;
      continue;
    }
    seen.add(key);
    resolved.push(reference);
  }
  if (!valid) {
    return undefined;
  }
  return [...resolved].sort((a, b) =>
    a.id === b.id
      ? a.revision < b.revision
        ? -1
        : a.revision > b.revision
          ? 1
          : 0
      : a.id < b.id
        ? -1
        : 1,
  );
}

/**
 * Set-like collections: canonically sorted by (id, revision) so declaration
 * order never changes identity.
 */
function sortedSetEntries(
  references: readonly AgentReference[] | undefined,
): ReadonlyArray<{ readonly id: string; readonly revision: string }> | null {
  if (references === undefined) {
    return null;
  }
  return [...references]
    .sort((a, b) =>
      a.id === b.id
        ? a.revision < b.revision
          ? -1
          : a.revision > b.revision
            ? 1
            : 0
        : a.id < b.id
          ? -1
          : 1,
    )
    .map((reference) => ({ id: reference.id, revision: reference.revision }));
}

/** Order-sensitive chains: declared order is preserved. */
function orderedEntries(
  references: readonly AgentReference[] | undefined,
): ReadonlyArray<{ readonly id: string; readonly revision: string }> | null {
  if (references === undefined) {
    return null;
  }
  return references.map((reference) => ({ id: reference.id, revision: reference.revision }));
}

/* ------------------------------------------------------------------ */
/* Compilation                                                         */
/* ------------------------------------------------------------------ */

/**
 * Compile an agent profile: validate the strict canonical-input boundary,
 * enforce the closed schema, and — only when every check passes — produce
 * an immutable VICT-owned capture with its deterministic
 * `agentProfileVersion`. No invalid profile produces a partial compiled
 * profile or version.
 */
export function compileAgentProfile(input: unknown): AgentProfileCompileResult {
  const collector = new IssueCollector();

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return {
      ok: false,
      issues: [
        {
          code: 'AGENT_PROFILE_REQUIRED_MEMBER',
          message: 'An agent profile must be a plain object.',
        },
      ],
    };
  }

  collectCanonicalInputIssues(input, collector);

  // Semantic validation operates over the SAME accepted data; when the
  // canonical boundary failed, structural shape cannot be trusted.
  const profile = input as Record<string, unknown>;
  if (collector.sorted().length === 0) {
    validateProfileSemantics(profile, collector);
  }

  const issues = collector.sorted();
  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const manifest = buildCanonicalManifest(profile as unknown as AgentProfileAuthoring);
  const manifestJson = canonicalJson(manifest);
  const agentProfileVersion = `v1_${sha256Hex(`${AGENT_PROFILE_IDENTITY_SCHEMA}\u0000${manifestJson}`)}`;

  return {
    ok: true,
    value: {
      profile: deepFreeze(structuredCopy(profile)) as unknown as FrozenAgentProfile,
      manifest: deepFreeze(manifest as unknown as Record<string, unknown>),
      agentProfileVersion,
      manifestJson,
    },
  };
}

function validateProfileSemantics(
  profile: Record<string, unknown>,
  collector: IssueCollector,
): void {
  checkClosedFields(profile, PROFILE_FIELDS, '(profile)', collector);

  // 1. Schema marker — exact, never defaulted.
  if (profile.schema === undefined) {
    collector.add(
      'AGENT_PROFILE_REQUIRED_MEMBER',
      `'(profile).schema' is required; it must be exactly the closed marker.`,
      '(profile).schema',
    );
  } else if (profile.schema !== 'vict.agent-profile@1') {
    collector.add(
      'AGENT_PROFILE_UNKNOWN_SCHEMA',
      `'(profile).schema' must be exactly 'vict.agent-profile@1'; other schema markers are rejected.`,
      '(profile).schema',
    );
  }

  // 2. Agent ID and revision.
  if (profile.id === undefined) {
    collector.add('AGENT_PROFILE_REQUIRED_MEMBER', `'(profile).id' is required.`, '(profile).id');
  } else if (!isValidId(profile.id)) {
    collector.add(
      'AGENT_PROFILE_EMPTY_ID',
      `'(profile).id' must be a non-empty printable identifier of at most ${MAX_ID_LENGTH} characters.`,
      '(profile).id',
    );
  }
  if (profile.revision === undefined) {
    collector.add(
      'AGENT_PROFILE_REQUIRED_MEMBER',
      `'(profile).revision' is required; required values are never silently defaulted.`,
      '(profile).revision',
    );
  } else if (!isValidId(profile.revision)) {
    collector.add(
      'AGENT_PROFILE_EMPTY_REVISION',
      `'(profile).revision' must be a non-empty printable revision string.`,
      '(profile).revision',
    );
  }

  // 3. Instructions reference.
  if (profile.instructions === undefined) {
    collector.add(
      'AGENT_PROFILE_REQUIRED_MEMBER',
      `'(profile).instructions' is required (instructions are referenced by id + revision, never inlined).`,
      '(profile).instructions',
    );
  } else {
    checkReference(profile.instructions, '(profile).instructions', collector);
  }

  // 4. Model profile (id/revision + provider intent).
  if (profile.modelProfile === undefined) {
    collector.add(
      'AGENT_PROFILE_REQUIRED_MEMBER',
      `'(profile).modelProfile' is required.`,
      '(profile).modelProfile',
    );
  } else if (typeof profile.modelProfile === 'object' && profile.modelProfile !== null) {
    const modelProfile = profile.modelProfile as Record<string, unknown>;
    checkClosedFields(modelProfile, MODEL_PROFILE_FIELDS, '(profile).modelProfile', collector);
    if (modelProfile.id === undefined) {
      collector.add(
        'AGENT_PROFILE_REQUIRED_MEMBER',
        `'(profile).modelProfile.id' is required.`,
        '(profile).modelProfile.id',
      );
    } else if (!isValidId(modelProfile.id)) {
      collector.add(
        'AGENT_PROFILE_EMPTY_ID',
        `'(profile).modelProfile.id' must be a non-empty printable identifier.`,
        '(profile).modelProfile.id',
      );
    }
    if (modelProfile.revision === undefined) {
      collector.add(
        'AGENT_PROFILE_REQUIRED_MEMBER',
        `'(profile).modelProfile.revision' is required.`,
        '(profile).modelProfile.revision',
      );
    } else if (!isValidId(modelProfile.revision)) {
      collector.add(
        'AGENT_PROFILE_EMPTY_REVISION',
        `'(profile).modelProfile.revision' must be a non-empty printable revision string.`,
        '(profile).modelProfile.revision',
      );
    }
    for (const member of ['routerModel', 'provider'] as const) {
      const value = modelProfile[member];
      const limit = member === 'routerModel' ? MAX_ROUTER_MODEL_LENGTH : MAX_PROVIDER_LENGTH;
      if (value === undefined) {
        collector.add(
          'AGENT_PROFILE_REQUIRED_MEMBER',
          `'(profile).modelProfile.${member}' is required.`,
          `(profile).modelProfile.${member}`,
        );
      } else if (
        typeof value !== 'string' ||
        value.length === 0 ||
        value.length > limit ||
        !IDENTITY_PATTERN.test(value)
      ) {
        collector.add(
          'AGENT_PROFILE_INVALID_IDENTITY_MEMBER',
          `'(profile).modelProfile.${member}' must be a non-empty printable string of at most ${limit} characters.`,
          `(profile).modelProfile.${member}`,
        );
      }
    }
  } else {
    collector.add(
      'AGENT_PROFILE_REQUIRED_MEMBER',
      `'(profile).modelProfile' must be a plain object.`,
      '(profile).modelProfile',
    );
  }

  // 5. Generation defaults — explicit record (may be intentionally empty).
  if (profile.generation === undefined) {
    collector.add(
      'AGENT_PROFILE_REQUIRED_MEMBER',
      `'(profile).generation' is required; declare it explicitly (an empty record declares provider defaults).`,
      '(profile).generation',
    );
  } else if (
    typeof profile.generation === 'object' &&
    profile.generation !== null &&
    !Array.isArray(profile.generation)
  ) {
    const generation = profile.generation as Record<string, unknown>;
    checkClosedFields(generation, GENERATION_FIELDS, '(profile).generation', collector);
    for (const [field, bound] of Object.entries(GENERATION_BOUNDS)) {
      const value = generation[field];
      if (value === undefined) {
        continue;
      }
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        collector.add(
          'AGENT_PROFILE_INVALID_BOUND',
          `'(profile).generation.${field}' must be a finite number.`,
          `(profile).generation.${field}`,
        );
        continue;
      }
      if (bound.integral && !Number.isInteger(value)) {
        collector.add(
          'AGENT_PROFILE_INVALID_BOUND',
          `'(profile).generation.${field}' must be an integer.`,
          `(profile).generation.${field}`,
        );
        continue;
      }
      if (
        value < bound.min ||
        value > bound.max ||
        ('exclusiveMin' in bound && bound.exclusiveMin === true && value <= bound.min)
      ) {
        collector.add(
          'AGENT_PROFILE_INVALID_BOUND',
          `'(profile).generation.${field}' must be within [${bound.min}, ${bound.max}].`,
          `(profile).generation.${field}`,
        );
      }
    }
  } else {
    collector.add(
      'AGENT_PROFILE_REQUIRED_MEMBER',
      `'(profile).generation' must be a plain object.`,
      '(profile).generation',
    );
  }

  // 6. Turn policy — stop/iteration/tool-call/loop policy, fully explicit.
  if (profile.turnPolicy === undefined) {
    collector.add(
      'AGENT_PROFILE_REQUIRED_MEMBER',
      `'(profile).turnPolicy' is required; stop/iteration/tool-call/loop policy is never defaulted.`,
      '(profile).turnPolicy',
    );
  } else if (
    typeof profile.turnPolicy === 'object' &&
    profile.turnPolicy !== null &&
    !Array.isArray(profile.turnPolicy)
  ) {
    const turnPolicy = profile.turnPolicy as Record<string, unknown>;
    checkClosedFields(turnPolicy, TURN_POLICY_FIELDS, '(profile).turnPolicy', collector);
    for (const [field, bound] of Object.entries(TURN_BOUNDS)) {
      const value = turnPolicy[field];
      if (value === undefined) {
        collector.add(
          'AGENT_PROFILE_REQUIRED_MEMBER',
          `'(profile).turnPolicy.${field}' is required.`,
          `(profile).turnPolicy.${field}`,
        );
        continue;
      }
      if (
        typeof value !== 'number' ||
        !Number.isInteger(value) ||
        value < bound.min ||
        value > bound.max
      ) {
        collector.add(
          'AGENT_PROFILE_INVALID_BOUND',
          `'(profile).turnPolicy.${field}' must be an integer within [${bound.min}, ${bound.max}].`,
          `(profile).turnPolicy.${field}`,
        );
      }
    }
    const onLimit = turnPolicy.onLimit;
    if (onLimit === undefined) {
      collector.add(
        'AGENT_PROFILE_REQUIRED_MEMBER',
        `'(profile).turnPolicy.onLimit' is required.`,
        '(profile).turnPolicy.onLimit',
      );
    } else if (onLimit !== 'fail-closed') {
      collector.add(
        'AGENT_PROFILE_INVALID_ENUM',
        `'(profile).turnPolicy.onLimit' must be 'fail-closed'; no other loop policy is accepted by this schema revision.`,
        '(profile).turnPolicy.onLimit',
      );
    }
  } else {
    collector.add(
      'AGENT_PROFILE_REQUIRED_MEMBER',
      `'(profile).turnPolicy' must be a plain object.`,
      '(profile).turnPolicy',
    );
  }

  // 7. Memory-policy reference.
  if (profile.memoryPolicy === undefined) {
    collector.add(
      'AGENT_PROFILE_REQUIRED_MEMBER',
      `'(profile).memoryPolicy' is required.`,
      '(profile).memoryPolicy',
    );
  } else {
    checkReference(profile.memoryPolicy, '(profile).memoryPolicy', collector);
  }

  // 8./9. Ordered processor and guardrail chains (order is significant).
  checkChain(profile.processors, '(profile).processors', collector);
  checkChain(profile.guardrails, '(profile).guardrails', collector);

  // 10. Structured-output contract reference (when enabled).
  if (profile.structuredOutput !== undefined) {
    if (
      typeof profile.structuredOutput !== 'object' ||
      profile.structuredOutput === null ||
      Array.isArray(profile.structuredOutput)
    ) {
      collector.add(
        'AGENT_PROFILE_REQUIRED_MEMBER',
        `'(profile).structuredOutput' must be an object with a 'contract' reference.`,
        '(profile).structuredOutput',
      );
    } else {
      const structured = profile.structuredOutput as Record<string, unknown>;
      checkClosedFields(
        structured,
        STRUCTURED_OUTPUT_FIELDS,
        '(profile).structuredOutput',
        collector,
      );
      if (structured.contract === undefined) {
        collector.add(
          'AGENT_PROFILE_REQUIRED_MEMBER',
          `'(profile).structuredOutput.contract' is required when structured output is enabled.`,
          '(profile).structuredOutput.contract',
        );
      } else {
        checkReference(structured.contract, '(profile).structuredOutput.contract', collector);
      }
    }
  }

  // 11.–13. Set-like collections (canonically sorted in identity).
  checkReferenceSet(profile.helperTools, '(profile).helperTools', collector);
  checkReferenceSet(profile.capabilities, '(profile).capabilities', collector);
  checkReferenceSet(profile.subagents, '(profile).subagents', collector);
  checkReferenceSet(profile.workflows, '(profile).workflows', collector);

  // 14. Adapter compatibility marker — required; every pinned runtime
  // package participates in identity.
  if (profile.adapter === undefined) {
    collector.add(
      'AGENT_PROFILE_REQUIRED_MEMBER',
      `'(profile).adapter' is required (adapter id/revision + every runtime-affecting pinned runtime package version).`,
      '(profile).adapter',
    );
  } else if (
    typeof profile.adapter === 'object' &&
    profile.adapter !== null &&
    !Array.isArray(profile.adapter)
  ) {
    const adapter = profile.adapter as Record<string, unknown>;
    checkClosedFields(adapter, ADAPTER_FIELDS, '(profile).adapter', collector);
    if (adapter.id === undefined) {
      collector.add(
        'AGENT_PROFILE_REQUIRED_MEMBER',
        `'(profile).adapter.id' is required.`,
        '(profile).adapter.id',
      );
    } else if (!isValidId(adapter.id)) {
      collector.add(
        'AGENT_PROFILE_EMPTY_ID',
        `'(profile).adapter.id' must be a non-empty printable identifier.`,
        '(profile).adapter.id',
      );
    }
    if (adapter.revision === undefined) {
      collector.add(
        'AGENT_PROFILE_REQUIRED_MEMBER',
        `'(profile).adapter.revision' is required.`,
        '(profile).adapter.revision',
      );
    } else if (!isValidId(adapter.revision)) {
      collector.add(
        'AGENT_PROFILE_EMPTY_REVISION',
        `'(profile).adapter.revision' must be a non-empty printable revision string.`,
        '(profile).adapter.revision',
      );
    }
    if (adapter.runtimePackages === undefined) {
      collector.add(
        'AGENT_PROFILE_REQUIRED_MEMBER',
        `'(profile).adapter.runtimePackages' is required (declare it explicitly, an empty record declares no pinned runtime package).`,
        '(profile).adapter.runtimePackages',
      );
    } else if (
      typeof adapter.runtimePackages === 'object' &&
      adapter.runtimePackages !== null &&
      !Array.isArray(adapter.runtimePackages)
    ) {
      const packages = adapter.runtimePackages as Record<string, unknown>;
      for (const [name, version] of Object.entries(packages)) {
        if (
          name.length === 0 ||
          name.length > MAX_PACKAGE_NAME_LENGTH ||
          !IDENTITY_PATTERN.test(name)
        ) {
          collector.add(
            'AGENT_PROFILE_INVALID_IDENTITY_MEMBER',
            `'(profile).adapter.runtimePackages' declares an invalid package name (non-empty printable, at most ${MAX_PACKAGE_NAME_LENGTH} characters).`,
            `(profile).adapter.runtimePackages.${name}`,
          );
        }
        if (
          typeof version !== 'string' ||
          version.length === 0 ||
          version.length > MAX_PACKAGE_VERSION_LENGTH ||
          !IDENTITY_PATTERN.test(version)
        ) {
          collector.add(
            'AGENT_PROFILE_INVALID_IDENTITY_MEMBER',
            `'(profile).adapter.runtimePackages.${name}' must map to a non-empty printable exact version string.`,
            `(profile).adapter.runtimePackages.${name}`,
          );
        }
      }
    } else {
      collector.add(
        'AGENT_PROFILE_REQUIRED_MEMBER',
        `'(profile).adapter.runtimePackages' must be a plain object of exact pinned versions.`,
        '(profile).adapter.runtimePackages',
      );
    }
  } else {
    collector.add(
      'AGENT_PROFILE_REQUIRED_MEMBER',
      `'(profile).adapter' must be a plain object.`,
      '(profile).adapter',
    );
  }
}

/**
 * Build the canonical identity manifest (amendment §6.1). Set-like
 * collections are canonically sorted; order-sensitive chains preserve
 * declared order; absent optional members are canonically `null`.
 */
function buildCanonicalManifest(profile: AgentProfileAuthoring): Record<string, unknown> {
  const generation: Record<string, unknown> = {};
  for (const field of ['temperature', 'topP', 'maxOutputTokens', 'maxRetries'] as const) {
    const value = (profile.generation as Record<string, unknown>)[field];
    if (value !== undefined) {
      generation[field] = value;
    }
  }

  return {
    schema: AGENT_PROFILE_IDENTITY_SCHEMA,
    profile: {
      schema: profile.schema,
      id: profile.id,
      revision: profile.revision,
      instructions: referenceEntry(profile.instructions),
      modelProfile: {
        id: profile.modelProfile.id,
        revision: profile.modelProfile.revision,
        routerModel: profile.modelProfile.routerModel,
        provider: profile.modelProfile.provider,
        providerCredentialVar: profile.modelProfile.providerCredentialVar ?? null,
      },
      generation,
      turnPolicy: {
        maxSteps: profile.turnPolicy.maxSteps,
        maxToolCalls: profile.turnPolicy.maxToolCalls,
        onLimit: profile.turnPolicy.onLimit,
      },
      memoryPolicy: referenceEntry(profile.memoryPolicy),
      processors: orderedEntries(profile.processors),
      guardrails: orderedEntries(profile.guardrails),
      structuredOutput:
        profile.structuredOutput === undefined
          ? null
          : { contract: referenceEntry(profile.structuredOutput.contract) },
      helperTools: sortedSetEntries(profile.helperTools),
      capabilities: sortedSetEntries(profile.capabilities),
      subagents: sortedSetEntries(profile.subagents),
      workflows: sortedSetEntries(profile.workflows),
      adapter: {
        id: profile.adapter.id,
        revision: profile.adapter.revision,
        runtimePackages: sortedEntries(profile.adapter.runtimePackages),
      },
    },
  };
}

function referenceEntry(reference: AgentReference): { id: string; revision: string } {
  return { id: reference.id, revision: reference.revision };
}

/** Sorted `name → version` entries (insertion order never matters). */
function sortedEntries(
  record: Readonly<Record<string, string>>,
): ReadonlyArray<readonly [string, string]> {
  return Object.keys(record)
    .sort()
    .map((name) => [name, record[name] as string] as const);
}

/** Structural deep copy of validated canonical data (no functions present). */
function structuredCopy(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(structuredCopy);
  }
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      const item = (value as Record<string, unknown>)[key];
      if (item !== undefined) {
        out[key] = structuredCopy(item);
      }
    }
    return out;
  }
  return value;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

function sha256Hex(payload: string): string {
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}
