<script lang="ts">
  import Popover from './Popover.svelte';
  import Tooltip from './Tooltip.svelte';
  import type { UiTableIntent, UiTableState } from '@victframework/ui';

  interface Props {
    intent: UiTableIntent;
    rows: readonly Readonly<Record<string, unknown>>[];
    state: UiTableState;
    onSearch: (value: string) => void | Promise<void>;
    onFilter: (field: string, value: string) => void | Promise<void>;
    onSort: (field: string) => void | Promise<void>;
    onPage: (page: number) => void | Promise<void>;
  }
  let { intent, rows, state: tableState, onSearch, onFilter, onSort, onPage }: Props = $props();
  let compact = $state(false);
</script>

<section class="vict-ui-table" class:vict-ui-table--compact={compact} data-surface={intent.surfaceId} aria-label={intent.title}>
  <div class="vict-ui-table__heading">
    <h2>{intent.title}</h2>
    <span class="vict-ui-table__count" aria-live="polite">{tableState.total} {tableState.total === 1 ? 'record' : 'records'}</span>
  </div>
  <div class="vict-ui-table__toolbar">
    <label class="vict-ui-table__field">
      <span>{intent.search.label}</span>
      <input
        type="search"
        data-testid="table-search"
        aria-label={intent.search.label}
        value={tableState.search}
        oninput={(event) => void onSearch(event.currentTarget.value)}
      />
    </label>
    {#each intent.filters as filter (filter.field)}
      <label class="vict-ui-table__field">
        <span>{filter.label}</span>
        <input
          type="text"
          data-testid="table-filter-{filter.field}"
          aria-label={filter.label}
          value={tableState.filters[filter.field] ?? ''}
          oninput={(event) => void onFilter(filter.field, event.currentTarget.value)}
        />
      </label>
    {/each}
    <div class="vict-table-tools">
      <Tooltip label="Search help" text="Search across the configured fields. Sorting and paging keep your search." />
      <Popover label="View options">
        <p class="vict-popover-title">Display</p>
        <label class="vict-check-row"><input type="checkbox" class="vict-checkbox" bind:checked={compact} />Compact rows</label>
      </Popover>
    </div>
    {#if tableState.pending}
      <span class="vict-ui-table__loading" role="status" data-testid="table-loading">Loading…</span>
    {/if}
  </div>

  {#if tableState.total === 0}
    <p class="vict-ui-table__empty" data-state="empty" data-testid="table-empty">{intent.emptyMessage}</p>
  {:else}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <!-- A scrollable table region must be keyboard-operable (axe:
         scrollable-region-focusable); role=region + aria-label make the
         focus stop meaningful, and keyboard scrolling is handled in
         code. The Svelte rule does not model this pattern. -->
    <div class="vict-ui-table__scroll" role="region" aria-label="Records table" tabindex="0">
      <table data-testid="records-table">
        <thead>
          <tr>
            {#each intent.columns as column (column.field)}
              <th scope="col" aria-sort={tableState.sortField === column.field ? (tableState.sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}>
                {#if column.sortable}
                  <button type="button" class="vict-ui-table__sort" data-sort-field={column.field} onclick={() => void onSort(column.field)}>
                    {column.label}
                    {#if tableState.sortField === column.field}<span aria-hidden="true">{tableState.sortDirection === 'asc' ? '▲' : '▼'}</span>{/if}
                  </button>
                {:else}
                  {column.label}
                {/if}
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each rows as row, index (index)}
            <tr data-testid="table-row">
              {#each intent.columns as column (column.field)}
                <td>{String(row[column.field] ?? '')}</td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <nav class="vict-ui-table__pagination" aria-label="Table pagination">
      <button type="button" data-testid="table-prev" disabled={tableState.page === 0} onclick={() => void onPage(tableState.page - 1)}>Previous</button>
      <span class="vict-ui-table__page-status" aria-live="polite" data-testid="table-page-indicator">Page {tableState.page + 1} of {tableState.pageCount} ({tableState.total} {tableState.total === 1 ? 'record' : 'records'})</span>
      <button type="button" data-testid="table-next" disabled={tableState.page >= tableState.pageCount - 1} onclick={() => void onPage(tableState.page + 1)}>Next</button>
    </nav>
  {/if}
</section>
