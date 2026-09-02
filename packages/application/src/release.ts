import type { ApplicationRelease } from '@vict/sdk';
import { satisfiesCompatibilityRange, VICT_AUTHORING_COMPAT_VERSION } from '@vict/sdk';
import { sha256 as sha256Pure } from './sha256.js';
import type { ApplicationPlan } from './compile.js';
import { stableJson } from './compile.js';

/**
 * Application Release compilation (Stage 04).
 *
 * A release binds one application version to a renderer, a component
 * registry identity, application-data adapter compatibility, public Vict
 * compatibility, and an activation reference or selection policy. Its
 * identity is DISTINCT from `applicationVersion`: changing the renderer or
 * data-adapter revision changes the release identity WITHOUT changing the
 * underlying application identity.
 *
 * Resolved secrets, timestamps, and machine-specific paths never enter the
 * canonical identity.
 */

export const RELEASE_IDENTITY_SCHEMA = 'vict.application-release-identity@1';

export type ReleaseIssueCode =
  | 'RELEASE_UNKNOWN_FIELD'
  | 'RELEASE_EMBEDDED_VALUE_FIELD'
  | 'RELEASE_EMPTY_ID'
  | 'RELEASE_EMPTY_REVISION'
  | 'RELEASE_UNKNOWN_SCHEMA'
  | 'RELEASE_APPLICATION_MISMATCH'
  | 'RELEASE_COMPATIBILITY_UNPARSEABLE'
  | 'RELEASE_COMPATIBILITY_UNMET'
  | 'RELEASE_PROVENANCE_UNSAFE';

export interface ReleaseIssue {
  readonly code: ReleaseIssueCode;
  readonly message: string;
  readonly path?: string;
}

const RELEASE_FIELDS: ReadonlySet<string> = new Set([
  'schema',
  'applicationId',
  'applicationRevision',
  'applicationVersion',
  'renderer',
  'components',
  'dataAdapter',
  'victCompatibility',
  'activation',
  'provenance',
]);
const RENDERER_FIELDS: ReadonlySet<string> = new Set(['id', 'revision']);
const COMPONENTS_FIELDS: ReadonlySet<string> = new Set(['registryId', 'revision', 'components']);
const DATA_ADAPTER_FIELDS: ReadonlySet<string> = new Set(['id', 'revision']);
const PROVENANCE_FIELDS: ReadonlySet<string> = new Set(['author', 'source']);
const VALUE_LIKE: ReadonlySet<string> = new Set([
  'secrets',
  'secret',
  'secretValue',
  'configuration',
  'config',
  'credentials',
  'password',
  'token',
  'apiKey',
  'buildPath',
  'machinePath',
]);

export type CompileReleaseResult =
  | { readonly ok: true; readonly release: FrozenApplicationRelease }
  | { readonly ok: false; readonly issues: readonly ReleaseIssue[] };

/** The validated, frozen release manifest with its deterministic identity. */
export interface FrozenApplicationRelease {
  readonly manifest: Readonly<ApplicationRelease>;
  /** Deterministic release identity — distinct from applicationVersion. */
  readonly releaseVersion: string;
}

/**
 * `releaseVersion` = hash(canonical release manifest under a versioned
 * schema marker). Deterministic across processes; independent of insertion
 * order, timestamps, machine paths, and resolved secrets.
 */
export function computeReleaseVersion(release: ApplicationRelease): string {
  return `v1_${sha256(stableJson({ schema: RELEASE_IDENTITY_SCHEMA, release }))}`;
}

function sha256(payload: string): string {
  return sha256Pure(payload);
}

/**
 * Validate one release against its compiled plan: binding consistency,
 * closed schema, and safe provenance. Never throws for invalid releases.
 */
export function compileApplicationRelease(
  release: ApplicationRelease,
  plan: ApplicationPlan,
): CompileReleaseResult {
  const issues: ReleaseIssue[] = [];
  const check = (
    condition: unknown,
    code: ReleaseIssueCode,
    message: string,
    path?: string,
  ): void => {
    if (!condition) {
      issues.push({ code, message, ...(path !== undefined ? { path } : {}) });
    }
  };

  if (!release || typeof release !== 'object') {
    return {
      ok: false,
      issues: [{ code: 'RELEASE_UNKNOWN_SCHEMA', message: 'Release must be an object.' }],
    };
  }
  for (const key of Object.keys(release)
    .filter((key) => !RELEASE_FIELDS.has(key))
    .sort()) {
    if (VALUE_LIKE.has(key)) {
      issues.push({
        code: 'RELEASE_EMBEDDED_VALUE_FIELD',
        message: `Field '${key}' looks like an embedded configuration/secret value; releases declare references only.`,
        path: `release.${key}`,
      });
      continue;
    }
    issues.push({
      code: 'RELEASE_UNKNOWN_FIELD',
      message: `Unknown field '${key}' at 'release': the release schema is closed.`,
      path: `release.${key}`,
    });
  }

  check(
    release.schema === 'vict.application-release@1',
    'RELEASE_UNKNOWN_SCHEMA',
    `Release schema '${String(release.schema)}' is not supported.`,
    'release.schema',
  );
  check(
    typeof release.applicationId === 'string' && release.applicationId.length > 0,
    'RELEASE_EMPTY_ID',
    'Release applicationId must be a non-empty string.',
    'release.applicationId',
  );
  check(
    typeof release.applicationRevision === 'string' && release.applicationRevision.length > 0,
    'RELEASE_EMPTY_REVISION',
    'Release applicationRevision must be a non-empty string.',
    'release.applicationRevision',
  );
  check(
    typeof release.applicationVersion === 'string' && release.applicationVersion.length > 0,
    'RELEASE_EMPTY_ID',
    'Release applicationVersion must be a non-empty string.',
    'release.applicationVersion',
  );

  // The release must bind EXACTLY the compiled plan.
  check(
    release.applicationId === plan.applicationId &&
      release.applicationRevision === plan.applicationRevision &&
      release.applicationVersion === plan.applicationVersion,
    'RELEASE_APPLICATION_MISMATCH',
    `Release binds application '${String(release.applicationId)}@${String(release.applicationRevision)}' version '${String(release.applicationVersion)}' but the compiled plan is '${plan.applicationId}@${plan.applicationRevision}' version '${plan.applicationVersion}'.`,
    'release.applicationVersion',
  );

  // Renderer binding.
  const renderer = release.renderer;
  check(
    renderer !== undefined && typeof renderer === 'object',
    'RELEASE_EMPTY_ID',
    'Release must declare a renderer binding.',
    'release.renderer',
  );
  if (renderer !== undefined && typeof renderer === 'object') {
    for (const key of Object.keys(renderer).filter((key) => !RENDERER_FIELDS.has(key))) {
      issues.push({
        code: 'RELEASE_UNKNOWN_FIELD',
        message: `Unknown field '${key}' at 'release.renderer'.`,
        path: `release.renderer.${key}`,
      });
    }
    check(
      typeof renderer.id === 'string' && renderer.id.length > 0,
      'RELEASE_EMPTY_ID',
      'Renderer id must be a non-empty string.',
      'release.renderer.id',
    );
    check(
      typeof renderer.revision === 'string' && renderer.revision.length > 0,
      'RELEASE_EMPTY_REVISION',
      'Renderer revision must be a non-empty string.',
      'release.renderer.revision',
    );
  }

  // Component registry identity (optional).
  const components = release.components;
  if (components !== undefined) {
    for (const key of Object.keys(components).filter((key) => !COMPONENTS_FIELDS.has(key))) {
      issues.push({
        code: 'RELEASE_UNKNOWN_FIELD',
        message: `Unknown field '${key}' at 'release.components'.`,
        path: `release.components.${key}`,
      });
    }
    check(
      typeof components.registryId === 'string' && components.registryId.length > 0,
      'RELEASE_EMPTY_ID',
      'Component registry id must be a non-empty string.',
      'release.components.registryId',
    );
    check(
      typeof components.revision === 'string' && components.revision.length > 0,
      'RELEASE_EMPTY_REVISION',
      'Component registry revision must be a non-empty string.',
      'release.components.revision',
    );
  }

  // Data-adapter compatibility.
  const dataAdapter = release.dataAdapter;
  check(
    dataAdapter !== undefined && typeof dataAdapter === 'object',
    'RELEASE_EMPTY_ID',
    'Release must declare application-data adapter compatibility.',
    'release.dataAdapter',
  );
  if (dataAdapter !== undefined && typeof dataAdapter === 'object') {
    for (const key of Object.keys(dataAdapter).filter((key) => !DATA_ADAPTER_FIELDS.has(key))) {
      issues.push({
        code: 'RELEASE_UNKNOWN_FIELD',
        message: `Unknown field '${key}' at 'release.dataAdapter'.`,
        path: `release.dataAdapter.${key}`,
      });
    }
    check(
      typeof dataAdapter.id === 'string' && dataAdapter.id.length > 0,
      'RELEASE_EMPTY_ID',
      'Data adapter id must be a non-empty string.',
      'release.dataAdapter.id',
    );
    check(
      typeof dataAdapter.revision === 'string' && dataAdapter.revision.length > 0,
      'RELEASE_EMPTY_REVISION',
      'Data adapter revision must be a non-empty string.',
      'release.dataAdapter.revision',
    );
  }

  // Compatibility range must be parseable AND satisfiable by this Vict.
  check(
    typeof release.victCompatibility === 'string' && release.victCompatibility.length > 0,
    'RELEASE_EMPTY_ID',
    'Release Vict compatibility must be a non-empty range string.',
    'release.victCompatibility',
  );
  if (typeof release.victCompatibility === 'string' && release.victCompatibility.length > 0) {
    const parseable = /^[v^~>=<.\d\s]+$/.test(release.victCompatibility);
    if (!parseable) {
      issues.push({
        code: 'RELEASE_COMPATIBILITY_UNPARSEABLE',
        message: `Release Vict compatibility '${release.victCompatibility}' is not a supported range.`,
        path: 'release.victCompatibility',
      });
    } else if (
      !satisfiesCompatibilityRange(VICT_AUTHORING_COMPAT_VERSION, release.victCompatibility)
    ) {
      issues.push({
        code: 'RELEASE_COMPATIBILITY_UNMET',
        message: `Release requires Vict '${release.victCompatibility}' but this Vict provides '${VICT_AUTHORING_COMPAT_VERSION}'.`,
        path: 'release.victCompatibility',
      });
    }
  }

  // Activation binding: exact reference or explicit policy — never embedded values.
  const activation = release.activation;
  check(
    activation !== undefined && typeof activation === 'object',
    'RELEASE_EMPTY_ID',
    'Release must declare an activation reference or selection policy.',
    'release.activation',
  );
  if (activation !== undefined && typeof activation === 'object') {
    if (activation.kind === 'reference') {
      check(
        typeof activation.activationVersion === 'string' && activation.activationVersion.length > 0,
        'RELEASE_EMPTY_ID',
        'Activation reference must carry a non-empty activationVersion.',
        'release.activation.activationVersion',
      );
    } else if (activation.kind === 'policy') {
      check(
        activation.selection === 'latest',
        'RELEASE_UNKNOWN_FIELD',
        `Activation selection '${String((activation as { selection?: unknown }).selection)}' is not supported.`,
        'release.activation.selection',
      );
    } else {
      issues.push({
        code: 'RELEASE_UNKNOWN_FIELD',
        message: `Activation kind '${String((activation as { kind?: unknown }).kind)}' is not supported.`,
        path: 'release.activation.kind',
      });
    }
  }

  // Provenance: safe fields only — never secrets, timestamps, or machine paths.
  const provenance = release.provenance;
  if (provenance !== undefined) {
    for (const key of Object.keys(provenance)) {
      if (!PROVENANCE_FIELDS.has(key)) {
        issues.push({
          code: VALUE_LIKE.has(key) ? 'RELEASE_EMBEDDED_VALUE_FIELD' : 'RELEASE_UNKNOWN_FIELD',
          message: `Field '${key}' at 'release.provenance' is not a safe provenance field.`,
          path: `release.provenance.${key}`,
        });
      }
    }
  }

  if (issues.length > 0) {
    issues.sort((a, b) =>
      (a.path ?? '') === (b.path ?? '')
        ? a.code < b.code
          ? -1
          : 1
        : (a.path ?? '') < (b.path ?? '')
          ? -1
          : 1,
    );
    return { ok: false, issues };
  }

  const manifest = deepFreeze(release);
  return {
    ok: true,
    release: Object.freeze({ manifest, releaseVersion: computeReleaseVersion(manifest) }),
  };
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    for (const item of value) {
      deepFreeze(item);
    }
    Object.freeze(value);
    return value;
  }
  if (value !== null && typeof value === 'object') {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}
