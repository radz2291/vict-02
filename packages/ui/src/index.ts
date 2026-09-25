/**
 * UI Plan is a disposable projection of compiled application truth. It is
 * rebuilt when the Application Plan changes and is never serialized, edited,
 * or used to authorize an operation.
 */
export interface UiPlanSource {
  readonly screens: Readonly<
    Record<
      string,
      | {
          readonly title?: string;
          readonly layout: readonly {
            readonly surfaces: readonly {
              readonly role: string;
              readonly id: string;
              readonly [key: string]: unknown;
            }[];
          }[];
        }
      | undefined
    >
  >;
}

export interface UiTableIntent {
  readonly title: string;
  readonly columns: readonly { readonly field: string; readonly label: string }[];
  readonly searchLabel: string;
  readonly filters: readonly { readonly field: string; readonly label: string }[];
  readonly emptyMessage: string;
}

export interface UiPlan {
  readonly tables: Readonly<Record<string, UiTableIntent>>;
}

/** Derive display intent only: no dispatcher, route, query or permission state. */
export function deriveUiPlan(plan: UiPlanSource): UiPlan {
  const tables: Record<string, UiTableIntent> = Object.create(null);
  for (const screen of Object.values(plan.screens)) {
    if (screen === undefined) continue;
    for (const region of screen.layout) {
      for (const surface of region.surfaces) {
        if (surface.role !== 'table') continue;
        const declaredColumns = Array.isArray(surface.columns) ? surface.columns : [];
        const columns = declaredColumns
          .filter(
            (value): value is { field: string; label?: string } =>
              value !== null && typeof value === 'object' && typeof value.field === 'string',
          )
          .map((column) =>
            Object.freeze({
              field: column.field,
              label: typeof column.label === 'string' ? column.label : column.field,
            }),
          );
        const filterFields = Array.isArray(surface.filterFields) ? surface.filterFields : [];
        tables[surface.id] = Object.freeze({
          title: screenTitle(screen),
          columns: Object.freeze(columns),
          searchLabel: 'Search records',
          filters: Object.freeze(
            filterFields
              .filter((field): field is string => typeof field === 'string')
              .map((field) => Object.freeze({ field, label: `Filter by ${field}` })),
          ),
          emptyMessage:
            typeof surface.emptyMessage === 'string' ? surface.emptyMessage : 'No records found.',
        });
      }
    }
  }
  return Object.freeze({ tables: Object.freeze(tables) });
}

function screenTitle(screen: { readonly title?: string }): string {
  return typeof screen.title === 'string' ? screen.title : 'Records';
}
