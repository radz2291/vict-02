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

/** Canonical schema marker of an Application Definition manifest. */
export const APPLICATION_DEFINITION_SCHEMA = 'vict.application@1';
/** Canonical schema marker of a Resource Definition manifest. */
export const RESOURCE_DEFINITION_SCHEMA = 'vict.resource@1';
/** Canonical schema marker of an Application Release manifest. */
export const APPLICATION_RELEASE_SCHEMA = 'vict.application-release@1';

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

/** One navigable route. The routes array is ORDERED navigation semantics. */
export interface ApplicationRoute {
  readonly id: string;
  /** URL path of the route (single dynamic segments allowed, e.g. `/projects/:id`). */
  readonly path: string;
  readonly screenId: string;
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
}

/** A named layout region of a screen, holding ordered surfaces. */
export interface ScreenRegion {
  readonly name: string;
  /** Ordered surface sequence; the order is meaningful presentation semantics. */
  readonly surfaces: readonly Surface[];
}

/** A screen: title, layout regions, and safe default states. */
export interface ScreenDefinition {
  readonly id: string;
  readonly title: string;
  /** Named regions; the region array is ordered layout semantics. */
  readonly layout: readonly ScreenRegion[];
  readonly states?: ScreenStates;
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

/** Surface roles supported by the Stage 04 proof renderer. */
export type SurfaceRole = 'text' | 'view' | 'form' | 'action' | 'component' | 'states';

/** Neutral surface: meaning and composition, never framework component types. */
export type Surface =
  | { readonly role: 'text'; readonly id: string; readonly content: string }
  | {
      readonly role: 'view';
      readonly id: string;
      readonly viewId: string;
    }
  | {
      readonly role: 'form';
      readonly id: string;
      readonly formId: string;
    }
  | {
      readonly role: 'action';
      readonly id: string;
      readonly actionId: string;
      readonly label: string;
    }
  | {
      readonly role: 'component';
      readonly id: string;
      readonly componentId: string;
      readonly revision: string;
      /** Bounded, contract-safe props for the custom component. */
      readonly props?: Readonly<Record<string, string | number | boolean>>;
    }
  | {
      readonly role: 'states';
      readonly id: string;
      readonly viewId: string;
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
  readonly schema: typeof APPLICATION_DEFINITION_SCHEMA;
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
  /** Presentation references: theme/design-token reference (never resolved values). */
  readonly theme?: string;
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
