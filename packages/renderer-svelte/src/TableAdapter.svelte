<script lang="ts">
  /** Transitional owner of query dispatch and local table behavior. */
  import type { UiTableIntent, UiTableState } from '@victframework/ui';
  import { RecordsTable } from '@victframework/ui-svelte';
  import type { ActionResult, PlanSurface } from './logic.js';

  interface Props {
    surface: PlanSurface;
    intent: UiTableIntent;
    initialRows: readonly Record<string, unknown>[];
    dispatch: (actionId: string, input?: unknown) => Promise<ActionResult>;
  }
  let { surface, intent, initialRows, dispatch }: Props = $props();

  interface QueryPayload {
    filters?: Record<string, string>;
    search?: { text: string; fields: readonly string[] };
    sort?: readonly { field: string; direction: 'asc' | 'desc' }[];
    limit: number;
    offset: number;
  }

  const hasQueryAction = $derived(typeof surface.queryActionId === 'string' && surface.queryActionId.length > 0);
  let search = $state('');
  let filterValues = $state<Record<string, string>>({});
  let sortField = $state<string | null>(null);
  let sortDir = $state<'asc' | 'desc'>('asc');
  let page = $state(0);
  let queryRows = $state<readonly Record<string, unknown>[]>([]);
  let queryTotal = $state<number | null>(null);
  let pending = $state(false);

  // The host's route-data refresh resets transient controls, as before.
  $effect(() => {
    void initialRows;
    queryRows = hasQueryAction ? initialRows.slice(0, intent.pageSize) : initialRows;
    queryTotal = initialRows.length;
    page = 0;
    search = '';
    filterValues = {};
    sortField = null;
    sortDir = 'asc';
  });

  const displayRows = $derived.by(() => {
    if (hasQueryAction) return queryRows;
    let rows = [...initialRows];
    if (search.trim() !== '') {
      const needle = search.trim().toLowerCase();
      rows = rows.filter((row) =>
        intent.search.fields.some((field) => String(row[field] ?? '').toLowerCase().includes(needle)),
      );
    }
    for (const [field, value] of Object.entries(filterValues)) {
      if (value !== '') rows = rows.filter((row) => row[field] === value);
    }
    if (sortField !== null) {
      rows.sort((a, b) => {
        const av = a[sortField as string];
        const bv = b[sortField as string];
        const cmp = typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av ?? '') < String(bv ?? '') ? -1 : String(av ?? '') > String(bv ?? '') ? 1 : 0;
        return sortDir === 'desc' ? -cmp : cmp;
      });
    }
    return rows;
  });
  const total = $derived(hasQueryAction ? (queryTotal ?? 0) : displayRows.length);
  const pageCount = $derived(Math.max(1, Math.ceil(total / intent.pageSize)));
  const rows = $derived(hasQueryAction ? displayRows : displayRows.slice(page * intent.pageSize, (page + 1) * intent.pageSize));
  const state: UiTableState = $derived({
    search,
    filters: filterValues,
    sortField,
    sortDirection: sortDir,
    page,
    pageCount,
    total,
    pending,
  });

  async function runQuery(nextPage: number, nextSortField: string | null, nextSortDir: 'asc' | 'desc'): Promise<void> {
    if (!hasQueryAction) return;
    const payload: QueryPayload = { limit: intent.pageSize, offset: nextPage * intent.pageSize };
    const activeFilters: Record<string, string> = {};
    for (const [field, value] of Object.entries(filterValues)) if (value !== '') activeFilters[field] = value;
    if (Object.keys(activeFilters).length > 0) payload.filters = activeFilters;
    if (search.trim() !== '') payload.search = { text: search.trim(), fields: intent.search.fields };
    if (nextSortField !== null) payload.sort = [{ field: nextSortField, direction: nextSortDir }];
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

  async function onSearch(value: string): Promise<void> {
    search = value;
    page = 0;
    await runQuery(0, sortField, sortDir);
  }
  async function onFilter(field: string, value: string): Promise<void> {
    filterValues = { ...filterValues, [field]: value };
    page = 0;
    await runQuery(0, sortField, sortDir);
  }
  async function onSort(field: string): Promise<void> {
    const nextDir: 'asc' | 'desc' = sortField === field && sortDir === 'asc' ? 'desc' : 'asc';
    sortField = field;
    sortDir = nextDir;
    page = 0;
    await runQuery(0, field, nextDir);
  }
  async function onPage(nextPage: number): Promise<void> {
    page = Math.min(Math.max(0, nextPage), pageCount - 1);
    await runQuery(page, sortField, sortDir);
  }
</script>

<RecordsTable {intent} {rows} {state} {onSearch} {onFilter} {onSort} {onPage} />
