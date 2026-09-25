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
  }[];
  readonly search: { readonly label: string; readonly fields: readonly string[] };
  readonly filters: readonly { readonly field: string; readonly label: string }[];
  readonly pageSize: number;
  readonly emptyMessage: string;
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
            (value): value is { field: string; label?: string; sortable?: boolean } =>
              value !== null && typeof value === 'object' && typeof value.field === 'string',
          )
          .map((column) =>
            Object.freeze({
              field: column.field,
              label: typeof column.label === 'string' ? column.label : column.field,
              sortable: column.sortable !== false,
            }),
          );
        const searchFields =
          Array.isArray(surface.searchFields) && surface.searchFields.length > 0
            ? surface.searchFields.filter((field): field is string => typeof field === 'string')
            : columns.slice(0, 1).map((column) => column.field);
        const filterFields = Array.isArray(surface.filterFields) ? surface.filterFields : [];
        tables[surface.id] = Object.freeze({
          surfaceId: surface.id,
          // A table is a surface within a titled page. Repeating the page
          // title in its card produces adjacent identical headings.
          title: 'Records',
          columns: Object.freeze(columns),
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
