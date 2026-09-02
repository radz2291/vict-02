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

/** Readable authoring names for one capability. */
interface DeclaredNames {
  readonly permissions: readonly string[];
  readonly configuration: readonly string[];
  readonly requiredConfiguration: readonly string[];
  readonly secrets: readonly string[];
  readonly requiredSecrets: readonly string[];
}

function declaredNamesOf(definition: CapabilityDefinition): DeclaredNames {
  return {
    permissions: definition.permissions ?? [],
    configuration: definition.configuration ?? [],
    requiredConfiguration: definition.requiredConfiguration ?? [],
    secrets: definition.secrets ?? [],
    requiredSecrets: definition.requiredSecrets ?? [],
  };
}

/**
 * Wrap a capability's invoke with the least-authority gate. The WRAPPED
 * invoke is what the registry stores and what activations capture, so the
 * gate is enforced identically by the sequential and the durable engines.
 */
export function gateCapabilityInvoke(
  definition: CapabilityDefinition,
  authority: CapabilityAuthority = {},
): CapabilityDefinition['invoke'] {
  const names = declaredNamesOf(definition);
  const invoke = definition.invoke;
  const grants = new Set(authority.grants ?? []);
  const configNames = new Set([...names.configuration, ...names.requiredConfiguration]);
  const secretNames = new Set([...names.secrets, ...names.requiredSecrets]);

  return async (input: unknown, context: CapabilityContext): Promise<unknown> => {
    // ---- Permission gate: fail BEFORE the handler runs -------------------
    for (const permissionId of names.permissions) {
      if (!grants.has(permissionId)) {
        throw new VictRuntimeError(
          'VICT_RUNTIME_PERMISSION_DENIED',
          `Permission '${permissionId}' required by capability '${definition.id}' is not granted in this runtime; the handler was not invoked.`,
          { capabilityId: definition.id, permissionId },
        );
      }
    }

    // ---- Eager required configuration/secret resolution ------------------
    for (const name of names.requiredConfiguration) {
      if (authority.configuration === undefined) {
        throw new VictRuntimeError(
          'VICT_RUNTIME_CONFIGURATION_UNAVAILABLE',
          `Configuration '${name}' required by capability '${definition.id}' is unavailable: no configuration provider is configured.`,
          { capabilityId: definition.id, configurationName: name },
        );
      }
      const value = authority.configuration.get(name);
      if (value === undefined) {
        throw new VictRuntimeError(
          'VICT_RUNTIME_CONFIGURATION_UNAVAILABLE',
          `Configuration '${name}' required by capability '${definition.id}' is not provisioned.`,
          { capabilityId: definition.id, configurationName: name },
        );
      }
    }
    for (const name of names.requiredSecrets) {
      if (authority.secrets === undefined) {
        throw new VictRuntimeError(
          'VICT_RUNTIME_SECRET_UNAVAILABLE',
          `Secret '${name}' required by capability '${definition.id}' is unavailable: no secret port is configured.`,
          { capabilityId: definition.id, secretName: name },
        );
      }
      const value = await authority.secrets.get(name);
      if (value === undefined) {
        throw new VictRuntimeError(
          'VICT_RUNTIME_SECRET_UNAVAILABLE',
          `Secret '${name}' required by capability '${definition.id}' is not provisioned.`,
          { capabilityId: definition.id, secretName: name },
        );
      }
    }

    // ---- Scoped, name-checked readers ------------------------------------
    let config: CapabilityConfigReader | undefined;
    if (authority.configuration !== undefined && configNames.size > 0) {
      const provider = authority.configuration;
      config = {
        get(name: string): unknown {
          if (!configNames.has(name)) {
            throw new VictRuntimeError(
              'VICT_RUNTIME_CONFIGURATION_UNAVAILABLE',
              `Configuration '${name}' is not declared by capability '${definition.id}'; undeclared configuration is unavailable.`,
              { capabilityId: definition.id, configurationName: name },
            );
          }
          return provider.get(name);
        },
      };
    }
    let secrets: CapabilitySecretReader | undefined;
    if (authority.secrets !== undefined && secretNames.size > 0) {
      const port = authority.secrets;
      secrets = {
        get(name: string): Promise<string | undefined> {
          if (!secretNames.has(name)) {
            return Promise.reject(
              new VictRuntimeError(
                'VICT_RUNTIME_SECRET_UNAVAILABLE',
                `Secret '${name}' is not declared by capability '${definition.id}'; undeclared secrets are unavailable.`,
                { capabilityId: definition.id, secretName: name },
              ),
            );
          }
          return port.get(name);
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
