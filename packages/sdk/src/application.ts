/**
 * Framework-neutral Application, Resource and Release DEFINITIONS.
 *
 * These are the stable authoring declarations for the Application
 * Definition and Delivery Layer. They are TypeScript-first and
 * UI-framework-neutral by invariant: no Svelte, React, or other renderer
 * type may appear here or in any base SDK declaration. Serializations of
 * these definitions contain declarations and stable references only —
 * never executable functions, resolved secret values, or framework
 * internals.
 *
 * Validation, canonicalization, identity, and compilation live in
 * `@vict/application` (which depends on this module, never the reverse).
 * Every schema is CLOSED: unknown fields are rejected with structured
 * diagnostics instead of being silently stripped.
 */

/** Canonical schema marker of an Application Definition manifest (Stage 04 foundation). */
export const APPLICATION_DEFINITION_SCHEMA = 'vict.application@1';
/**
 * Canonical schema marker of the extended Application Definition manifest
 * (Stage 05). `vict.application@2` accepts the complete surface vocabulary
 * (tables, charts, tabs, dialogs/drawers, status, conversation, lists,
 * details, breadcrumbs, redirects, conditions, stale/partial states, and
 * theme tokens) while `vict.application@1` keeps its EXACT Stage 04
 * accepted shape and validation semantics. The schema marker is part of
 * application identity, so a @2 definition can never alias a @1 identity.
 */
export const APPLICATION_DEFINITION_SCHEMA_V2 = 'vict.application@2';
/** Canonical schema marker of a Resource Definition manifest. */
export const RESOURCE_DEFINITION_SCHEMA = 'vict.resource@1';
/** Canonical schema marker of an Application Release manifest. */
export const APPLICATION_RELEASE_SCHEMA = 'vict.application-release@1';

/**
 * The closed vocabulary of semantic theme/design token names a @2
 * Application Definition may declare. Renderer-owned CSS variables implement
 * the tokens; values are validated safe strings (no CSS escapes, no url(),
 * no braces/semicolons) so a definition can never inject executable CSS.
 */
export const THEME_TOKEN_NAMES: readonly string[] = [
  'color.bg',
  'color.surface',
  'color.text',
  'color.textMuted',
  'color.accent',
  'color.accentContrast',
  'color.border',
  'color.danger',
  'color.warning',
  'color.success',
  'color.info',
  'color.focusRing',
  'font.family',
  'font.sizeBase',
  'spacing.unit',
  'radius.base',
  'density',
  'elevation.low',
  'elevation.high',
];

/** One semantic theme/design token assignment (name from the closed set). */
export interface ThemeTokenAssignment {
  /** Token name; must be a member of the closed THEME_TOKEN_NAMES set. */
  readonly name: string;
  /** Safe token value (plain CSS variable value; never a selector, rule, url(), or expression). */
  readonly value: string;
}

/** The @2 theme declaration: a reference plus optional safe token overrides. */
export interface ThemeDeclaration {
  /** Named theme reference (e.g. 'vict.default-theme'); never resolved values. */
  readonly reference?: string;
  /** Explicit token overrides against the closed token vocabulary. */
  readonly tokens?: readonly ThemeTokenAssignment[];
}

/* ------------------------------------------------------------------ */
/* Component references                                                */
/* ------------------------------------------------------------------ */

/**
 * A stable reference to a custom (or built-in) component. Components are
 * trusted local code registered OUTSIDE the serializable definition, in a
 * versioned component registry; the definition carries only the exact
 * id/revision pair.
 */
export interface ComponentReference {
  readonly componentId: string;
  readonly revision: string;
}

/* ------------------------------------------------------------------ */
/* Resource definitions                                                */
/* ------------------------------------------------------------------ */

/** Primitive field types of the explicit resource field catalogue. */
export type ResourceFieldType = 'string' | 'number' | 'boolean' | 'date' | 'json';

/** One field of the explicit resource field catalogue. */
export interface ResourceField {
  readonly name: string;
  readonly type: ResourceFieldType;
  readonly required?: boolean;
  /** Presentation label (presentation metadata is never validation). */
  readonly label?: string;
}

/** A declared relationship to another resource. */
export interface ResourceRelationship {
  readonly name: string;
  readonly targetResourceId: string;
  readonly cardinality: 'one' | 'many';
}

/** Supported query shape declarations of a resource. */
export interface ResourceQuerySupport {
  readonly filters?: readonly string[];
  readonly sort?: readonly string[];
  readonly pagination?: boolean;
  readonly projection?: readonly string[];
}

/** A permitted, declared mutation of a resource. */
export interface ResourceMutation {
  /** Stable operation name (`create`, `update`, `delete`, or a declared domain verb). */
  readonly op: string;
  /** Effect class of the mutation. Resource mutations are never `pure`. */
  readonly effect: 'read' | 'write' | 'irreversible';
  /** Input contract id the mutation input must pass. */
  readonly inputContractId?: string;
  /** Output contract id the mutation result must pass. */
  readonly outputContractId?: string;
  /** Declared idempotency semantics for retryable writes. */
  readonly idempotency?: 'keyed';
  /** Permission grants required before the mutation may be attempted. */
  readonly permissions?: readonly string[];
}

/**
 * A storage-neutral Resource Definition. It describes application-domain
 * data, identity, relationships, supported queries, and permitted
 * mutations. It does NOT grant storage authority: persistence enters only
 * through a conforming application-data adapter crossing the declared
 * authorization/effect boundary.
 */
export interface ResourceDefinition {
  readonly schema: typeof RESOURCE_DEFINITION_SCHEMA;
  /** Stable resource id, unique within an application. */
  readonly id: string;
  /** Explicit revision; bump when declared semantics change. */
  readonly revision: string;
  /** Identity declaration: the field acting as stable identity. */
  readonly identity: { readonly key: string };
  /** Explicit field catalogue (also the authority for presentation references). */
  readonly fields: readonly ResourceField[];
  /** Explicit input contract reference (id), when the resource declares one. */
  readonly inputContract?: string;
  /** Explicit output contract reference (id), when the resource declares one. */
  readonly outputContract?: string;
  readonly relationships?: readonly ResourceRelationship[];
  /** Supported list/detail query capabilities. */
  readonly queries?: {
    readonly list?: ResourceQuerySupport;
    readonly detail?: ResourceQuerySupport;
  };
  /** Permitted mutations. Absent means read-only. */
  readonly mutations?: readonly ResourceMutation[];
  /** Presentation references (labels/order/widget hints) against the field catalogue. */
  readonly presentation?: readonly ResourcePresentationHint[];
  /** Authorization/effect metadata for read access. */
  readonly authorization?: {
    readonly effect: 'read' | 'write';
    readonly permissions?: readonly string[];
  };
}

/** Presentation hint for one catalogue field. */
export interface ResourcePresentationHint {
  readonly field: string;
  readonly label?: string;
  /** Meaningful display order (ordered semantics; never sorted away). */
  readonly order?: number;
  readonly widget?: 'text' | 'number' | 'boolean' | 'date' | 'json';
}

/* ------------------------------------------------------------------ */
/* Application definitions                                             */
/* ------------------------------------------------------------------ */

/**
 * One breadcrumb item: contextual navigation above the screen content.
 * `routeId` names a declared route; when omitted the item is a plain
 * non-navigable label (e.g. the current record title placeholder).
 */
export interface BreadcrumbItem {
  readonly label: string;
  readonly routeId?: string;
}

/**
 * One navigable route. The routes array is ORDERED navigation semantics.
 * Dynamic segments are single `:name` parameters (e.g. `/projects/:id`).
 * A route MAY instead declare a `redirect` to another route id (Stage 05):
 * redirect routes are resolved by the renderer, never by page shells.
 */
export interface ApplicationRoute {
  readonly id: string;
  /** URL path of the route (single dynamic segments allowed, e.g. `/projects/:id`). */
  readonly path: string;
  /** Target screen. Optional ONLY when the route declares a redirect. */
  readonly screenId?: string;
  /** Redirect target: another declared route id (Stage 05; validated acyclic). */
  readonly redirect?: string;
  /** Navigation entry (presence makes the route visible in navigation). */
  readonly nav?: {
    readonly label: string;
    readonly group?: string;
    /** Meaningful navigation order hint within its group. */
    readonly order?: number;
  };
}

/** Safe-failure and default state declarations of a screen. */
export interface ScreenStates {
  readonly loading?: Surface;
  readonly empty?: Surface;
  readonly validation?: Surface;
  readonly denied?: Surface;
  readonly failure?: Surface;
  /** Data is shown but known to be stale (Stage 05). */
  readonly stale?: Surface;
  /** Data is shown but incomplete/partial (Stage 05). */
  readonly partial?: Surface;
}

/**
 * Safe derived-state condition for conditional visibility (Stage 05).
 * Exactly one of the fields may be declared; conditions read ONLY route
 * parameters and loaded view state — never arbitrary expressions, so no
 * executable logic can enter the definition.
 */
export interface SurfaceCondition {
  /** Visible only when the named view currently has at least one row. */
  readonly viewNonEmpty?: string;
  /** Visible only when the named view currently has zero rows. */
  readonly viewEmpty?: string;
  /** Visible only when the named route parameter equals this value. */
  readonly paramEquals?: { readonly name: string; readonly value: string };
}

/**
 * Safe enabled-state condition for action surfaces (Stage 05). Disabled
 * state is presentation only and NEVER authorization (APP-012).
 */
export interface DisabledCondition {
  /** Disabled when the named route parameter is absent from the current path. */
  readonly paramMissing?: string;
}

/** A named layout region of a screen, holding ordered surfaces. */
export interface ScreenRegion {
  readonly name: string;
  /** Ordered surface sequence; the order is meaningful presentation semantics. */
  readonly surfaces: readonly Surface[];
}

/** A screen: title, layout regions, safe default states, and contextual navigation. */
export interface ScreenDefinition {
  readonly id: string;
  readonly title: string;
  /** Named regions; the region array is ordered layout semantics. */
  readonly layout: readonly ScreenRegion[];
  readonly states?: ScreenStates;
  /** Contextual breadcrumb trail (Stage 05, @2 only; validated route references). */
  readonly breadcrumbs?: readonly BreadcrumbItem[];
}

/** A typed resource view binding. */
export interface ViewBinding {
  readonly viewId: string;
  readonly resourceId: string;
  /** Explicit resource revision this view is bound to. */
  readonly resourceRevision: string;
  /** Projection: subset of catalogue fields, in meaningful display order. */
  readonly fields?: readonly string[];
  /** Declared safe-empty behavior key rendered when no rows exist. */
  readonly emptyMessage?: string;
}

/** One ordered form field. Form-field order is meaningful presentation semantics. */
export interface FormField {
  /** Field name; must exist in the bound resource's explicit field catalogue. */
  readonly name: string;
  readonly label: string;
  readonly required?: boolean;
  readonly widget?: 'text' | 'number' | 'boolean' | 'date' | 'json';
}

/**
 * A contract-validated form binding. Validation ALWAYS crosses the
 * declared neutral contract (`inputContractId`); the form field metadata is
 * presentation only and never weakens contract validation.
 */
export interface FormBinding {
  readonly formId: string;
  readonly resourceId: string;
  /** Explicit resource revision this form is bound to. */
  readonly resourceRevision: string;
  /** Contract reference the submitted input must pass before any action runs. */
  readonly inputContractId: string;
  /** Optional exact revision pin for the input contract (validated exactly when declared). */
  readonly inputContractRevision?: string;
  readonly fields: readonly FormField[];
  /** The action executed after the input passes the contract. */
  readonly submitActionId: string;
}

/**
 * Surface roles. The first six are the Stage 04 foundation vocabulary;
 * the remainder are the Stage 05 delivery vocabulary. `vict.application@1`
 * definitions accept ONLY the foundation roles; `vict.application@2`
 * definitions accept the complete set.
 */
export type SurfaceRole =
  | 'text'
  | 'view'
  | 'form'
  | 'action'
  | 'component'
  | 'states'
  | 'list'
  | 'table'
  | 'detail'
  | 'chart'
  | 'status'
  | 'tabs'
  | 'dialog'
  | 'drawer'
  | 'conversation';

/** Chart kinds supported by the neutral chart surface. */
export type ChartKind = 'bar' | 'line';

/** Status tone vocabulary of the neutral status surface. */
export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** One named tab of a tabs surface (ordered presentation semantics). */
export interface TabDefinition {
  readonly name: string;
  readonly label: string;
  readonly surfaces: readonly Surface[];
}

/** One column of a table surface (ordered presentation semantics). */
export interface TableColumn {
  /** Field from the bound view's projection. */
  readonly field: string;
  readonly label?: string;
  /** Column header sorting control is presented when true. */
  readonly sortable?: boolean;
}

/** Semantic value→tone mapping entries of a status surface. */
export type StatusToneMapping = Readonly<Record<string, StatusTone>>;

/**
 * Neutral surface: meaning and composition, never framework component types.
 * The Stage 04 variants are unchanged; Stage 05 adds the delivery roles.
 * Every surface accepts the optional `visibleWhen` condition (Stage 05,
 * @2 only) for safe derived-state conditional visibility.
 */
export type Surface =
  | {
      readonly role: 'text';
      readonly id: string;
      readonly content: string;
      /** Heading level 1–6 for structured content (Stage 05, @2 only). */
      readonly level?: number;
      readonly visibleWhen?: SurfaceCondition;
    }
  | {
      readonly role: 'view';
      readonly id: string;
      readonly viewId: string;
      readonly visibleWhen?: SurfaceCondition;
    }
  | {
      readonly role: 'form';
      readonly id: string;
      readonly formId: string;
      readonly visibleWhen?: SurfaceCondition;
    }
  | {
      readonly role: 'action';
      readonly id: string;
      readonly actionId: string;
      readonly label: string;
      readonly disabledWhen?: DisabledCondition;
      readonly visibleWhen?: SurfaceCondition;
    }
  | {
      readonly role: 'component';
      readonly id: string;
      readonly componentId: string;
      readonly revision: string;
      /** Bounded, contract-safe props for the custom component. */
      readonly props?: Readonly<Record<string, string | number | boolean>>;
      readonly visibleWhen?: SurfaceCondition;
    }
  | {
      readonly role: 'states';
      readonly id: string;
      readonly viewId: string;
      readonly visibleWhen?: SurfaceCondition;
    }
  | {
      /** Semantic list rendering of a view's rows. */
      readonly role: 'list';
      readonly id: string;
      readonly viewId: string;
      /** Field rendered as the item's primary line. */
      readonly titleField: string;
      /** Optional field rendered as the item's secondary line. */
      readonly secondaryField?: string;
      readonly emptyMessage?: string;
      readonly visibleWhen?: SurfaceCondition;
    }
  | {
      /** Searchable, sortable, paginated records table. */
      readonly role: 'table';
      readonly id: string;
      readonly viewId: string;
      /** Ordered columns; defaults to the view's declared field order. */
      readonly columns?: readonly TableColumn[];
      /** Declared query action that re-reads rows for search/sort/page. */
      readonly queryActionId?: string;
      /** Fields searched by the table's search control (subset of view fields). */
      readonly searchFields?: readonly string[];
      /** Fields offered as exact-match filter controls (subset of view fields). */
      readonly filterFields?: readonly string[];
      /** Page size for the pagination control (positive safe integer). */
      readonly pageSize?: number;
      readonly emptyMessage?: string;
      readonly visibleWhen?: SurfaceCondition;
    }
  | {
      /** Record detail rendering of the route's resolved record. */
      readonly role: 'detail';
      readonly id: string;
      readonly viewId: string;
      /** Rendered fields; defaults to the view's declared field order. */
      readonly fields?: readonly string[];
      readonly emptyMessage?: string;
      readonly visibleWhen?: SurfaceCondition;
    }
  | {
      /** Accessible chart with a mandatory textual/tabular equivalent. */
      readonly role: 'chart';
      readonly id: string;
      readonly viewId: string;
      readonly kind: ChartKind;
      /** Field grouping the chart domain (x axis). */
      readonly xField: string;
      /** Numeric field summed per domain value (y axis). */
      readonly yField: string;
      /** Accessible summary announced to non-visual users. */
      readonly summary: string;
      readonly title?: string;
      readonly visibleWhen?: SurfaceCondition;
    }
  | {
      /** Semantic status indicator for a value or the route record's field. */
      readonly role: 'status';
      readonly id: string;
      /** Static value to present; omit to read the route record's field. */
      readonly value?: string;
      /** Record field read when `value` is absent. */
      readonly field?: string;
      /** Explicit value→tone mapping; unmapped values render neutral. */
      readonly tones?: StatusToneMapping;
      readonly visibleWhen?: SurfaceCondition;
    }
  | {
      /** Tabbed content container. */
      readonly role: 'tabs';
      readonly id: string;
      readonly tabs: readonly TabDefinition[];
      readonly visibleWhen?: SurfaceCondition;
    }
  | {
      /** Modal dialog: trigger button plus nested content surfaces. */
      readonly role: 'dialog';
      readonly id: string;
      readonly title: string;
      readonly triggerLabel: string;
      readonly content: readonly Surface[];
      readonly visibleWhen?: SurfaceCondition;
    }
  | {
      /** Drawer (side panel): trigger button plus nested content surfaces. */
      readonly role: 'drawer';
      readonly id: string;
      readonly title: string;
      readonly triggerLabel: string;
      readonly content: readonly Surface[];
      readonly visibleWhen?: SurfaceCondition;
    }
  | {
      /** Conversation feed with validated input and a declared send action. */
      readonly role: 'conversation';
      readonly id: string;
      readonly viewId: string;
      /** Field holding the message body. */
      readonly messageField: string;
      /** Field holding the participant display name. */
      readonly authorField: string;
      /** Field holding the participant role (user/assistant/system). */
      readonly participantField?: string;
      /** Declared mutation/capability action executed on send. */
      readonly sendActionId: string;
      readonly inputLabel: string;
      readonly inputPlaceholder?: string;
      readonly emptyMessage?: string;
      readonly visibleWhen?: SurfaceCondition;
    };

/** Application action kinds (Stage 04 foundation subset). */
export type ActionDefinition =
  /** Local/view presentation action. Never becomes a graph node. */
  | {
      readonly kind: 'local';
      readonly id: string;
      readonly revision: string;
      readonly inputContractId?: string;
    }
  /** Navigation action: change route context. */
  | {
      readonly kind: 'navigation';
      readonly id: string;
      readonly revision: string;
      readonly routeId: string;
    }
  /** Typed resource query. */
  | {
      readonly kind: 'query';
      readonly id: string;
      readonly revision: string;
      readonly resourceId: string;
      readonly resourceRevision: string;
      readonly inputContractId?: string;
      readonly inputContractRevision?: string;
      readonly outputContractId?: string;
      readonly outputContractRevision?: string;
    }
  /** Authorized resource mutation. */
  | {
      readonly kind: 'mutation';
      readonly id: string;
      readonly revision: string;
      readonly resourceId: string;
      readonly resourceRevision: string;
      readonly op: string;
      readonly inputContractId: string;
      readonly inputContractRevision?: string;
      readonly outputContractId?: string;
      readonly outputContractRevision?: string;
    }
  /** Real VICT capability invocation through the public runtime boundary. */
  | {
      readonly kind: 'capability';
      readonly id: string;
      readonly revision: string;
      readonly capabilityId: string;
      readonly capabilityRevision: string;
      readonly inputContractId: string;
      readonly inputContractRevision?: string;
      readonly outputContractId?: string;
      readonly outputContractRevision?: string;
    };

/** Compatibility declarations of an application. */
export interface ApplicationCompatibility {
  /** Public Vict compatibility range the application requires (e.g. `^0.1.0`). */
  readonly vict?: string;
  /** Application-definition schema markers this definition consumes. */
  readonly applicationSchema: string;
}

/** Canonical framework-neutral Application Definition. */
export interface ApplicationDefinition {
  readonly schema: typeof APPLICATION_DEFINITION_SCHEMA | typeof APPLICATION_DEFINITION_SCHEMA_V2;
  /** Stable application id. */
  readonly id: string;
  /** Explicit application revision (author/build owned). */
  readonly revision: string;
  readonly name?: string;
  /** Ordered navigation routes. */
  readonly routes: readonly ApplicationRoute[];
  /** Screens (set-like; canonical identity is insertion-order independent). */
  readonly screens: readonly ScreenDefinition[];
  /** Typed resource views (set-like). */
  readonly views?: readonly ViewBinding[];
  /** Contract-validated forms (set-like). */
  readonly forms?: readonly FormBinding[];
  /** Actions (set-like). */
  readonly actions: readonly ActionDefinition[];
  /** Referenced resources with explicit revisions. */
  readonly resources: readonly { readonly resourceId: string; readonly revision: string }[];
  /** Referenced custom components with explicit revisions. */
  readonly components?: readonly ComponentReference[];
  readonly compatibility?: ApplicationCompatibility;
  /**
   * Presentation references: theme/design-token reference (never resolved
   * values). @1 definitions declare a plain reference string; @2
   * definitions may alternatively declare a closed token assignment set.
   */
  readonly theme?: string | ThemeDeclaration;
}

/* ------------------------------------------------------------------ */
/* Application releases                                                */
/* ------------------------------------------------------------------ */

/** The renderer binding of a release. */
export interface ReleaseRenderer {
  readonly id: string;
  readonly revision: string;
}

/** The component-registry identity a release pins. */
export interface ReleaseComponentRegistry {
  readonly registryId: string;
  readonly revision: string;
  readonly components: readonly ComponentReference[];
}

/** The application-data adapter compatibility a release declares. */
export interface ReleaseDataAdapter {
  readonly id: string;
  /** Compatible adapter revision or range marker. */
  readonly revision: string;
}

/** Activation binding of a release: an exact reference OR an explicit policy. */
export type ReleaseActivation =
  | { readonly kind: 'reference'; readonly activationVersion: string }
  | { readonly kind: 'policy'; readonly selection: 'latest' };

/** Provenance metadata that is safe to serialize (never secrets, never machine paths). */
export interface ReleaseProvenance {
  readonly author?: string;
  readonly source?: string;
}

/**
 * An Application Release: the deployable binding of one application
 * version to a renderer, component registry, data-adapter compatibility,
 * public Vict compatibility, and an activation reference or selection
 * policy. Its identity is distinct from `applicationVersion`.
 */
export interface ApplicationRelease {
  readonly schema: typeof APPLICATION_RELEASE_SCHEMA;
  readonly applicationId: string;
  readonly applicationRevision: string;
  /** The canonical application identity this release binds (computed, not authored). */
  readonly applicationVersion: string;
  readonly renderer: ReleaseRenderer;
  readonly components?: ReleaseComponentRegistry;
  readonly dataAdapter: ReleaseDataAdapter;
  /** Public Vict compatibility range required by this release. */
  readonly victCompatibility: string;
  readonly activation: ReleaseActivation;
  readonly provenance?: ReleaseProvenance;
}
