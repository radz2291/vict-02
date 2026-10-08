/** Disposable presentation intent derived from the compiled Application Plan. */
export interface UiSurfaceSource {
  readonly role: string;
  readonly id: string;
  readonly [key: string]: unknown;
}

export interface UiPlanSource {
  readonly screens: Readonly<
    Record<
      string,
      | {
          readonly title?: string;
          readonly layout: readonly { readonly surfaces: readonly UiSurfaceSource[] }[];
        }
      | undefined
    >
  >;
  readonly views?: Readonly<Record<string, unknown>>;
}

export interface UiTableIntent {
  readonly surfaceId: string;
  readonly title: string;
  readonly columns: readonly {
    readonly field: string;
    readonly label: string;
    readonly sortable: boolean;
    /** Versioned registered island rendered in this cell; props map prop name → row field. */
    readonly component?: {
      readonly componentId: string;
      readonly revision: string;
      readonly props: Readonly<Record<string, string>>;
    };
  }[];
  /** Declared per-row action; input maps action-input field → row field. */
  readonly rowAction?: {
    readonly actionId: string;
    readonly label: string;
    readonly input: Readonly<Record<string, string>>;
  };
  /**
   * Definition-declared row→detail navigation binding (FT-1). When present,
   * the renderer renders a GENUINE navigation link per row; when absent,
   * no link is rendered at all. Route resolution (routeId → path) stays
   * with the renderer's route table.
   */
  readonly rowDetail?: UiRowDetail;
  readonly search: { readonly label: string; readonly fields: readonly string[] };
  readonly filters: readonly { readonly field: string; readonly label: string }[];
  /**
   * The bound view's declared deterministic sort (@2), when declared.
   * The table's fresh-mount state AND every dispatched query (search,
   * filter, pagination) use it until the user selects another sort, so
   * dispatched pages can never diverge from the server-loaded page order
   * (zero repeated/hidden rows across page boundaries).
   */
  readonly initialSort?: readonly {
    readonly field: string;
    readonly direction: 'asc' | 'desc';
  }[];
  readonly pageSize: number;
  readonly emptyMessage: string;
}

/**
 * Defensive read of a declared view sort (@2): entries must all be
 * well-formed `{ field, direction: 'asc' | 'desc' }` objects. Any malformed
 * entry discards the whole declaration (the compiler already rejects it;
 * the derived intent simply stays honest about what it applies).
 */
function deriveInitialSort(source: unknown): UiTableIntent['initialSort'] {
  if (!Array.isArray(source)) return undefined;
  const entries: { field: string; direction: 'asc' | 'desc' }[] = [];
  for (const entry of source) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return undefined;
    const field = (entry as { field?: unknown }).field;
    const direction = (entry as { direction?: unknown }).direction;
    if (typeof field !== 'string' || field.length === 0) return undefined;
    if (direction !== 'asc' && direction !== 'desc') return undefined;
    entries.push({ field, direction });
  }
  return entries.length > 0 ? Object.freeze(entries) : undefined;
}

/** Read a bounded plain-object member defensively. */
function plainMember(source: unknown): Readonly<Record<string, unknown>> | undefined {
  return typeof source === 'object' && source !== null && !Array.isArray(source)
    ? (source as Readonly<Record<string, unknown>>)
    : undefined;
}

/** Derive the declared row-action intent (closed mapping; default `{ id: 'id' }`). */
function deriveRowAction(surface: UiSurfaceSource): UiTableIntent['rowAction'] {
  const declared = plainMember(surface.rowAction);
  const actionId = declared?.actionId;
  const label = declared?.label;
  if (typeof actionId !== 'string' || actionId.length === 0 || typeof label !== 'string') {
    return undefined;
  }
  const declaredInput = plainMember(declared?.input);
  const entries = Object.entries(declaredInput ?? { id: 'id' }).filter(
    (entry): entry is [string, string] =>
      typeof entry[0] === 'string' &&
      entry[0].length > 0 &&
      typeof entry[1] === 'string' &&
      entry[1].length > 0,
  );
  return Object.freeze({ actionId, label, input: Object.freeze(Object.fromEntries(entries)) });
}

/** Resolved display links. Route IDs and navigation policy stay with the renderer. */
export interface UiShellLink {
  readonly label: string;
  readonly href: string;
  readonly current?: boolean;
}

export interface UiShellGroup {
  readonly label: string;
  readonly links: readonly UiShellLink[];
}

export interface UiShellBreadcrumb {
  readonly label: string;
  readonly href?: string;
}

/** Stable display props. Application IDs, dispatch, and value conversion stay with the adapter. */
export type UiButtonVariant = 'primary' | 'secondary' | 'danger';
export type UiStatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
export type UiFieldWidget = 'text' | 'number' | 'boolean' | 'date' | 'json' | 'select';
export interface UiSelectOption {
  readonly value: string;
  readonly label: string;
}
export * from './composition.js';
export * from './feedback.js';

export interface UiFormField {
  readonly options?: readonly UiSelectOption[];
  readonly name: string;
  readonly label: string;
  readonly required: boolean;
  readonly widget: UiFieldWidget;
}

export interface UiTab {
  readonly name: string;
  readonly label: string;
}

export interface UiOverlayIntent {
  readonly kind: 'dialog' | 'drawer';
  readonly title: string;
  readonly triggerLabel: string;
}

/** Resolved display values; source fields and records stay with the adapter. */
export interface UiDisplayField {
  readonly label: string;
  readonly value: string;
}

/**
 * Definition-declared row→detail navigation binding (FT-1): a DECLARED
 * route id plus the mapping from route path parameters to row fields.
 * The renderer resolves the binding through its route table and renders a
 * real link affordance (anchor href) — never a dispatch-only button.
 * Presentation default: a row without binding renders no link at all.
 */
export interface UiRowDetail {
  readonly routeId: string;
  readonly label: string;
  /** Route path parameter name → row field supplying the value. */
  readonly param: Readonly<Record<string, string>>;
}

/** Row-navigation intent for a view-role record surface (FT-1). */
export interface UiViewIntent {
  readonly surfaceId: string;
  readonly rowDetail?: UiRowDetail;
}

/**
 * Bounded defensive read of one FT-1 row-detail navigation binding. A
 * well-formed declaration is `{ routeId, label?, param? }` with non-empty
 * strings; `param` is a closed `routeParam → rowField` map of non-empty
 * strings (default `{ id: 'id' }`). Malformed declarations are discarded
 * whole (the compiler already rejects them; the derived intent stays
 * honest about what it can present).
 */
function deriveRowDetail(surface: UiSurfaceSource): UiRowDetail | undefined {
  const declared = plainMember(surface.rowDetail);
  const routeId = declared?.routeId;
  if (typeof routeId !== 'string' || routeId.length === 0) return undefined;
  const label =
    typeof declared?.label === 'string' && declared.label.length > 0 ? declared.label : 'Open';
  const declaredParam = plainMember(declared?.param);
  const entries = Object.entries(declaredParam ?? { id: 'id' }).filter(
    (entry): entry is [string, string] =>
      typeof entry[0] === 'string' &&
      entry[0].length > 0 &&
      typeof entry[1] === 'string' &&
      entry[1].length > 0,
  );
  return Object.freeze({
    routeId,
    label,
    param: Object.freeze(Object.fromEntries(entries)),
  });
}

export interface UiListItem {
  readonly title: string;
  readonly secondary?: string;
}

export interface UiChartPoint {
  readonly label: string;
  readonly value: number;
}

export interface UiConversationMessage {
  readonly author: string;
  readonly participant: string;
  readonly text: string;
}

export interface UiPlan {
  readonly tables: Readonly<Record<string, UiTableIntent>>;
  /** View-role record surfaces (FT-1 row-detail navigation intents). */
  readonly views: Readonly<Record<string, UiViewIntent>>;
}

/** Current, disposable view state supplied by the renderer adapter. */
export interface UiTableState {
  readonly search: string;
  readonly filters: Readonly<Record<string, string>>;
  readonly sortField: string | null;
  readonly sortDirection: 'asc' | 'desc';
  readonly page: number;
  readonly pageCount: number;
  readonly total: number;
  readonly pending: boolean;
}

/** Presentation fields only. Query action IDs and dispatch stay below UI. */
export function deriveUiPlan(plan: UiPlanSource): UiPlan {
  const tables: Record<string, UiTableIntent> = Object.create(null);
  const views: Record<string, UiViewIntent> = Object.create(null);
  for (const screen of Object.values(plan.screens)) {
    if (screen === undefined) continue;
    const visit = (surface: UiSurfaceSource): void => {
      if (surface.role === 'table') {
        const declaredColumns = Array.isArray(surface.columns) ? surface.columns : [];
        const view = plan.views?.[String(surface.viewId)] as
          { fields?: readonly string[]; sort?: unknown } | undefined;
        const initialSort = deriveInitialSort(view?.sort);
        const rawColumns =
          declaredColumns.length > 0
            ? declaredColumns
            : (view?.fields ?? []).map((field) => ({ field }));
        const columns = rawColumns
          .filter(
            (value): value is Record<string, unknown> & { field: string } =>
              value !== null &&
              typeof value === 'object' &&
              typeof (value as { field?: unknown }).field === 'string',
          )
          .map((column) => {
            const cellComponentId = column.componentId;
            const cellRevision = column.revision;
            const hasComponent =
              typeof cellComponentId === 'string' &&
              cellComponentId.length > 0 &&
              typeof cellRevision === 'string' &&
              cellRevision.length > 0;
            const propEntries = hasComponent
              ? Object.entries(plainMember(column.props) ?? {}).filter(
                  (entry): entry is [string, string] =>
                    typeof entry[0] === 'string' &&
                    entry[0].length > 0 &&
                    typeof entry[1] === 'string' &&
                    entry[1].length > 0,
                )
              : [];
            return Object.freeze({
              field: column.field,
              label: typeof column.label === 'string' ? column.label : column.field,
              sortable: column.sortable !== false,
              ...(hasComponent
                ? {
                    component: Object.freeze({
                      componentId: cellComponentId as string,
                      revision: cellRevision as string,
                      props: Object.freeze(Object.fromEntries(propEntries)),
                    }),
                  }
                : {}),
            });
          });
        const searchFields =
          Array.isArray(surface.searchFields) && surface.searchFields.length > 0
            ? surface.searchFields.filter((field): field is string => typeof field === 'string')
            : columns.slice(0, 1).map((column) => column.field);
        const filterFields = Array.isArray(surface.filterFields) ? surface.filterFields : [];
        const rowAction = deriveRowAction(surface);
        const rowDetail = deriveRowDetail(surface);
        tables[surface.id] = Object.freeze({
          surfaceId: surface.id,
          // A table is a surface within a titled page. Repeating the page
          // title in its card produces adjacent identical headings.
          title: 'Records',
          columns: Object.freeze(columns),
          ...(rowAction !== undefined ? { rowAction } : {}),
          ...(rowDetail !== undefined ? { rowDetail } : {}),
          search: Object.freeze({ label: 'Search records', fields: Object.freeze(searchFields) }),
          filters: Object.freeze(
            filterFields
              .filter((field): field is string => typeof field === 'string')
              .map((field) => Object.freeze({ field, label: `Filter by ${field}` })),
          ),
          ...(initialSort !== undefined ? { initialSort } : {}),
          pageSize:
            typeof surface.pageSize === 'number' &&
            Number.isSafeInteger(surface.pageSize) &&
            surface.pageSize > 0
              ? surface.pageSize
              : 10,
          emptyMessage:
            typeof surface.emptyMessage === 'string' ? surface.emptyMessage : 'No records found.',
        });
      }
      if (surface.role === 'view') {
        const rowDetail = deriveRowDetail(surface);
        views[surface.id] = Object.freeze({
          surfaceId: surface.id,
          ...(rowDetail !== undefined ? { rowDetail } : {}),
        });
      }
      if (surface.role === 'tabs' && Array.isArray(surface.tabs)) {
        for (const tab of surface.tabs) {
          if (tab !== null && typeof tab === 'object' && Array.isArray(tab.surfaces)) {
            for (const nested of tab.surfaces) visit(nested as UiSurfaceSource);
          }
        }
      }
      if (
        (surface.role === 'dialog' || surface.role === 'drawer') &&
        Array.isArray(surface.content)
      ) {
        for (const nested of surface.content) visit(nested as UiSurfaceSource);
      }
    };
    for (const region of screen.layout) for (const surface of region.surfaces) visit(surface);
  }
  return Object.freeze({ tables: Object.freeze(tables), views: Object.freeze(views) });
}

/* ------------------------------------------------------------------ */
/* U1 — canonical UI document model (vict.ui-document@1)               */
/* ------------------------------------------------------------------ */

export {
  UI_DOCUMENT_SCHEMA,
  UI_RENDER_PLAN_SCHEMA,
  UI_EDIT_SCHEMA,
  UI_SCENARIO_SCHEMA,
} from './document.js';
export type {
  AssetId,
  ConditionId,
  DefinitionId,
  NodeId,
  SemanticElementCatalog,
  SemanticElementDef,
  StateKey,
  StyleSourceId,
  TokenId,
  UiAssetRef,
  UiAttributeValue,
  UiCatalogs,
  UiComponentDefinition,
  UiCondition,
  UiDocument,
  UiExpression,
  UiFieldTypes,
  UiFieldType,
  UiInteraction,
  UiLocalStateDecl,
  UiNode,
  UiNodeCommon,
  UiOutputBinding,
  UiOutputDecl,
  UiPrimitiveType,
  UiPropDecl,
  UiSlotFill,
  UiStyleDeclaration,
  UiStyleSource,
  UiStyleValue,
  UiTextContent,
  UiToken,
  UiValueType,
  UiVariantConditionRef,
} from './document.js';
export { copyUiValue, isUiValueOfType, isUiValueType, uiValueEmptyFor } from './values.js';
export type { UiValue } from './values.js';
export { CanonicalUiError } from './canonical-error.js';
export {
  canonicalUiDocument,
  compareCodePoints,
  orderUiDocumentIdentityEntries,
  stableJson,
} from './canonical.js';
export type { CanonicalUiDocument, UiDocumentIdentityEntry } from './canonical.js';
export { hasErrors, severityFor, uiDiagnostic } from './diagnostics.js';
export type { UiDiagnostic, UiDiagnosticCode, UiSeverity } from './diagnostics.js';
export { checkExpression, evaluateExpression } from './expressions.js';
export type { ResolvedRefType, UiScopeInfo, UiScopeValues } from './expressions.js';
export {
  allowedAttributes,
  defaultSemanticElementCatalog,
  isKnownElement,
  isLeafElement,
} from './semantic.js';
export { isBoundedMediaQuery, validateUiDocument } from './validate.js';
export { compileUiDocument, isUiComponentPlanDiagnostic } from './compile.js';
export type {
  UiCompileResult,
  UiExtensionDescriptor,
  UiNodeExtractedInteraction,
  UiRenderInstruction,
  UiRenderPlan,
  UiResolvedValue,
  UiSourceMapEntry,
  UiStyleRule,
} from './compile.js';
export {
  applyUiEdit,
  cloneDocument,
  emptyCatalogs,
  expectUiDocument,
  isDeferredProductReference,
} from './edit.js';
export type { UiDocumentSnapshot, UiEditCommand, UiEditResult, UiEditTransaction } from './edit.js';
export { UiEditSession, advanceStoredRevision } from './session.js';
export type { UiApplyOutcome, UiEditSessionState, UiSaveOutcome, UiStagedSave } from './session.js';
export { inspectUiOccurrence, occurrenceKeyOf, parseOccurrenceKey } from './occurrence.js';
export type { UiOccurrenceRef, UiOccurrenceReport, UiRuntimeProjection } from './occurrence.js';
export { isUiScenario } from './scenario.js';
export type {
  ClockPolicy,
  OutcomeSpec,
  ScenarioActor,
  ScenarioImplementation,
  ScenarioOperation,
  ScenarioStateDecl,
  SeedSpec,
  UiScenario,
} from './scenario.js';

export * from './storage.js';
export * from './local-storage-store.js';

export { repeatExpressionFields } from './expressions.js';
