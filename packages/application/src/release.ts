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
  | 'RELEASE_INVALID_IDENTIFIER'
  | 'RELEASE_UNKNOWN_SCHEMA'
  | 'RELEASE_BINDING_CONTEXT_REQUIRED'
  | 'RELEASE_APPLICATION_MISMATCH'
  | 'RELEASE_RENDERER_MISMATCH'
  | 'RELEASE_COMPONENT_REGISTRY_MISMATCH'
  | 'RELEASE_COMPONENT_MISMATCH'
  | 'RELEASE_DATA_ADAPTER_MISMATCH'
  | 'RELEASE_ACTIVATION_MISMATCH'
  | 'RELEASE_COMPATIBILITY_UNPARSEABLE'
  | 'RELEASE_COMPATIBILITY_UNMET'
  | 'RELEASE_COMPILATION_FAILED'
  | 'RELEASE_PROVENANCE_UNSAFE';

/**
 * The ACTUAL supplied bindings a release is cross-checked against
 * (MED-04-G remediation; RE-AUDIT MED-04-G-R correction): renderer identity,
 * component-registry identity with its exact component list,
 * application-data adapter identity, and the activation identity currently
 * selected (when the release references an exact activation). A release
 * must compile against these real identities, not merely its own
 * self-declared text.
 *
 * MANDATORY binding context (RE-AUDIT MED-04-G-R) — TRUST BOUNDARY:
 *
 * - Release manifest declarations are NOT trusted as proof of deployed
 *   identity. They are the author's CLAIMS only.
 * - Deployment composition MUST obtain context descriptors from the actual
 *   selected objects: the renderer instance, the component-registry
 *   identity snapshot (`registry.identity()`), the application-data adapter
 *   instance, and the activation selection result.
 * - Callers MUST NOT construct the verification context by copying values
 *   back out of the release manifest — that would verify the manifest
 *   against itself.
 * - VICT verifies EQUALITY against the supplied binding snapshots; it
 *   cannot prove that buggy or hostile deployment tooling supplied
 *   truthful snapshots. This boundary is documented and accepted; the
 *   canonical Stage 04 proof sources its descriptors from the actual
 *   renderer, registry, adapter, and activation objects.
 *
 * Requirement rules (fail closed):
 * - `renderer` and `dataAdapter` are ALWAYS required: every valid release
 *   declares a renderer and a data-adapter binding, so their actual
 *   identities must always be supplied and cross-checked.
 * - `componentRegistry` is required whenever the release declares a
 *   component-registry binding (`release.components`).
 * - `selectedActivationVersion` is required when the release binds an exact
 *   activation reference (`kind: 'reference'`). Activation SELECTION
 *   POLICIES (e.g. `latest`) intentionally defer selection; no exact
 *   activation requirement is fabricated for them.
 * - An omitted, partial, or invalid context fails closed with the stable
 *   `RELEASE_BINDING_CONTEXT_REQUIRED` diagnostic — never a misleading
 *   mismatch code, and never a silent compile.
 */
export interface CompileReleaseContext {
  /** The ACTUAL renderer selected by this deployment (always required). */
  readonly renderer: { readonly id: string; readonly revision: string };
  /**
   * The ACTUAL component-registry identity snapshot (required whenever the
   * release declares a component-registry binding).
   */
  readonly componentRegistry?: {
    readonly registryId: string;
    readonly revision: string;
    readonly components: readonly { readonly componentId: string; readonly revision: string }[];
  };
  /** The ACTUAL application-data adapter (always required). */
  readonly dataAdapter: { readonly id: string; readonly revision: string };
  /**
   * The activation version this deployment ACTUALLY selected (required for
   * exact activation references).
   */
  readonly selectedActivationVersion?: string;
}

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
 *
 * `context` is a MANDATORY, explicitly supplied argument (RE-AUDIT
 * MED-04-G-R): an omitted, partial, or invalid context fails closed with
 * the stable `RELEASE_BINDING_CONTEXT_REQUIRED` diagnostic instead of
 * compiling self-declared bindings. See `CompileReleaseContext` for the
 * descriptor trust boundary.
 */
export function compileApplicationRelease(
  release: ApplicationRelease,
  plan: ApplicationPlan,
  context: CompileReleaseContext,
): CompileReleaseResult {
  // Compilation NEVER throws for invalid releases (LOW-04-B): hostile
  // getters, proxies, invalid prototypes, and unsupported values are
  // converted into structured safe diagnostics.
  try {
    return compileReleaseChecked(release, plan, context);
  } catch {
    return {
      ok: false,
      issues: [
        {
          code: 'RELEASE_COMPILATION_FAILED',
          message:
            'The release could not be processed (hostile getter, proxy, or invalid prototype); compilation fails safely with this structured diagnostic.',
        },
      ],
    };
  }
}

function compileReleaseChecked(
  release: ApplicationRelease,
  plan: ApplicationPlan,
  context: CompileReleaseContext,
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

  // ---- Mandatory binding context (RE-AUDIT MED-04-G-R) -------------------
  // The context is an explicitly supplied argument and is validated FIRST,
  // fail-closed: an omitted, partial, or invalid context produces the stable
  // RELEASE_BINDING_CONTEXT_REQUIRED diagnostic (never a misleading
  // mismatch code, never a silent compile, and no echo of hostile values).
  const binding = validateBindingContext(release, context);
  if (!binding.ok) {
    return { ok: false, issues: binding.issues };
  }
  const bindingContext = binding.value;

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
    if (
      typeof renderer.id === 'string' &&
      renderer.id.length > 0 &&
      renderer.id.trim().length === 0
    ) {
      issues.push({
        code: 'RELEASE_INVALID_IDENTIFIER',
        message: 'Renderer id must not be whitespace-only.',
        path: 'release.renderer.id',
      });
    }
    check(
      typeof renderer.revision === 'string' && renderer.revision.length > 0,
      'RELEASE_EMPTY_REVISION',
      'Renderer revision must be a non-empty string.',
      'release.renderer.revision',
    );
    if (
      typeof renderer.revision === 'string' &&
      renderer.revision.length > 0 &&
      renderer.revision.trim().length === 0
    ) {
      issues.push({
        code: 'RELEASE_INVALID_IDENTIFIER',
        message: 'Renderer revision must not be whitespace-only.',
        path: 'release.renderer.revision',
      });
    }
    // Cross-check the renderer against the ACTUAL supplied renderer
    // (MED-04-G; the context is mandatory — RE-AUDIT MED-04-G-R).
    check(
      renderer.id === bindingContext.renderer.id,
      'RELEASE_RENDERER_MISMATCH',
      `Release binds renderer '${String(renderer.id)}' but the supplied renderer is '${bindingContext.renderer.id}'.`,
      'release.renderer.id',
    );
    check(
      renderer.revision === bindingContext.renderer.revision,
      'RELEASE_RENDERER_MISMATCH',
      `Release binds renderer revision '${String(renderer.revision)}' but the supplied renderer is revision '${bindingContext.renderer.revision}'.`,
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
    // Cross-check against the ACTUAL registry identity (MED-04-G; the
    // registry context is REQUIRED whenever components are declared —
    // RE-AUDIT MED-04-G-R): the declared registry id/revision and the EXACT
    // component identity list (no missing components, no extra components,
    // no mismatched revisions where exact binding is required).
    const actual = bindingContext.componentRegistry;
    if (actual !== undefined) {
      check(
        components.registryId === actual.registryId,
        'RELEASE_COMPONENT_REGISTRY_MISMATCH',
        `Release binds component registry '${String(components.registryId)}' but the supplied registry is '${actual.registryId}'.`,
        'release.components.registryId',
      );
      check(
        components.revision === actual.revision,
        'RELEASE_COMPONENT_REGISTRY_MISMATCH',
        `Release binds component registry revision '${String(components.revision)}' but the supplied registry is revision '${actual.revision}'.`,
        'release.components.revision',
      );
      const declaredComponents = new Map(
        (components.components ?? []).map((entry) => [entry.componentId, entry.revision]),
      );
      const actualComponents = new Map(
        actual.components.map((entry) => [entry.componentId, entry.revision]),
      );
      for (const [componentId, declaredRevision] of declaredComponents) {
        const actualRevision = actualComponents.get(componentId);
        if (actualRevision === undefined) {
          issues.push({
            code: 'RELEASE_COMPONENT_MISMATCH',
            message: `Release binds component '${componentId}' which is not in the supplied registry.`,
            path: `release.components.components.${componentId}`,
          });
        } else if (actualRevision !== declaredRevision) {
          issues.push({
            code: 'RELEASE_COMPONENT_MISMATCH',
            message: `Release binds component '${componentId}' revision '${declaredRevision}' but the supplied registry declares '${actualRevision}'.`,
            path: `release.components.components.${componentId}`,
          });
        }
      }
      for (const componentId of actualComponents.keys()) {
        if (!declaredComponents.has(componentId)) {
          issues.push({
            code: 'RELEASE_COMPONENT_MISMATCH',
            message: `The supplied registry contains component '${componentId}' which the release does not bind.`,
            path: 'release.components.components',
          });
        }
      }
    }
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
    // Cross-check against the ACTUAL supplied data adapter (MED-04-G; the
    // context is mandatory — RE-AUDIT MED-04-G-R).
    check(
      dataAdapter.id === bindingContext.dataAdapter.id,
      'RELEASE_DATA_ADAPTER_MISMATCH',
      `Release binds data adapter '${String(dataAdapter.id)}' but the supplied adapter is '${bindingContext.dataAdapter.id}'.`,
      'release.dataAdapter.id',
    );
    check(
      dataAdapter.revision === bindingContext.dataAdapter.revision,
      'RELEASE_DATA_ADAPTER_MISMATCH',
      `Release binds data adapter revision '${String(dataAdapter.revision)}' but the supplied adapter is revision '${bindingContext.dataAdapter.revision}'.`,
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
      // Cross-check the EXACT activation reference against the identity the
      // deployment actually selected (MED-04-G; the selected activation is
      // REQUIRED for exact references — RE-AUDIT MED-04-G-R): a stale
      // activation binding is rejected instead of silently resolving to a
      // newer activation.
      check(
        activation.activationVersion === bindingContext.selectedActivationVersion,
        'RELEASE_ACTIVATION_MISMATCH',
        `Release binds activation '${String(activation.activationVersion)}' but the selected activation is '${String(bindingContext.selectedActivationVersion)}'.`,
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

  // Provenance: safe fields only — never secrets, timestamps, or machine
  // paths. Prose values are length-bounded safe provenance text; resolved
  // secrets never enter manifests or release identity, and this compiler
  // makes NO claim that arbitrary prose can be automatically proven
  // secret-free.
  const provenance = release.provenance;
  if (provenance !== undefined) {
    for (const key of Object.keys(provenance)) {
      if (!PROVENANCE_FIELDS.has(key)) {
        issues.push({
          code: VALUE_LIKE.has(key) ? 'RELEASE_EMBEDDED_VALUE_FIELD' : 'RELEASE_UNKNOWN_FIELD',
          message: `Field '${key}' at 'release.provenance' is not a safe provenance field.`,
          path: `release.provenance.${key}`,
        });
        continue;
      }
      const value = (provenance as Record<string, unknown>)[key];
      if (typeof value !== 'string') {
        issues.push({
          code: 'RELEASE_PROVENANCE_UNSAFE',
          message: `Provenance field '${key}' must be a safe prose string.`,
          path: `release.provenance.${key}`,
        });
      } else if (value.trim().length === 0 || value.length > 200) {
        issues.push({
          code: 'RELEASE_PROVENANCE_UNSAFE',
          message: `Provenance field '${key}' must be a non-empty prose string of at most 200 characters.`,
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

  // Defensive capture: clone then freeze. The caller's release object is
  // NEVER frozen or mutated, and later mutation of the input cannot change
  // the compiled release's declared identity (LOW-04-F remediation).
  const manifest = deepFreeze(cloneForFreeze(release));
  return {
    ok: true,
    release: Object.freeze({ manifest, releaseVersion: computeReleaseVersion(manifest) }),
  };
}

/* ------------------------------------------------------------------ */
/* Mandatory binding-context validation (RE-AUDIT MED-04-G-R)           */
/* ------------------------------------------------------------------ */

interface NormalizedBindingContext {
  readonly renderer: { readonly id: string; readonly revision: string };
  readonly componentRegistry?:
    | {
        readonly registryId: string;
        readonly revision: string;
        readonly components: readonly {
          readonly componentId: string;
          readonly revision: string;
        }[];
      }
    | undefined;
  readonly dataAdapter: { readonly id: string; readonly revision: string };
  readonly selectedActivationVersion: string | undefined;
}

type BindingContextValidation =
  | { readonly ok: true; readonly value: NormalizedBindingContext }
  | { readonly ok: false; readonly issues: readonly ReleaseIssue[] };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Stable fail-closed diagnostic for an omitted, partial, or invalid binding
 * context. The message NEVER echoes the received value (a hostile or
 * malformed identity value can never leak through diagnostics).
 */
const contextRequired = (path: string): ReleaseIssue => ({
  code: 'RELEASE_BINDING_CONTEXT_REQUIRED',
  message:
    `The release binding context is missing or invalid at '${path}'. ` +
    'Deployment composition must supply the ACTUAL binding identities — ' +
    'taken from the selected renderer instance, the component-registry ' +
    'identity snapshot, the application-data adapter instance, and the ' +
    'activation selection — never copied out of the release manifest ' +
    'itself. Omitting any required binding fails closed.',
  path,
});

/**
 * Validate the mandatory binding context (RE-AUDIT MED-04-G-R). Every valid
 * release declares a renderer and a data-adapter binding, so their actual
 * identities are ALWAYS required; the component-registry snapshot is
 * required when the release declares `components`; an exact activation
 * reference requires the actually selected activation version. Activation
 * selection POLICIES intentionally defer selection and require nothing.
 */
function validateBindingContext(
  release: ApplicationRelease,
  context: CompileReleaseContext,
): BindingContextValidation {
  if (!isPlainObject(context)) {
    return { ok: false, issues: [contextRequired('context')] };
  }
  const issues: ReleaseIssue[] = [];

  const renderer = context.renderer;
  if (
    !isPlainObject(renderer) ||
    typeof renderer.id !== 'string' ||
    renderer.id.length === 0 ||
    typeof renderer.revision !== 'string' ||
    renderer.revision.length === 0
  ) {
    issues.push(contextRequired('context.renderer'));
  }
  const dataAdapter = context.dataAdapter;
  if (
    !isPlainObject(dataAdapter) ||
    typeof dataAdapter.id !== 'string' ||
    dataAdapter.id.length === 0 ||
    typeof dataAdapter.revision !== 'string' ||
    dataAdapter.revision.length === 0
  ) {
    issues.push(contextRequired('context.dataAdapter'));
  }

  let componentRegistry: NormalizedBindingContext['componentRegistry'];
  if (context.componentRegistry !== undefined || release.components !== undefined) {
    const registry = context.componentRegistry;
    if (
      !isPlainObject(registry) ||
      typeof registry.registryId !== 'string' ||
      registry.registryId.length === 0 ||
      typeof registry.revision !== 'string' ||
      registry.revision.length === 0 ||
      !Array.isArray(registry.components) ||
      registry.components.some(
        (entry) =>
          !isPlainObject(entry) ||
          typeof entry.componentId !== 'string' ||
          entry.componentId.length === 0 ||
          typeof entry.revision !== 'string' ||
          entry.revision.length === 0,
      )
    ) {
      issues.push(contextRequired('context.componentRegistry'));
    } else {
      componentRegistry = {
        registryId: registry.registryId,
        revision: registry.revision,
        components: registry.components.map((entry) => ({
          componentId: entry.componentId,
          revision: entry.revision,
        })),
      };
    }
  }

  let selectedActivationVersion: string | undefined;
  const activation = release.activation;
  const requiresSelectedActivation = isPlainObject(activation) && activation.kind === 'reference';
  if (context.selectedActivationVersion !== undefined || requiresSelectedActivation) {
    const selected = context.selectedActivationVersion;
    if (typeof selected !== 'string' || selected.length === 0) {
      issues.push(contextRequired('context.selectedActivationVersion'));
    } else {
      selectedActivationVersion = selected;
    }
  }

  if (issues.length > 0) {
    issues.sort((a, b) => ((a.path ?? '') < (b.path ?? '') ? -1 : 1));
    return { ok: false, issues };
  }
  return {
    ok: true,
    value: {
      renderer: renderer as { readonly id: string; readonly revision: string },
      componentRegistry,
      dataAdapter: dataAdapter as { readonly id: string; readonly revision: string },
      selectedActivationVersion,
    },
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

/** Shallow-structural clone of plain release data (no functions expected). */
function cloneForFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(cloneForFreeze) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = cloneForFreeze(item);
    }
    return out as unknown as T;
  }
  return value;
}
