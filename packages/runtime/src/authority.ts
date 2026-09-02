import type {
  CapabilityConfigReader,
  CapabilityContext,
  CapabilityDefinition,
  CapabilitySecretReader,
} from '@vict/sdk';
import { VictRuntimeError } from './errors.js';

/**
 * Stage 04 least-authority boundary for capability packs.
 *
 * A capability NEVER receives a service locator, a store, a registry, or
 * unrestricted mutation. It receives:
 * - permission enforcement BEFORE invocation (declared grants must be
 *   explicitly granted to the runtime);
 * - eager resolution of required configuration/secret names BEFORE
 *   invocation (a missing required value fails the invocation, never the
 *   handler);
 * - SCOPED, name-checked readers for declared configuration/secret names.
 *   Undeclared names are unavailable: access throws a structured authority
 *   error instead of silently returning empty.
 *
 * Audit remediation (HIGH-04-C / LOW-04-H):
 * - The gate closes over COPIED + FROZEN declaration snapshots, never the
 *   caller's arrays. Mutating a raw definition's `permissions` array after
 *   registration (or after activation) cannot change enforcement.
 * - Every configuration/secret name is resolved AT MOST ONCE per
 *   invocation. Required names are resolved eagerly into an
 *   invocation-scoped cache; optional declared names resolve lazily once
 *   per name and are then cached. The handler's scoped reader returns the
 *   SAME checked value — the check and the use are one consistent read.
 * - Provider exceptions are converted into sanitized, stable authority
 *   failures; the provider's message never propagates.
 * - Resolved values never enter events, traces, history, or activation
 *   identity (they never leave this gate except through the handler's
 *   scoped reader).
 */

/** Runtime port resolving declared configuration values. */
export interface ConfigurationPort {
  get(name: string): unknown;
}

/**
 * Runtime port resolving declared secret references just in time. Values
 * never enter manifests, events, or retained history; they are handed only
 * to the declaring capability through the scoped reader.
 */
export interface SecretResolutionPort {
  get(name: string): Promise<string | undefined>;
}

/** The authority granted to one runtime. */
export interface CapabilityAuthority {
  /** Explicitly granted permission ids. Absent means nothing is granted. */
  readonly grants?: readonly string[];
  readonly configuration?: ConfigurationPort;
  readonly secrets?: SecretResolutionPort;
}

/** Immutable snapshot of the declared authority names of one capability. */
export interface PinnedAuthorityDeclarations {
  readonly permissions: readonly string[];
  readonly configuration: readonly string[];
  readonly requiredConfiguration: readonly string[];
  readonly secrets: readonly string[];
  readonly requiredSecrets: readonly string[];
}

/** The authority-name fields of a capability definition, in declaration order. */
const AUTHORITY_FIELDS = [
  'permissions',
  'configuration',
  'requiredConfiguration',
  'secrets',
  'requiredSecrets',
] as const;

export type AuthorityFieldName = (typeof AUTHORITY_FIELDS)[number];

/**
 * Validate and PIN the authority declarations of a capability definition:
 * every entry must be a non-empty, non-whitespace string; duplicates are
 * rejected. Returns fresh frozen copies — the caller's arrays are never
 * retained by reference.
 */
export function pinAuthorityDeclarations(
  definition: CapabilityDefinition,
): PinnedAuthorityDeclarations {
  const pinned: Record<string, readonly string[]> = {};
  for (const field of AUTHORITY_FIELDS) {
    const raw = definition[field] as readonly string[] | undefined;
    const names = new Set<string>();
    if (raw !== undefined) {
      if (!Array.isArray(raw)) {
        throw new VictRuntimeError(
          'VICT_RUNTIME_INVALID_AUTHORITY',
          `Capability '${definition.id}' declares '${field}' that is not an array of names.`,
          { capabilityId: definition.id, field },
        );
      }
      for (const entry of raw) {
        if (typeof entry !== 'string' || entry.trim().length === 0) {
          throw new VictRuntimeError(
            'VICT_RUNTIME_INVALID_AUTHORITY',
            `Capability '${definition.id}' declares an invalid '${field}' entry: every authority name must be a non-empty, non-whitespace string.`,
            { capabilityId: definition.id, field },
          );
        }
        if (names.has(entry)) {
          throw new VictRuntimeError(
            'VICT_RUNTIME_INVALID_AUTHORITY',
            `Capability '${definition.id}' declares '${entry}' more than once in '${field}'; duplicate authority names are rejected.`,
            { capabilityId: definition.id, field },
          );
        }
        names.add(entry);
      }
    }
    pinned[field] = Object.freeze([...(raw ?? [])]);
  }
  return {
    permissions: Object.freeze(pinned.permissions ?? []),
    configuration: Object.freeze(pinned.configuration ?? []),
    requiredConfiguration: Object.freeze(pinned.requiredConfiguration ?? []),
    secrets: Object.freeze(pinned.secrets ?? []),
    requiredSecrets: Object.freeze(pinned.requiredSecrets ?? []),
  };
}

/**
 * Wrap a capability's invoke with the least-authority gate. The WRAPPED
 * invoke is what the registry stores and what activations capture, so the
 * gate is enforced identically by the sequential and the durable engines.
 * The gate closes over the PINNED declaration snapshot and the runtime's
 * grants — never over the caller's definition object.
 */
export function gateCapabilityInvoke(
  definition: CapabilityDefinition,
  authority: CapabilityAuthority = {},
): CapabilityDefinition['invoke'] {
  const names = pinAuthorityDeclarations(definition);
  const capabilityId = definition.id;
  const invoke = definition.invoke;
  const grants = new Set(authority.grants ?? []);
  const configNames = new Set([...names.configuration, ...names.requiredConfiguration]);
  const secretNames = new Set([...names.secrets, ...names.requiredSecrets]);

  // Invocation-scoped caches: each requested name is resolved AT MOST ONCE.
  let configCache: Map<string, { value: unknown }> | undefined;
  const secretCache = new Map<string, Promise<string | undefined>>();

  const unavailableConfiguration = (name: string, reason: string): VictRuntimeError =>
    new VictRuntimeError(
      'VICT_RUNTIME_CONFIGURATION_UNAVAILABLE',
      `Configuration '${name}' required by capability '${capabilityId}' is unavailable: ${reason}`,
      { capabilityId, configurationName: name },
    );
  const unavailableSecret = (name: string, reason: string): VictRuntimeError =>
    new VictRuntimeError(
      'VICT_RUNTIME_SECRET_UNAVAILABLE',
      `Secret '${name}' required by capability '${capabilityId}' is unavailable: ${reason}`,
      { capabilityId, secretName: name },
    );

  /** Resolve a configuration name at most once per invocation. */
  const resolveConfiguration = (name: string): unknown => {
    const cached = configCache?.get(name);
    if (cached !== undefined) {
      return cached.value;
    }
    let value: unknown;
    try {
      value = authority.configuration?.get(name);
    } catch {
      // Provider exceptions are sanitized into stable authority failures;
      // the provider's message never propagates.
      throw unavailableConfiguration(name, 'the configuration provider failed.');
    }
    configCache ??= new Map();
    configCache.set(name, { value });
    return value;
  };

  /** Resolve a secret name at most once per invocation (promise-cached). */
  const resolveSecret = (name: string): Promise<string | undefined> => {
    const cached = secretCache.get(name);
    if (cached !== undefined) {
      return cached;
    }
    const pending = (async (): Promise<string | undefined> => {
      try {
        return await authority.secrets?.get(name);
      } catch {
        throw unavailableSecret(name, 'the secret provider failed.');
      }
    })();
    secretCache.set(name, pending);
    return pending;
  };

  return async (input: unknown, context: CapabilityContext): Promise<unknown> => {
    // ---- Permission gate: fail BEFORE the handler runs -------------------
    for (const permissionId of names.permissions) {
      if (!grants.has(permissionId)) {
        throw new VictRuntimeError(
          'VICT_RUNTIME_PERMISSION_DENIED',
          `Permission '${permissionId}' required by capability '${capabilityId}' is not granted in this runtime; the handler was not invoked.`,
          { capabilityId, permissionId },
        );
      }
    }

    // ---- Eager required configuration/secret resolution ------------------
    // The resolved values are kept in the invocation-scoped caches below;
    // the handler's scoped readers return the SAME checked values.
    for (const name of names.requiredConfiguration) {
      if (authority.configuration === undefined) {
        throw unavailableConfiguration(name, 'no configuration provider is configured.');
      }
      const value = resolveConfiguration(name);
      if (value === undefined) {
        throw unavailableConfiguration(name, 'it is not provisioned.');
      }
    }
    for (const name of names.requiredSecrets) {
      if (authority.secrets === undefined) {
        throw unavailableSecret(name, 'no secret port is configured.');
      }
      const value = await resolveSecret(name);
      if (value === undefined) {
        throw unavailableSecret(name, 'it is not provisioned.');
      }
    }

    // ---- Scoped, name-checked, invocation-scoped readers ------------------
    let config: CapabilityConfigReader | undefined;
    if (authority.configuration !== undefined && configNames.size > 0) {
      config = {
        get(name: string): unknown {
          if (!configNames.has(name)) {
            throw unavailableConfiguration(
              name,
              `it is not declared by capability '${capabilityId}'; undeclared configuration is unavailable.`,
            );
          }
          // Optional names resolve lazily ONCE and are then cached.
          return resolveConfiguration(name);
        },
      };
    }
    let secrets: CapabilitySecretReader | undefined;
    if (authority.secrets !== undefined && secretNames.size > 0) {
      secrets = {
        get(name: string): Promise<string | undefined> {
          if (!secretNames.has(name)) {
            return Promise.reject(
              unavailableSecret(
                name,
                `it is not declared by capability '${capabilityId}'; undeclared secrets are unavailable.`,
              ),
            );
          }
          // Optional names resolve lazily ONCE and are then cached.
          return resolveSecret(name);
        },
      };
    }

    return invoke(input, {
      ...context,
      ...(config !== undefined ? { config } : {}),
      ...(secrets !== undefined ? { secrets } : {}),
    });
  };
}
