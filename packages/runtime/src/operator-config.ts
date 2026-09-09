/**
 * Stage 07A work item 6 — the bounded protected operator-configuration
 * resolution foundation (pre-Quellight).
 *
 * Quellight (Stage 07B+) will need to configure one pinned model-provider
 * profile, store locations, and retention bounds through operator
 * configuration. This module is the VICT-side FOUNDATION for that
 * composition: typed resolution, name-pattern validation, and fail-closed
 * credential handling — extending the Verified Stage 06A
 * `protectCredentialPort`/`requireCredential` discipline (MSTR-011) to
 * product-facing operator configuration.
 *
 * Scope guard (handoff work item 6): this is resolution types, a loader,
 * validation, and tests ONLY. It is NOT a real provider integration, NOT a
 * live-provider wrapper, and NOT any Quellight product code. No generalized
 * secrets-management platform is created.
 *
 * Protected-credential discipline (SEC-003, MSTR-011, AI-004):
 * - the operator configuration carries the provider credential VARIABLE
 *   NAME (`credentialVar`) — NEVER a credential value;
 * - credential VALUES enter only through `requireOperatorCredential`,
 *   which resolves just-in time from the operator-provided environment
 *   source and is never cached, logged, serialized, or persisted;
 * - failures are stable and non-echoing: no provider content, no
 *   environment content, and no credential value can enter an error, a
 *   diagnostic, or the serialized configuration;
 * - the serialized configuration surface (`serializeOperatorConfiguration`)
 *   is structural: a configuration object HAS no credential-value field, so
 *   no serialization path can leak one.
 */

import { protectCredentialPort } from './agent-governance.js';
import type { AgentCredentialPort } from './agent-types.js';

/** The closed schema marker of the operator configuration foundation. */
export const OPERATOR_CONFIG_SCHEMA = 'vict.operator-config@1' as const;

/** Stable non-echoing operator-configuration failure codes. */
export type OperatorConfigErrorCode =
  'VICT_OPERATOR_CONFIG_INVALID' | 'VICT_OPERATOR_CREDENTIAL_UNAVAILABLE';

/** Error thrown for operator-configuration failures (stable, non-echoing). */
export class OperatorConfigError extends Error {
  readonly code: OperatorConfigErrorCode;

  constructor(code: OperatorConfigErrorCode, message: string) {
    super(message);
    this.name = 'OperatorConfigError';
    this.code = code;
  }
}

/** Error thrown when a required operator credential cannot be resolved. */
export class OperatorCredentialUnavailableError extends OperatorConfigError {
  /** The credential VARIABLE NAME (never a value, never provider content). */
  readonly credentialName: string;

  constructor(credentialName: string) {
    super(
      'VICT_OPERATOR_CREDENTIAL_UNAVAILABLE',
      `Credential '${credentialName}' could not be resolved through the protected operator configuration.`,
    );
    this.name = 'OperatorCredentialUnavailableError';
    this.credentialName = credentialName;
  }
}

/** Bounded identifier: the same accepted ID discipline as the runtime. */
const ID_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const MAX_ID_LENGTH = 128;

/** Environment-variable NAME pattern (never a value): `OPENAI_API_KEY`. */
const CREDENTIAL_VAR_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const MAX_CREDENTIAL_VAR_LENGTH = 128;

/** Model-router intent string: `provider/model`, both bounded identifiers. */
const ROUTER_MODEL_PATTERN =
  /^[a-z][a-z0-9-]*(?:[.-][a-z0-9]+)*\/[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const MAX_ROUTER_MODEL_LENGTH = 200;

/** Relative store-location discipline: bounded POSIX-style relative path. */
const STORE_PATH_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,500}$/;
const MAX_STORE_PATH_LENGTH = 512;

/** One validated provider-profile selection (credential NAME only). */
export interface ProviderProfileSelection {
  /** Stable profile ID (the pinned preferred profile; rotation deferred, OQ4). */
  readonly profileId: string;
  /** Provider identifier intent (e.g. `offline-fixture`). */
  readonly provider: string;
  /** The pinned model-router intent string (`provider/model`). */
  readonly routerModel: string;
  /** The provider credential ENVIRONMENT-VARIABLE NAME — never a value. */
  readonly credentialVar: string;
}

/** Validated store locations (bounded relative paths; never URLs). */
export interface StoreLocationPlan {
  /** VICT operational store location, when configured. */
  readonly operationalStorePath?: string;
  /** VICT application-domain store location, when configured. */
  readonly applicationStorePath?: string;
  /** Dedicated Mastra store location, when configured. */
  readonly mastraStorePath?: string;
}

/** Validated retention bounds (positive finite safe integer milliseconds). */
export interface RetentionBounds {
  /** Conversation-message retention bound, when configured. */
  readonly messagesMaxAgeMs?: number;
  /** Thread retention bound, when configured. */
  readonly threadsMaxAgeMs?: number;
  /** Observability-span retention bound, when configured. */
  readonly spansMaxAgeMs?: number;
}

/** One resolved, frozen operator configuration. */
export interface OperatorConfiguration {
  readonly schema: typeof OPERATOR_CONFIG_SCHEMA;
  readonly profile: ProviderProfileSelection;
  readonly stores: StoreLocationPlan;
  readonly retention: RetentionBounds;
}

/** The operator input for one profile selection (credential NAME only). */
export interface OperatorProfileInput {
  readonly profileId: unknown;
  readonly provider: unknown;
  readonly routerModel: unknown;
  readonly credentialVar: unknown;
}

/** The operator input for store locations. */
export interface OperatorStoresInput {
  readonly operationalStorePath?: unknown;
  readonly applicationStorePath?: unknown;
  readonly mastraStorePath?: unknown;
}

/** The operator input for retention bounds. */
export interface OperatorRetentionInput {
  readonly messagesMaxAgeMs?: unknown;
  readonly threadsMaxAgeMs?: unknown;
  readonly spansMaxAgeMs?: unknown;
}

/** The operator configuration input document. */
export interface OperatorConfigInput {
  readonly profile: unknown;
  readonly stores?: unknown;
  readonly retention?: unknown;
}

function invalid(reason: string): never {
  // The reason is a FIXED structural description — never operator content.
  throw new OperatorConfigError('VICT_OPERATOR_CONFIG_INVALID', reason);
}

/** Require a bounded identifier string. */
function requireId(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_ID_LENGTH) {
    invalid(`${field} must be a bounded non-empty identifier string`);
  }
  if (!ID_PATTERN.test(value)) {
    invalid(`${field} must match the bounded VICT identifier pattern`);
  }
  return value;
}

/** Require an environment-variable NAME (credential values are unnameable). */
function requireCredentialVar(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_CREDENTIAL_VAR_LENGTH ||
    !CREDENTIAL_VAR_PATTERN.test(value)
  ) {
    invalid('credentialVar must be an environment-variable NAME matching [A-Za-z_][A-Za-z0-9_]*');
  }
  return value;
}

/** Require a bounded `provider/model` router intent string. */
function requireRouterModel(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_ROUTER_MODEL_LENGTH ||
    !ROUTER_MODEL_PATTERN.test(value)
  ) {
    invalid('routerModel must be a bounded provider/model intent string');
  }
  return value;
}

/** Require an optional bounded relative store path (never a URL). */
function requireOptionalStorePath(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_STORE_PATH_LENGTH ||
    value.includes('://') ||
    value.includes('\\') ||
    value.includes('//') ||
    !STORE_PATH_PATTERN.test(value) ||
    value.includes('..')
  ) {
    invalid(`${field} must be a bounded relative store path without URL schemes or traversal`);
  }
  return value;
}

/** Require an optional positive-finite-safe-integer millisecond bound. */
function requireOptionalRetentionMs(value: unknown, field: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    invalid(`${field} must be a positive safe-integer millisecond bound`);
  }
  return value;
}

/**
 * Require the input document to be a PLAIN canonical object with EXACTLY
 * the accepted field set: own enumerable string-keyed DATA properties,
 * `Object.prototype` or null prototype, no symbol keys. Unknown fields are
 * rejected (fail closed) — a configuration can never smuggle, for example,
 * a `credential` or `apiKey` VALUE field past this boundary.
 */
function requirePlainObjectWithFields(
  value: unknown,
  what: string,
  acceptedFields: readonly string[],
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    invalid(`${what} must be a plain object`);
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    invalid(`${what} must have Object.prototype or a null prototype`);
  }
  const ownKeys = Reflect.ownKeys(value);
  for (const key of ownKeys) {
    if (typeof key !== 'string') {
      invalid(`${what} must not carry symbol-keyed fields`);
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) {
      invalid(`${what} structure could not be proven`);
    }
    if (
      !Object.prototype.propertyIsEnumerable.call(value, key) ||
      descriptor!.get ||
      descriptor!.set
    ) {
      invalid(`${what} fields must be own enumerable data properties`);
    }
  }
  for (const key of ownKeys as string[]) {
    if (!acceptedFields.includes(key)) {
      invalid(`${what} carries an unknown field (closed field set)`);
    }
  }
  return value as Record<string, unknown>;
}

/**
 * Resolve one provider-profile selection. Only the credential VARIABLE
 * NAME is accepted; any value-shaped attempt is a structural rejection.
 */
export function resolveProviderProfileSelection(input: unknown): ProviderProfileSelection {
  const record = requirePlainObjectWithFields(input, 'profile', [
    'profileId',
    'provider',
    'routerModel',
    'credentialVar',
  ]);
  const selection: ProviderProfileSelection = Object.freeze({
    profileId: requireId(record.profileId, 'profile.profileId'),
    provider: requireId(record.provider, 'profile.provider'),
    routerModel: requireRouterModel(record.routerModel),
    credentialVar: requireCredentialVar(record.credentialVar),
  });
  return selection;
}

/** Resolve the store-location plan. */
export function resolveStoreLocationPlan(input: unknown): StoreLocationPlan {
  const record = requirePlainObjectWithFields(input, 'stores', [
    'operationalStorePath',
    'applicationStorePath',
    'mastraStorePath',
  ]);
  return Object.freeze({
    operationalStorePath: requireOptionalStorePath(
      record.operationalStorePath,
      'stores.operationalStorePath',
    ),
    applicationStorePath: requireOptionalStorePath(
      record.applicationStorePath,
      'stores.applicationStorePath',
    ),
    mastraStorePath: requireOptionalStorePath(record.mastraStorePath, 'stores.mastraStorePath'),
  });
}

/** Resolve the retention bounds. */
export function resolveRetentionBounds(input: unknown): RetentionBounds {
  const record = requirePlainObjectWithFields(input, 'retention', [
    'messagesMaxAgeMs',
    'threadsMaxAgeMs',
    'spansMaxAgeMs',
  ]);
  return Object.freeze({
    messagesMaxAgeMs: requireOptionalRetentionMs(
      record.messagesMaxAgeMs,
      'retention.messagesMaxAgeMs',
    ),
    threadsMaxAgeMs: requireOptionalRetentionMs(
      record.threadsMaxAgeMs,
      'retention.threadsMaxAgeMs',
    ),
    spansMaxAgeMs: requireOptionalRetentionMs(record.spansMaxAgeMs, 'retention.spansMaxAgeMs'),
  });
}

/**
 * Resolve the complete operator configuration from operator-supplied
 * configuration data. Credential VALUES are structurally absent: the
 * result carries the credential VARIABLE NAME only.
 */
export function resolveOperatorConfiguration(input: OperatorConfigInput): OperatorConfiguration {
  const document = requirePlainObjectWithFields(input, 'operator configuration', [
    'profile',
    'stores',
    'retention',
  ]);
  const profile = resolveProviderProfileSelection(document.profile);
  const stores =
    document.stores === undefined
      ? (Object.freeze({}) as StoreLocationPlan)
      : resolveStoreLocationPlan(document.stores);
  const retention =
    document.retention === undefined
      ? (Object.freeze({}) as RetentionBounds)
      : resolveRetentionBounds(document.retention);
  return Object.freeze({
    schema: OPERATOR_CONFIG_SCHEMA,
    profile,
    stores,
    retention,
  });
}

/**
 * The deterministic, safe serialization surface of an operator
 * configuration. Because the configuration object structurally HAS no
 * credential-value field, no serialization of it can leak a credential
 * value. The serialization is canonical (sorted keys) and bounded.
 */
export function serializeOperatorConfiguration(config: OperatorConfiguration): string {
  if (config.schema !== OPERATOR_CONFIG_SCHEMA) {
    invalid('operator configuration carries an unknown schema marker');
  }
  const ordered = {
    profile: {
      credentialVar: config.profile.credentialVar,
      profileId: config.profile.profileId,
      provider: config.profile.provider,
      routerModel: config.profile.routerModel,
    },
    retention: { ...config.retention },
    schema: config.schema,
    stores: { ...config.stores },
  };
  return JSON.stringify(ordered);
}

/** The minimal environment source: a credential VARIABLE NAME → value read. */
export type OperatorCredentialEnvironment =
  AgentCredentialPort | Record<string, string | undefined>;

function asCredentialPort(environment: OperatorCredentialEnvironment): AgentCredentialPort {
  if (typeof (environment as AgentCredentialPort).get === 'function') {
    return protectCredentialPort(environment as AgentCredentialPort);
  }
  const record = environment as Record<string, string | undefined>;
  return protectCredentialPort({
    async get(name: string): Promise<string | undefined> {
      return record[name];
    },
  });
}

/**
 * Resolve the REQUIRED provider credential just in time through the
 * protected discipline: the value is read from the operator-provided
 * environment source, never cached, never logged, never serialized, and a
 * missing value fails closed with the stable non-echoing
 * `VICT_OPERATOR_CREDENTIAL_UNAVAILABLE` code. The error carries the
 * credential VARIABLE NAME only — never a value, never environment
 * content.
 */
export async function requireOperatorCredential(
  config: OperatorConfiguration,
  environment: OperatorCredentialEnvironment,
): Promise<string> {
  const port = asCredentialPort(environment);
  // Protected resolution: provider failures collapse to `undefined` (never
  // propagated provider content), then the value passes the same
  // just-in-time, non-caching, non-echoing requirement as every other
  // protected credential read. The failure carries the credential VARIABLE
  // NAME only.
  const value = await port.get(config.profile.credentialVar).catch(() => undefined);
  if (value === undefined || typeof value !== 'string') {
    throw new OperatorCredentialUnavailableError(config.profile.credentialVar);
  }
  return value;
}
