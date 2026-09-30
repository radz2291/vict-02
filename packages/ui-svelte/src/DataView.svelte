<script lang="ts">
  import Feedback from './Feedback.svelte';

  /**
   * A read-only display grid. RecordsTable owns query, search, sort, and paging.
   * FT-1: when the surface's definition declares a row→detail navigation
   * binding, the host passes `rowLink`; each then resolvable row renders a
   * GENUINE navigation link in a trailing column. Without the binding and
   * without `rowLink`, rendering is byte-identical to the pre-FT-1 grid.
   */
  interface Props {
    surfaceId?: string;
    columns: readonly string[];
    rows: readonly (readonly string[])[];
    emptyMessage?: string;
    rowLink?: (
      row: Readonly<Record<string, unknown>>,
    ) => { href: string; label: string } | undefined;
    rowLinkHeading?: string;
    /** Host navigation (FT-1): SPA click interception; absent ⇒ native href. */
    navigate?: (path: string) => void;
    /** Raw view rows backing `rows` (FT-1 row-field resolution). */
    viewRows?: readonly Record<string, unknown>[];
  }
  let {
    surfaceId,
    columns,
    rows,
    emptyMessage = 'Nothing here yet.',
    rowLink,
    rowLinkHeading,
    navigate,
    viewRows,
  }: Props = $props();

  /** Click interception (shared FT-1 pattern): SPA navigation when hosted. */
  function onRowLinkClick(event: MouseEvent, href: string, navigate?: (path: string) => void): void {
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return; // modified clicks (new tab/window) keep the native behavior
    }
    if (navigate === undefined) return;
    event.preventDefault();
    navigate(href);
  }
</script>

{#if rows.length === 0}
  <Feedback kind="empty" message={emptyMessage} {surfaceId} />
{:else}
  {#if rowLink !== undefined}
    {@const viewRow = (index: number): Record<string, unknown> => viewRows?.[index] ?? {}}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex --><!-- Keyboard users need focus to scroll a wide read-only table. -->
    <div class="vict-data-view vict-data-view--nav" data-surface={surfaceId} role="region" aria-label="Data table" tabindex="0">
      <table>
        <thead><tr>{#each columns as column (column)}<th scope="col">{column}</th>{/each}<th scope="col" class="vict-data-view__row-link-heading">{rowLinkHeading ?? 'Open'}</th></tr></thead>
        <tbody>
          {#each rows as row, index (index)}
            {@const link = rowLink(viewRow(index))}
            <tr>
              {#each row as value, cell (cell)}<td>{value}</td>{/each}
              <td class="vict-data-view__row-link-cell">
                {#if link !== undefined}
                  <a
                    href={link.href}
                    class="vict-data-view__row-link"
                    data-testid="view-row-link"
                    aria-label={link.label}
                    onclick={(event) => onRowLinkClick(event, link.href, navigate)}
                  >{rowLinkHeading ?? 'Open'}</a>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
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
{/if}