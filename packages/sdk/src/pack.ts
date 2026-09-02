import type { CapabilityDefinition, DoubleInvoke, EffectClass } from './capability.js';
import type { RetryPolicy } from './graph.js';

/**
 * Capability-pack authoring.
 *
 * A capability pack groups related capabilities and contracts behind an
 * explicit, serializable manifest. The manifest contains DECLARATIONS and
 * STABLE REFERENCES only — never handlers and never resolved secret or
 * configuration values. Executable bindings are supplied separately and are
 * cross-validated against the manifest.
 *
 * Everything in this module is pure: it never imports the runtime, a UI
 * framework, or a schema library, so capability-pack authors can install
 * `@vict/sdk` alone.
 */

/** Canonical schema marker of a capability-pack manifest. */
export const CAPABILITY_PACK_SCHEMA = 'vict.capability-pack@1';

/**
 * The public Vict authoring compatibility this SDK generation speaks.
 * Pack manifests declare a range; loaders compare it against this version
 * (or the consuming runtime's version) and fail with structured
 * diagnostics on mismatch.
 */
export const VICT_AUTHORING_COMPAT_VERSION = '0.1.0';

/** Effect/ambiguity semantics declared for write-capable capabilities. */
export type PackAmbiguityPolicy = 'block' | 'keyedRetry';

export interface PackContractDeclaration {
  readonly id: string;
  readonly revision: string;
  readonly expected?: string;
}

export interface PackCapabilityDeclaration {
  readonly id: string;
  readonly revision: string;
  readonly effect: EffectClass;
  /** Declared input contract reference (exact id + revision). */
  readonly input?: { readonly contractId: string; readonly revision: string };
  /** Declared output contract reference (exact id + revision). */
  readonly output?: { readonly contractId: string; readonly revision: string };
  readonly idempotency?: 'keyed';
  /** Declared default retry policy (bounded; node declarations may only be used where compatible). */
  readonly retry?: RetryPolicy;
  /** Permission grants the capability requires. */
  readonly permissions?: readonly string[];
  /** Configuration names the capability may read (declarations, not values). */
  readonly configuration?: readonly string[];
  /** Configuration names the capability requires (must resolve at runtime). */
  readonly requiredConfiguration?: readonly string[];
  /** Secret references the capability may resolve (names, never values). */
  readonly secrets?: readonly string[];
  /** Secret references the capability requires (must resolve at runtime). */
  readonly requiredSecrets?: readonly string[];
  /** Declared timeout/ambiguity semantics for unsafe effects. */
  readonly ambiguity?: PackAmbiguityPolicy;
}

export interface PackPermissionDeclaration {
  readonly id: string;
  readonly description?: string;
}

export interface PackConfigurationDescriptor {
  readonly name: string;
  readonly required?: boolean;
  readonly description?: string;
  /** True when values are sensitive; descriptors never carry values either way. */
  readonly sensitive?: boolean;
}

/** A secret REFERENCE descriptor. Carries a name only — never a value. */
export interface PackSecretDescriptor {
  readonly name: string;
  readonly required?: boolean;
  readonly description?: string;
}

export interface PackDoubleDeclaration {
  readonly capabilityId: string;
  readonly revision: string;
  /** Modes in which the double is eligible (defaults follow runtime policy). */
  readonly modes?: readonly ('test' | 'simulate')[];
}

export interface PackEvaluation {
  readonly id: string;
  readonly capabilityId: string;
  readonly description?: string;
}

export interface PackDocumentation {
  readonly summary?: string;
}

export interface PackProvenance {
  readonly author?: string;
  readonly license?: string;
  readonly source?: string;
}

/**
 * The serializable capability-pack manifest: declarations and stable
 * references, never handlers and never resolved secret/configuration
 * values.
 */
export interface CapabilityPackManifest {
  readonly schema: typeof CAPABILITY_PACK_SCHEMA;
  /** Stable pack id (e.g. `vict.example.notes`). */
  readonly id: string;
  /** Pack semantic version. */
  readonly version: string;
  /** Declared public Vict compatibility range (e.g. `^0.1.0`). */
  readonly victCompatibility: string;
  readonly capabilities: readonly PackCapabilityDeclaration[];
  readonly contracts?: readonly PackContractDeclaration[];
  readonly permissions?: readonly PackPermissionDeclaration[];
  readonly configuration?: readonly PackConfigurationDescriptor[];
  readonly secrets?: readonly PackSecretDescriptor[];
  readonly doubles?: readonly PackDoubleDeclaration[];
  readonly evaluations?: readonly PackEvaluation[];
  readonly documentation?: PackDocumentation;
  readonly provenance?: PackProvenance;
}

/** One executable capability binding (handler + contracts), matched by id/revision. */
export interface PackCapabilityBinding {
  readonly id: string;
  readonly revision: string;
  readonly invoke: CapabilityDefinition['invoke'];
  readonly input?: CapabilityDefinition['input'];
  readonly output?: CapabilityDefinition['output'];
}

/** Executable bindings supplied separately from the manifest. */
export interface CapabilityPackBindings {
  readonly capabilities: readonly PackCapabilityBinding[];
  /** Explicit, auditable test/simulation doubles. */
  readonly doubles?: readonly {
    readonly capabilityId: string;
    readonly revision: string;
    readonly invoke: DoubleInvoke;
  }[];
}

/** A captured capability pack: frozen manifest + frozen binding structure. */
export interface CapabilityPack {
  readonly manifest: CapabilityPackManifest;
  readonly bindings: CapabilityPackBindings;
}

/** Stable pack-validation diagnostics. */
export type PackIssueCode =
  | 'PACK_UNKNOWN_FIELD'
  | 'PACK_EMPTY_ID'
  | 'PACK_INVALID_VERSION'
  | 'PACK_EMPTY_REVISION'
  | 'PACK_COMPATIBILITY_UNMET'
  | 'PACK_DUPLICATE_CAPABILITY'
  | 'PACK_DUPLICATE_CONTRACT'
  | 'PACK_DUPLICATE_PERMISSION'
  | 'PACK_DUPLICATE_CONFIGURATION'
  | 'PACK_DUPLICATE_SECRET'
  | 'PACK_DUPLICATE_DOUBLE'
  | 'PACK_DUPLICATE_EVALUATION'
  | 'PACK_MISSING_CAPABILITY'
  | 'PACK_MISSING_BINDING'
  | 'PACK_EXTRA_BINDING'
  | 'PACK_BINDING_REVISION_MISMATCH'
  | 'PACK_BINDING_EFFECT_MISMATCH'
  | 'PACK_BINDING_IDEMPOTENCY_MISMATCH'
  | 'PACK_BINDING_CONTRACT_MISMATCH'
  | 'PACK_UNKNOWN_CONTRACT_REFERENCE'
  | 'PACK_UNKNOWN_DOUBLE_TARGET'
  | 'PACK_UNKNOWN_EVALUATION_TARGET'
  | 'PACK_UNKNOWN_PERMISSION'
  | 'PACK_UNKNOWN_CONFIGURATION'
  | 'PACK_UNKNOWN_SECRET'
  | 'PACK_EMBEDDED_SECRET_VALUE'
  | 'PACK_INVALID_RETRY'
  | 'PACK_WRITE_RETRY_NOT_IDEMPOTENT'
  | 'PACK_IRREVERSIBLE_RETRY'
  | 'PACK_AMBIGUITY_NOT_DECLARED';

export interface PackIssue {
  readonly code: PackIssueCode;
  /** Framework-generated, safe-to-log message (never binding content). */
  readonly message: string;
  /** Safe definition path, e.g. `capabilities[ledger.apply]` or `secrets[token].value`. */
  readonly path?: string;
}

export type PackValidationResult =
  { readonly ok: true } | { readonly ok: false; readonly issues: readonly PackIssue[] };

export interface PackValidationOptions {
  /**
   * The Vict compatibility version to validate against. Defaults to
   * `VICT_AUTHORING_COMPAT_VERSION`; loaders pass the consuming runtime's
   * version.
   */
  readonly victVersion?: string;
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

const MANIFEST_FIELDS: ReadonlySet<string> = new Set([
  'schema',
  'id',
  'version',
  'victCompatibility',
  'capabilities',
  'contracts',
  'permissions',
  'configuration',
  'secrets',
  'doubles',
  'evaluations',
  'documentation',
  'provenance',
]);

const CAPABILITY_DECL_FIELDS: ReadonlySet<string> = new Set([
  'id',
  'revision',
  'effect',
  'input',
  'output',
  'idempotency',
  'retry',
  'permissions',
  'configuration',
  'requiredConfiguration',
  'secrets',
  'requiredSecrets',
  'ambiguity',
]);

const SECRET_DESCRIPTOR_FIELDS: ReadonlySet<string> = new Set(['name', 'required', 'description']);

const CONFIG_DESCRIPTOR_FIELDS: ReadonlySet<string> = new Set([
  'name',
  'required',
  'description',
  'sensitive',
]);

/** Closed-field helper: record unknown fields deterministically (sorted by path at the end). */
class IssueCollector {
  readonly #issues: PackIssue[] = [];

  add(code: PackIssueCode, message: string, path?: string): void {
    this.#issues.push({ code, message, ...(path !== undefined ? { path } : {}) });
  }

  /** Unknown-field diagnostics are sorted by safe path so ordering is insertion-order independent. */
  unknownFields(value: object, allowed: ReadonlySet<string>, path: string): void {
    const names = Object.keys(value)
      .filter((key) => !allowed.has(key))
      .sort();
    for (const key of names) {
      this.add(
        'PACK_UNKNOWN_FIELD',
        `Unknown field '${key}' at '${path}'; the ${path.split('.').at(-1)} schema is closed.`,
        `${path}.${key}`,
      );
    }
  }

  get issues(): readonly PackIssue[] {
    return [...this.#issues].sort((a, b) =>
      a.path === b.path ? (a.code < b.code ? -1 : 1) : (a.path ?? '') < (b.path ?? '') ? -1 : 1,
    );
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkRetry(collector: IssueCollector, retry: unknown, path: string): void {
  if (!isPlainObject(retry)) {
    collector.add('PACK_INVALID_RETRY', `Retry policy at '${path}' must be an object.`, path);
    return;
  }
  collector.unknownFields(retry, new Set(['maxAttempts', 'retryOn', 'backoff']), path);
  const backoff = retry.backoff;
  if (isPlainObject(backoff)) {
    const allowed =
      backoff.kind === 'exponential'
        ? new Set(['kind', 'initialMs', 'multiplier', 'maxMs'])
        : new Set(['kind', 'delayMs']);
    collector.unknownFields(backoff, allowed, `${path}.backoff`);
  }
}

/**
 * Evaluate a simple semver compatibility range: exact versions, `^`, `~`,
 * and comparison operators (`>=`, `<=`, `>`, `<`, `=`), possibly combined
 * with spaces (logical AND). Returns false for anything it cannot parse —
 * compatibility failures are failures.
 */
export function satisfiesCompatibilityRange(version: string, range: string): boolean {
  const parse = (input: string): [number, number, number] | undefined => {
    const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(input.trim());
    return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
  };
  const actual = parse(version);
  if (!actual) {
    return false;
  }
  const compare = (a: [number, number, number], b: [number, number, number]): number => {
    const [a0, a1, a2] = a;
    const [b0, b1, b2] = b;
    if (a0 !== b0) return a0 - b0;
    if (a1 !== b1) return a1 - b1;
    return a2 - b2;
  };
  const parts = range
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    return false;
  }
  for (const part of parts) {
    const caret = /^\^v?(\d+)\.(\d+)\.(\d+)$/.exec(part);
    const tilde = /^~v?(\d+)\.(\d+)\.(\d+)$/.exec(part);
    const op = /^(>=|<=|>|<|=)?v?(\d+)\.(\d+)\.(\d+)$/.exec(part);
    if (caret) {
      const base = parse(`${caret[1]}.${caret[2]}.${caret[3]}`);
      if (!base) {
        return false;
      }
      const upper: [number, number, number] = [Number(caret[1]) + 1, 0, 0];
      if (compare(actual, base) < 0 || compare(actual, upper) >= 0) {
        return false;
      }
    } else if (tilde) {
      const base = parse(`${tilde[1]}.${tilde[2]}.${tilde[3]}`);
      if (!base) {
        return false;
      }
      const upper: [number, number, number] = [Number(tilde[1]), Number(tilde[2]) + 1, 0];
      if (compare(actual, base) < 0 || compare(actual, upper) >= 0) {
        return false;
      }
    } else if (op) {
      const bound = parse(`${op[2]}.${op[3]}.${op[4]}`);
      if (!bound) {
        return false;
      }
      const cmp = compare(actual, bound);
      switch (op[1] ?? '=') {
        case '=':
          if (cmp !== 0) return false;
          break;
        case '>':
          if (cmp <= 0) return false;
          break;
        case '>=':
          if (cmp < 0) return false;
          break;
        case '<':
          if (cmp >= 0) return false;
          break;
        case '<=':
          if (cmp > 0) return false;
          break;
        default:
          return false;
      }
    } else {
      return false;
    }
  }
  return true;
}

/**
 * Cross-validate a capability pack: manifest schema/closedness, duplicate
 * ids, compatibility, and the manifest-to-bindings relationship (missing,
 * duplicate, extra, and revision-mismatched bindings fail deterministically).
 * Pure: no runtime, no I/O, no handler execution.
 */
export function validateCapabilityPack(
  pack: CapabilityPack,
  options: PackValidationOptions = {},
): PackValidationResult {
  const collector = new IssueCollector();
  const { manifest, bindings } = pack;
  const victVersion = options.victVersion ?? VICT_AUTHORING_COMPAT_VERSION;

  if (!isPlainObject(manifest)) {
    return {
      ok: false,
      issues: [{ code: 'PACK_EMPTY_ID', message: 'Pack manifest must be an object.' }],
    };
  }
  collector.unknownFields(manifest, MANIFEST_FIELDS, 'manifest');

  if (typeof manifest.id !== 'string' || manifest.id.length === 0) {
    collector.add('PACK_EMPTY_ID', 'Pack id must be a non-empty string.', 'manifest.id');
  }
  if (typeof manifest.version !== 'string' || manifest.version.length === 0) {
    collector.add(
      'PACK_INVALID_VERSION',
      'Pack version must be a non-empty string.',
      'manifest.version',
    );
  }
  if (!satisfiesCompatibilityRange(victVersion, manifest.victCompatibility ?? '')) {
    collector.add(
      'PACK_COMPATIBILITY_UNMET',
      `Pack requires Vict compatibility '${String(manifest.victCompatibility)}' but this Vict provides '${victVersion}'.`,
      'manifest.victCompatibility',
    );
  }

  // ---- Declared contracts --------------------------------------------
  const declaredContracts = new Map<string, string>();
  for (const contract of manifest.contracts ?? []) {
    if (typeof contract.id !== 'string' || contract.id.length === 0) {
      collector.add(
        'PACK_EMPTY_ID',
        'Declared contract id must be non-empty.',
        'manifest.contracts',
      );
      continue;
    }
    if (typeof contract.revision !== 'string' || contract.revision.length === 0) {
      collector.add(
        'PACK_EMPTY_REVISION',
        `Contract '${contract.id}' must declare a revision.`,
        `manifest.contracts.${contract.id}`,
      );
      continue;
    }
    if (declaredContracts.has(contract.id)) {
      collector.add(
        'PACK_DUPLICATE_CONTRACT',
        `Contract '${contract.id}' is declared more than once.`,
        `manifest.contracts.${contract.id}`,
      );
      continue;
    }
    declaredContracts.set(contract.id, contract.revision);
  }

  // ---- Declared permissions / configuration / secrets ------------------
  const declaredPermissions = new Set<string>();
  for (const permission of manifest.permissions ?? []) {
    if (typeof permission.id !== 'string' || permission.id.length === 0) {
      collector.add('PACK_EMPTY_ID', 'Permission id must be non-empty.', 'manifest.permissions');
      continue;
    }
    if (declaredPermissions.has(permission.id)) {
      collector.add(
        'PACK_DUPLICATE_PERMISSION',
        `Permission '${permission.id}' is declared more than once.`,
        `manifest.permissions.${permission.id}`,
      );
      continue;
    }
    declaredPermissions.add(permission.id);
  }
  const declaredConfiguration = new Map<string, { required: boolean }>();
  for (const config of manifest.configuration ?? []) {
    if (isPlainObject(config)) {
      collector.unknownFields(config, CONFIG_DESCRIPTOR_FIELDS, 'manifest.configuration');
    }
    if (typeof config.name !== 'string' || config.name.length === 0) {
      collector.add(
        'PACK_UNKNOWN_CONFIGURATION',
        'Configuration descriptor name must be non-empty.',
        'manifest.configuration',
      );
      continue;
    }
    if (declaredConfiguration.has(config.name)) {
      collector.add(
        'PACK_DUPLICATE_CONFIGURATION',
        `Configuration '${config.name}' is declared more than once.`,
        `manifest.configuration.${config.name}`,
      );
      continue;
    }
    declaredConfiguration.set(config.name, { required: config.required === true });
  }
  const declaredSecrets = new Map<string, { required: boolean }>();
  for (const secret of manifest.secrets ?? []) {
    if (isPlainObject(secret)) {
      collector.unknownFields(secret, SECRET_DESCRIPTOR_FIELDS, 'manifest.secrets');
      // A secret descriptor must never carry a value-like field under any name.
      const valueLike = Object.keys(secret).find(
        (key) => key === 'value' || key === 'secretValue' || key === 'token' || key === 'password',
      );
      if (valueLike !== undefined) {
        collector.add(
          'PACK_EMBEDDED_SECRET_VALUE',
          `Secret descriptor '${String(secret.name)}' carries a value-like field '${valueLike}'; manifests declare names, never values.`,
          `manifest.secrets.${String(secret.name)}.${valueLike}`,
        );
      }
    }
    if (typeof secret.name !== 'string' || secret.name.length === 0) {
      collector.add(
        'PACK_UNKNOWN_SECRET',
        'Secret descriptor name must be non-empty.',
        'manifest.secrets',
      );
      continue;
    }
    if (declaredSecrets.has(secret.name)) {
      collector.add(
        'PACK_DUPLICATE_SECRET',
        `Secret '${secret.name}' is declared more than once.`,
        `manifest.secrets.${secret.name}`,
      );
      continue;
    }
    declaredSecrets.set(secret.name, { required: secret.required === true });
  }

  // ---- Declared capabilities -------------------------------------------
  const declaredCapabilities = new Map<string, PackCapabilityDeclaration>();
  for (const capability of manifest.capabilities ?? []) {
    if (isPlainObject(capability)) {
      collector.unknownFields(capability, CAPABILITY_DECL_FIELDS, 'manifest.capabilities');
    }
    if (typeof capability.id !== 'string' || capability.id.length === 0) {
      collector.add(
        'PACK_EMPTY_ID',
        'Declared capability id must be non-empty.',
        'manifest.capabilities',
      );
      continue;
    }
    const capPath = `manifest.capabilities.${capability.id}`;
    if (typeof capability.revision !== 'string' || capability.revision.length === 0) {
      collector.add(
        'PACK_EMPTY_REVISION',
        `Capability '${capability.id}' must declare a revision.`,
        capPath,
      );
      continue;
    }
    if (declaredCapabilities.has(capability.id)) {
      collector.add(
        'PACK_DUPLICATE_CAPABILITY',
        `Capability '${capability.id}' is declared more than once.`,
        capPath,
      );
      continue;
    }
    declaredCapabilities.set(capability.id, capability);
    for (const ref of [
      ['input', capability.input],
      ['output', capability.output],
    ] as const) {
      const contractRef = ref[1];
      if (contractRef !== undefined) {
        const declaredRevision = declaredContracts.get(contractRef.contractId);
        if (declaredRevision === undefined) {
          collector.add(
            'PACK_UNKNOWN_CONTRACT_REFERENCE',
            `Capability '${capability.id}' ${ref[0]} references undeclared contract '${contractRef.contractId}'.`,
            `${capPath}.${ref[0]}`,
          );
        } else if (declaredRevision !== contractRef.revision) {
          collector.add(
            'PACK_BINDING_CONTRACT_MISMATCH',
            `Capability '${capability.id}' ${ref[0]} references contract '${contractRef.contractId}' revision '${contractRef.revision}' but the manifest declares '${declaredRevision}'.`,
            `${capPath}.${ref[0]}`,
          );
        }
      }
    }
    if (capability.retry !== undefined) {
      checkRetry(collector, capability.retry, `${capPath}.retry`);
      const maxAttempts = (capability.retry as { maxAttempts?: unknown }).maxAttempts;
      if (Number.isInteger(maxAttempts) && (maxAttempts as number) > 1) {
        if (capability.effect === 'irreversible') {
          collector.add(
            'PACK_IRREVERSIBLE_RETRY',
            `Irreversible capability '${capability.id}' rejects retry policies beyond one attempt.`,
            capPath,
          );
        }
        if (capability.effect === 'write' && capability.idempotency !== 'keyed') {
          collector.add(
            'PACK_WRITE_RETRY_NOT_IDEMPOTENT',
            `Write capability '${capability.id}' declares retry without keyed idempotency.`,
            capPath,
          );
        }
      }
    }
    if (
      capability.effect === 'write' &&
      capability.idempotency !== 'keyed' &&
      capability.ambiguity !== 'block'
    ) {
      collector.add(
        'PACK_AMBIGUITY_NOT_DECLARED',
        `Write capability '${capability.id}' without keyed idempotency must declare ambiguity: 'block' (ambiguous unsafe effects are never replayed).`,
        capPath,
      );
    }
    for (const permissionId of capability.permissions ?? []) {
      if (!declaredPermissions.has(permissionId)) {
        collector.add(
          'PACK_UNKNOWN_PERMISSION',
          `Capability '${capability.id}' requires undeclared permission '${permissionId}'.`,
          `${capPath}.permissions`,
        );
      }
    }
    for (const configName of capability.configuration ?? []) {
      if (!declaredConfiguration.has(configName)) {
        collector.add(
          'PACK_UNKNOWN_CONFIGURATION',
          `Capability '${capability.id}' reads undeclared configuration '${configName}'.`,
          `${capPath}.configuration`,
        );
      }
    }
    for (const configName of capability.requiredConfiguration ?? []) {
      if (!declaredConfiguration.has(configName)) {
        collector.add(
          'PACK_UNKNOWN_CONFIGURATION',
          `Capability '${capability.id}' requires undeclared configuration '${configName}'.`,
          `${capPath}.requiredConfiguration`,
        );
      }
    }
    for (const secretName of capability.secrets ?? []) {
      if (!declaredSecrets.has(secretName)) {
        collector.add(
          'PACK_UNKNOWN_SECRET',
          `Capability '${capability.id}' resolves undeclared secret '${secretName}'.`,
          `${capPath}.secrets`,
        );
      }
    }
    for (const secretName of capability.requiredSecrets ?? []) {
      if (!declaredSecrets.has(secretName)) {
        collector.add(
          'PACK_UNKNOWN_SECRET',
          `Capability '${capability.id}' requires undeclared secret '${secretName}'.`,
          `${capPath}.requiredSecrets`,
        );
      }
    }
  }

  // ---- Bindings cross-validation -----------------------------------------
  const seenBindings = new Set<string>();
  const boundIds = new Set<string>();
  for (const binding of bindings.capabilities ?? []) {
    if (typeof binding.id !== 'string' || binding.id.length === 0) {
      collector.add('PACK_EMPTY_ID', 'Binding id must be non-empty.', 'bindings.capabilities');
      continue;
    }
    const bindingPath = `bindings.capabilities.${binding.id}`;
    if (seenBindings.has(`${binding.id}@${binding.revision}`)) {
      collector.add(
        'PACK_DUPLICATE_CAPABILITY',
        `Capability '${binding.id}' revision '${binding.revision}' is bound more than once.`,
        bindingPath,
      );
      continue;
    }
    seenBindings.add(`${binding.id}@${binding.revision}`);
    const declaration = declaredCapabilities.get(binding.id);
    if (!declaration) {
      collector.add(
        'PACK_EXTRA_BINDING',
        `Binding '${binding.id}' has no manifest declaration.`,
        bindingPath,
      );
      continue;
    }
    boundIds.add(binding.id);
    if (binding.revision !== declaration.revision) {
      collector.add(
        'PACK_BINDING_REVISION_MISMATCH',
        `Binding '${binding.id}' revision '${binding.revision}' does not match declared revision '${declaration.revision}'.`,
        bindingPath,
      );
    }
    if (declaration.effect !== undefined && binding.revision === declaration.revision) {
      // Effect is declared on the manifest and NOT overridable by bindings.
      // The definition's effect is re-checked at registration time by the runtime.
    }
    if (typeof binding.invoke !== 'function') {
      collector.add(
        'PACK_MISSING_BINDING',
        `Binding '${binding.id}' must provide an invoke function.`,
        bindingPath,
      );
    }
    for (const [role, contractRef, contract] of [
      ['input', declaration.input, binding.input],
      ['output', declaration.output, binding.output],
    ] as const) {
      if (contractRef === undefined && contract !== undefined) {
        collector.add(
          'PACK_BINDING_CONTRACT_MISMATCH',
          `Binding '${binding.id}' supplies an ${role} contract the manifest does not declare.`,
          bindingPath,
        );
        continue;
      }
      if (contractRef !== undefined && contract === undefined) {
        collector.add(
          'PACK_MISSING_BINDING',
          `Binding '${binding.id}' is missing its declared ${role} contract '${contractRef.contractId}'.`,
          bindingPath,
        );
        continue;
      }
      if (
        contractRef !== undefined &&
        contract !== undefined &&
        (contract.id !== contractRef.contractId || contract.revision !== contractRef.revision)
      ) {
        collector.add(
          'PACK_BINDING_CONTRACT_MISMATCH',
          `Binding '${binding.id}' ${role} contract '${contract.id}@${contract.revision}' does not match the declared '${contractRef.contractId}@${contractRef.revision}'.`,
          bindingPath,
        );
      }
    }
  }
  for (const [id] of declaredCapabilities) {
    if (!boundIds.has(id)) {
      collector.add(
        'PACK_MISSING_BINDING',
        `Declared capability '${id}' has no binding.`,
        `bindings.capabilities.${id}`,
      );
    }
  }

  // ---- Doubles -------------------------------------------------------------
  const seenDoubles = new Set<string>();
  for (const double of bindings.doubles ?? []) {
    const doublePath = `bindings.doubles.${double.capabilityId}`;
    if (seenDoubles.has(`${double.capabilityId}@${double.revision}`)) {
      collector.add(
        'PACK_DUPLICATE_DOUBLE',
        `Double for '${double.capabilityId}@${double.revision}' is declared more than once.`,
        doublePath,
      );
      continue;
    }
    seenDoubles.add(`${double.capabilityId}@${double.revision}`);
    const declaration = declaredCapabilities.get(double.capabilityId);
    if (!declaration) {
      collector.add(
        'PACK_UNKNOWN_DOUBLE_TARGET',
        `Double targets undeclared capability '${double.capabilityId}'.`,
        doublePath,
      );
      continue;
    }
    if (double.revision !== declaration.revision) {
      collector.add(
        'PACK_BINDING_REVISION_MISMATCH',
        `Double for '${double.capabilityId}' revision '${double.revision}' does not match declared revision '${declaration.revision}'.`,
        doublePath,
      );
    }
  }
  const declaredDoubles = new Map<string, string>();
  for (const double of manifest.doubles ?? []) {
    declaredDoubles.set(double.capabilityId, double.revision);
    const bound = (bindings.doubles ?? []).some(
      (candidate) =>
        candidate.capabilityId === double.capabilityId && candidate.revision === double.revision,
    );
    if (!bound) {
      collector.add(
        'PACK_MISSING_BINDING',
        `Manifest declares a double for '${double.capabilityId}@${double.revision}' but no double binding is supplied.`,
        `manifest.doubles.${double.capabilityId}`,
      );
    }
  }
  for (const [capabilityId, revision] of declaredDoubles) {
    const declaration = declaredCapabilities.get(capabilityId);
    if (declaration && declaration.revision !== revision) {
      collector.add(
        'PACK_BINDING_REVISION_MISMATCH',
        `Manifest double for '${capabilityId}' targets revision '${revision}' but the capability declares '${declaration.revision}'.`,
        `manifest.doubles.${capabilityId}`,
      );
    }
  }

  // ---- Evaluations -----------------------------------------------------------
  for (const evaluation of manifest.evaluations ?? []) {
    if (!declaredCapabilities.has(evaluation.capabilityId)) {
      collector.add(
        'PACK_UNKNOWN_EVALUATION_TARGET',
        `Evaluation '${evaluation.id}' targets undeclared capability '${evaluation.capabilityId}'.`,
        `manifest.evaluations.${evaluation.id}`,
      );
    }
  }

  if (collector.issues.length > 0) {
    return { ok: false, issues: collector.issues };
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Factory                                                             */
/* ------------------------------------------------------------------ */

function frozenCopy<T>(value: T): T {
  if (typeof value === 'function') {
    return value;
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => frozenCopy(item))) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    // Contract-like objects (with a `parse` callable) and already-frozen
    // objects are ATOMIC: captured by reference so shared contract identity
    // is preserved exactly as authored. Frozen contracts from
    // `defineContract`/adapters therefore keep their object identity when a
    // capability definition is captured.
    const candidate = value as Record<string, unknown>;
    if (Object.isFrozen(value) || typeof candidate.parse === 'function') {
      return value;
    }
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = frozenCopy(item);
    }
    return Object.freeze(out) as unknown as T;
  }
  return value;
}

/**
 * Define a capability pack. Returns a pack whose manifest and binding
 * STRUCTURE are frozen deep copies: mutating the original manifest/binding
 * objects after definition cannot alter captured semantics. Handlers
 * (functions) are captured by reference and intentionally not cloned.
 */
export function defineCapabilityPack(
  manifest: CapabilityPackManifest,
  bindings: CapabilityPackBindings,
): CapabilityPack {
  return Object.freeze({
    manifest: frozenCopy(manifest),
    bindings: frozenCopy(bindings),
  });
}
