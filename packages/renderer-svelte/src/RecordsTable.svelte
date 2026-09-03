<script lang="ts">
  /**
   * The `table` role: searchable, sortable, paginated records table.
   *
   * When the surface declares a `queryActionId`, search/sort/page changes
   * dispatch that DECLARED query action through the dispatcher (the typed
   * data boundary below the UI re-authorizes every read). Without a query
   * action the table paginates/sorts the already-loaded rows locally
   * (presentation-only interactions stay local — APP-011).
   */
  import type { VictPlanView, PlanSurface, ActionResult } from './logic.js';
  
  interface Props {
    surface: PlanSurface;
    plan: VictPlanView;
    initialRows: readonly Record<string, unknown>[];
    dispatch: (actionId: string, input?: unknown) => Promise<ActionResult>;
    onInvalidate?: () => void;
  }

  let { surface, plan, initialRows, dispatch, onInvalidate }: Props = $props();

  interface QueryPayload {
    readonly filters?: Record<string, string>;
    readonly search?: { readonly text: string; readonly fields: readonly string[] };
    readonly search?: { readonly text: string; readonly fields: readonly string[] };
    readonly sort?: readonly { readonly field: string; readonly direction: 'asc' | 'desc' }[];
    readonly limit?: number;
    readonly offset?: number;
  }

  const pageSize = $derived(
    typeof surface.pageSize === 'number' && Number.isSafeInteger(surface.pageSize) && surface.pageSize > 0
      ? surface.pageSize
      : 10,
  );
  const viewId = $derived(String(surface.viewId));
  const view = $derived(plan.views?.[viewId] as { fields?: readonly string[] } | undefined);
  const columns = $derived.by(() => {
    if (Array.isArray(surface.columns) && surface.columns.length > 0) {
      return surface.columns as readonly { field: string; label?: string; sortable?: boolean }[];
    }
    return (view?.fields ?? []).map((field) => ({ field }));
  });
  const searchFields = $derived(
    Array.isArray(surface.searchFields) && surface.searchFields.length > 0
      ? (surface.searchFields as readonly string[])
      : columns.slice(0, 1).map((column) => column.field),
  );
  const filterFields = $derived(
    Array.isArray(surface.filterFields) ? (surface.filterFields as readonly string[]) : [],
  );
  const hasQueryAction = $derived(
    typeof surface.queryActionId === 'string' && surface.queryActionId.length > 0,
  );

  let search = $state('');
  let filterValues = $state<Record<string, string>>({});
  let sortField = $state<string | null>(null);
  let sortDir = $state<'asc' | 'desc'>('asc');
  let page = $state(0);
  let queryRows = $state<readonly Record<string, unknown>[]>([]);
  let queryTotal = $state<number | null>(null);
  let pending = $state(false);

  // Route-data changes (path/plan/load refreshes) resync the local state —
  // never stale rows.
  $effect(() => {
    void initialRows;
    queryRows = hasQueryAction ? initialRows.slice(0, pageSize) : initialRows;
    queryTotal = initialRows.length;
    page = 0;
    search = '';
    filterValues = {};
    sortField = null;
    sortDir = 'asc';
  });

  const displayRows = $derived.by(() => {
    if (hasQueryAction) {
      return queryRows;
    }
    let rows = [...initialRows];
    if (search.trim() !== '') {
      const needle = search.trim().toLowerCase();
      rows = rows.filter((row) =>
        searchFields.some((field) => String(row[field] ?? '').toLowerCase().includes(needle)),
      );
    }
    for (const [field, value] of Object.entries(filterValues)) {
      if (value !== '') {
        rows = rows.filter((row) => row[field] === value);
      }
    }
    if (sortField !== null) {
      rows.sort((a, b) => {
        const av = a[sortField as string];
        const bv = b[sortField as string];
        const cmp =
          typeof av === 'number' && typeof bv === 'number'
            ? av - bv
            : String(av ?? '') < String(bv ?? '')
              ? -1
              : String(av ?? '') > String(bv ?? '')
                ? 1
                : 0;
        return sortDir === 'desc' ? -cmp : cmp;
      });
    }
    return rows;
  });
  const displayTotal = $derived(hasQueryAction ? (queryTotal ?? 0) : displayRows.length);
  const pageCount = $derived(Math.max(1, Math.ceil(displayTotal / pageSize)));
  const pageRows = $derived(
    hasQueryAction ? displayRows : displayRows.slice(page * pageSize, (page + 1) * pageSize),
  );

  async function runQuery(nextPage: number, nextSortField: string | null, nextSortDir: 'asc' | 'desc'): Promise<void> {
    if (!hasQueryAction) {
      return;
    }
    const payload: QueryPayload = {
      limit: pageSize,
      offset: nextPage * pageSize,
    };
    const activeFilters: Record<string, string> = {};
    for (const [field, value] of Object.entries(filterValues)) {
      if (value !== '') {
        activeFilters[field] = value;
      }
    }
    if (Object.keys(activeFilters).length > 0) {
      payload.filters = activeFilters;
    }
    if (search.trim() !== '') {
      payload.search = { text: search.trim(), fields: searchFields };
    }
    if (nextSortField !== null) {
      payload.sort = [{ field: nextSortField, direction: nextSortDir }];
    }
    pending = true;
    try {
      const result = await dispatch(String(surface.queryActionId), payload);
      if (result.ok && Array.isArray((result.value as { rows?: unknown }).rows)) {
        queryRows = (result.value as { rows: Record<string, unknown>[] }).rows;
        queryTotal = (result.value as { total?: number }).total ?? queryRows.length;
      }
    } finally {
      pending = false;
    }
  }

  async function onSearchInput(event: Event): Promise<void> {
    search = (event.currentTarget as HTMLInputElement).value;
    page = 0;
    await runQuery(0, sortField, sortDir);
  }

  async function onFilterInput(field: string, event: Event): Promise<void> {
    const value = (event.currentTarget as HTMLInputElement).value;
    filterValues = { ...filterValues, [field]: value };
    page = 0;
    await runQuery(0, sortField, sortDir);
  }

  async function onSortClick(field: string): Promise<void> {
    const nextDir: 'asc' | 'desc' =
      sortField === field && sortDir === 'asc' ? 'desc' : 'asc';
    sortField = field;
    sortDir = nextDir;
    page = 0;
    await runQuery(0, field, nextDir);
  }

  async function goToPage(nextPage: number): Promise<void> {
    page = Math.min(Math.max(0, nextPage), pageCount - 1);
    await runQuery(page, sortField, sortDir);
  }
</script>

<div class="vict-records-table" data-surface={surface.id}>
  <div class="vict-table-toolbar">
    <label class="vict-search-label">
      <span class="vict-field-label">Search</span>
      <input
        class="vict-input"
        type="search"
        data-testid="table-search"
        aria-label="Search records"
        value={search}
        oninput={(event) => void onSearchInput(event)}
      />
    </label>
    {#each filterFields as filterField (filterField)}
      <label class="vict-search-label">
        <span class="vict-field-label">Filter: {filterField}</span>
        <input
          class="vict-input"
          type="text"
          data-testid="table-filter-{filterField}"
          aria-label="Filter by {filterField}"
          value={filterValues[filterField] ?? ''}
          oninput={(event) => void onFilterInput(filterField, event)}
        />
      </label>
    {/each}
    {#if pending}
      <span class="vict-state" role="status" data-testid="table-loading">Loading…</span>
    {/if}
  </div>

  {#if displayTotal === 0}
    <p class="vict-state" data-state="empty" data-testid="table-empty">
      {typeof surface.emptyMessage === 'string' ? surface.emptyMessage : 'No records found.'}
    </p>
  {:else}
    <div class="vict-table-wrap" role="region" aria-label="Records table">
      <table class="vict-table" data-testid="records-table">
        <thead>
          <tr>
            {#each columns as column (column.field)}
              <th
                scope="col"
                aria-sort={sortField === column.field ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
              >
                {#if column.sortable !== false}
                  <button
                    type="button"
                    class="vict-table-sort"
                    data-sort-field={column.field}
                    onclick={() => void onSortClick(column.field)}
                  >
                    {column.label ?? column.field}
                    {sortField === column.field ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </button>
                {:else}
                  {column.label ?? column.field}
                {/if}
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each pageRows as row, index (index)}
            <tr data-testid="table-row">
              {#each columns as column (column.field)}
                <td>{String(row[column.field] ?? '')}</td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <nav class="vict-pagination" aria-label="Table pagination">
      <button
        type="button"
        class="vict-btn vict-btn--secondary"
        data-testid="table-prev"
        disabled={page === 0}
        onclick={() => void goToPage(page - 1)}
      >
        Previous
      </button>
      <span aria-live="polite" data-testid="table-page-indicator">Page {page + 1} of {pageCount} ({displayTotal} records)</span>
      <button
        type="button"
        class="vict-btn vict-btn--secondary"
        data-testid="table-next"
        disabled={page >= pageCount - 1}
        onclick={() => void goToPage(page + 1)}
      >
        Next
      </button>
    </nav>
  {/if}
</div>

<style>
  .vict-table-toolbar {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: calc(var(--vict-spacing-unit) * 2);
    margin-bottom: calc(var(--vict-spacing-unit) * 2);
    flex-wrap: wrap;
  }

  .vict-search-label {
    display: flex;
    flex-direction: column;
    gap: calc(var(--vict-spacing-unit) * 0.5);
    min-width: 16rem;
  }

  .vict-table-wrap {
    overflow-x: auto;
  }

  .vict-pagination {
    display: flex;
    align-items: center;
    gap: calc(var(--vict-spacing-unit) * 2);
    margin-top: calc(var(--vict-spacing-unit) * 2);
    flex-wrap: wrap;
  }
</style>
