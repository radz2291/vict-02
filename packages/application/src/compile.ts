import {
  APPLICATION_DEFINITION_SCHEMA,
  APPLICATION_DEFINITION_SCHEMA_V2,
  THEME_TOKEN_NAMES,
} from '@vict/sdk';
import { sha256 } from './sha256.js';
import type {
  ActionDefinition,
  ApplicationDefinition,
  ComponentReference,
  FormBinding,
  ResourceDefinition,
  ScreenDefinition,
  Surface,
  ThemeDeclaration,
  ViewBinding,
} from '@vict/sdk';

/**
 * Application validation and compilation (Stage 04).
 *
 * Compiles a validated Application Definition plus its declared resource /
 * contract / component bindings into an IMMUTABLE Application Plan, or
 * rejects it with structured, deterministic diagnostics. Compilation never
 * throws for invalid definitions and never executes author code: a
 * serialized application manifest contains declarations and stable
 * references only.
 *
 * Diagnostics carry stable codes and safe definition paths; the
 * unknown-field subset is sorted by path so ordering is deterministic and
 * insertion-order independent.
 */

export type ApplicationIssueCode =
  | 'APPLICATION_UNKNOWN_FIELD'
  | 'APPLICATION_EMBEDDED_VALUE_FIELD'
  | 'APPLICATION_EMPTY_ID'
  | 'APPLICATION_EMPTY_REVISION'
  | 'APPLICATION_INVALID_IDENTIFIER'
  | 'APPLICATION_NON_CANONICAL_VALUE'
  | 'APPLICATION_COMPILATION_FAILED'
  | 'APPLICATION_UNKNOWN_SCHEMA'
  | 'DUPLICATE_ROUTE_ID'
  | 'DUPLICATE_ROUTE_PATH'
  | 'DUPLICATE_SCREEN_ID'
  | 'DUPLICATE_REGION_NAME'
  | 'DUPLICATE_SURFACE_ID'
  | 'DUPLICATE_VIEW_ID'
  | 'DUPLICATE_FORM_ID'
  | 'DUPLICATE_ACTION_ID'
  | 'DUPLICATE_RESOURCE_REFERENCE'
  | 'DUPLICATE_COMPONENT_REFERENCE'
  | 'DUPLICATE_TAB_NAME'
  | 'UNKNOWN_ROUTE_SCREEN'
  | 'UNKNOWN_ROUTE_REFERENCE'
  | 'UNKNOWN_VIEW_REFERENCE'
  | 'UNKNOWN_FORM_REFERENCE'
  | 'UNKNOWN_ACTION_REFERENCE'
  | 'UNKNOWN_FORM_ACTION'
  | 'UNKNOWN_RESOURCE_REFERENCE'
  | 'UNKNOWN_RESOURCE'
  | 'RESOURCE_REVISION_MISMATCH'
  | 'UNKNOWN_FIELD'
  | 'UNKNOWN_CONTRACT_REFERENCE'
  | 'CONTRACT_REVISION_MISMATCH'
  | 'UNKNOWN_CAPABILITY_REFERENCE'
  | 'CAPABILITY_REVISION_MISMATCH'
  | 'UNKNOWN_COMPONENT_REFERENCE'
  | 'COMPONENT_REVISION_MISMATCH'
  | 'UNKNOWN_SURFACE_ROLE'
  | 'MUTATION_NOT_DECLARED'
  | 'ROUTE_PATH_INVALID'
  | 'ROUTE_REDIRECT_INVALID'
  | 'ROUTE_REDIRECT_CYCLE'
  | 'ROUTE_SCREEN_REQUIRED'
  | 'UNKNOWN_BREADCRUMB_ROUTE'
  | 'INVALID_SURFACE_CONDITION'
  | 'INVALID_SURFACE_DISABLED_CONDITION'
  | 'INVALID_THEME_TOKEN'
  | 'INVALID_THEME_TOKEN_VALUE'
  | 'INVALID_SURFACE_DECLARATION'
  | 'INVALID_TABLE_DECLARATION'
  | 'INVALID_CHART_DECLARATION'
  | 'INVALID_STATUS_DECLARATION'
  | 'INVALID_TABS_DECLARATION'
  | 'INVALID_CONVERSATION_DECLARATION'
  | 'INVALID_ACTION_BINDING';

export interface ApplicationIssue {
  readonly code: ApplicationIssueCode;
  readonly message: string;
  readonly path?: string;
}

export interface ContractRegistryEntry {
  readonly id: string;
  readonly revision: string;
}

export interface CapabilityRegistryEntry {
  readonly id: string;
  readonly revision: string;
}

export interface CompileApplicationInput {
  readonly application: ApplicationDefinition;
  readonly resources: readonly ResourceDefinition[];
  readonly contracts?: readonly ContractRegistryEntry[];
  readonly capabilities?: readonly CapabilityRegistryEntry[];
  readonly components?: readonly ComponentReference[];
}

/* ------------------------------------------------------------------ */
/* Closed schemas                                                      */
/* ------------------------------------------------------------------ */

const APPLICATION_FIELDS: ReadonlySet<string> = new Set([
  'schema',
  'id',
  'revision',
  'name',
  'routes',
  'screens',
  'views',
  'forms',
  'actions',
  'resources',
  'components',
  'compatibility',
  'theme',
]);

const ROUTE_FIELDS: ReadonlySet<string> = new Set(['id', 'path', 'screenId', 'nav']);
/** @2 adds redirect routes (screenId optional, redirect target validated). */
const ROUTE_FIELDS_V2: ReadonlySet<string> = new Set([...ROUTE_FIELDS, 'redirect']);
const NAV_FIELDS: ReadonlySet<string> = new Set(['label', 'group', 'order']);
const SCREEN_FIELDS: ReadonlySet<string> = new Set(['id', 'title', 'layout', 'states']);
/** @2 adds contextual breadcrumb navigation on screens. */
const SCREEN_FIELDS_V2: ReadonlySet<string> = new Set([...SCREEN_FIELDS, 'breadcrumbs']);
const REGION_FIELDS: ReadonlySet<string> = new Set(['name', 'surfaces']);
const STATES_FIELDS: ReadonlySet<string> = new Set([
  'loading',
  'empty',
  'validation',
  'denied',
  'failure',
]);
/** @2 adds the stale and partial states. */
const STATES_FIELDS_V2: ReadonlySet<string> = new Set([...STATES_FIELDS, 'stale', 'partial']);
const VIEW_FIELDS: ReadonlySet<string> = new Set([
  'viewId',
  'resourceId',
  'resourceRevision',
  'fields',
  'emptyMessage',
]);
const FORM_FIELDS: ReadonlySet<string> = new Set([
  'formId',
  'resourceId',
  'resourceRevision',
  'inputContractId',
  'inputContractRevision',
  'fields',
  'submitActionId',
]);
const FORM_FIELD_FIELDS: ReadonlySet<string> = new Set(['name', 'label', 'required', 'widget']);
const ACTION_BASE_FIELDS: ReadonlySet<string> = new Set(['kind', 'id', 'revision']);
const ACTION_FIELDS: ReadonlyMap<ActionDefinition['kind'], ReadonlySet<string>> = new Map([
  ['local', new Set([...ACTION_BASE_FIELDS, 'inputContractId'])],
  ['navigation', new Set([...ACTION_BASE_FIELDS, 'routeId'])],
  [
    'query',
    new Set([
      ...ACTION_BASE_FIELDS,
      'resourceId',
      'resourceRevision',
      'inputContractId',
      'inputContractRevision',
      'outputContractId',
      'outputContractRevision',
    ]),
  ],
  [
    'mutation',
    new Set([
      ...ACTION_BASE_FIELDS,
      'resourceId',
      'resourceRevision',
      'op',
      'inputContractId',
      'inputContractRevision',
      'outputContractId',
      'outputContractRevision',
    ]),
  ],
  [
    'capability',
    new Set([
      ...ACTION_BASE_FIELDS,
      'capabilityId',
      'capabilityRevision',
      'inputContractId',
      'inputContractRevision',
      'outputContractId',
      'outputContractRevision',
    ]),
  ],
]);
const RESOURCE_REF_FIELDS: ReadonlySet<string> = new Set(['resourceId', 'revision']);
const COMPONENT_FIELDS: ReadonlySet<string> = new Set(['componentId', 'revision']);
const SURFACE_COMMON_FIELDS: ReadonlySet<string> = new Set(['role', 'id']);
const SURFACE_FIELDS: ReadonlyMap<Surface['role'], ReadonlySet<string>> = new Map([
  ['text', new Set([...SURFACE_COMMON_FIELDS, 'content'])],
  ['view', new Set([...SURFACE_COMMON_FIELDS, 'viewId'])],
  ['form', new Set([...SURFACE_COMMON_FIELDS, 'formId'])],
  ['action', new Set([...SURFACE_COMMON_FIELDS, 'actionId', 'label'])],
  ['component', new Set([...SURFACE_COMMON_FIELDS, 'componentId', 'revision', 'props'])],
  ['states', new Set([...SURFACE_COMMON_FIELDS, 'viewId'])],
]);

/** The closed @2 surface field sets (Stage 05 delivery vocabulary). */
const CONDITION_FIELDS: ReadonlySet<string> = new Set(['viewNonEmpty', 'viewEmpty', 'paramEquals']);
const CONDITION_PARAM_EQUALS_FIELDS: ReadonlySet<string> = new Set(['name', 'value']);
const DISABLED_CONDITION_FIELDS: ReadonlySet<string> = new Set(['paramMissing']);
const BREADCRUMB_FIELDS: ReadonlySet<string> = new Set(['label', 'routeId']);
const STAGE04_SURFACE_FIELD_SETS = SURFACE_FIELDS;
const SURFACE_FIELDS_V2: ReadonlyMap<Surface['role'], ReadonlySet<string>> = new Map([
  [
    'text',
    new Set([
      ...(STAGE04_SURFACE_FIELD_SETS.get('text') as ReadonlySet<string>),
      'level',
      'visibleWhen',
    ]),
  ],
  [
    'view',
    new Set([...(STAGE04_SURFACE_FIELD_SETS.get('view') as ReadonlySet<string>), 'visibleWhen']),
  ],
  [
    'form',
    new Set([...(STAGE04_SURFACE_FIELD_SETS.get('form') as ReadonlySet<string>), 'visibleWhen']),
  ],
  [
    'action',
    new Set([
      ...(STAGE04_SURFACE_FIELD_SETS.get('action') as ReadonlySet<string>),
      'disabledWhen',
      'visibleWhen',
    ]),
  ],
  [
    'component',
    new Set([
      ...(STAGE04_SURFACE_FIELD_SETS.get('component') as ReadonlySet<string>),
      'visibleWhen',
    ]),
  ],
  [
    'states',
    new Set([...(STAGE04_SURFACE_FIELD_SETS.get('states') as ReadonlySet<string>), 'visibleWhen']),
  ],
  [
    'list',
    new Set([
      ...SURFACE_COMMON_FIELDS,
      'viewId',
      'titleField',
      'secondaryField',
      'emptyMessage',
      'visibleWhen',
    ]),
  ],
  [
    'table',
    new Set([
      ...SURFACE_COMMON_FIELDS,
      'viewId',
      'columns',
      'queryActionId',
      'searchFields',
      'filterFields',
      'pageSize',
      'emptyMessage',
      'visibleWhen',
    ]),
  ],
  [
    'detail',
    new Set([...SURFACE_COMMON_FIELDS, 'viewId', 'fields', 'emptyMessage', 'visibleWhen']),
  ],
  [
    'chart',
    new Set([
      ...SURFACE_COMMON_FIELDS,
      'viewId',
      'kind',
      'xField',
      'yField',
      'summary',
      'title',
      'visibleWhen',
    ]),
  ],
  ['status', new Set([...SURFACE_COMMON_FIELDS, 'value', 'field', 'tones', 'visibleWhen'])],
  ['tabs', new Set([...SURFACE_COMMON_FIELDS, 'tabs', 'visibleWhen'])],
  [
    'dialog',
    new Set([...SURFACE_COMMON_FIELDS, 'title', 'triggerLabel', 'content', 'visibleWhen']),
  ],
  [
    'drawer',
    new Set([...SURFACE_COMMON_FIELDS, 'title', 'triggerLabel', 'content', 'visibleWhen']),
  ],
  [
    'conversation',
    new Set([
      ...SURFACE_COMMON_FIELDS,
      'viewId',
      'messageField',
      'authorField',
      'participantField',
      'sendActionId',
      'inputLabel',
      'inputPlaceholder',
      'emptyMessage',
      'visibleWhen',
    ]),
  ],
]);
const TAB_FIELDS: ReadonlySet<string> = new Set(['name', 'label', 'surfaces']);
const TABLE_COLUMN_FIELDS: ReadonlySet<string> = new Set(['field', 'label', 'sortable']);
const STATUS_TONES: ReadonlySet<string> = new Set([
  'success',
  'warning',
  'danger',
  'info',
  'neutral',
]);
const CHART_KINDS: ReadonlySet<string> = new Set(['bar', 'line']);
/** Route path segment: a static segment or a single `:name` parameter. */
const PATH_SEGMENT = /^[A-Za-z0-9_-]+$/;
/** Safe theme token value: no CSS structure, no url(), bounded length. */
const THEME_TOKEN_VALUE_SAFE = /^[^{};<>]*$/;
const RESOURCE_DEF_FIELDS: ReadonlySet<string> = new Set([
  'schema',
  'id',
  'revision',
  'identity',
  'fields',
  'inputContract',
  'outputContract',
  'relationships',
  'queries',
  'mutations',
  'presentation',
  'authorization',
]);
const RESOURCE_FIELD_FIELDS: ReadonlySet<string> = new Set(['name', 'type', 'required', 'label']);
/** Field names that signal an embedded secret/config value where only references are allowed. */
const VALUE_LIKE_FIELD_NAMES: ReadonlySet<string> = new Set([
  'secrets',
  'secret',
  'secretValue',
  'configuration',
  'config',
  'credentials',
  'password',
  'token',
  'apiKey',
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** True for a non-empty, non-whitespace-only identifier. */
function isValidIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

class Collector {
  readonly #issues: ApplicationIssue[] = [];

  add(code: ApplicationIssueCode, message: string, path?: string): void {
    this.#issues.push({ code, message, ...(path !== undefined ? { path } : {}) });
  }

  unknownFields(
    value: object,
    allowed: ReadonlySet<string>,
    path: string,
    code: ApplicationIssueCode = 'APPLICATION_UNKNOWN_FIELD',
  ): void {
    const names = Object.keys(value)
      .filter((key) => !allowed.has(key))
      .sort();
    for (const key of names) {
      if (VALUE_LIKE_FIELD_NAMES.has(key)) {
        this.add(
          'APPLICATION_EMBEDDED_VALUE_FIELD',
          `Field '${key}' at '${path}' looks like an embedded configuration/secret value; application manifests declare references only, never resolved values.`,
          `${path}.${key}`,
        );
        continue;
      }
      this.add(
        code,
        `Unknown field '${key}' at '${path}': the application schema is closed and does not accept it.`,
        `${path}.${key}`,
      );
    }
  }

  sorted(): readonly ApplicationIssue[] {
    return [...this.#issues].sort((a, b) => {
      const pathA = a.path ?? '';
      const pathB = b.path ?? '';
      if (pathA === pathB) {
        return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
      }
      return pathA < pathB ? -1 : 1;
    });
  }
}

/* ------------------------------------------------------------------ */
/* Canonicalization and identity                                       */
/* ------------------------------------------------------------------ */

/**
 * Structured rejection for values outside the canonical serializable
 * domain (MED-04-F remediation). The compiler NEVER silently coerces
 * NaN, ±Infinity, negative zero, BigInt, Date, functions, symbols,
 * sparse arrays, cyclic structures, unsupported prototypes, or throwing
 * getters/proxies into `null`, strings, or omissions — ambiguous
 * `applicationVersion` values are impossible because out-of-domain
 * definitions fail compilation.
 */
export class CanonicalIdentityError extends Error {
  readonly code: 'NON_CANONICAL_VALUE' | 'CYCLIC_STRUCTURE';
  readonly path: string;

  constructor(code: 'NON_CANONICAL_VALUE' | 'CYCLIC_STRUCTURE', message: string, path: string) {
    super(message);
    this.name = 'CanonicalIdentityError';
    this.code = code;
    this.path = path;
  }
}

/** Stable JSON: recursively sorted object keys, arrays preserved in order. */
export function stableJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown, path: string = '(root)'): unknown {
  if (value === null) {
    return null;
  }
  const type = typeof value;
  if (type === 'string' || type === 'boolean') {
    return value;
  }
  if (type === 'number') {
    if (!Number.isFinite(value)) {
      throw new CanonicalIdentityError(
        'NON_CANONICAL_VALUE',
        `The canonical serializable domain rejects the non-finite number ${String(value)} at '${path}'.`,
        path,
      );
    }
    if (Object.is(value, -0)) {
      throw new CanonicalIdentityError(
        'NON_CANONICAL_VALUE',
        `The canonical serializable domain rejects negative zero at '${path}' (use 0).`,
        path,
      );
    }
    return value;
  }
  if (type === 'bigint') {
    throw new CanonicalIdentityError(
      'NON_CANONICAL_VALUE',
      `The canonical serializable domain rejects a BigInt at '${path}' (declare a number or string instead).`,
      path,
    );
  }
  if (type === 'function') {
    throw new CanonicalIdentityError(
      'NON_CANONICAL_VALUE',
      `The canonical serializable domain rejects a function at '${path}'.`,
      path,
    );
  }
  if (type === 'symbol') {
    throw new CanonicalIdentityError(
      'NON_CANONICAL_VALUE',
      `The canonical serializable domain rejects a symbol at '${path}'.`,
      path,
    );
  }
  if (type === 'undefined') {
    throw new CanonicalIdentityError(
      'NON_CANONICAL_VALUE',
      `The canonical serializable domain rejects undefined at '${path}' (omit the field or use null).`,
      path,
    );
  }
  if (value instanceof Date) {
    throw new CanonicalIdentityError(
      'NON_CANONICAL_VALUE',
      `The canonical serializable domain rejects a Date object at '${path}' (declare an ISO string instead).`,
      path,
    );
  }
  const seen = canonicalSeenStack;
  if (seen.has(value as object)) {
    throw new CanonicalIdentityError(
      'CYCLIC_STRUCTURE',
      `The value at '${path}' is part of a cyclic structure; cyclic values cannot be canonicalized.`,
      path,
    );
  }
  if (Array.isArray(value)) {
    if (value.length !== new Set(value.keys()).size) {
      throw new CanonicalIdentityError(
        'NON_CANONICAL_VALUE',
        `The canonical serializable domain rejects a sparse array at '${path}'.`,
        path,
      );
    }
    seen.add(value as object);
    try {
      return (value as unknown[]).map((item, index) => canonicalize(item, `${path}[${index}]`));
    } finally {
      seen.delete(value as object);
    }
  }
  const proto = Object.getPrototypeOf(value as object);
  if (proto !== Object.prototype && proto !== null) {
    throw new CanonicalIdentityError(
      'NON_CANONICAL_VALUE',
      `The canonical serializable domain rejects an object with an unsupported prototype at '${path}'.`,
      path,
    );
  }
  const source = value as Record<string, unknown>;
  let keys: string[];
  try {
    keys = Object.keys(source);
  } catch {
    throw new CanonicalIdentityError(
      'NON_CANONICAL_VALUE',
      `The value at '${path}' could not be enumerated (hostile getter or proxy); identity inputs must be plain data.`,
      path,
    );
  }
  seen.add(value as object);
  try {
    const out: Record<string, unknown> = {};
    for (const key of keys.sort()) {
      let item: unknown;
      try {
        item = source[key];
      } catch {
        throw new CanonicalIdentityError(
          'NON_CANONICAL_VALUE',
          `Reading field '${key}' at '${path}' threw (hostile getter); identity inputs must be plain data.`,
          `${path}.${key}`,
        );
      }
      if (item !== undefined) {
        out[key] = canonicalize(item, `${path}.${key}`);
      }
    }
    return out;
  } finally {
    seen.delete(value as object);
  }
}

/** Cycle-detection scratch set (per canonicalize call tree). */
const canonicalSeenStack = new Set<object>();

/** Pure-TS SHA-256 (byte-identical to node:crypto; browser-safe). */
function sha256Hex(payload: string): string {
  return sha256(payload);
}

/** The application identity schema marker (versioned canonicalization + hash). */
export const APPLICATION_IDENTITY_SCHEMA = 'vict.application-identity@1';

/**
 * The identity-schema marker for Stage 05 (`vict.application@2`)
 * definitions. The @2 marker is explicit because the accepted manifest
 * SHAPE is materially extended; the canonicalization ALGORITHM is the same
 * stable sorted-key form. @1 identity vectors remain byte-identical.
 */
export const APPLICATION_IDENTITY_SCHEMA_V2 = 'vict.application-identity@2';

/** Resolve the identity marker for an application schema. */
function identitySchemaFor(applicationSchema: string): string {
  return applicationSchema === 'vict.application@2'
    ? APPLICATION_IDENTITY_SCHEMA_V2
    : APPLICATION_IDENTITY_SCHEMA;
}

/**
 * Sort SET-LIKE collections by id and PRESERVE meaningful ordered arrays
 * (navigation routes, layout regions, ordered surfaces, form fields).
 * Insertion order of set-like declarations therefore never affects identity,
 * while meaningful UI sequence order always does.
 */
export function canonicalApplicationManifest(
  application: ApplicationDefinition,
): Record<string, unknown> {
  const byId = <T>(items: readonly T[], key: (item: T) => string): T[] =>
    [...items].sort((a, b) => {
      const keyA = key(a);
      const keyB = key(b);
      return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
    });

  const screens = byId(application.screens, (screen) => screen.id).map((screen) => ({
    ...screen,
    // Regions are ordered layout semantics; surfaces are ordered semantics.
    // Region NAMES form a set within a screen; keep declared order (they are
    // validated unique) — sorting them would discard layout intent.
  }));

  return {
    schema: application.schema,
    id: application.id,
    revision: application.revision,
    ...(application.name !== undefined ? { name: application.name } : {}),
    routes: [...application.routes].map((route) => ({ ...route })),
    screens,
    ...(application.views !== undefined
      ? { views: byId(application.views, (view) => view.viewId).map((view) => ({ ...view })) }
      : {}),
    ...(application.forms !== undefined
      ? { forms: byId(application.forms, (form) => form.formId).map((form) => ({ ...form })) }
      : {}),
    actions: byId(application.actions, (action) => action.id).map((action) => ({ ...action })),
    resources: byId(
      application.resources.map((entry) => ({ ...entry })),
      (entry) => entry.resourceId,
    ),
    ...(application.components !== undefined
      ? {
          components: [...application.components]
            .map((entry) => ({ ...entry }))
            .sort(
              (a, b) =>
                (a.componentId < b.componentId ? -1 : a.componentId > b.componentId ? 1 : 0) ||
                (a.revision < b.revision ? -1 : a.revision > b.revision ? 1 : 0),
            ),
        }
      : {}),
    ...(application.compatibility !== undefined
      ? { compatibility: { ...application.compatibility } }
      : {}),
    ...(application.theme !== undefined ? { theme: application.theme } : {}),
  };
}

/**
 * `applicationVersion` — the canonical identity of one application and its
 * explicit semantic references:
 *
 *   hash(canonical application manifest
 *        + referenced resource/view/action revisions
 *        + referenced component ids/revisions
 *        + application schema marker)
 *
 * Deterministic across processes; independent of object insertion order,
 * timestamps, randomness, function text, renderer internals, and schema-library
 * internals. Meaningful UI sequences (navigation, layout, surfaces, form
 * fields) are ORDERED semantics and change the identity; set-like
 * declarations do not.
 */
export function computeApplicationVersion(input: {
  readonly application: ApplicationDefinition;
  readonly resources: readonly ResourceDefinition[];
}): string {
  const { application } = input;
  const providedResources = new Map(input.resources.map((entry) => [entry.id, entry]));
  const referencedResources = application.resources
    .map((reference) => {
      const resource = providedResources.get(reference.resourceId);
      return {
        resourceId: reference.resourceId,
        revision: resource?.revision ?? reference.revision,
      };
    })
    .sort((a, b) => (a.resourceId < b.resourceId ? -1 : a.resourceId > b.resourceId ? 1 : 0));

  const referencedViews = (application.views ?? [])
    .map((view) => ({ viewId: view.viewId, revision: view.resourceRevision }))
    .sort((a, b) => (a.viewId < b.viewId ? -1 : a.viewId > b.viewId ? 1 : 0));
  const referencedActions = application.actions
    .map((action) => ({ actionId: action.id, revision: action.revision }))
    .sort((a, b) => (a.actionId < b.actionId ? -1 : a.actionId > b.actionId ? 1 : 0));
  const referencedComponents = [...(application.components ?? [])]
    .map((entry) => ({ ...entry }))
    .sort(
      (a, b) =>
        (a.componentId < b.componentId ? -1 : a.componentId > b.componentId ? 1 : 0) ||
        (a.revision < b.revision ? -1 : a.revision > b.revision ? 1 : 0),
    );

  return `v1_${sha256Hex(
    stableJson({
      schema: identitySchemaFor(application.schema),
      applicationSchema: application.schema,
      manifest: canonicalApplicationManifest(application),
      referencedResources,
      referencedViews,
      referencedActions,
      referencedComponents,
    }),
  )}`;
}

/* ------------------------------------------------------------------ */
/* Compilation                                                         */
/* ------------------------------------------------------------------ */

export type CompileApplicationResult =
  | { readonly ok: true; readonly plan: ApplicationPlan }
  | { readonly ok: false; readonly issues: readonly ApplicationIssue[] };

/**
 * The compiled, immutable application plan. Everything is deep-frozen;
 * callers can neither mutate the plan nor use it to mutate the source
 * definitions.
 */
export interface ApplicationPlan {
  readonly applicationId: string;
  readonly applicationRevision: string;
  readonly applicationVersion: string;
  /** Canonical (set-like sorted, meaningful order preserved) manifest. */
  readonly manifest: Readonly<Record<string, unknown>>;
  /** Resolved routes in NAVIGATION order with their screens (null for @2 redirect routes). */
  readonly routes: readonly {
    readonly route: Readonly<ApplicationDefinition['routes'][number]>;
    readonly screen: Readonly<ScreenDefinition> | null;
  }[];
  readonly screens: Readonly<Record<string, Readonly<ScreenDefinition>>>;
  readonly views: Readonly<Record<string, Readonly<ViewBinding>>>;
  readonly forms: Readonly<Record<string, Readonly<FormBinding>>>;
  readonly actions: Readonly<Record<string, Readonly<ActionDefinition>>>;
  readonly resources: Readonly<Record<string, Readonly<ResourceDefinition>>>;
  readonly components: readonly Readonly<ComponentReference>[];
  /** Canonical serializable form of the compiled plan (declarations + references only). */
  toJSON(): Record<string, unknown>;
}

/** Compile one application. Never throws for invalid definitions. */
export function compileApplication(input: CompileApplicationInput): CompileApplicationResult {
  // Compilation NEVER throws for invalid definitions (LOW-04-B): hostile
  // getters, proxies, invalid prototypes, and unsupported values are
  // converted into structured safe diagnostics.
  try {
    const collector = new Collector();
    const surfaceResolutions: SurfaceResolution[] = [];
    const routeScreenResolutions: RouteScreenResolution[] = [];
    const application = input.application;
    // The @2 schema marker selects the EXTENDED closed field sets and the
    // Stage 05 validation rules. @1 definitions keep their exact Stage 04
    // accepted shape and semantics (schema-marker compatibility path).
    const isV2 = application.schema === 'vict.application@2';
    const routeFields = isV2 ? ROUTE_FIELDS_V2 : ROUTE_FIELDS;
    const screenFields = isV2 ? SCREEN_FIELDS_V2 : SCREEN_FIELDS;
    const statesFields = isV2 ? STATES_FIELDS_V2 : STATES_FIELDS;

    if (!isPlainObject(application)) {
      return {
        ok: false,
        issues: [
          { code: 'APPLICATION_EMPTY_ID', message: 'Application definition must be an object.' },
        ],
      };
    }
    collector.unknownFields(application, APPLICATION_FIELDS, 'application');

    if (typeof application.schema !== 'string') {
      collector.add(
        'APPLICATION_UNKNOWN_SCHEMA',
        'Application definition must declare its schema marker.',
        'application.schema',
      );
    } else if (
      application.schema !== APPLICATION_DEFINITION_SCHEMA &&
      application.schema !== APPLICATION_DEFINITION_SCHEMA_V2
    ) {
      collector.add(
        'APPLICATION_UNKNOWN_SCHEMA',
        `Application schema '${String(application.schema)}' is not supported by this compiler.`,
        'application.schema',
      );
    }
    if (typeof application.id !== 'string' || application.id.length === 0) {
      collector.add(
        'APPLICATION_EMPTY_ID',
        'Application id must be a non-empty string.',
        'application.id',
      );
    } else if (!isValidIdentifier(application.id)) {
      collector.add(
        'APPLICATION_INVALID_IDENTIFIER',
        'Application id must not be whitespace-only.',
        'application.id',
      );
    }
    if (typeof application.revision !== 'string' || application.revision.length === 0) {
      collector.add(
        'APPLICATION_EMPTY_REVISION',
        'Application revision must be a non-empty string.',
        'application.revision',
      );
    } else if (!isValidIdentifier(application.revision)) {
      collector.add(
        'APPLICATION_INVALID_IDENTIFIER',
        'Application revision must not be whitespace-only.',
        'application.revision',
      );
    }

    // ---- Provided bindings -------------------------------------------------
    const providedResources = new Map<string, ResourceDefinition>();
    for (const resource of input.resources) {
      collector.unknownFields(resource, RESOURCE_DEF_FIELDS, `resources[${resource.id}]`);
      for (const field of resource.fields) {
        collector.unknownFields(
          field,
          RESOURCE_FIELD_FIELDS,
          `resources[${resource.id}].fields[${field.name}]`,
        );
      }
      if (providedResources.has(resource.id)) {
        collector.add(
          'DUPLICATE_RESOURCE_REFERENCE',
          `Resource '${resource.id}' is provided more than once.`,
          `resources[${resource.id}]`,
        );
        continue;
      }
      providedResources.set(resource.id, resource);
    }
    const providedContracts = new Map<string, string>();
    for (const contract of input.contracts ?? []) {
      providedContracts.set(contract.id, contract.revision);
    }
    const providedCapabilities = new Map<string, string>();
    for (const capability of input.capabilities ?? []) {
      providedCapabilities.set(capability.id, capability.revision);
    }
    const providedComponents = new Map<string, string>();
    for (const component of input.components ?? []) {
      providedComponents.set(component.componentId, component.revision);
    }

    // ---- Routes (ordered navigation) ----------------------------------------
    const routeIds = new Set<string>();
    const routePaths = new Set<string>();
    const redirectTargets = new Map<string, string>();
    for (const route of application.routes) {
      collector.unknownFields(route, routeFields, `application.routes[${route.id}]`);
      if (routeIds.has(route.id)) {
        collector.add(
          'DUPLICATE_ROUTE_ID',
          `Route id '${route.id}' is declared more than once.`,
          `application.routes[${route.id}]`,
        );
      }
      routeIds.add(route.id);
      if (routePaths.has(route.path)) {
        collector.add(
          'DUPLICATE_ROUTE_PATH',
          `Route path '${route.path}' is declared more than once.`,
          `application.routes[${route.id}]`,
        );
      }
      routePaths.add(route.path);
      if (isV2) {
        // Stage 05 route-path grammar: leading slash, static segments and
        // single `:name` parameters only — the renderer's deterministic
        // matcher cannot accept anything else.
        if (typeof route.path !== 'string' || !route.path.startsWith('/')) {
          collector.add(
            'ROUTE_PATH_INVALID',
            `Route '${route.id}' path must start with '/'.`,
            `application.routes[${route.id}].path`,
          );
        } else {
          const segments = route.path
            .slice(1)
            .split('/')
            .filter((segment) => segment.length > 0);
          const paramNames = new Set<string>();
          for (const segment of segments) {
            const isParam = segment.startsWith(':');
            const name = isParam ? segment.slice(1) : segment;
            if (name.length === 0 || !PATH_SEGMENT.test(name)) {
              collector.add(
                'ROUTE_PATH_INVALID',
                `Route '${route.id}' path segment '${segment}' is not a valid static segment or ':name' parameter.`,
                `application.routes[${route.id}].path`,
              );
            } else if (isParam) {
              if (paramNames.has(name)) {
                collector.add(
                  'ROUTE_PATH_INVALID',
                  `Route '${route.id}' path declares the parameter ':${name}' more than once.`,
                  `application.routes[${route.id}].path`,
                );
              }
              paramNames.add(name);
            }
          }
        }
        // Redirect routes: screenId must be ABSENT; the target is validated
        // after the full route set is known (missing target + cycles).
        if (route.redirect !== undefined) {
          if (typeof route.redirect !== 'string' || route.redirect.length === 0) {
            collector.add(
              'ROUTE_REDIRECT_INVALID',
              `Route '${route.id}' redirect must be a non-empty route id when present.`,
              `application.routes[${route.id}].redirect`,
            );
          } else {
            redirectTargets.set(route.id, route.redirect);
          }
          if (route.screenId !== undefined) {
            collector.add(
              'ROUTE_REDIRECT_INVALID',
              `Route '${route.id}' declares both a redirect and a screen; a redirect route renders no screen.`,
              `application.routes[${route.id}].screenId`,
            );
          }
        }
      }
      if (route.nav !== undefined) {
        collector.unknownFields(route.nav, NAV_FIELDS, `application.routes[${route.id}].nav`);
        // Reachable numeric identity fields are value-checked (MED-04-F): a
        // NaN/Infinity order would silently coerce under canonicalization and
        // create ambiguous identity.
        if (
          route.nav.order !== undefined &&
          (typeof route.nav.order !== 'number' ||
            !Number.isFinite(route.nav.order) ||
            Object.is(route.nav.order, -0))
        ) {
          collector.add(
            'APPLICATION_NON_CANONICAL_VALUE',
            `Route '${route.id}' nav.order must be a finite number (received ${describeReceivedType(route.nav.order)}).`,
            `application.routes[${route.id}].nav.order`,
          );
        }
      }
      // Route->screen resolution is checked after the screens map is built.
      // @2 redirect routes are exempt: they declare no screen at all.
      routeScreenResolutions.push((collector, screens: ReadonlyMap<string, ScreenDefinition>) => {
        if (isV2 && route.redirect !== undefined) {
          return;
        }
        if (route.screenId === undefined) {
          collector.add(
            'ROUTE_SCREEN_REQUIRED',
            `Route '${route.id}' must declare a screen${isV2 ? ' or a redirect' : ''}.`,
            `application.routes[${route.id}].screenId`,
          );
          return;
        }
        if (!screens.has(route.screenId)) {
          collector.add(
            'UNKNOWN_ROUTE_SCREEN',
            `Route '${route.id}' targets unknown screen '${route.screenId}'.`,
            `application.routes[${route.id}].screenId`,
          );
        }
      });
    }
    if (isV2 && redirectTargets.size > 0) {
      // Redirect targets must exist; redirect chains must terminate. The
      // chain walk is bounded by the route count, so cycles fail with a
      // structured diagnostic instead of looping.
      for (const [sourceId, firstTarget] of redirectTargets) {
        let current = firstTarget;
        const visited = new Set<string>([sourceId]);
        let ok = true;
        for (let hop = 0; hop <= redirectTargets.size + 1; hop += 1) {
          if (!routeIds.has(current)) {
            collector.add(
              'ROUTE_REDIRECT_INVALID',
              `Route '${sourceId}' redirects to unknown route '${current}'.`,
              `application.routes[${sourceId}].redirect`,
            );
            ok = false;
            break;
          }
          if (visited.has(current)) {
            collector.add(
              'ROUTE_REDIRECT_CYCLE',
              `Route '${sourceId}' takes part in a redirect cycle.`,
              `application.routes[${sourceId}].redirect`,
            );
            ok = false;
            break;
          }
          visited.add(current);
          const next = redirectTargets.get(current);
          if (next === undefined) {
            break;
          }
          current = next;
        }
        if (ok && visited.size > redirectTargets.size + 1) {
          collector.add(
            'ROUTE_REDIRECT_CYCLE',
            `Route '${sourceId}' takes part in a redirect cycle.`,
            `application.routes[${sourceId}].redirect`,
          );
        }
      }
    }

    // ---- Screens --------------------------------------------------------------
    const screensById = new Map<string, ScreenDefinition>();
    const surfaceIds = new Set<string>();
    for (const screen of application.screens) {
      collector.unknownFields(screen, screenFields, `application.screens[${screen.id}]`);
      if (screensById.has(screen.id)) {
        collector.add(
          'DUPLICATE_SCREEN_ID',
          `Screen id '${screen.id}' is declared more than once.`,
          `application.screens[${screen.id}]`,
        );
        continue;
      }
      screensById.set(screen.id, screen);
      if (isV2 && screen.breadcrumbs !== undefined) {
        for (const [index, crumb] of screen.breadcrumbs.entries()) {
          collector.unknownFields(
            crumb,
            BREADCRUMB_FIELDS,
            `application.screens[${screen.id}].breadcrumbs[${index}]`,
          );
          if (typeof crumb.label !== 'string' || crumb.label.length === 0) {
            collector.add(
              'INVALID_SURFACE_DECLARATION',
              `Breadcrumb ${index} of screen '${screen.id}' must declare a non-empty label.`,
              `application.screens[${screen.id}].breadcrumbs[${index}].label`,
            );
          }
          if (crumb.routeId !== undefined && !routeIds.has(crumb.routeId)) {
            collector.add(
              'UNKNOWN_BREADCRUMB_ROUTE',
              `Breadcrumb ${index} of screen '${screen.id}' references unknown route '${crumb.routeId}'.`,
              `application.screens[${screen.id}].breadcrumbs[${index}].routeId`,
            );
          }
        }
      }
      const regionNames = new Set<string>();
      for (const region of screen.layout) {
        collector.unknownFields(
          region,
          REGION_FIELDS,
          `application.screens[${screen.id}].layout[${region.name}]`,
        );
        if (regionNames.has(region.name)) {
          collector.add(
            'DUPLICATE_REGION_NAME',
            `Region '${region.name}' is declared more than once on screen '${screen.id}'.`,
            `application.screens[${screen.id}].layout[${region.name}]`,
          );
        }
        regionNames.add(region.name);
        for (const surface of region.surfaces) {
          collectSurface(
            collector,
            surface,
            `application.screens[${screen.id}]`,
            surfaceIds,
            surfaceResolutions,
            isV2,
          );
        }
      }
      const states = screen.states;
      if (states !== undefined) {
        collector.unknownFields(states, statesFields, `application.screens[${screen.id}].states`);
        for (const [name, surface] of Object.entries(states)) {
          if (surface !== undefined) {
            collectSurface(
              collector,
              surface,
              `application.screens[${screen.id}].states.${name}`,
              surfaceIds,
              surfaceResolutions,
              isV2,
            );
          }
        }
      }
    }
    // Route->screen targets are resolved now that the screens map is complete.
    for (const routeCheck of routeScreenResolutions) {
      routeCheck(collector, screensById);
    }

    // ---- Views / forms / actions ------------------------------------------------
    const viewIds = new Set<string>();
    const viewsById = new Map<string, ViewBinding>();
    for (const view of application.views ?? []) {
      collector.unknownFields(view, VIEW_FIELDS, `application.views[${view.viewId}]`);
      if (viewIds.has(view.viewId)) {
        collector.add(
          'DUPLICATE_VIEW_ID',
          `View '${view.viewId}' is declared more than once.`,
          `application.views[${view.viewId}]`,
        );
        continue;
      }
      viewIds.add(view.viewId);
      viewsById.set(view.viewId, view);
      collectResourceReference(
        collector,
        application,
        view.resourceId,
        view.resourceRevision,
        providedResources,
        `application.views[${view.viewId}]`,
      );
      for (const field of view.fields ?? []) {
        checkCatalogueField(
          collector,
          providedResources.get(view.resourceId),
          field,
          `application.views[${view.viewId}].fields`,
        );
      }
    }

    const formIds = new Set<string>();
    const formsById = new Map<string, FormBinding>();
    for (const form of application.forms ?? []) {
      collector.unknownFields(form, FORM_FIELDS, `application.forms[${form.formId}]`);
      if (formIds.has(form.formId)) {
        collector.add(
          'DUPLICATE_FORM_ID',
          `Form '${form.formId}' is declared more than once.`,
          `application.forms[${form.formId}]`,
        );
        continue;
      }
      formIds.add(form.formId);
      formsById.set(form.formId, form);
      collectResourceReference(
        collector,
        application,
        form.resourceId,
        form.resourceRevision,
        providedResources,
        `application.forms[${form.formId}]`,
      );
      checkContractReference(
        collector,
        providedContracts,
        form.inputContractId,
        form.inputContractRevision,
        `application.forms[${form.formId}].inputContractId`,
      );
      for (const field of form.fields) {
        collector.unknownFields(
          field,
          FORM_FIELD_FIELDS,
          `application.forms[${form.formId}].fields[${field.name}]`,
        );
        checkCatalogueField(
          collector,
          providedResources.get(form.resourceId),
          field.name,
          `application.forms[${form.formId}].fields`,
        );
      }
    }

    const actionIds = new Set<string>();
    const actionsById = new Map<string, ActionDefinition>();
    for (const action of application.actions) {
      collector.unknownFields(
        action,
        ACTION_FIELDS.get(action.kind) ?? ACTION_BASE_FIELDS,
        `application.actions[${action.id}]`,
      );
      if (actionIds.has(action.id)) {
        collector.add(
          'DUPLICATE_ACTION_ID',
          `Action '${action.id}' is declared more than once.`,
          `application.actions[${action.id}]`,
        );
        continue;
      }
      actionIds.add(action.id);
      actionsById.set(action.id, action);
      if (!ACTION_FIELDS.has(action.kind)) {
        collector.add(
          'UNKNOWN_SURFACE_ROLE',
          `Action '${action.id}' declares unknown kind '${String((action as { kind?: unknown }).kind)}'.`,
          `application.actions[${action.id}].kind`,
        );
        continue;
      }
      if (action.kind === 'navigation') {
        if (!routeIds.has(action.routeId)) {
          collector.add(
            'UNKNOWN_ROUTE_REFERENCE',
            `Navigation action '${action.id}' targets unknown route '${action.routeId}'.`,
            `application.actions[${action.id}].routeId`,
          );
        }
      } else if (action.kind === 'query' || action.kind === 'mutation') {
        collectResourceReference(
          collector,
          application,
          action.resourceId,
          action.resourceRevision,
          providedResources,
          `application.actions[${action.id}]`,
        );
        if (action.kind === 'mutation') {
          const resource = providedResources.get(action.resourceId);
          const declared = resource?.mutations?.some((mutation) => mutation.op === action.op);
          if (
            resource !== undefined &&
            action.resourceRevision === resource.revision &&
            !declared
          ) {
            collector.add(
              'MUTATION_NOT_DECLARED',
              `Mutation action '${action.id}' uses op '${action.op}' which resource '${action.resourceId}' does not declare.`,
              `application.actions[${action.id}].op`,
            );
          }
        }
        if (action.inputContractId !== undefined) {
          checkContractReference(
            collector,
            providedContracts,
            action.inputContractId,
            action.inputContractRevision,
            `application.actions[${action.id}].inputContractId`,
          );
        }
        if (action.outputContractId !== undefined) {
          checkContractReference(
            collector,
            providedContracts,
            action.outputContractId,
            action.outputContractRevision,
            `application.actions[${action.id}].outputContractId`,
          );
        }
      } else if (action.kind === 'capability') {
        const expectedRevision = providedCapabilities.get(action.capabilityId);
        if (expectedRevision === undefined) {
          collector.add(
            'UNKNOWN_CAPABILITY_REFERENCE',
            `Capability action '${action.id}' references unknown capability '${action.capabilityId}'.`,
            `application.actions[${action.id}].capabilityId`,
          );
        } else if (expectedRevision !== action.capabilityRevision) {
          collector.add(
            'CAPABILITY_REVISION_MISMATCH',
            `Capability action '${action.id}' references capability '${action.capabilityId}' revision '${action.capabilityRevision}' but the runtime declares '${expectedRevision}'.`,
            `application.actions[${action.id}].capabilityRevision`,
          );
        }
        checkContractReference(
          collector,
          providedContracts,
          action.inputContractId,
          action.inputContractRevision,
          `application.actions[${action.id}].inputContractId`,
        );
        if (action.outputContractId !== undefined) {
          checkContractReference(
            collector,
            providedContracts,
            action.outputContractId,
            action.outputContractRevision,
            `application.actions[${action.id}].outputContractId`,
          );
        }
      } else if (action.kind === 'local') {
        if (action.inputContractId !== undefined) {
          checkContractReference(
            collector,
            providedContracts,
            action.inputContractId,
            undefined,
            `application.actions[${action.id}].inputContractId`,
          );
        }
      }
    }

    // ---- Referenced resources + components --------------------------------------
    const resourceReferences = new Set<string>();
    for (const reference of application.resources) {
      collector.unknownFields(
        reference,
        RESOURCE_REF_FIELDS,
        `application.resources[${reference.resourceId}]`,
      );
      if (resourceReferences.has(reference.resourceId)) {
        collector.add(
          'DUPLICATE_RESOURCE_REFERENCE',
          `Resource '${reference.resourceId}' is referenced more than once.`,
          `application.resources[${reference.resourceId}]`,
        );
        continue;
      }
      resourceReferences.add(reference.resourceId);
      const provided = providedResources.get(reference.resourceId);
      if (provided === undefined) {
        collector.add(
          'UNKNOWN_RESOURCE',
          `Application references resource '${reference.resourceId}' which was not provided.`,
          `application.resources[${reference.resourceId}]`,
        );
      } else if (provided.revision !== reference.revision) {
        collector.add(
          'RESOURCE_REVISION_MISMATCH',
          `Application references resource '${reference.resourceId}' revision '${reference.revision}' but the provided definition is '${provided.revision}'.`,
          `application.resources[${reference.resourceId}]`,
        );
      } else {
        // Explicit contract references of the resource must resolve.
        for (const [role, contractId] of [
          ['input', provided.inputContract],
          ['output', provided.outputContract],
        ] as const) {
          if (contractId !== undefined && !providedContracts.has(contractId)) {
            collector.add(
              'UNKNOWN_CONTRACT_REFERENCE',
              `Resource '${reference.resourceId}' ${role} contract '${contractId}' is unknown.`,
              `resources[${reference.resourceId}]`,
            );
          }
        }
      }
    }

    const componentRefs = new Map<string, string>();
    for (const component of application.components ?? []) {
      collector.unknownFields(
        component,
        COMPONENT_FIELDS,
        `application.components[${component.componentId}]`,
      );
      if (componentRefs.has(component.componentId)) {
        collector.add(
          'DUPLICATE_COMPONENT_REFERENCE',
          `Component '${component.componentId}' is referenced more than once.`,
          `application.components[${component.componentId}]`,
        );
        continue;
      }
      componentRefs.set(component.componentId, component.revision);
      const provided = providedComponents.get(component.componentId);
      if (provided === undefined) {
        collector.add(
          'UNKNOWN_COMPONENT_REFERENCE',
          `Application references component '${component.componentId}' which is not in the registry.`,
          `application.components[${component.componentId}]`,
        );
      } else if (provided !== component.revision) {
        collector.add(
          'COMPONENT_REVISION_MISMATCH',
          `Application references component '${component.componentId}' revision '${component.revision}' but the registry declares '${provided}'.`,
          `application.components[${component.componentId}]`,
        );
      }
    }

    // ---- Theme tokens (@2) -------------------------------------------------------
    if (isV2 && application.theme !== undefined && typeof application.theme === 'object') {
      const theme = application.theme as ThemeDeclaration;
      const themeFields = new Set(['reference', 'tokens']);
      collector.unknownFields(theme, themeFields, 'application.theme');
      if (
        theme.reference !== undefined &&
        (typeof theme.reference !== 'string' || theme.reference.trim().length === 0)
      ) {
        collector.add(
          'INVALID_THEME_TOKEN',
          'The theme reference must be a non-empty, non-whitespace string when present.',
          'application.theme.reference',
        );
      }
      if (theme.tokens !== undefined) {
        if (!Array.isArray(theme.tokens)) {
          collector.add(
            'INVALID_THEME_TOKEN',
            'Theme tokens must be an array of { name, value } assignments against the closed token vocabulary.',
            'application.theme.tokens',
          );
        } else {
          const seenTokens = new Set<string>();
          for (const [index, assignment] of theme.tokens.entries()) {
            const path = `application.theme.tokens[${index}]`;
            collector.unknownFields(assignment, new Set(['name', 'value']), path);
            if (
              typeof assignment.name !== 'string' ||
              !THEME_TOKEN_NAMES.includes(assignment.name)
            ) {
              collector.add(
                'INVALID_THEME_TOKEN',
                'Theme token name is outside the closed semantic token vocabulary.',
                `${path}.name`,
              );
            } else if (seenTokens.has(assignment.name)) {
              collector.add(
                'INVALID_THEME_TOKEN',
                `Theme token '${assignment.name}' is assigned more than once.`,
                `${path}.name`,
              );
            } else {
              seenTokens.add(assignment.name);
            }
            if (
              typeof assignment.value !== 'string' ||
              assignment.value.length === 0 ||
              assignment.value.length > 200 ||
              !THEME_TOKEN_VALUE_SAFE.test(assignment.value) ||
              /url\s*\(/i.test(assignment.value) ||
              /@\s*import/i.test(assignment.value) ||
              /expression\s*\(/i.test(assignment.value)
            ) {
              collector.add(
                'INVALID_THEME_TOKEN_VALUE',
                'Theme token values must be short plain CSS variable values; CSS structure, url(), imports, and expressions are rejected.',
                `${path}.value`,
              );
            }
          }
        }
      }
    }

    // ---- Cross-references from surfaces (deferred until the maps exist) --------
    for (const resolution of surfaceResolutions) {
      resolution(collector, {
        viewsById,
        formsById,
        actionsById,
        routeIds,
        componentRefs,
        resources: providedResources,
      });
    }

    const issues = collector.sorted();
    if (issues.length > 0) {
      return { ok: false, issues };
    }

    // ---- Assemble the immutable plan --------------------------------------------
    // Identity inputs are canonicalized STRICTLY: any out-of-domain value
    // (NaN, Infinity, -0, BigInt, Date, function, symbol, sparse array,
    // cyclic structure, exotic prototype, throwing getter/proxy) fails
    // compilation with a structured diagnostic — no ambiguous
    // applicationVersion is ever produced (MED-04-F).
    let manifest: Record<string, unknown>;
    let applicationVersion: string;
    try {
      manifest = deepFreeze(cloneForFreeze(canonicalApplicationManifest(application))) as Record<
        string,
        unknown
      >;
      applicationVersion = computeApplicationVersion({ application, resources: input.resources });
    } catch (error) {
      if (error instanceof CanonicalIdentityError) {
        return {
          ok: false,
          issues: [
            {
              code: 'APPLICATION_NON_CANONICAL_VALUE',
              message: error.message,
              ...(error.path !== '(root)' ? { path: error.path } : {}),
            },
          ],
        };
      }
      return {
        ok: false,
        issues: [
          {
            code: 'APPLICATION_COMPILATION_FAILED',
            message:
              'The application definition could not be canonicalized; identity inputs must be plain, finite, acyclic data.',
          },
        ],
      };
    }

    // Deep-copy then freeze: compilers operate on DEFENSIVE COPIES and never
    // freeze or mutate caller-owned objects (LOW-04-F remediation).
    const screensFrozen: Record<string, Readonly<ScreenDefinition>> = {};
    for (const screen of application.screens) {
      screensFrozen[screen.id] = deepFreezeClone(screen);
    }
    const viewsFrozen: Record<string, Readonly<ViewBinding>> = {};
    for (const view of application.views ?? []) {
      viewsFrozen[view.viewId] = deepFreezeClone(view);
    }
    const formsFrozen: Record<string, Readonly<FormBinding>> = {};
    for (const form of application.forms ?? []) {
      formsFrozen[form.formId] = deepFreezeClone(form);
    }
    const actionsFrozen: Record<string, Readonly<ActionDefinition>> = {};
    for (const action of application.actions) {
      actionsFrozen[action.id] = deepFreezeClone(action);
    }
    const resourcesFrozen: Record<string, Readonly<ResourceDefinition>> = {};
    for (const reference of application.resources) {
      const resource = providedResources.get(reference.resourceId);
      if (resource !== undefined) {
        resourcesFrozen[resource.id] = deepFreezeClone(resource);
      }
    }
    const routesFrozen = deepFreeze(
      application.routes.map((route) => ({
        route: cloneForFreeze(route),
        screen:
          route.screenId !== undefined
            ? cloneForFreeze(screensById.get(route.screenId) as ScreenDefinition)
            : null,
      })),
    );

    const plan: ApplicationPlan = Object.freeze({
      applicationId: application.id,
      applicationRevision: application.revision,
      applicationVersion,
      manifest,
      routes: routesFrozen,
      screens: Object.freeze(screensFrozen),
      views: Object.freeze(viewsFrozen),
      forms: Object.freeze(formsFrozen),
      actions: Object.freeze(actionsFrozen),
      resources: Object.freeze(resourcesFrozen),
      components: deepFreeze([...(application.components ?? [])].map(cloneForFreeze)),
      toJSON(): Record<string, unknown> {
        return {
          applicationId: application.id,
          applicationRevision: application.revision,
          applicationVersion,
          manifest: canonicalApplicationManifest(application),
          routes: routesFrozen,
          screens: screensFrozen,
          views: viewsFrozen,
          forms: formsFrozen,
          actions: actionsFrozen,
          resources: resourcesFrozen,
          components: [...(application.components ?? [])],
        };
      },
    });
    return { ok: true, plan };
  } catch (error) {
    if (error instanceof CanonicalIdentityError) {
      return {
        ok: false,
        issues: [
          {
            code: 'APPLICATION_NON_CANONICAL_VALUE',
            message: error.message,
            ...(error.path !== '(root)' ? { path: error.path } : {}),
          },
        ],
      };
    }
    return {
      ok: false,
      issues: [
        {
          code: 'APPLICATION_COMPILATION_FAILED',
          message:
            'The application definition could not be processed (hostile getter, proxy, or invalid prototype); compilation fails safely with this structured diagnostic.',
        },
      ],
    };
  }
}

/* ------------------------------------------------------------------ */
/* Deferred resolutions (route->screen, then surface cross-refs)       */
/* ------------------------------------------------------------------ */

type RouteScreenResolution = (
  collector: Collector,
  screens: ReadonlyMap<string, ScreenDefinition>,
) => void;

type SurfaceResolution = (
  collector: Collector,
  maps: {
    readonly viewsById: ReadonlyMap<string, ViewBinding>;
    readonly formsById: ReadonlyMap<string, FormBinding>;
    readonly actionsById: ReadonlyMap<string, ActionDefinition>;
    readonly routeIds: ReadonlySet<string>;
    readonly componentRefs: ReadonlyMap<string, string>;
    readonly resources: ReadonlyMap<string, ResourceDefinition>;
  },
) => void;

function resolveSurfaceLater(
  surface: Surface,
  path: string,
  resolutions: SurfaceResolution[],
): void {
  resolutions.push((collector, maps) => {
    switch (surface.role) {
      case 'view':
      case 'states': {
        if (!maps.viewsById.has(surface.viewId)) {
          collector.add(
            'UNKNOWN_VIEW_REFERENCE',
            `Surface '${surface.id}' references unknown view '${surface.viewId}'.`,
            `${path}.viewId`,
          );
        }
        collectConditionIssues(collector, surface, path, maps);
        break;
      }
      case 'form': {
        if (!maps.formsById.has(surface.formId)) {
          collector.add(
            'UNKNOWN_FORM_REFERENCE',
            `Surface '${surface.id}' references unknown form '${surface.formId}'.`,
            `${path}.formId`,
          );
        }
        collectConditionIssues(collector, surface, path, maps);
        break;
      }
      case 'action': {
        if (!maps.actionsById.has(surface.actionId)) {
          collector.add(
            'UNKNOWN_ACTION_REFERENCE',
            `Action surface '${surface.id}' references unknown action '${surface.actionId}'.`,
            `${path}.actionId`,
          );
        }
        if (surface.disabledWhen !== undefined) {
          collector.unknownFields(
            surface.disabledWhen,
            DISABLED_CONDITION_FIELDS,
            `${path}.disabledWhen`,
          );
          if (
            typeof surface.disabledWhen.paramMissing !== 'string' ||
            surface.disabledWhen.paramMissing.length === 0
          ) {
            collector.add(
              'INVALID_SURFACE_DISABLED_CONDITION',
              `Action surface '${surface.id}' disabledWhen.paramMissing must be a non-empty route-parameter name.`,
              `${path}.disabledWhen`,
            );
          }
        }
        collectConditionIssues(collector, surface, path, maps);
        break;
      }
      case 'component': {
        const declared = maps.componentRefs.get(surface.componentId);
        if (declared === undefined) {
          collector.add(
            'UNKNOWN_COMPONENT_REFERENCE',
            `Component surface '${surface.id}' references unknown component '${surface.componentId}'.`,
            `${path}.componentId`,
          );
        } else if (declared !== surface.revision) {
          collector.add(
            'COMPONENT_REVISION_MISMATCH',
            `Component surface '${surface.id}' references component '${surface.componentId}' revision '${surface.revision}' but the application declares '${declared}'.`,
            `${path}.revision`,
          );
        }
        collectConditionIssues(collector, surface, path, maps);
        break;
      }
      case 'text': {
        if (
          surface.level !== undefined &&
          (typeof surface.level !== 'number' ||
            !Number.isSafeInteger(surface.level) ||
            surface.level < 1 ||
            surface.level > 6)
        ) {
          collector.add(
            'INVALID_SURFACE_DECLARATION',
            `Text surface '${surface.id}' level must be an integer between 1 and 6 when present.`,
            `${path}.level`,
          );
        }
        collectConditionIssues(collector, surface, path, maps);
        break;
      }
      case 'list': {
        collectViewFieldIssues(
          collector,
          maps,
          surface.id,
          surface.viewId,
          [
            ['titleField', surface.titleField],
            ['secondaryField', surface.secondaryField],
          ],
          path,
        );
        collectConditionIssues(collector, surface, path, maps);
        break;
      }
      case 'table': {
        if (
          surface.pageSize !== undefined &&
          (typeof surface.pageSize !== 'number' ||
            !Number.isSafeInteger(surface.pageSize) ||
            surface.pageSize <= 0)
        ) {
          collector.add(
            'INVALID_TABLE_DECLARATION',
            `Table surface '${surface.id}' pageSize must be a positive safe integer when present.`,
            `${path}.pageSize`,
          );
        }
        if (surface.columns !== undefined) {
          for (const [index, column] of surface.columns.entries()) {
            collector.unknownFields(column, TABLE_COLUMN_FIELDS, `${path}.columns[${index}]`);
          }
          collectViewFieldIssues(
            collector,
            maps,
            surface.id,
            surface.viewId,
            surface.columns.map(
              (column, index) => [`columns[${index}].field`, column.field] as const,
            ),
            path,
          );
        }
        if (surface.searchFields !== undefined) {
          collectViewFieldIssues(
            collector,
            maps,
            surface.id,
            surface.viewId,
            surface.searchFields.map((field, index) => [`searchFields[${index}]`, field] as const),
            path,
          );
        }
        if (surface.filterFields !== undefined) {
          collectViewFieldIssues(
            collector,
            maps,
            surface.id,
            surface.viewId,
            surface.filterFields.map((field, index) => [`filterFields[${index}]`, field] as const),
            path,
          );
        }
        if (surface.queryActionId !== undefined) {
          const action = maps.actionsById.get(surface.queryActionId);
          if (action === undefined) {
            collector.add(
              'UNKNOWN_ACTION_REFERENCE',
              `Table surface '${surface.id}' references unknown query action '${surface.queryActionId}'.`,
              `${path}.queryActionId`,
            );
          } else if (action.kind !== 'query') {
            collector.add(
              'INVALID_ACTION_BINDING',
              `Table surface '${surface.id}' queryActionId must reference a query action; '${surface.queryActionId}' is a '${action.kind}' action.`,
              `${path}.queryActionId`,
            );
          }
        }
        collectConditionIssues(collector, surface, path, maps);
        break;
      }
      case 'detail': {
        collectViewFieldIssues(
          collector,
          maps,
          surface.id,
          surface.viewId,
          (surface.fields ?? []).map((field, index) => [`fields[${index}]`, field] as const),
          path,
        );
        collectConditionIssues(collector, surface, path, maps);
        break;
      }
      case 'chart': {
        if (typeof surface.kind !== 'string' || !CHART_KINDS.has(surface.kind)) {
          collector.add(
            'INVALID_CHART_DECLARATION',
            `Chart surface '${surface.id}' kind must be one of: bar, line.`,
            `${path}.kind`,
          );
        }
        if (!maps.viewsById.has(surface.viewId)) {
          collector.add(
            'UNKNOWN_VIEW_REFERENCE',
            `Surface '${surface.id}' references unknown view '${surface.viewId}'.`,
            `${path}.viewId`,
          );
        }
        if (typeof surface.summary !== 'string' || surface.summary.length === 0) {
          collector.add(
            'INVALID_CHART_DECLARATION',
            `Chart surface '${surface.id}' must declare a non-empty accessible summary.`,
            `${path}.summary`,
          );
        }
        collectViewFieldIssues(
          collector,
          maps,
          surface.id,
          surface.viewId,
          [
            ['xField', surface.xField],
            ['yField', surface.yField],
          ],
          path,
        );
        collectConditionIssues(collector, surface, path, maps);
        break;
      }
      case 'status': {
        if (surface.value !== undefined && surface.field !== undefined) {
          collector.add(
            'INVALID_STATUS_DECLARATION',
            `Status surface '${surface.id}' must declare a static value or a record field, not both.`,
            path,
          );
        }
        if (surface.value === undefined && surface.field === undefined) {
          collector.add(
            'INVALID_STATUS_DECLARATION',
            `Status surface '${surface.id}' must declare either a static value or a record field.`,
            path,
          );
        }
        if (surface.tones !== undefined) {
          for (const [value, tone] of Object.entries(surface.tones)) {
            if (value.length === 0 || !STATUS_TONES.has(tone)) {
              collector.add(
                'INVALID_STATUS_DECLARATION',
                `Status surface '${surface.id}' declares an invalid tone mapping.`,
                `${path}.tones`,
              );
              break;
            }
          }
        }
        collectConditionIssues(collector, surface, path, maps);
        break;
      }
      case 'tabs': {
        collectConditionIssues(collector, surface, path, maps);
        break;
      }
      case 'dialog':
      case 'drawer': {
        collectConditionIssues(collector, surface, path, maps);
        break;
      }
      case 'conversation': {
        if (!maps.viewsById.has(surface.viewId)) {
          collector.add(
            'UNKNOWN_VIEW_REFERENCE',
            `Surface '${surface.id}' references unknown view '${surface.viewId}'.`,
            `${path}.viewId`,
          );
        }
        collectViewFieldIssues(
          collector,
          maps,
          surface.id,
          surface.viewId,
          [
            ['messageField', surface.messageField],
            ['authorField', surface.authorField],
            ['participantField', surface.participantField],
          ],
          path,
        );
        const sendAction = maps.actionsById.get(surface.sendActionId);
        if (sendAction === undefined) {
          collector.add(
            'UNKNOWN_ACTION_REFERENCE',
            `Conversation surface '${surface.id}' references unknown send action '${surface.sendActionId}'.`,
            `${path}.sendActionId`,
          );
        } else if (sendAction.kind !== 'mutation' && sendAction.kind !== 'capability') {
          collector.add(
            'INVALID_ACTION_BINDING',
            `Conversation surface '${surface.id}' sendActionId must reference a mutation or capability action; '${surface.sendActionId}' is a '${sendAction.kind}' action.`,
            `${path}.sendActionId`,
          );
        }
        collectConditionIssues(collector, surface, path, maps);
        break;
      }
      default:
        break;
    }
  });
}

/** Validate one surface's optional visibleWhen condition against the maps. */
function collectConditionIssues(
  collector: Collector,
  surface: { readonly id: string; readonly visibleWhen?: Surface['visibleWhen'] },
  path: string,
  maps: {
    readonly viewsById: ReadonlyMap<string, ViewBinding>;
  },
): void {
  const condition = surface.visibleWhen;
  if (condition === undefined) {
    return;
  }
  collector.unknownFields(condition, CONDITION_FIELDS, `${path}.visibleWhen`);
  const declared = ['viewNonEmpty', 'viewEmpty', 'paramEquals'].filter(
    (key) => (condition as Record<string, unknown>)[key] !== undefined,
  );
  if (declared.length !== 1) {
    collector.add(
      'INVALID_SURFACE_CONDITION',
      `Surface '${surface.id}' visibleWhen must declare exactly one condition (viewNonEmpty, viewEmpty, or paramEquals).`,
      `${path}.visibleWhen`,
    );
    return;
  }
  if (condition.viewNonEmpty !== undefined) {
    if (!maps.viewsById.has(condition.viewNonEmpty)) {
      collector.add(
        'UNKNOWN_VIEW_REFERENCE',
        `Surface '${surface.id}' visibleWhen references unknown view '${condition.viewNonEmpty}'.`,
        `${path}.visibleWhen.viewNonEmpty`,
      );
    }
  } else if (condition.viewEmpty !== undefined) {
    if (!maps.viewsById.has(condition.viewEmpty)) {
      collector.add(
        'UNKNOWN_VIEW_REFERENCE',
        `Surface '${surface.id}' visibleWhen references unknown view '${condition.viewEmpty}'.`,
        `${path}.visibleWhen.viewEmpty`,
      );
    }
  } else if (condition.paramEquals !== undefined) {
    collector.unknownFields(
      condition.paramEquals,
      CONDITION_PARAM_EQUALS_FIELDS,
      `${path}.visibleWhen.paramEquals`,
    );
    if (
      typeof condition.paramEquals.name !== 'string' ||
      condition.paramEquals.name.length === 0 ||
      typeof condition.paramEquals.value !== 'string'
    ) {
      collector.add(
        'INVALID_SURFACE_CONDITION',
        `Surface '${surface.id}' visibleWhen.paramEquals must declare a non-empty parameter name and a string value.`,
        `${path}.visibleWhen.paramEquals`,
      );
    }
  }
}

/**
 * Validate that surface-bound fields exist in the bound view's projection
 * (falling back to the resource's explicit field catalogue when the view
 * does not narrow fields).
 */
function collectViewFieldIssues(
  collector: Collector,
  maps: {
    readonly viewsById: ReadonlyMap<string, ViewBinding>;
    readonly resources: ReadonlyMap<string, ResourceDefinition>;
  },
  surfaceId: string,
  viewId: string,
  fields: readonly (readonly [string, string | undefined])[],
  path: string,
): void {
  const view = maps.viewsById.get(viewId);
  if (view === undefined) {
    return; // unknown-view already diagnosed
  }
  const resource = maps.resources.get(view.resourceId);
  for (const [fieldPath, fieldName] of fields) {
    if (fieldName === undefined) {
      continue;
    }
    const inProjection = view.fields === undefined || view.fields.includes(fieldName);
    const inCatalogue = resource === undefined || resource.fields.some((f) => f.name === fieldName);
    if (!inProjection || !inCatalogue) {
      collector.add(
        'UNKNOWN_FIELD',
        `Surface '${surfaceId}' field '${fieldName}' is not part of view '${viewId}' or the bound resource catalogue.`,
        `${path}.${fieldPath}`,
      );
    }
  }
}

function collectSurface(
  collector: Collector,
  surface: Surface,
  screenPath: string,
  surfaceIds: Set<string>,
  resolutions: SurfaceResolution[],
  isV2: boolean = false,
): void {
  const path = `${screenPath} (surface '${surface.id}')`;
  const allowed = (isV2 ? SURFACE_FIELDS_V2 : SURFACE_FIELDS).get(surface.role);
  if (allowed === undefined) {
    collector.add(
      'UNKNOWN_SURFACE_ROLE',
      `Surface '${String((surface as { id?: unknown }).id)}' declares unknown role '${String((surface as { role?: unknown }).role)}'.`,
      `${screenPath}.surfaces[${String((surface as { id?: unknown }).id)}]`,
    );
    return;
  }
  if (surfaceIds.has(surface.id)) {
    collector.add(
      'DUPLICATE_SURFACE_ID',
      `Surface id '${surface.id}' is declared more than once.`,
      path,
    );
  }
  surfaceIds.add(surface.id);
  collector.unknownFields(surface, allowed, path);
  if (isV2 && surface.visibleWhen !== undefined) {
    if (typeof surface.visibleWhen !== 'object' || surface.visibleWhen === null) {
      collector.add(
        'INVALID_SURFACE_CONDITION',
        `Surface '${surface.id}' visibleWhen must be an object with exactly one condition.`,
        `${path}.visibleWhen`,
      );
    }
  }
  if (isV2) {
    // Nested content surfaces of tabs/dialogs/drawers are validated with the
    // SAME closed field sets, surface-id uniqueness, and deferred
    // cross-reference checks as top-level surfaces.
    if (surface.role === 'tabs') {
      if (!Array.isArray(surface.tabs) || surface.tabs.length === 0) {
        collector.add(
          'INVALID_TABS_DECLARATION',
          `Tabs surface '${surface.id}' must declare a non-empty tabs array.`,
          `${path}.tabs`,
        );
      } else {
        const tabNames = new Set<string>();
        for (const [index, tab] of surface.tabs.entries()) {
          const tabPath = `${path}.tabs[${index}]`;
          collector.unknownFields(tab, TAB_FIELDS, tabPath);
          if (typeof tab.name !== 'string' || tab.name.length === 0) {
            collector.add(
              'INVALID_TABS_DECLARATION',
              `Tab ${index} of surface '${surface.id}' must declare a non-empty name.`,
              `${tabPath}.name`,
            );
          } else if (tabNames.has(tab.name)) {
            collector.add(
              'DUPLICATE_TAB_NAME',
              `Tab name '${tab.name}' is declared more than once on surface '${surface.id}'.`,
              `${tabPath}.name`,
            );
          } else {
            tabNames.add(tab.name);
          }
          if (typeof tab.label !== 'string' || tab.label.length === 0) {
            collector.add(
              'INVALID_TABS_DECLARATION',
              `Tab ${index} of surface '${surface.id}' must declare a non-empty label.`,
              `${tabPath}.label`,
            );
          }
          if (Array.isArray(tab.surfaces)) {
            for (const nested of tab.surfaces) {
              collectSurface(
                collector,
                nested,
                `${path}.tabs[${index}]`,
                surfaceIds,
                resolutions,
                true,
              );
            }
          }
        }
      }
    } else if (surface.role === 'dialog' || surface.role === 'drawer') {
      if (typeof surface.title !== 'string' || surface.title.length === 0) {
        collector.add(
          'INVALID_SURFACE_DECLARATION',
          `${surface.role} surface '${surface.id}' must declare a non-empty title.`,
          `${path}.title`,
        );
      }
      if (typeof surface.triggerLabel !== 'string' || surface.triggerLabel.length === 0) {
        collector.add(
          'INVALID_SURFACE_DECLARATION',
          `${surface.role} surface '${surface.id}' must declare a non-empty triggerLabel.`,
          `${path}.triggerLabel`,
        );
      }
      if (!Array.isArray(surface.content) || surface.content.length === 0) {
        collector.add(
          'INVALID_SURFACE_DECLARATION',
          `${surface.role} surface '${surface.id}' must declare non-empty content surfaces.`,
          `${path}.content`,
        );
      } else {
        for (const nested of surface.content) {
          collectSurface(collector, nested, path, surfaceIds, resolutions, true);
        }
      }
    }
  }
  resolveSurfaceLater(surface, path, resolutions);
}

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

function collectResourceReference(
  collector: Collector,
  application: ApplicationDefinition,
  resourceId: string,
  resourceRevision: string,
  provided: ReadonlyMap<string, ResourceDefinition>,
  path: string,
): void {
  const declared = application.resources.find((entry) => entry.resourceId === resourceId);
  if (declared === undefined) {
    collector.add(
      'UNKNOWN_RESOURCE_REFERENCE',
      `'${path}' references resource '${resourceId}' that the application does not declare.`,
      path,
    );
    return;
  }
  if (declared.revision !== resourceRevision) {
    collector.add(
      'RESOURCE_REVISION_MISMATCH',
      `'${path}' binds resource '${resourceId}' revision '${resourceRevision}' but the application declares '${declared.revision}'.`,
      path,
    );
    return;
  }
  const providedResource = provided.get(resourceId);
  if (providedResource !== undefined && providedResource.revision !== resourceRevision) {
    collector.add(
      'RESOURCE_REVISION_MISMATCH',
      `'${path}' binds resource '${resourceId}' revision '${resourceRevision}' but the provided definition is '${providedResource.revision}'.`,
      path,
    );
  }
}

function checkCatalogueField(
  collector: Collector,
  resource: ResourceDefinition | undefined,
  fieldName: string | { readonly name: string },
  path: string,
): void {
  const name = typeof fieldName === 'string' ? fieldName : fieldName.name;
  if (resource === undefined) {
    return; // unknown-resource already diagnosed
  }
  if (!resource.fields.some((field) => field.name === name)) {
    collector.add(
      'UNKNOWN_FIELD',
      `Field '${name}' is not in the explicit field catalogue of resource '${resource.id}'.`,
      path,
    );
  }
}

function checkContractReference(
  collector: Collector,
  provided: ReadonlyMap<string, string>,
  contractId: string,
  expectedRevision: string | undefined,
  path: string,
): void {
  const revision = provided.get(contractId);
  if (revision === undefined) {
    collector.add(
      'UNKNOWN_CONTRACT_REFERENCE',
      `Contract reference '${contractId}' is unknown.`,
      path,
    );
    return;
  }
  if (expectedRevision !== undefined && expectedRevision !== revision) {
    collector.add(
      'CONTRACT_REVISION_MISMATCH',
      `Contract '${contractId}' reference expects revision '${expectedRevision}' but the registry declares '${revision}'.`,
      path,
    );
  }
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

/** Shallow-structural clone of plain data (functions by reference). */
function cloneForFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(cloneForFreeze) as unknown as T;
  }
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      return value; // non-plain objects are retained as-is (declarations only)
    }
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = cloneForFreeze(item);
    }
    return out as unknown as T;
  }
  return value;
}

/** Clone then deep-freeze: the caller's object is never frozen or mutated. */
function deepFreezeClone<T>(value: T): T {
  return deepFreeze(cloneForFreeze(value));
}

/** Safe type description for a diagnostic (never the value itself). */
function describeReceivedType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}
