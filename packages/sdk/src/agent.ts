import { frozenCapture, VictAuthoringError } from './authoring.js';

/**
 * Product-agent authoring vocabulary (`@vict/sdk`).
 *
 * This module is part of the stable authoring ABI. It sits BELOW the kernel
 * and runtime in the dependency direction and is — like the rest of the
 * SDK — schema-library neutral and the agent framework neutral (AI-002): a profile is
 * strict canonical DATA. No agent-framework type, package name, schema-library type,
 * credential value, function body, or timestamp may appear in a profile.
 * Function implementations live in separately registered ARTIFACTS
 * (instructions text, helper tools, processors, guardrails, memory
 * policies), referenced by explicit `id` + `revision`; the kernel resolves
 * them at activation and binds them by reference without hashing or
 * serializing their bodies (AI-003/AI-004, amendment §6).
 *
 * Identity (`agentProfileVersion`) covers EVERY runtime-affecting component
 * declared here (amendment §6.1). Set-like collections (helper tools,
 * capabilities, subagents, workflows) are canonically sorted in identity;
 * the processor and guardrail chains are order-sensitive. Changing any
 * declared semantic requires a new revision (or a changed adapter marker)
 * to change the version.
 */

/** The closed agent-profile schema marker. */
export const AGENT_PROFILE_SCHEMA = 'vict.agent-profile@1';

/** A stable reference to a revisioned artifact or capability. */
export interface AgentReference {
  /** Stable, non-empty, printable identifier (e.g. `instructions.ara`). */
  readonly id: string;
  /** Explicit author/build revision; never defaulted. */
  readonly revision: string;
}

/**
 * Model-profile declaration: which model intent the adapter should resolve
 * and under which provider constraints. Declares INTENT only — the actual
 * provider/model identity observed at execution is recorded as run
 * metadata, never hashed into identity (amendment §6.4).
 */
export interface AgentModelProfileAuthoring {
  readonly id: string;
  readonly revision: string;
  /** Model-router intent string (`provider/model` format). */
  readonly routerModel: string;
  /** Provider intent (e.g. `offline-fixture`, `openai`). Closed: non-empty printable string. */
  readonly provider: string;
  /**
   * NAME of the environment variable that would hold the provider
   * credential in a real deployment. A NAME only — credential VALUES never
   * enter a profile (SEC-003, amendment §8.1).
   */
  readonly providerCredentialVar?: string;
}

/**
 * Generation defaults and bounded options. Presence is mandatory; every
 * field is an explicit author declaration (nothing is silently defaulted),
 * and every value participates in `agentProfileVersion`. Ranges are
 * enforced by the kernel compiler.
 */
export interface AgentGenerationOptions {
  /** Sampling temperature in [0, 2]. */
  readonly temperature?: number;
  /** Nucleus-sampling mass in (0, 1]. */
  readonly topP?: number;
  /** Maximum generated tokens in [1, 200000]. */
  readonly maxOutputTokens?: number;
  /** Provider retry bound in [0, 8]. */
  readonly maxRetries?: number;
}

/**
 * Stop/iteration/tool-call/loop policy. Bounded and enumerated; unbounded
 * loops are not representable. `onLimit` is a closed enum — `fail-closed`
 * is the only accepted policy in this schema revision.
 */
export interface AgentTurnPolicy {
  /** Maximum model steps per turn in [1, 64]. */
  readonly maxSteps: number;
  /** Maximum tool calls per turn in [0, 64]. */
  readonly maxToolCalls: number;
  /** Behavior at any limit. Only `'fail-closed'` is accepted. */
  readonly onLimit: 'fail-closed';
}

/**
 * The adapter compatibility marker (amendment §6.1 component 14):
 * the adapter package identity plus EVERY runtime-affecting pinned runtime
 * package (`name → exact version`) the adapter actually uses. A pinned
 * runtime version change changes the marker and therefore the profile
 * version; upgrade conformance (MSTR-002) decides acceptance. The neutral
 * schema stores the mapping generically — package names are adapter-owned
 * data, never neutral-surface literals.
 */
export interface AgentAdapterCompatibilityAuthoring {
  readonly id: string;
  readonly revision: string;
  /** Exact pinned runtime package versions actually used (`name → version`). */
  readonly runtimePackages: Readonly<Record<string, string>>;
}

/**
 * The complete agent-profile declaration (amendment §6.1). Strict canonical
 * data only — the kernel compiler rejects unknown fields, non-canonical
 * values (accessors, prototypes, sparse arrays, exotic objects), and
 * out-of-range or defaulted required members with stable, path-sorted,
 * non-echoing diagnostics.
 */
export interface AgentProfileAuthoring {
  /** Closed schema marker; must be exactly `vict.agent-profile@1`. */
  readonly schema: 'vict.agent-profile@1';
  /** Stable agent identifier. */
  readonly id: string;
  /** Explicit agent revision (author/build responsibility). */
  readonly revision: string;
  /** Instructions reference — resolved to an exact revision at activation. */
  readonly instructions: AgentReference;
  /** Model profile (id + revision + provider intent). */
  readonly modelProfile: AgentModelProfileAuthoring;
  /** Generation defaults and bounded options (explicit record; may be empty). */
  readonly generation: AgentGenerationOptions;
  /** Stop/iteration/tool-call/loop policy. */
  readonly turnPolicy: AgentTurnPolicy;
  /** Memory-policy reference — resolved to an exact revision at activation. */
  readonly memoryPolicy: AgentReference;
  /** Ordered processor chain (order is execution order; order changes identity). */
  readonly processors?: readonly AgentReference[];
  /** Ordered guardrail chain (order is execution order; order changes identity). */
  readonly guardrails?: readonly AgentReference[];
  /** Structured-output contract reference, when structured output is enabled. */
  readonly structuredOutput?: { readonly contract: AgentReference };
  /** adapter-native helper tools (pure, versioned; set-like — canonically sorted in identity). */
  readonly helperTools?: readonly AgentReference[];
  /** VICT capability authority envelope (set-like — canonically sorted in identity). */
  readonly capabilities?: readonly AgentReference[];
  /** Subagent references, when enabled (set-like — canonically sorted in identity). */
  readonly subagents?: readonly AgentReference[];
  /** AI-internal workflow references, when enabled (set-like — canonically sorted in identity). */
  readonly workflows?: readonly AgentReference[];
  /** Adapter compatibility marker (adapter id/revision + pinned runtime packages). */
  readonly adapter: AgentAdapterCompatibilityAuthoring;
}

/**
 * Define an agent profile. Returns a deep-frozen deep copy; the author's
 * original object can be mutated (or frozen) afterwards without changing
 * captured semantics, and captured semantics can never be changed through
 * the original. Profiles are pure data.
 *
 * The capture is guarded by a strict, non-invoking canonical walk: accessor
 * fields are rejected by DESCRIPTOR inspection and are never invoked;
 * functions, BigInts, symbols, Dates/class instances (unsupported
 * prototypes), sparse arrays, symbol-keyed members, and cyclic structures
 * fail with a structured `VictAuthoringError` BEFORE any value is read
 * through a hostile getter or proxy. Hostile input never escapes as a raw
 * TypeError, and no accessor body ever executes during authoring capture.
 */
export function defineAgentProfile(profile: AgentProfileAuthoring): AgentProfileAuthoring {
  rejectNonCanonicalProfileValue(profile, '(profile)');
  return frozenCapture(profile);
}

const MAX_PROFILE_DEPTH = 64;

function rejectNonCanonicalProfileValue(value: unknown, path: string, depth = 0): void {
  if (depth > MAX_PROFILE_DEPTH) {
    throw new VictAuthoringError(
      'VICT_AUTHORING_CYCLIC_STRUCTURE',
      `The agent profile is too deep to capture safely at '${path}'; nesting beyond ${MAX_PROFILE_DEPTH} levels is rejected structurally.`,
    );
  }
  if (value === null) {
    return; // a real null is canonical data (distinct from an absent member)
  }
  const type = typeof value;
  if (type === 'string' || type === 'boolean') {
    return;
  }
  if (type === 'number') {
    if (!Number.isFinite(value)) {
      throw new VictAuthoringError(
        'VICT_AUTHORING_UNSUPPORTED_VALUE',
        `The agent profile rejects a non-finite number at '${path}'; profile data must be canonical.`,
      );
    }
    if (Object.is(value, -0)) {
      throw new VictAuthoringError(
        'VICT_AUTHORING_UNSUPPORTED_VALUE',
        `The agent profile rejects negative zero at '${path}'; use 0.`,
      );
    }
    return;
  }
  if (type === 'undefined') {
    return; // an undefined OBJECT member means absent (rejected in arrays below)
  }
  if (type === 'bigint' || type === 'function' || type === 'symbol') {
    throw new VictAuthoringError(
      'VICT_AUTHORING_UNSUPPORTED_VALUE',
      `The agent profile rejects a ${type} value at '${path}'; profiles capture strict canonical data only.`,
    );
  }

  let descriptors: Record<string | symbol, PropertyDescriptor>;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value as object) as Record<
      string | symbol,
      PropertyDescriptor
    >;
  } catch {
    throw new VictAuthoringError(
      'VICT_AUTHORING_HOSTILE_INPUT',
      `The agent profile could not be inspected at '${path}': property descriptors threw (hostile or revoked proxy).`,
    );
  }

  if (Array.isArray(value)) {
    const array = value as unknown[];
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key === 'symbol') {
        throw new VictAuthoringError(
          'VICT_AUTHORING_UNSUPPORTED_VALUE',
          `The agent profile rejects a symbol-keyed array property at '${path}'.`,
        );
      }
      if (key === 'length') {
        continue;
      }
      const descriptor = descriptors[key] as PropertyDescriptor;
      if (descriptor.get !== undefined || descriptor.set !== undefined) {
        throw new VictAuthoringError(
          'VICT_AUTHORING_UNSUPPORTED_VALUE',
          `The agent profile rejects an accessor array element at '${path}[${key}]' (rejected by descriptor inspection, never invoked).`,
        );
      }
      const index = Number(key);
      if (!Number.isInteger(index) || index < 0 || index >= array.length || String(index) !== key) {
        throw new VictAuthoringError(
          'VICT_AUTHORING_UNSUPPORTED_VALUE',
          `The agent profile rejects an unsupported additional array property at '${path}.${key}'.`,
        );
      }
      if (!descriptor.enumerable) {
        throw new VictAuthoringError(
          'VICT_AUTHORING_UNSUPPORTED_VALUE',
          `The agent profile rejects a non-enumerable array element at '${path}[${key}]'.`,
        );
      }
    }
    for (let index = 0; index < array.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(descriptors, String(index))) {
        throw new VictAuthoringError(
          'VICT_AUTHORING_UNSUPPORTED_VALUE',
          `The agent profile rejects a sparse array slot at '${path}[${index}]'; declare an explicit null instead.`,
        );
      }
      let item: unknown;
      try {
        item = array[index];
      } catch {
        throw new VictAuthoringError(
          'VICT_AUTHORING_HOSTILE_INPUT',
          `The agent profile could not read the array element at '${path}[${index}]' (hostile getter or proxy).`,
        );
      }
      if (item === undefined) {
        throw new VictAuthoringError(
          'VICT_AUTHORING_UNSUPPORTED_VALUE',
          `The agent profile rejects an undefined array element at '${path}[${index}]'; declare an explicit null instead.`,
        );
      }
      rejectNonCanonicalProfileValue(item, `${path}[${index}]`, depth + 1);
    }
    return;
  }

  let proto: object | null;
  try {
    proto = Object.getPrototypeOf(value as object);
  } catch {
    throw new VictAuthoringError(
      'VICT_AUTHORING_HOSTILE_INPUT',
      `The agent profile could not be inspected at '${path}': prototype access threw (hostile or revoked proxy).`,
    );
  }
  if (proto !== Object.prototype && proto !== null) {
    throw new VictAuthoringError(
      'VICT_AUTHORING_UNSUPPORTED_VALUE',
      `The agent profile rejects an unsupported prototype at '${path}'; class instances, Dates, Maps, and Sets are not canonical profile data.`,
    );
  }
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key === 'symbol') {
      throw new VictAuthoringError(
        'VICT_AUTHORING_UNSUPPORTED_VALUE',
        `The agent profile rejects a symbol-keyed member at '${path}'.`,
      );
    }
    const descriptor = descriptors[key] as PropertyDescriptor;
    if (descriptor.get !== undefined || descriptor.set !== undefined) {
      // Rejected by descriptor inspection; the accessor is never invoked.
      throw new VictAuthoringError(
        'VICT_AUTHORING_UNSUPPORTED_VALUE',
        `The agent profile rejects an accessor member at '${path}.${key}' (rejected by descriptor inspection, never invoked).`,
      );
    }
    if (!descriptor.enumerable) {
      throw new VictAuthoringError(
        'VICT_AUTHORING_UNSUPPORTED_VALUE',
        `The agent profile rejects a non-enumerable member at '${path}.${key}'.`,
      );
    }
    let item: unknown;
    try {
      item = (value as Record<string, unknown>)[key];
    } catch {
      throw new VictAuthoringError(
        'VICT_AUTHORING_HOSTILE_INPUT',
        `The agent profile could not read the field at '${path}.${key}' (hostile getter or proxy).`,
      );
    }
    rejectNonCanonicalProfileValue(item, `${path}.${key}`, depth + 1);
  }
}

/** A reference bound to an exact revision — the resolved form used in snapshots. */
export interface BoundAgentReference {
  readonly id: string;
  readonly revision: string;
}
