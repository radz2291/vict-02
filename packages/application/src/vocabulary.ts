/**
 * Machine-readable Application-Definition vocabulary for authoring tools.
 *
 * `describeApplicationVocabulary()` serializes the compiler's own
 * enforcement constants (see `APPLICATION_VOCABULARY` in `compile.ts`, the
 * closed composition/feedback tables in `@victframework/ui`, and the
 * schema/token/widget constants in `@victframework/sdk`) into one stable,
 * JSON-able descriptor. There is deliberately NO second hand-written
 * schema here: everything is derived from the same objects validation
 * uses, so the two cannot drift.
 *
 * Stability contract (tested): the same package version always produces
 * byte-identical JSON — arrays are sorted, insertion order is erased, and
 * no environment-dependent value is included.
 */

import {
  APPLICATION_DEFINITION_SCHEMA,
  APPLICATION_DEFINITION_SCHEMA_V2,
  FORM_FIELD_WIDGETS,
  RESOURCE_PRESENTATION_WIDGETS,
  THEME_TOKEN_NAMES,
} from '@victframework/sdk';
import {
  ACTION_FEEDBACK_OUTCOMES,
  APPLICATION_COMPOSITION_CHOICES,
  LAYOUT_MODES,
  PAGE_COMPOSITION_CHOICES,
  REGION_PRESENTATION_CHOICES,
} from '@victframework/ui';
import { APPLICATION_VOCABULARY, type ApplicationIssueCode } from './compile.js';

/**
 * Compile-time exhaustiveness guard: the literal must carry EXACTLY the
 * members of `ApplicationIssueCode` — a missing, extra, or renamed code
 * fails the type-check, so the runtime list can never silently drift from
 * the union. `APPLICATION_ISSUE_CODES` is derived from these flags.
 */
const APPLICATION_ISSUE_CODE_FLAGS = {
  APPLICATION_UNKNOWN_FIELD: true,
  APPLICATION_EMBEDDED_VALUE_FIELD: true,
  APPLICATION_EMPTY_ID: true,
  APPLICATION_EMPTY_REVISION: true,
  APPLICATION_INVALID_IDENTIFIER: true,
  APPLICATION_REQUIRED_MEMBER: true,
  APPLICATION_NON_CANONICAL_VALUE: true,
  APPLICATION_COMPILATION_FAILED: true,
  APPLICATION_UNKNOWN_SCHEMA: true,
  DUPLICATE_ROUTE_ID: true,
  DUPLICATE_ROUTE_PATH: true,
  DUPLICATE_SCREEN_ID: true,
  DUPLICATE_REGION_NAME: true,
  DUPLICATE_SURFACE_ID: true,
  DUPLICATE_VIEW_ID: true,
  DUPLICATE_FORM_ID: true,
  DUPLICATE_ACTION_ID: true,
  DUPLICATE_RESOURCE_REFERENCE: true,
  DUPLICATE_COMPONENT_REFERENCE: true,
  DUPLICATE_TAB_NAME: true,
  UNKNOWN_ROUTE_SCREEN: true,
  UNKNOWN_ROUTE_REFERENCE: true,
  UNKNOWN_VIEW_REFERENCE: true,
  UNKNOWN_FORM_REFERENCE: true,
  UNKNOWN_ACTION_REFERENCE: true,
  UNKNOWN_FORM_ACTION: true,
  UNKNOWN_RESOURCE_REFERENCE: true,
  UNKNOWN_RESOURCE: true,
  RESOURCE_REVISION_MISMATCH: true,
  UNKNOWN_FIELD: true,
  UNKNOWN_CONTRACT_REFERENCE: true,
  CONTRACT_REVISION_MISMATCH: true,
  UNKNOWN_CAPABILITY_REFERENCE: true,
  CAPABILITY_REVISION_MISMATCH: true,
  UNKNOWN_COMPONENT_REFERENCE: true,
  COMPONENT_REVISION_MISMATCH: true,
  INVALID_COMPONENT_SOURCE: true,
  UNKNOWN_SURFACE_ROLE: true,
  MUTATION_NOT_DECLARED: true,
  ROUTE_PATH_INVALID: true,
  ROUTE_REDIRECT_INVALID: true,
  ROUTE_REDIRECT_CYCLE: true,
  ROUTE_SCREEN_REQUIRED: true,
  UNKNOWN_BREADCRUMB_ROUTE: true,
  INVALID_SURFACE_CONDITION: true,
  INVALID_SURFACE_DISABLED_CONDITION: true,
  INVALID_THEME_TOKEN: true,
  INVALID_THEME_TOKEN_VALUE: true,
  INVALID_ACTION_FEEDBACK: true,
  INVALID_UI_COMPOSITION: true,
  INVALID_SURFACE_DECLARATION: true,
  INVALID_VIEW_DECLARATION: true,
  INVALID_TABLE_DECLARATION: true,
  INVALID_CHART_DECLARATION: true,
  INVALID_STATUS_DECLARATION: true,
  INVALID_TABS_DECLARATION: true,
  INVALID_CONVERSATION_DECLARATION: true,
  INVALID_ACTION_BINDING: true,
} satisfies Record<ApplicationIssueCode, true>;

/** All diagnostic codes `compileApplication` can emit (exhaustive by construction). */
export const APPLICATION_ISSUE_CODES = Object.freeze(
  Object.keys(APPLICATION_ISSUE_CODE_FLAGS) as ApplicationIssueCode[],
);

/** Sorted unique string array (vocabulary JSON building block). */
function sorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort();
}

/** Stable per-object descriptor. */
export interface VocabularyObject {
  /** Allowed members (@1 schema). */
  readonly fields?: readonly string[];
  /** Allowed members (@2 schema), when @2 extends the object. */
  readonly fieldsV2?: readonly string[];
  /** Closed per-key member sets, e.g. surface roles or action kinds. */
  readonly fieldsByKey?: Readonly<Record<string, readonly string[]>>;
  /** Closed per-key member sets under the @1 schema, when they differ. */
  readonly fieldsByKeyV1?: Readonly<Record<string, readonly string[]>>;
}

export interface ApplicationVocabulary {
  /** Accepted `schema` markers, and which schema generation is current. */
  readonly schemaVersions: { readonly accepted: readonly string[]; readonly current: string };
  /** Allowed members per definition object (dotted name = nested object). */
  readonly objects: Readonly<Record<string, VocabularyObject>>;
  /** Closed value vocabularies with their enforcement site. */
  readonly closedValues: {
    readonly surfaceRoles: { readonly v1: readonly string[]; readonly v2: readonly string[] };
    readonly actionKinds: readonly string[];
    readonly statusTones: readonly string[];
    readonly chartKinds: readonly string[];
    readonly sortDirections: readonly string[];
    readonly resourceFieldTypes: readonly string[];
    readonly formFieldWidgets: readonly string[];
    readonly resourcePresentationWidgets: readonly string[];
    readonly screenLayoutModes: readonly string[];
    readonly actionFeedbackOutcomes: readonly string[];
    readonly themeTokenNames: readonly string[];
    readonly composition: {
      readonly application: Readonly<Record<string, readonly string[]>>;
      readonly page: Readonly<Record<string, readonly string[]>>;
      readonly regionPresentation: Readonly<Record<string, readonly string[]>>;
    };
  };
  /** Every diagnostic code `compileApplication` can emit. */
  readonly issueCodes: readonly string[];
  /** Pointers into this package for programmatic consumers. */
  readonly sourceOfTruth: {
    readonly compiler: '@victframework/application';
    readonly exporter: 'describeApplicationVocabulary';
    readonly note: string;
  };
}

/** Derive the stable, JSON-able vocabulary descriptor. */
export function describeApplicationVocabulary(): ApplicationVocabulary {
  const { objects, closedValues, actionFieldsByKind, surfaceFieldsByRoleV1, surfaceFieldsByRoleV2 } =
    APPLICATION_VOCABULARY;
  const objectEntries = (sets: Record<string, ReadonlySet<string>>): Record<string, VocabularyObject> =>
    Object.fromEntries(
      Object.entries(sets).map(([name, set]) => [name, { fields: sorted(set) }]),
    );
  const byKey = (map: ReadonlyMap<string, ReadonlySet<string>>): Record<string, readonly string[]> =>
    Object.fromEntries([...map.entries()].map(([key, set]) => [key, sorted(set)]));
  return {
    schemaVersions: {
      accepted: sorted([APPLICATION_DEFINITION_SCHEMA, APPLICATION_DEFINITION_SCHEMA_V2]),
      current: APPLICATION_DEFINITION_SCHEMA_V2,
    },
    objects: {
      ...objectEntries(objects),
      action: { fieldsByKey: byKey(actionFieldsByKind) },
      surface: {
        fieldsByKey: byKey(surfaceFieldsByRoleV2),
        // @1 surfaces share the role names; field sets differ per schema.
        fieldsByKeyV1: byKey(surfaceFieldsByRoleV1),
      },
    },
    closedValues: {
      surfaceRoles: {
        v1: sorted(closedValues.surfaceRolesV1),
        v2: sorted(closedValues.surfaceRolesV2),
      },
      actionKinds: sorted(closedValues.actionKinds),
      statusTones: sorted(closedValues.statusTones),
      chartKinds: sorted(closedValues.chartKinds),
      sortDirections: sorted(closedValues.sortDirections),
      resourceFieldTypes: sorted(closedValues.resourceFieldTypes),
      formFieldWidgets: sorted(FORM_FIELD_WIDGETS),
      resourcePresentationWidgets: sorted(RESOURCE_PRESENTATION_WIDGETS),
      screenLayoutModes: sorted(LAYOUT_MODES),
      actionFeedbackOutcomes: sorted(ACTION_FEEDBACK_OUTCOMES),
      themeTokenNames: sorted(THEME_TOKEN_NAMES),
      composition: {
        application: Object.fromEntries(
          Object.entries(APPLICATION_COMPOSITION_CHOICES).map(([k, v]) => [k, sorted(v)]),
        ),
        page: Object.fromEntries(
          Object.entries(PAGE_COMPOSITION_CHOICES).map(([k, v]) => [k, sorted(v)]),
        ),
        regionPresentation: Object.fromEntries(
          Object.entries(REGION_PRESENTATION_CHOICES).map(([k, v]) => [k, sorted(v)]),
        ),
      },
    },
    issueCodes: [...APPLICATION_ISSUE_CODES],
    sourceOfTruth: {
      compiler: '@victframework/application',
      exporter: 'describeApplicationVocabulary',
      note: 'Derived from the compiler’s own enforcement constants (compile.ts APPLICATION_VOCABULARY, @victframework/ui composition/feedback tables, @victframework/sdk schema/token/widget constants). It cannot drift from what compileApplication enforces.',
    },
  };
}
