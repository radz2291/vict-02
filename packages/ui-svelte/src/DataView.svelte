<script lang="ts">
  import Feedback from './Feedback.svelte';

  /** A read-only display grid. RecordsTable owns query, search, sort, and paging. */
  interface Props {
    surfaceId?: string;
    columns: readonly string[];
    rows: readonly (readonly string[])[];
    emptyMessage?: string;
  }
  let { surfaceId, columns, rows, emptyMessage = 'Nothing here yet.' }: Props = $props();
</script>

{#if rows.length === 0}
  <Feedback kind="empty" message={emptyMessage} {surfaceId} />
{:else}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex --><!-- Keyboard users need focus to scroll a wide read-only table. -->
  <div class="vict-data-view" data-surface={surfaceId} role="region" aria-label="Data table" tabindex="0">
    <table>
      <thead><tr>{#each columns as column (column)}<th scope="col">{column}</th>{/each}</tr></thead>
      <tbody>
        {#each rows as row, index (index)}
          <tr>{#each row as value, cell (cell)}<td>{value}</td>{/each}</tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
