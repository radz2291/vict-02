import { APPLICATION_DEFINITION_SCHEMA } from '@vict/sdk';
import { sha256 } from './sha256.js';
import type {
  ActionDefinition,
  ApplicationDefinition,
  ComponentReference,
  FormBinding,
  ResourceDefinition,
  ScreenDefinition,
  Surface,
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
  | 'MUTATION_NOT_DECLARED';

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
const NAV_FIELDS: ReadonlySet<string> = new Set(['label', 'group', 'order']);
const SCREEN_FIELDS: ReadonlySet<string> = new Set(['id', 'title', 'layout', 'states']);
const REGION_FIELDS: ReadonlySet<string> = new Set(['name', 'surfaces']);
const STATES_FIELDS: ReadonlySet<string> = new Set([
  'loading',
  'empty',
  'validation',
  'denied',
  'failure',
]);
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

/** Stable JSON: recursively sorted object keys, arrays preserved in order. */
export function stableJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      const item = source[key];
      if (item !== undefined) {
        out[key] = canonicalize(item);
      }
    }
    return out;
  }
  return value;
}

/** Pure-TS SHA-256 (byte-identical to node:crypto; browser-safe). */
function sha256Hex(payload: string): string {
  return sha256(payload);
}

/** The application identity schema marker (versioned canonicalization + hash). */
export const APPLICATION_IDENTITY_SCHEMA = 'vict.application-identity@1';

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
      schema: APPLICATION_IDENTITY_SCHEMA,
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
  /** Resolved routes in NAVIGATION order with their screens. */
  readonly routes: readonly {
    readonly route: Readonly<ApplicationDefinition['routes'][number]>;
    readonly screen: Readonly<ScreenDefinition>;
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
  const collector = new Collector();
  const surfaceResolutions: SurfaceResolution[] = [];
  const routeScreenResolutions: RouteScreenResolution[] = [];
  const application = input.application;

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
  } else if (application.schema !== APPLICATION_DEFINITION_SCHEMA) {
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
  }
  if (typeof application.revision !== 'string' || application.revision.length === 0) {
    collector.add(
      'APPLICATION_EMPTY_REVISION',
      'Application revision must be a non-empty string.',
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
  for (const route of application.routes) {
    collector.unknownFields(route, ROUTE_FIELDS, `application.routes[${route.id}]`);
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
    if (route.nav !== undefined) {
      collector.unknownFields(route.nav, NAV_FIELDS, `application.routes[${route.id}].nav`);
    }
    // Route->screen resolution is checked after the screens map is built.
    routeScreenResolutions.push((collector, screens: ReadonlyMap<string, ScreenDefinition>) => {
      if (!screens.has(route.screenId)) {
        collector.add(
          'UNKNOWN_ROUTE_SCREEN',
          `Route '${route.id}' targets unknown screen '${route.screenId}'.`,
          `application.routes[${route.id}].screenId`,
        );
      }
    });
  }

  // ---- Screens --------------------------------------------------------------
  const screensById = new Map<string, ScreenDefinition>();
  const surfaceIds = new Set<string>();
  for (const screen of application.screens) {
    collector.unknownFields(screen, SCREEN_FIELDS, `application.screens[${screen.id}]`);
    if (screensById.has(screen.id)) {
      collector.add(
        'DUPLICATE_SCREEN_ID',
        `Screen id '${screen.id}' is declared more than once.`,
        `application.screens[${screen.id}]`,
      );
      continue;
    }
    screensById.set(screen.id, screen);
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
        );
      }
    }
    const states = screen.states;
    if (states !== undefined) {
      collector.unknownFields(states, STATES_FIELDS, `application.screens[${screen.id}].states`);
      for (const [name, surface] of Object.entries(states)) {
        if (surface !== undefined) {
          collectSurface(
            collector,
            surface,
            `application.screens[${screen.id}].states.${name}`,
            surfaceIds,
            surfaceResolutions,
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
        if (resource !== undefined && action.resourceRevision === resource.revision && !declared) {
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

  // ---- Cross-references from surfaces (deferred until the maps exist) --------
  for (const resolution of surfaceResolutions) {
    resolution(collector, {
      viewsById,
      formsById,
      actionsById,
      routeIds,
      componentRefs,
    });
  }

  const issues = collector.sorted();
  if (issues.length > 0) {
    return { ok: false, issues };
  }

  // ---- Assemble the immutable plan --------------------------------------------
  const manifest = deepFreeze(canonicalApplicationManifest(application)) as Record<string, unknown>;
  const applicationVersion = computeApplicationVersion({ application, resources: input.resources });

  const screensFrozen: Record<string, Readonly<ScreenDefinition>> = {};
  for (const screen of application.screens) {
    screensFrozen[screen.id] = deepFreeze(screen);
  }
  const viewsFrozen: Record<string, Readonly<ViewBinding>> = {};
  for (const view of application.views ?? []) {
    viewsFrozen[view.viewId] = deepFreeze(view);
  }
  const formsFrozen: Record<string, Readonly<FormBinding>> = {};
  for (const form of application.forms ?? []) {
    formsFrozen[form.formId] = deepFreeze(form);
  }
  const actionsFrozen: Record<string, Readonly<ActionDefinition>> = {};
  for (const action of application.actions) {
    actionsFrozen[action.id] = deepFreeze(action);
  }
  const resourcesFrozen: Record<string, Readonly<ResourceDefinition>> = {};
  for (const reference of application.resources) {
    const resource = providedResources.get(reference.resourceId);
    if (resource !== undefined) {
      resourcesFrozen[resource.id] = deepFreeze(resource);
    }
  }
  const routesFrozen = deepFreeze(
    application.routes.map((route) => ({
      route,
      screen: screensById.get(route.screenId) as ScreenDefinition,
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
    components: deepFreeze([...(application.components ?? [])]),
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
        break;
      }
      case 'text':
      default:
        break;
    }
  });
}

function collectSurface(
  collector: Collector,
  surface: Surface,
  screenPath: string,
  surfaceIds: Set<string>,
  resolutions: SurfaceResolution[],
): void {
  const path = `${screenPath} (surface '${surface.id}')`;
  const allowed = SURFACE_FIELDS.get(surface.role);
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
