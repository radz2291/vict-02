<script lang="ts">
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
  let { intent, rows, state, onSearch, onFilter, onSort, onPage }: Props = $props();
</script>

<section class="vict-ui-table" data-surface={intent.surfaceId} aria-label={intent.title}>
  <div class="vict-ui-table__heading">
    <h2>{intent.title}</h2>
    <span class="vict-ui-table__count" aria-live="polite">{state.total} {state.total === 1 ? 'record' : 'records'}</span>
  </div>
  <div class="vict-ui-table__toolbar">
    <label class="vict-ui-table__field">
      <span>{intent.search.label}</span>
      <input
        type="search"
        data-testid="table-search"
        aria-label={intent.search.label}
        value={state.search}
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
          value={state.filters[filter.field] ?? ''}
          oninput={(event) => void onFilter(filter.field, event.currentTarget.value)}
        />
      </label>
    {/each}
    {#if state.pending}
      <span class="vict-ui-table__loading" role="status" data-testid="table-loading">Loading…</span>
    {/if}
  </div>

  {#if state.total === 0}
    <p class="vict-ui-table__empty" data-state="empty" data-testid="table-empty">{intent.emptyMessage}</p>
  {:else}
    <div class="vict-ui-table__scroll" role="region" aria-label="Records table">
      <table data-testid="records-table">
        <thead>
          <tr>
            {#each intent.columns as column (column.field)}
              <th scope="col" aria-sort={state.sortField === column.field ? (state.sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}>
                {#if column.sortable}
                  <button type="button" class="vict-ui-table__sort" data-sort-field={column.field} onclick={() => void onSort(column.field)}>
                    {column.label}
                    {#if state.sortField === column.field}<span aria-hidden="true">{state.sortDirection === 'asc' ? '▲' : '▼'}</span>{/if}
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
      <button type="button" data-testid="table-prev" disabled={state.page === 0} onclick={() => void onPage(state.page - 1)}>Previous</button>
      <span class="vict-ui-table__page-status" aria-live="polite" data-testid="table-page-indicator">Page {state.page + 1} of {state.pageCount} ({state.total} {state.total === 1 ? 'record' : 'records'})</span>
      <button type="button" data-testid="table-next" disabled={state.page >= state.pageCount - 1} onclick={() => void onPage(state.page + 1)}>Next</button>
    </nav>
  {/if}
</section>
