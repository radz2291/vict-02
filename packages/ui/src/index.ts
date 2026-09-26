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
  readonly search: { readonly label: string; readonly fields: readonly string[] };
  readonly filters: readonly { readonly field: string; readonly label: string }[];
  readonly pageSize: number;
  readonly emptyMessage: string;
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
  for (const screen of Object.values(plan.screens)) {
    if (screen === undefined) continue;
    const visit = (surface: UiSurfaceSource): void => {
      if (surface.role === 'table') {
        const declaredColumns = Array.isArray(surface.columns) ? surface.columns : [];
        const view = plan.views?.[String(surface.viewId)] as
          { fields?: readonly string[] } | undefined;
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
        tables[surface.id] = Object.freeze({
          surfaceId: surface.id,
          // A table is a surface within a titled page. Repeating the page
          // title in its card produces adjacent identical headings.
          title: 'Records',
          columns: Object.freeze(columns),
          ...(rowAction !== undefined ? { rowAction } : {}),
          search: Object.freeze({ label: 'Search records', fields: Object.freeze(searchFields) }),
          filters: Object.freeze(
            filterFields
              .filter((field): field is string => typeof field === 'string')
              .map((field) => Object.freeze({ field, label: `Filter by ${field}` })),
          ),
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
  return Object.freeze({ tables: Object.freeze(tables) });
}
